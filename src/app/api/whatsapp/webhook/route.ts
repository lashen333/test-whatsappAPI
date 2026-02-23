// src\app\api\whatsapp\webhook\route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabaseAdmin";

import { appendRawMessageToSheet } from "@/src/services/sheets/appendRawMessage";
import { appendRawConversationToSheet } from "@/src/services/sheets/appendRawConversation";
import { appendRawUserToSheet } from "@/src/services/sheets/appendRawUser";
import { updateConversationMetrics } from "@/src/services/conversations/updateConversationMetrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toIsoFromUnixSeconds(ts?: string | number | null) {
  if (!ts) return new Date().toISOString();
  const n = typeof ts === "string" ? Number(ts) : ts;
  if (!Number.isFinite(n)) return new Date().toISOString();
  return new Date(n * 1000).toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];

    // If there is no message in payload, still return 200
    if (!msg) return NextResponse.json({ ok: true, note: "no message" }, { status: 200 });

    // WhatsApp fields
    const waId = String(msg.from || ""); // user wa_id
    const waMessageId = String(msg.id || "");
    const msgType = String(msg.type || "text");
    const textBody = msg?.text?.body ?? null;
    const occurredAt = toIsoFromUnixSeconds(msg.timestamp);

    if (!waId || !waMessageId) {
      return NextResponse.json({ ok: true, note: "missing waId/messageId" }, { status: 200 });
    }

    // ---- 1) conversation upsert (per wa_id)
    const { data: conv, error: convErr } = await supabaseAdmin
      .from("wa_conversations")
      .upsert(
        {
          wa_id: waId,
          source: "unknown",
          last_message_at: occurredAt,
        },
        { onConflict: "wa_id" }
      )
      .select("id")
      .single();

    if (convErr || !conv?.id) {
      console.error("❌ convErr:", convErr, conv);
      return NextResponse.json({ ok: false, where: "conv" }, { status: 200 });
    }

    // ---- 2) insert message (inbound)
    const { data: inserted, error: msgErr } = await supabaseAdmin
      .from("wa_messages")
      .insert({
        conversation_id: conv.id,
        wa_message_id: waMessageId,
        direction: "inbound", // ✅ normalized
        msg_type: msgType,
        text_body: textBody,
        payload: msg,
        // if your table has created_at default, you don't need to set it
      })
      .select("id")
      .single();

    if (msgErr) {
      console.error("❌ msgErr:", msgErr);
      return NextResponse.json({ ok: false, where: "msg" }, { status: 200 });
    }

    console.log("✅ inserted message id:", inserted?.id);

    // ---- 2.5) update conversation metrics (DB) + append RAW_CONVERSATIONS + RAW_USERS (best effort)
    try {
      const updatedConv = await updateConversationMetrics({
        conversationId: conv.id,
        direction: "inbound",
        occurredAtIso: occurredAt,
      });

      try {
        await appendRawConversationToSheet({
          conversation_id: updatedConv.id,
          wa_id: updatedConv.wa_id,
          source: updatedConv.source ?? "unknown",
          first_inbound_at: updatedConv.first_inbound_at,
          first_outbound_at: updatedConv.first_outbound_at,
          first_response_seconds: updatedConv.first_response_seconds,
          last_message_at: updatedConv.last_message_at,
          last_direction: updatedConv.last_direction,
        });
      } catch (e) {
        console.error("❌ Sheets RAW_CONVERSATIONS append failed:", e);
      }

      try {
        await appendRawUserToSheet({
          wa_id: updatedConv.wa_id,
          first_seen_at: updatedConv.first_inbound_at ?? updatedConv.first_message_at ?? null,
          last_seen_at: updatedConv.last_message_at ?? null,
          conversations_count: null, // we’ll compute later cleanly
          last_conversation_id: updatedConv.id,
          last_message_at: updatedConv.last_message_at ?? null,
          notes: "",
        });
      } catch (e) {
        console.error("❌ Sheets RAW_USERS append failed:", e);
      }
    } catch (e) {
      // If metrics update fails, do not break webhook
      console.error("❌ updateConversationMetrics failed:", e);
    }

    // ---- 3) append to Google Sheets RAW_MESSAGES (best effort)
    try {
      await appendRawMessageToSheet({
        message_id: waMessageId,
        conversation_id: conv.id,
        wa_id: waId,
        timestamp_utc: occurredAt,
        direction: "inbound",
        msg_type: msgType,
        message_body: textBody ?? "",
      });
      console.log("✅ appended to Google Sheets RAW_MESSAGES:", waMessageId);
    } catch (err) {
      console.error("❌ Sheets RAW_MESSAGES append failed:", err);
      // do NOT fail webhook
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("❌ webhook error:", e);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}