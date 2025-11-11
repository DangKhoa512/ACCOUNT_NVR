import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Service Account authentication
async function getServiceAccountAuth() {
  try {
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not found');
    }

    const credentials = JSON.parse(serviceAccountKey);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    return auth;
  } catch (error) {
    console.error('Service Account auth error:', error);
    throw new Error('Failed to authenticate with Service Account');
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { 
    status: 200, 
    headers: corsHeaders 
  });
}

// GET handler for search with query parameters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sheetId = searchParams.get('sheetId');
    const sheetName = searchParams.get('sheetName');
    const rowValue = searchParams.get('rowValue');
    const columnValue = searchParams.get('columnValue');
    
    if (!sheetId || !sheetName) {
      return NextResponse.json({
        error: 'Missing required parameters',
        required: {
          sheetId: 'Sheet ID (query param)',
          sheetName: 'Sheet name (query param)',
          rowValue: 'Row value to search (query param)',
          columnValue: 'Column value to search (query param)'
        },
        example: '/api/search?sheetId=SHEET_ID&sheetName=WEB&rowValue=FUN_OTP&columnValue=May1'
      }, { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    return await processSearchRequest({
      sheetId,
      sheetName,
      rowValue,
      columnValue
    });
  } catch (error) {
    console.error('[GET Search] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// POST handler for backward compatibility
export async function POST(req: NextRequest) {
  try {
    const { sheetId, sheetName, rowValue, columnValue } = await req.json();
    
    if (!sheetId || !sheetName) {
      return NextResponse.json({
        error: 'Missing required parameters',
        required: ['sheetId', 'sheetName', 'rowValue', 'columnValue']
      }, { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    return await processSearchRequest({
      sheetId,
      sheetName,
      rowValue,
      columnValue
    });
  } catch (error) {
    console.error('[POST Search] Error:', error);
    return NextResponse.json({
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// Shared search processing function
async function processSearchRequest(params: {
  sheetId: string;
  sheetName: string;
  rowValue: string | null;
  columnValue: string | null;
}) {
  const { sheetId, sheetName, rowValue, columnValue } = params;

  if (!rowValue || !columnValue) {
    return NextResponse.json({
      error: 'Missing search parameters',
      required: ['rowValue', 'columnValue'],
      description: 'Both rowValue and columnValue are required for search'
    }, { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  // Use Service Account authentication
  const auth = await getServiceAccountAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Get data from sheet
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:ZZZ`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return NextResponse.json({
      error: 'No data found in sheet'
    }, { 
      status: 404, 
      headers: corsHeaders 
    });
  }

  const headers = rows[0];
  let foundRow = -1;
  let foundColumn = -1;

  // Find row in column A (first column)
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].toString().toLowerCase().includes(rowValue.toLowerCase())) {
      foundRow = i;
      break;
    }
  }

  // Find column in header row
  for (let j = 0; j < headers.length; j++) {
    if (headers[j] && headers[j].toString().toLowerCase().includes(columnValue.toLowerCase())) {
      foundColumn = j;
      break;
    }
  }

  if (foundRow === -1) {
    return NextResponse.json({
      error: `Row not found: ${rowValue}`,
      sheetName,
      searchedValue: rowValue
    }, { 
      status: 404, 
      headers: corsHeaders 
    });
  }

  if (foundColumn === -1) {
    return NextResponse.json({
      error: `Column not found: ${columnValue}`,
      sheetName,
      searchedValue: columnValue,
      availableColumns: headers.filter(h => h).slice(0, 10) // Show first 10 columns
    }, { 
      status: 404, 
      headers: corsHeaders 
    });
  }

  const value = rows[foundRow][foundColumn] || '';
  const columnLetter = String.fromCharCode(65 + foundColumn);

  return NextResponse.json({
    success: true,
    coordinate: `${columnLetter}${foundRow + 1}`,
    value: value,
    rowHeader: rows[foundRow][0],
    columnHeader: headers[foundColumn],
    rowNumber: foundRow + 1,
    columnLetter: columnLetter,
    sheetName: sheetName
  }, { 
    headers: corsHeaders 
  });
}
