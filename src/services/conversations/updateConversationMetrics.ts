// src\services\conversations\updateConversationMetrics.ts

//this will make a tiny helper to update wa_conversations
import { supabaseAdmin } from "@/src/lib/supabaseAdmin";

type Direction = "inbound" | "outbound";

export async function updateConversationMetrics(args: {
  conversationId: string;
  direction: Direction;
  occurredAtIso: string; // message time
}) {
  const { conversationId, direction, occurredAtIso } = args;

  // Read current conversation state
  const { data: conv, error } = await supabaseAdmin
    .from("wa_conversations")
    .select("id, first_inbound_at, first_outbound_at, first_response_seconds, last_message_at")
    .eq("id", conversationId)
    .single();

  if (error || !conv) throw error ?? new Error("Conversation not found");

  const updates: any = {
    last_message_at: occurredAtIso,
    last_direction: direction,
  };

  // Set first inbound/outbound if missing
  if (direction === "inbound" && !conv.first_inbound_at) {
    updates.first_inbound_at = occurredAtIso;
  }
  if (direction === "outbound" && !conv.first_outbound_at) {
    updates.first_outbound_at = occurredAtIso;
  }

  // Calculate first response seconds if possible and not already set
  const firstInbound = conv.first_inbound_at ?? updates.first_inbound_at ?? null;
  const firstOutbound = conv.first_outbound_at ?? updates.first_outbound_at ?? null;

  if (!conv.first_response_seconds && firstInbound && firstOutbound) {
    const secs = Math.max(
      0,
      Math.floor((new Date(firstOutbound).getTime() - new Date(firstInbound).getTime()) / 1000)
    );
    updates.first_response_seconds = secs;
  }

  const { data: updated, error: upErr } = await supabaseAdmin
    .from("wa_conversations")
    .update(updates)
    .eq("id", conversationId)
    .select("*")
    .single();

  if (upErr) throw upErr;
  return updated;
}
