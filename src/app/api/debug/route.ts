import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Debug API to check sheet structure
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sheetId = searchParams.get('sheetId') || '1eNwUM9207udmfJcEtC1ygBr7DIkhQth0-UJ6zoK1A5U';
    const sheetName = searchParams.get('sheetName') || 'API_MAY';
    
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      return NextResponse.json({ error: 'No service account key' }, { status: 500 });
    }

    const credentials = JSON.parse(serviceAccountKey);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Get first few rows to understand structure
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A1:Z10` // First 10 rows, up to column Z
    });
    
    const rows = response.data.values || [];
    
    return NextResponse.json({
      sheetId,
      sheetName,
      totalRows: rows.length,
      headers: rows[0] || [],
      firstFewRows: rows.slice(0, 5),
      columnA_values: rows.slice(1, 10).map(row => row[0]).filter(v => v), // First column values
      debug: {
        searchFor_web: 'FUN_OTP',
        searchFor_device: 'May19'
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}