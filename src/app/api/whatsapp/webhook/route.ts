import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];

    if (!msg) return NextResponse.json({ ok: true, note: "no message" }, { status: 200 });

    const waId = msg.from;
    const waMessageId = msg.id;
    const msgType = msg.type || "text";
    const textBody = msg?.text?.body ?? null;

    // 1) conversation upsert
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

    if (convErr) {
      console.error("❌ convErr:", convErr);
      return NextResponse.json({ ok: false, where: "conv" }, { status: 200 });
    }

    if (!conv?.id) {
      console.error("❌ conv missing id:", conv);
      return NextResponse.json({ ok: false, where: "conv-id" }, { status: 200 });
    }

    // 2) message insert
    const { data: inserted, error: msgErr } = await supabaseAdmin
      .from("wa_messages")
      .insert({
        conversation_id: conv.id,
        wa_message_id: waMessageId,
        direction: "in",
        msg_type: msgType,
        text_body: textBody,
        payload: msg,
      })
      .select("id")
      .single();

    if (msgErr) {
      console.error("❌ msgErr:", msgErr);
      console.error("❌ attempted insert:", {
        conversation_id: conv.id,
        wa_message_id: waMessageId,
        direction: "in",
        msg_type: msgType,
        text_body: textBody,
      });
      return NextResponse.json({ ok: false, where: "msg" }, { status: 200 });
    }

    console.log("✅ inserted message id:", inserted?.id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("❌ webhook error:", e);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
