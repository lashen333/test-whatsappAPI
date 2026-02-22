// src\lib\googleSheets.ts
import { google } from "googleapis";

function getJwtClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  if (!email || !key || !spreadsheetId) {
    throw new Error("Missing Google Sheets env vars");
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return { auth, spreadsheetId };
}

export function getSheets() {
  const { auth, spreadsheetId } = getJwtClient();
  const sheets = google.sheets({ version: "v4", auth });
  return { sheets, spreadsheetId };
}