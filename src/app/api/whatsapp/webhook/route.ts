import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Respond fast to WhatsApp
  const res = NextResponse.json({ ok: true }, { status: 200 });

  // Process after response (good enough for MVP)
  // For high volume later, we’ll add a queue.
  queueMicrotask(async () => {
    try {
      // WhatsApp payload structure: entry -> changes -> value
      const change = body?.entry?.[0]?.changes?.[0]?.value;
      const messages = change?.messages;
      if (!messages?.length) return;

      const msg = messages[0];
      const waId = msg.from; // sender wa_id
      const waMessageId = msg.id;
      const msgType = msg.type || "text";
      const textBody = msg?.text?.body || null;

      // Referral/ad context (if present)
      const referral = msg?.referral || change?.referral || null;
      const source = referral ? "meta_ad" : "unknown";

      // 1) Upsert conversation
      const { data: conv, error: convErr } = await supabaseAdmin
        .from("wa_conversations")
        .upsert(
          {
            wa_id: waId,
            source,
            ad_context: referral ? referral : null,
            last_message_at: new Date().toISOString(),
          },
          { onConflict: "wa_id" }
        )
        .select("id")
        .single();

      if (convErr) throw convErr;

      // 2) Insert message
      const { error: msgErr } = await supabaseAdmin.from("wa_messages").insert({
        conversation_id: conv.id,
        wa_message_id: waMessageId,
        direction: "in",
        msg_type: msgType,
        text_body: textBody,
        payload: msg,
      });

      if (msgErr) throw msgErr;

      // 3) (Optional) update last_message_at (already in upsert, but safe)
      await supabaseAdmin
        .from("wa_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conv.id);

      console.log("✅ Saved message for wa_id:", waId);
    } catch (e) {
      console.error("❌ Webhook save error:", e);
    }
  });

  return res;
}
