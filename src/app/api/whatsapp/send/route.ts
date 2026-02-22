// src\app\api\whatsapp\send\route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabaseAdmin";
import { appendRawMessageToSheet } from "@/src/services/sheets/appendRawMessage";
import { sendWhatsappMessage } from "@/src/services/whatsapp/sendWhatsappMessage";
import crypto from "crypto";

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

    // 1) Ensure conversation exists
    const { data: conv, error: convErr } = await supabaseAdmin
      .from("wa_conversations")
      .upsert(
        {
          wa_id: waId,
          source: "unknown",
          last_message_at: new Date().toISOString(),
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

    const waMessageId =
      waSendRes?.messages?.[0]?.id || `out_${crypto.randomUUID()}`;

    const occurredAt = new Date().toISOString();

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

    // 4) Store outbound in Google Sheets (best-effort)
    try {
      await appendRawMessageToSheet({
        message_id: waMessageId,
        conversation_id: conv.id,
        wa_id: waId,
        timestamp_utc: occurredAt,
        direction: "outbound",
        message_body: text,
      });
    } catch (err) {
      console.error("❌ Sheets append failed (outbound):", err);
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