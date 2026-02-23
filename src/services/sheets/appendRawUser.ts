// src\services\sheets\appendRawUser.ts
import { getSheets } from "@/src/lib/googleSheets";

type RawUserRow = {
  wa_id: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
  conversations_count: number | null;
  last_conversation_id: string | null;
  last_message_at: string | null;
  notes?: string | null;
};

export async function appendRawUserToSheet(row: RawUserRow) {
  const { sheets, spreadsheetId } = getSheets();

  const values = [[
    row.wa_id,
    row.first_seen_at ?? "",
    row.last_seen_at ?? "",
    row.conversations_count ?? "",
    row.last_conversation_id ?? "",
    row.last_message_at ?? "",
    row.notes ?? "",
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "RAW_USERS!A:Z",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}