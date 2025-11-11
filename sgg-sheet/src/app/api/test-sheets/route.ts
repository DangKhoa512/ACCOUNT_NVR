import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Simple test API to check sheet existence
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sheetId = searchParams.get('sheetId') || '1eNwUM9207udmfJcEtC1ygBr7DIkhQth0-UJ6zoK1A5U';
    
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
    
    // Get sheet metadata to list all sheets
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId: sheetId
    });
    
    const sheetNames = metadata.data.sheets?.map(sheet => sheet.properties?.title) || [];
    
    return NextResponse.json({
      sheetId,
      availableSheets: sheetNames,
      totalSheets: sheetNames.length,
      searchedFor: 'CHAYCODESO3',
      exists: sheetNames.includes('CHAYCODESO3')
    });
    
  } catch (error) {
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}