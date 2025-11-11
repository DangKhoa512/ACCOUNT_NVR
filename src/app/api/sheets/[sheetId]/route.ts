import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Service Account rotation system
let currentKeyIndex = 0;
const keyFailureCount = new Map<number, number>(); // Track failures per key
const keyLastFailure = new Map<number, number>(); // Track last failure timestamp per key
const KEY_COOLDOWN_TIME = 5 * 60 * 1000; // 5 minutes cooldown after failure

// Get all available service account keys (4 keys only)
function getServiceAccountKeys() {
  const keys = [];
  
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    keys.push(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_2) {
    keys.push(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_2);
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_3) {
    keys.push(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_3);
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_4) {
    keys.push(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_4);
  }
  
  return keys;
}

// Check if error is quota-related
function isQuotaError(error: any): boolean {
  const errorMessage = error?.message || '';
  const errorString = JSON.stringify(error).toLowerCase();
  
  return (
    errorMessage.includes('Quota exceeded') ||
    errorMessage.includes('quota metric') ||
    errorMessage.includes('Read requests per minute') ||
    errorString.includes('quota exceeded') ||
    errorString.includes('quotaexceeded')
  );
}

// Create Google Sheets client with specific key
function createSheetsClient(keyIndex: number) {
  try {
    const keys = getServiceAccountKeys();
    if (keys.length === 0) {
      console.error('No Service Account keys found');
      return null;
    }
    
    const serviceAccountKey = keys[keyIndex % keys.length];
    const credentials = JSON.parse(serviceAccountKey);
    
    
    // Fix private key format - replace \\n with actual newlines
    if (credentials.private_key && credentials.private_key.includes('\\n')) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      console.log('✅ Fixed private key line breaks');
    }
    
    // Also handle case where spaces are in the key or missing line breaks
    if (credentials.private_key && !credentials.private_key.includes('\n')) {
      
      // Remove all spaces and recreate proper format
      let keyContent = credentials.private_key.replace(/\s+/g, '');
      
      // Extract the base64 content between BEGIN and END
      const match = keyContent.match(/-----BEGINPRIVATEKEY-----(.*?)-----ENDPRIVATEKEY-----/);
      if (match) {
        const base64Content = match[1];
        
        // Add line breaks every 64 characters to the base64 content
        const formattedBase64 = base64Content.replace(/(.{64})/g, '$1\n').trim();
        
        // Reconstruct the private key
        credentials.private_key = `-----BEGIN PRIVATE KEY-----\n${formattedBase64}\n-----END PRIVATE KEY-----`;
        
      } else {
        console.error('❌ Could not parse private key format');
      }
    }
    
    console.log(`Using Service Account key ${(keyIndex % keys.length) + 1}/${keys.length}: ${credentials.client_email}`);
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    return google.sheets({ version: 'v4', auth });
    
  } catch (error) {
    console.error(`Auth error with key ${keyIndex + 1}:`, error);
    // Log the error type for debugging
    if (error instanceof Error && error.message.includes('DECODER routines::unsupported')) {
      console.error('🔥 Private key format error detected - check for \\n encoding issues');
    }
    return null;
  }
}

// Record key failure and switch to next key
function recordKeyFailure(keyIndex: number) {
  const count = keyFailureCount.get(keyIndex) || 0;
  keyFailureCount.set(keyIndex, count + 1);
  keyLastFailure.set(keyIndex, Date.now());
  
  console.log(`Key ${keyIndex + 1} failed. Failure count: ${count + 1}`);
  
  // Switch to next key
  const keys = getServiceAccountKeys();
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  console.log(`Switched to next key: ${currentKeyIndex + 1}`);
}

// Get Google Sheets client with rotation
async function getSheetsClientWithRotation() {
  const keys = getServiceAccountKeys();
  if (keys.length === 0) {
    throw new Error('No Service Account keys found');
  }
  
  let lastError: any = null;
  
  // Try all keys
  for (let attempt = 0; attempt < keys.length; attempt++) {
    try {
      const keyIndex = (currentKeyIndex + attempt) % keys.length;
      const now = Date.now();
      const lastFailure = keyLastFailure.get(keyIndex) || 0;
      
      // Skip key if in cooldown
      if (now - lastFailure < KEY_COOLDOWN_TIME) {
        console.log(`Key ${keyIndex + 1} in cooldown, skipping...`);
        continue;
      }
      
      const sheets = createSheetsClient(keyIndex);
      if (sheets) {
        currentKeyIndex = keyIndex; // Update current key
        return sheets;
      }
      
    } catch (error) {
      lastError = error;
      console.error(`Failed to create client with key ${(currentKeyIndex + attempt) % keys.length + 1}:`, error);
    }
  }
  
  throw lastError || new Error('All Service Account keys failed');
}

// OPTIONS handler for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { 
    status: 200, 
    headers: corsHeaders 
  });
}

