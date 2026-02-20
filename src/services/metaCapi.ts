// src\services\metaCapi.ts
import { request } from "undici";
import crypto from "crypto";

type MetaEventName = "Lead" | "Purchase" | "Schedule";

function sha256LowerTrim(value: string) {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function mapOutcomeToMetaEvent(outcome: string): MetaEventName {
  // Industry common mapping
  if (outcome === "purchase") return "Purchase";
  if (outcome === "booked") return "Schedule"; // can also be custom event
  return "Lead";
}

type SendCapiArgs = {
  eventName: MetaEventName;
  eventId: string;            // unique id (dedupe)
  eventTime: number;          // unix seconds
  actionSource?: "chat" | "website" | "app" | "phone_call" | "email" | "other" | "physical_store" ; 
  phoneE164?: string | null;  // +9477... if you have; or raw digits is ok but be consistent
  value?: number | null;
  currency?: string | null;
  testEventCode?: string | null;
};

export async function sendMetaCapiEvent(args: SendCapiArgs) {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    throw new Error("Missing META_PIXEL_ID or META_CAPI_ACCESS_TOKEN");
  }

  // user_data: best is phone/email hash. We’ll use phone if available.
  const user_data: Record<string, any> = {};
  if (args.phoneE164) {
    user_data.ph = [sha256LowerTrim(args.phoneE164)];
  }

  const payload: any = {
    data: [
      {
        event_name: args.eventName,
        event_time: args.eventTime,
        event_id: args.eventId,
        action_source: args.actionSource ?? "chat",
        user_data,
      },
    ],
  };

  // Add purchase fields when relevant
  if (args.eventName === "Purchase" && args.value && args.currency) {
    payload.data[0].custom_data = {
      value: args.value,
      currency: args.currency,
    };
  }

  // Optional: test code for Events Manager "Test Events"
  const testCode = args.testEventCode ?? process.env.META_TEST_EVENT_CODE ?? null;

  // ✅ add debug logs (will appear in Vercel logs)
  console.log("🧪 META_TEST_EVENT_CODE (env):", process.env.META_TEST_EVENT_CODE ? "SET" : "NOT_SET");
  console.log("🧪 Using test_event_code:", testCode ?? "(none)");
  
  if (testCode) payload.test_event_code = testCode;

  const url = `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`;

  const res = await request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.body.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`Meta CAPI error ${res.statusCode}: ${JSON.stringify(json)}`);
  }

  return json;

  



}


