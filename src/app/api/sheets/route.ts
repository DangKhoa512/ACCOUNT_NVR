import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// CORS headers cho external API calls
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

// Sử dụng Service Account thay vì API key để có thể truy cập private sheets
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

// OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { 
    status: 200, 
    headers: corsHeaders 
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const task = searchParams.get('task');
    const sheetId = searchParams.get('sheetId');
    const mode = searchParams.get('mode');
    
    // Nếu có mode parameter (search hoặc getrow), xử lý trước
    if (mode && sheetId) {
      const sheetName = searchParams.get('sheetName');
      const rowValue = searchParams.get('rowValue');
      const columnValue = searchParams.get('columnValue');
      
      if (!sheetName) {
        return NextResponse.json(
          { 
            error: 'Missing sheetName parameter for mode operation',
            required: ['sheetId', 'sheetName', 'mode', 'rowValue'],
            optional: ['columnValue'],
            examples: [
              '/api/sheets?sheetId=SHEET_ID&sheetName=WEB&mode=search&rowValue=FUN_OTP&columnValue=May1',
              '/api/sheets?sheetId=SHEET_ID&sheetName=WEB&mode=getrow&rowValue=May1'
            ]
          },
          { status: 400, headers: corsHeaders }
        );
      }

      return await processSearchGetRowRequest({
        sheetId,
        sheetName,
        mode,
        rowValue,
        columnValue
      });
    }
    
    // Nếu có task (có thể là getAPI hoặc tên sheet), xử lý như API call
    if (task && sheetId) {
      const web = searchParams.get('web');
      const device = searchParams.get('device');
      
      if (!web || !device) {
        return NextResponse.json(
          { 
            error: 'Missing parameters',
            required: {
              sheetId: 'Sheet ID (query param)',
              task: 'Task/Sheet name (query param)', 
              web: 'Row identifier (query param)',
              device: 'Device/column name (query param)'
            },
            examples: [
              '/api/sheets?sheetId=YOUR_SHEET_ID&task=getAPI&web=WEB&device=May1',
              '/api/sheets?sheetId=YOUR_SHEET_ID&task=WEB&web=FUN_OTP&device=May1'
            ]
          },
          { status: 400, headers: corsHeaders }
        );
      }

      console.log(`[GET API] SheetID: ${sheetId}, Web: ${web}, Device: ${device}`);

      // Sử dụng Service Account authentication
      const auth = await getServiceAccountAuth();
      const sheets = google.sheets({ version: 'v4', auth });

      // Xác định sheet name - ưu tiên task nếu không phải "getAPI"
      let sheetName;
      if (task.toLowerCase() === 'getapi') {
        sheetName = web; // web parameter = sheet name
      } else {
        sheetName = task; // task = sheet name (format mới)
      }
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return NextResponse.json(
          { error: `Sheet '${sheetName}' is empty or not found` },
          { status: 404, headers: corsHeaders }
        );
      }

      const headers = rows[0];
      let foundColumn = -1;

      // Tìm column theo device name trong header row
      for (let j = 0; j < headers.length; j++) {
        if (headers[j] && headers[j].toString().toLowerCase() === device.toLowerCase()) {
          foundColumn = j;
          break;
        }
      }

      if (foundColumn === -1) {
        return NextResponse.json(
          { error: `Device '${device}' not found in sheet '${sheetName}'` },
          { status: 404, headers: corsHeaders }
        );
      }

      // Tìm row theo web parameter trong cột A
      let foundRow = -1;
      for (let i = 1; i < rows.length; i++) {
        const rowValue = rows[i][0]?.toString();
        if (rowValue && rowValue.toLowerCase() === web.toLowerCase()) {
          foundRow = i;
          break;
        }
      }

      let apiKeyValue = '';
      if (foundRow !== -1) {
        // Nếu tìm thấy row cụ thể, lấy giá trị từ row đó
        apiKeyValue = rows[foundRow][foundColumn]?.toString() || '';
      } else {
        // Nếu không tìm thấy row, lấy giá trị đầu tiên có data trong cột
        for (let i = 1; i < rows.length; i++) {
          const cellValue = rows[i][foundColumn]?.toString();
          if (cellValue && cellValue.trim()) {
            apiKeyValue = cellValue.trim();
            break;
          }
        }
      }

      // Trả về format đơn giản như yêu cầu
      const result = {
        "WEB": web,
        "KEY_API": apiKeyValue
      };

      console.log(`[GET API] Simple result:`, result);
      return NextResponse.json(result, { headers: corsHeaders });
    }

    // Nếu không có task, trả về documentation
    const documentation = {
      name: "Google Sheets API",
      version: "2.1.0", 
      description: "API để truy cập Google Sheets với Service Account authentication",
      endpoints: {
        getAPI_v1: {
          method: "GET",
          path: "/api/sheets?sheetId={SHEET_ID}&task=getAPI&web={SHEET_NAME}&device={DEVICE_NAME}",
          description: "Format cũ - Lấy KEY_API từ device column của sheet",
          example: "/api/sheets?sheetId=160UG1GUU-NBBxUalNZimnHSS2LJ9SZsR843l4UXwg-E&task=getAPI&web=WEB&device=May1",
        },
        getAPI_v2: {
          method: "GET",
          path: "/api/sheets?sheetId={SHEET_ID}&task={SHEET_NAME}&web={ROW_IDENTIFIER}&device={DEVICE_NAME}",
          description: "Format mới - task là tên sheet, web là row identifier",
          example: "/api/sheets?sheetId=160UG1GUU-NBBxUalNZimnHSS2LJ9SZsR843l4UXwg-E&task=WEB&web=FUN_OTP&device=May1",
        },
        response: {
          "WEB": "row_identifier",
          "KEY_API": "api_key_value"
        },
        search: {
          method: "POST",
          description: "Tìm kiếm giá trị tại giao điểm row/column",
          body: {
            sheetId: "string",
            sheetName: "string",
            mode: "search",
            rowValue: "string",
            columnValue: "string"
          }
        },
        getColumn: {
          method: "POST", 
          description: "Lấy toàn bộ dữ liệu của một cột",
          body: {
            sheetId: "string",
            sheetName: "string",
            mode: "getrow",
            rowValue: "string - Column header name"
          }
        }
      },
      cors: "Enabled for all origins",
      authentication: "Service Account (private sheets supported)"
    };

    return NextResponse.json(documentation, { headers: corsHeaders });
  } catch (error) {
    console.error('[GET] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sheetId, sheetName, mode, rowValue, columnValue } = await request.json();

    if (!sheetId || !sheetName) {
      return NextResponse.json(
        { 
          error: 'Missing required parameters',
          required: ['sheetId', 'sheetName'],
          received: { sheetId: !!sheetId, sheetName: !!sheetName }
        },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[POST] Processing ${mode} request - Sheet: ${sheetId}/${sheetName}`);

    // Sử dụng Service Account authentication
    const auth = await getServiceAccountAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Lấy dữ liệu từ sheet (private sheet thông qua Service Account)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A:ZZZ`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { 
          error: 'No data found',
          details: 'Sheet is empty or does not exist'
        },
        { status: 404, headers: corsHeaders }
      );
    }

    console.log(`[POST] Retrieved ${rows.length} rows`);

    if (mode === 'search') {
      // Tìm kiếm theo coordinate như cũ
      if (!rowValue || !columnValue) {
        return NextResponse.json(
          { 
            error: 'Missing search parameters',
            required: ['rowValue', 'columnValue'],
            received: { rowValue: !!rowValue, columnValue: !!columnValue }
          },
          { status: 400, headers: corsHeaders }
        );
      }

      console.log(`[POST] Searching for row: ${rowValue} column: ${columnValue}`);

      const headers = rows[0];
      let foundRow = -1;
      let foundColumn = -1;

      // Tìm row trong cột A (cột đầu tiên)
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] && rows[i][0].toString().toLowerCase().includes(rowValue.toLowerCase())) {
          foundRow = i;
          break;
        }
      }

      // Tìm column trong row đầu tiên
      for (let j = 0; j < headers.length; j++) {
        if (headers[j] && headers[j].toString().toLowerCase().includes(columnValue.toLowerCase())) {
          foundColumn = j;
          break;
        }
      }

      if (foundRow === -1) {
        return NextResponse.json(
          { error: `Row not found: ${rowValue}` },
          { status: 404, headers: corsHeaders }
        );
      }

      if (foundColumn === -1) {
        return NextResponse.json(
          { error: `Column not found: ${columnValue}` },
          { status: 404, headers: corsHeaders }
        );
      }

      const value = rows[foundRow][foundColumn] || '';
      const columnLetter = String.fromCharCode(65 + foundColumn);

      const result = {
        success: true,
        mode: 'search',
        data: {
          value: value,
          row: foundRow + 1,
          column: columnLetter,
          rowHeader: rows[foundRow][0],
          columnHeader: headers[foundColumn]
        },
        timestamp: new Date().toISOString()
      };

      console.log('[POST] Search result:', result.data);
      return NextResponse.json(result, { headers: corsHeaders });

    } else if (mode === 'getrow') {
      // Lấy toàn bộ cột như đã sửa trước đó
      if (!rowValue) {
        return NextResponse.json(
          { 
            error: 'Missing column parameter',
            required: ['rowValue (column header name)'],
            received: { rowValue: !!rowValue }
          },
          { status: 400, headers: corsHeaders }
        );
      }

      console.log(`[POST] Getting column data for: ${rowValue}`);

      const headers = rows[0];
      let foundColumnIndex = -1;

      // Tìm column index theo header name
      for (let j = 0; j < headers.length; j++) {
        if (headers[j] && headers[j].toString().toLowerCase() === rowValue.toLowerCase()) {
          foundColumnIndex = j;
          break;
        }
      }

      if (foundColumnIndex === -1) {
        return NextResponse.json(
          { error: `Column header not found: ${rowValue}` },
          { status: 404, headers: corsHeaders }
        );
      }

      // Lấy toàn bộ dữ liệu của cột (bỏ qua header row)
      const columnData = [];
      for (let i = 1; i < rows.length; i++) {
        const cellValue = rows[i][foundColumnIndex] || '';
        if (cellValue) { // Chỉ thêm vào nếu có giá trị
          columnData.push({
            row: i + 1,
            value: cellValue
          });
        }
      }

      const columnLetter = String.fromCharCode(65 + foundColumnIndex);

      const result = {
        success: true,
        mode: 'getColumn',
        data: {
          columnHeader: headers[foundColumnIndex],
          columnIndex: foundColumnIndex + 1,
          columnLetter: columnLetter,
          totalValues: columnData.length,
          data: columnData
        },
        timestamp: new Date().toISOString()
      };

      console.log('[POST] Column result:', result.data);
      return NextResponse.json(result, { headers: corsHeaders });
    }

    return NextResponse.json(
      { 
        error: 'Invalid mode',
        validModes: ['search', 'getrow'],
        received: mode
      },
      { status: 400, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[POST] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Helper function to process search and getrow requests
async function processSearchGetRowRequest(params: {
  sheetId: string;
  sheetName: string;
  mode: string | null;
  rowValue: string | null;
  columnValue: string | null;
}) {
  const { sheetId, sheetName, mode, rowValue, columnValue } = params;

  // Sử dụng Service Account authentication
  const auth = await getServiceAccountAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Lấy dữ liệu từ sheet
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:ZZZ`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { error: 'No data found in sheet' },
      { status: 404, headers: corsHeaders }
    );
  }

  if (mode === 'search') {
    // Search logic
    if (!rowValue || !columnValue) {
      return NextResponse.json(
        { error: 'Missing rowValue or columnValue for search mode' },
        { status: 400, headers: corsHeaders }
      );
    }

    const headers = rows[0];
    let foundRow = -1;
    let foundColumn = -1;

    // Find row
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toString().toLowerCase().includes(rowValue.toLowerCase())) {
        foundRow = i;
        break;
      }
    }

    // Find column
    for (let j = 0; j < headers.length; j++) {
      if (headers[j] && headers[j].toString().toLowerCase().includes(columnValue.toLowerCase())) {
        foundColumn = j;
        break;
      }
    }

    if (foundRow === -1) {
      return NextResponse.json(
        { error: `Row not found: ${rowValue}` },
        { status: 404, headers: corsHeaders }
      );
    }

    if (foundColumn === -1) {
      return NextResponse.json(
        { error: `Column not found: ${columnValue}` },
        { status: 404, headers: corsHeaders }
      );
    }

    const value = rows[foundRow][foundColumn] || '';
    const columnLetter = String.fromCharCode(65 + foundColumn);

    return NextResponse.json({
      success: true,
      coordinate: `${columnLetter}${foundRow + 1}`,
      value: value,
      rowHeader: rows[foundRow][0],
      columnHeader: headers[foundColumn],
      sheetName: sheetName
    }, { headers: corsHeaders });

  } else if (mode === 'getrow') {
    // Getrow logic
    if (!rowValue) {
      return NextResponse.json(
        { error: 'Missing rowValue for getrow mode' },
        { status: 400, headers: corsHeaders }
      );
    }

    const headers = rows[0];
    let foundColumn = -1;

    // Find column by header name
    for (let j = 0; j < headers.length; j++) {
      if (headers[j] && headers[j].toString().toLowerCase().includes(rowValue.toLowerCase())) {
        foundColumn = j;
        break;
      }
    }

    if (foundColumn === -1) {
      return NextResponse.json(
        { error: `Column not found: ${rowValue}` },
        { status: 404, headers: corsHeaders }
      );
    }

    // Extract column data
    const columnData = [];
    for (let i = 1; i < rows.length; i++) {
      const cellValue = rows[i][foundColumn];
      const rowId = rows[i][0];
      if (cellValue || rowId) {
        columnData.push({
          row: i + 1,
          rowId: rowId || '',
          value: cellValue || ''
        });
      }
    }

    const columnLetter = String.fromCharCode(65 + foundColumn);

    return NextResponse.json({
      success: true,
      columnHeader: headers[foundColumn],
      columnLetter: columnLetter,
      data: columnData,
      totalRows: columnData.length,
      sheetName: sheetName
    }, { headers: corsHeaders });
  }

  return NextResponse.json(
    { error: 'Invalid mode' },
    { status: 400, headers: corsHeaders }
  );
}