// GET handler for custom URL format
export async function GET(
  req: NextRequest,
  { params }: { params: { sheetId: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const sheetId = params.sheetId;
    const task = searchParams.get('task'); // WEB
    const web = searchParams.get('web');   // TOTP 
    const device = searchParams.get('device'); // May1
    if (!sheetId || !task || !device) {
      return NextResponse.json({
        error: 'Missing required parameters',
        required: {
          sheetId: 'Sheet ID (URL path)',
          task: 'Sheet name (query param)',
          device: 'Column name (query param)'
        },
        example: '/api/sheets/SHEET_ID?task=WEB&web=TOTP&device=May1'
      }, { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // Use Service Account with rotation system
    let sheets = await getSheetsClientWithRotation();
    let response;
    
    // Try with rotation if quota error occurs
    const keys = getServiceAccountKeys();
    let success = false;
    let lastError: any = null;
    
    for (let attempt = 0; attempt < keys.length && !success; attempt++) {
      try {
        console.log(`Attempt ${attempt + 1}/${keys.length} with key ${currentKeyIndex + 1}`);
        
        // Get all data without column limits
        response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${task}`,
        });
        
        success = true;
        console.log(`Successfully fetched data with key ${currentKeyIndex + 1}`);
        
      } catch (error) {
        lastError = error;
        console.error(`Error with key ${currentKeyIndex + 1}:`, error);
        
        // Check if it's a sheet not found error
        const errorMessage = error instanceof Error ? error.message : '';
        if (errorMessage.includes('Unable to parse range') || 
            errorMessage.includes('not found') ||
            errorMessage.includes('does not exist')) {
          // Sheet doesn't exist, return helpful error immediately
          return NextResponse.json({
            error: `Sheet '${task}' not found`,
            sheetId: sheetId,
            requestedSheet: task,
            hint: 'Please check if the sheet name exists in your Google Sheets document'
          }, { 
            status: 404, 
            headers: corsHeaders 
          });
        }
        
        if (isQuotaError(error)) {
          console.log(`Quota exceeded for key ${currentKeyIndex + 1}, trying next key...`);
          recordKeyFailure(currentKeyIndex);
          
          // Get next sheets client for next attempt
          if (attempt < keys.length - 1) {
            try {
              sheets = await getSheetsClientWithRotation();
            } catch (rotationError) {
              console.error('Failed to get next client:', rotationError);
              break;
            }
          }
        } else {
          // Non-quota error, don't rotate
          console.error('Non-quota error, stopping rotation:', error);
          throw error;
        }
      }
    }
    
    if (!success || !response) {
      console.error('All Service Account keys failed');
      throw lastError || new Error('All Service Account keys exhausted');
    }

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
    let foundColumn = -1;
    let foundRow = -1;

    // Find column by exact header name (device parameter) - tìm trong toàn bộ hàng 1
    console.log(`🔍 Searching for column: "${device}" (case insensitive)`);
    console.log(`📊 Total headers found: ${headers.length}`);
    console.log(`📋 First 20 headers:`, headers.slice(0, 20));
    
    // Debug: Show all N-series columns specifically
    const nColumns = headers.filter((h, i) => h && h.toString().toLowerCase().includes('n')).map((h, i) => `"${h}"`);
    console.log(`🔍 All N-series columns found:`, nColumns);
    
    for (let j = 0; j < headers.length; j++) {
      const headerValue = headers[j];
      if (headerValue) {
        const trimmedHeader = headerValue.toString().trim().toLowerCase();
        const searchTerm = device.toLowerCase().trim();
        
        // Extra debug for N7 specifically
        if (trimmedHeader.includes('n7') || searchTerm.includes('n7')) {
          console.log(`🔍 N7 Debug: header[${j}] = "${headerValue}" | trimmed = "${trimmedHeader}" | searching = "${searchTerm}"`);
        }
        
        if (trimmedHeader === searchTerm) {
          foundColumn = j;
          console.log(`✅ Found "${device}" at column index ${j} (${String.fromCharCode(65 + j)})`);
          break;
        }
      }
    }
    
    if (foundColumn === -1) {
      console.log(`❌ Column "${device}" not found in ${headers.length} headers`);
      console.log(`📄 All non-empty headers:`, headers.filter(h => h && h.toString().trim() !== ''));
    }

    if (foundColumn === -1) {
      // Show all available columns, not just first 20
      const allColumns = headers.filter(h => h && h.toString().trim() !== '');
      
      return NextResponse.json({
        error: 'Fail',
        sheetName: task,
        searchedColumn: device,
        totalColumns: headers.length,
        totalNonEmptyColumns: allColumns.length,
        availableColumns: allColumns // Show ALL columns
      }, { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    // Find row by first column value (web parameter)
    if (web) {
      for (let i = 1; i < rows.length; i++) {
        const firstColumnValue = rows[i][0];
        if (firstColumnValue && firstColumnValue.toString().trim().toLowerCase() === web.toLowerCase()) {
          foundRow = i;
          break;
        }
      }
    }

    if (foundRow === -1) {
      return NextResponse.json({
        error: `Row not found: ${web}`,
        sheetName: task,
        searchedRow: web,
        availableRows: rows.slice(1, 11).map(row => row[0]).filter(r => r) // Show first 10 rows
      }, { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    // Get the specific cell value
    const cellValue = rows[foundRow][foundColumn];
    const columnLetter = String.fromCharCode(65 + foundColumn);
    const rowNumber = foundRow + 1;

    return NextResponse.json({
      status: "success",
      web: web || "",
      value: cellValue || ""
    }, { 
      headers: corsHeaders 
    });
  } catch (error) {
    console.error('[GET Custom Format] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}
