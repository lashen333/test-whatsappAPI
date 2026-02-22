// src\services\whatsapp\sendWhatsappMessage.ts
import { request } from "undici";

type SendArgs = {
  toWaId: string;        // customer wa_id (e.g. 9470....)
  text: string;
};

export async function sendWhatsappMessage(args: SendArgs) {
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  const token = process.env.WA_CLOUD_API_TOKEN;

  if (!phoneNumberId || !token) {
    throw new Error("Missing WA_PHONE_NUMBER_ID or WA_CLOUD_API_TOKEN");
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: args.toWaId,
    type: "text",
    text: { body: args.text },
  };

  const res = await request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.body.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`WhatsApp send failed ${res.statusCode}: ${JSON.stringify(json)}`);
  }

  // Typical response includes messages[0].id
  return json;
}