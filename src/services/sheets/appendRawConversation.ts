// src\services\sheets\appendRawConversation.ts
import {getSheets} from "@/src/lib/googleSheets";

type RawConversationRow = {
    conversation_id: string;
    wa_id: string;
    source: string;
    first_inbound_at: string | null; 
    first_outbound_at: string | null; 
    first_response_seconds: number | null;
    last_message_at: string; 
    last_direction: string | null;
};

export async function appendRawConversationToSheet(row: RawConversationRow) {
    const{sheets, spreadsheetId} = getSheets();

    const values = [[
        row.conversation_id,
        row.wa_id,
        row.source,
        row.first_inbound_at ?? "",
        row.first_outbound_at ?? "",
        row.first_response_seconds ?? "",
        row.last_message_at ?? "",
        row.last_direction ?? "",
    ]];

    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "RAW_CONVERSATIONS!A:Z",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {values},
    });
}
