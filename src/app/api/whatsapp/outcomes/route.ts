// src\app\api\whatsapp\outcomes\route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/src/lib/supabaseAdmin";
import { mapOutcomeToMetaEvent, sendMetaCapiEvent } from "@/src/services/metaCapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OutcomeType = "lead" | "booked" | "purchase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const conversationId = String(body.conversation_id || "");
    const outcome = String(body.outcome || "") as OutcomeType;
    const value = body.value ?? null;
    const currency = body.currency ?? null;

    if (!conversationId || !["lead", "booked", "purchase"].includes(outcome)) {
      return NextResponse.json(
        { ok: false, error: "Invalid conversation_id or outcome" },
        { status: 400 }
      );
    }

    // 1) Save outcome first (never lose business data)
    const { data: row, error } = await supabaseAdmin
      .from("wa_outcomes")
      .insert({
        conversation_id: conversationId,
        outcome,
        value,
        currency,
      })
      .select("*")
      .single();

    if (error || !row) {
      console.error("❌ outcome insert error:", error);
      return NextResponse.json(
        { ok: false, error: "DB insert failed" },
        { status: 500 }
      );
    }

    // 2) Load conversation for matching info (phone/wa_id)
    const { data: conv, error: convErr } = await supabaseAdmin
      .from("wa_conversations")
      .select("wa_id, phone_e164")
      .eq("id", conversationId)
      .single();

    if (convErr || !conv) {
      console.error("❌ conv load error:", convErr);
      // Outcome saved; CAPI can be retried later
      return NextResponse.json(
        { ok: true, outcome: row, capi: "skipped_conv_load" },
        { status: 200 }
      );
    }

    // 3) Send Meta CAPI event (server-side conversion)
    const eventName = mapOutcomeToMetaEvent(outcome);
    const eventId = crypto.randomUUID(); // dedupe id
    const eventTime = Math.floor(Date.now() / 1000);

    const phoneForMatch = conv.phone_e164 ?? conv.wa_id ?? null;

    try {
      const capiRes = await sendMetaCapiEvent({
        eventName,
        eventId,
        eventTime,
        actionSource: "chat",
        phoneE164: phoneForMatch,
        value: value != null ? Number(value) : null,
        currency: currency ?? null,
      });

      // 4) Store meta_event_id for audit/dedup
      const { error: updErr } = await supabaseAdmin
        .from("wa_outcomes")
        .update({ meta_event_id: eventId })
        .eq("id", row.id);

      if (updErr) console.error("⚠️ meta_event_id update failed:", updErr);

      return NextResponse.json(
        { ok: true, outcome: { ...row, meta_event_id: eventId }, capi: capiRes },
        { status: 200 }
      );
    } catch (e) {
      console.error("❌ CAPI send failed:", e);

      // Outcome saved; Meta send failed (retry later)
      return NextResponse.json(
        { ok: true, outcome: row, capi: "failed_send" },
        { status: 200 }
      );
    }
  } catch (e) {
    console.error("❌ outcome route error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}