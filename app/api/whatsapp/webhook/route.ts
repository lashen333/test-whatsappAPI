import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET = Webhook verification (Meta calls this once when you "Verify")
 * It expects you to return the hub.challenge value if verify_token matches.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * POST = Incoming WhatsApp events (messages, status updates, etc.)
 * IMPORTANT: Respond fast (200) so WhatsApp doesn't retry.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  // For now: just log to terminal (local) or Vercel logs (prod)
  console.log("📩 WhatsApp webhook event:", JSON.stringify(body, null, 2));

  return NextResponse.json({ ok: true }, { status: 200 });
}
