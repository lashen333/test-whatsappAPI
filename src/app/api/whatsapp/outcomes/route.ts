// src\app\api\whatsapp\outcomes\route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabaseAdmin";

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

    // Save outcome
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

    if (error) {
      console.error("❌ outcome insert error:", error);
      return NextResponse.json({ ok: false, error: "DB insert failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, outcome: row }, { status: 200 });
  } catch (e) {
    console.error("❌ outcome route error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
