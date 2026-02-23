// src\services\sheets\appendRawMessage.ts
import { getSheets } from "@/src/lib/googleSheets";

type RawMessageRow = {
  message_id: string;
  conversation_id: string;
  wa_id: string;
  timestamp_utc: string;   // ISO string
  direction: "inbound" | "outbound";
  msg_type: string;
  message_body: string;
};

export async function appendRawMessageToSheet(row: RawMessageRow) {
  const { sheets, spreadsheetId } = getSheets();

  const values = [[
    row.message_id,
    row.conversation_id,
    row.wa_id,
    row.timestamp_utc,
    row.direction,
    row.msg_type,
    row.message_body,
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "RAW_MESSAGES!A:Z",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}