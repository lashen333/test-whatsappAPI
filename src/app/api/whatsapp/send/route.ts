// src\app\api\whatsapp\send\route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabaseAdmin";
import { appendRawMessageToSheet } from "@/src/services/sheets/appendRawMessage";
import { sendWhatsappMessage } from "@/src/services/whatsapp/sendWhatsappMessage";
import crypto from "crypto";

import { appendRawConversationToSheet } from "@/src/services/sheets/appendRawConversation";
import { appendRawUserToSheet } from "@/src/services/sheets/appendRawUser";
import { updateConversationMetrics } from "@/src/services/conversations/updateConversationMetrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const waId = String(body.wa_id || "");
    const text = String(body.text || "");

    if (!waId || !text) {
      return NextResponse.json({ ok: false, error: "wa_id and text required" }, { status: 400 });
    }

    const occurredAt = new Date().toISOString();

    // 1) Ensure conversation exists
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
      console.error("❌ convErr:", convErr);
      return NextResponse.json({ ok: false, error: "conversation upsert failed" }, { status: 500 });
    }

    // 2) Send via WhatsApp Cloud API
    const waSendRes = await sendWhatsappMessage({ toWaId: waId, text });

    const waMessageId = waSendRes?.messages?.[0]?.id || `out_${crypto.randomUUID()}`;

    // 3) Store outbound in Supabase
    const { data: inserted, error: msgErr } = await supabaseAdmin
      .from("wa_messages")
      .insert({
        conversation_id: conv.id,
        wa_message_id: waMessageId,
        direction: "outbound",
        msg_type: "text",
        text_body: text,
        payload: waSendRes,
      })
      .select("id")
      .single();

    if (msgErr) {
      console.error("❌ msgErr:", msgErr);
      // Do not fail the send; WhatsApp already sent message
    }

    // 3.5) update conversation metrics + append RAW_CONVERSATIONS + RAW_USERS (best effort)
    try {
      const updatedConv = await updateConversationMetrics({
        conversationId: conv.id,
        direction: "outbound",
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
        console.error("❌ Sheets RAW_CONVERSATIONS append failed (outbound):", e);
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
        console.error("❌ Sheets RAW_USERS append failed (outbound):", e);
      }
    } catch (e) {
      console.error("❌ updateConversationMetrics failed (outbound):", e);
    }

    // 4) Store outbound in Google Sheets RAW_MESSAGES (best-effort)
    try {
      await appendRawMessageToSheet({
        message_id: waMessageId,
        conversation_id: conv.id,
        wa_id: waId,
        timestamp_utc: occurredAt,
        direction: "outbound",
        msg_type: "text",
        message_body: text,
      });
    } catch (err) {
      console.error("❌ Sheets RAW_MESSAGES append failed (outbound):", err);
    }

    return NextResponse.json(
      { ok: true, wa: waSendRes, message_row_id: inserted?.id ?? null },
      { status: 200 }
    );
  } catch (e) {
    console.error("❌ send route error:", e);
    return NextResponse.json({ ok: false, error: "server error" }, { status: 500 });
  }
}