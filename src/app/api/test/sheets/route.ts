// src\app\api\test\sheets\route.ts
import { NextResponse } from "next/server";
import { getSheets } from "@/src/lib/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { sheets, spreadsheetId } = getSheets();

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "RAW_MESSAGES!A:Z",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        "test_message_id",
        "test_conversation_id",
        "test_wa_id",
        new Date().toISOString(),
        "inbound",
        "Hello from backend test",
      ]],
    },
  });

  return NextResponse.json({ ok: true, updated: res.data.updates });
}