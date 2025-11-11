import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Simple in-memory queue to prevent concurrent access
let processingQueue: Array<{
  id: string;
  timestamp: number;
  sheetId: string;
  sheetName: string;
}> = [];

// Track used values with timestamp (in-memory solution)
let usedValues: Array<{
  sheetId: string;
  sheetName: string;
  row: number;
  value: string;
  timestamp: number;
}> = [];

// Track currently processing rows to prevent duplicate selection with timeout
let processingRows: Map<string, number> = new Map(); // Format: "sheetId:sheetName:row" -> timestamp

// Timeout configurations - optimized for speed
const REQUEST_TIMEOUT = 15000; // 15 seconds timeout per request
const ROW_PROCESSING_TIMEOUT = 5000; // 5 seconds timeout for row processing

// Cleanup expired processing rows
function cleanupExpiredProcessingRows() {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  processingRows.forEach((timestamp, key) => {
    if (now - timestamp > ROW_PROCESSING_TIMEOUT) {
      console.log(`Cleaning up expired processing row: ${key}`);
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => processingRows.delete(key));
}

// Service Account rotation system
let currentKeyIndex = 0;
const keyFailureCount = new Map<number, number>(); // Track failures per key
const keyLastFailure = new Map<number, number>(); // Track last failure timestamp per key
const KEY_COOLDOWN_TIME = 2 * 60 * 1000; // 2 minutes cooldown after failure

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
    
    // Debug private key format
    console.log('🔍 [AUTOGET] Private key format check:');
    console.log('Has \\\\n?', credentials.private_key?.includes('\\n'));
    console.log('Has \\n?', credentials.private_key?.includes('\n'));
    console.log('Key starts with:', credentials.private_key?.substring(0, 50));
    
    // Fix private key format - replace \\n with actual newlines
    if (credentials.private_key && credentials.private_key.includes('\\n')) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      console.log('✅ [AUTOGET] Fixed private key line breaks');
    }
    
    // Also handle case where spaces are in the key or missing line breaks
    if (credentials.private_key && !credentials.private_key.includes('\n')) {
      console.log('🔧 [AUTOGET] Fixing private key format...');
      
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
        
        console.log('✅ [AUTOGET] Successfully formatted private key with proper line breaks');
      } else {
        console.error('❌ [AUTOGET] Could not parse private key format');
      }
    }
    
    console.log(`[AUTOGET] Using Service Account key ${(keyIndex % keys.length) + 1}/${keys.length}: ${credentials.client_email}`);
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    return google.sheets({ version: 'v4', auth });
    
  } catch (error) {
    console.error(`[AUTOGET] Auth error with key ${keyIndex + 1}:`, error);
    // Log the error type for debugging
    if (error instanceof Error && error.message.includes('DECODER routines::unsupported')) {
      console.error('🔥 [AUTOGET] Private key format error detected - check for \\n encoding issues');
    }
    return null;
  }
}

// Get next available service account (with rotation and cooldown)
function getGoogleSheetsAuth() {
  const keys = getServiceAccountKeys();
  if (keys.length === 0) {
    console.log('No Service Account keys found');
    return null;
  }
  
  const now = Date.now();
  
  // Try current key first if it's not in cooldown
  const lastFailure = keyLastFailure.get(currentKeyIndex) || 0;
  if (now - lastFailure > KEY_COOLDOWN_TIME) {
    const sheets = createSheetsClient(currentKeyIndex);
    if (sheets) {
      console.log(`Using current key index: ${currentKeyIndex}`);
      return sheets;
    }
  }
  
  // Find next available key not in cooldown
  for (let i = 0; i < keys.length; i++) {
    const keyIndex = (currentKeyIndex + i + 1) % keys.length;
    const lastFailureTime = keyLastFailure.get(keyIndex) || 0;
    
    if (now - lastFailureTime > KEY_COOLDOWN_TIME) {
      const sheets = createSheetsClient(keyIndex);
      if (sheets) {
        currentKeyIndex = keyIndex;
        console.log(`Switched to key index: ${currentKeyIndex}`);
        return sheets;
      }
    }
  }
  
  console.error('All Service Account keys are in cooldown or failed');
  return null;
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

// Cleanup old queue items and used values
const cleanupQueue = () => {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  processingQueue = processingQueue.filter(item => item.timestamp > fiveMinutesAgo);
  
  // Clean up used values older than 1 hour
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  usedValues = usedValues.filter(item => item.timestamp > oneHourAgo);
};

// OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { 
    status: 200, 
    headers: corsHeaders 
  });
}

// GET handler for query parameters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sheetId = searchParams.get('sheetId');
    const sheetName = searchParams.get('sheetName');
    const reset = searchParams.get('reset'); // Thêm parameter reset
    
    if (!sheetId || !sheetName) {
      return NextResponse.json({
        error: 'Missing parameters',
        required: {
          sheetId: 'Sheet ID (query param)',
          sheetName: 'Sheet name (query param)'
        },
        examples: [
          '/api/autoget?sheetId=YOUR_SHEET_ID&sheetName=ACCOUNT',
          '/api/autoget?sheetId=YOUR_SHEET_ID&sheetName=ACCOUNT&reset=true'
        ]
      }, { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    return await processAutoGetRequest(sheetId, sheetName, reset === 'true');
  } catch (error) {
    console.error('[GET] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// POST handler for JSON body (backward compatibility)
export async function POST(req: NextRequest) {
  try {
    const { sheetId, sheetName } = await req.json();
    
    if (!sheetId || !sheetName) {
      return NextResponse.json({
        error: 'Thiếu Sheet ID hoặc Sheet Name'
      }, { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    return await processAutoGetRequest(sheetId, sheetName, false);
  } catch (error) {
    console.error('[POST] Error:', error);
    return NextResponse.json({
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// Simple processing function for busy queue bypass
async function processSimpleAutoGet(sheetId: string, sheetName: string, requestId: string) {
  try {
    // Use first available key without rotation complexity
    const sheets = createSheetsClient(0);
    if (!sheets) {
      return NextResponse.json({ error: 'Auth failed' }, { status: 500, headers: corsHeaders });
    }

    // Get data with small range
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A:C`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ error: 'No data' }, { status: 404, headers: corsHeaders });
    }

    // Find first available row (simple scan)
    for (let i = 1; i < Math.min(rows.length, 50); i++) { // Check max 50 rows for speed
      const row = rows[i];
      const statusValue = row[1] || ''; // Assume status is in column B
      
      if (statusValue.toString().toLowerCase() !== 'used') {
        return NextResponse.json({
          column: 'B',
          VALUE: row[0] || '',
          mode: 'simple-bypass',
          requestId: requestId
        }, { headers: corsHeaders });
      }
    }

    return NextResponse.json({ 
      error: 'No available rows',
      mode: 'simple-bypass',
      requestId: requestId
    }, { status: 404, headers: corsHeaders });

  } catch (error) {
    console.error(`[${requestId}] Simple bypass error:`, error);
    return NextResponse.json({ error: 'Simple bypass failed' }, { status: 500, headers: corsHeaders });
  }
}

// Shared processing function for both GET and POST with timeout
async function processAutoGetRequest(sheetId: string, sheetName: string, reset: boolean = false) {
  // Generate unique request ID
  const requestId = Math.random().toString(36).substring(2, 15);
  let selectedRow: any = null; // Declare selectedRow at function scope
  
  // Add to queue
  cleanupQueue();
  
  // Simple bypass if queue is too busy (>5 requests)
  if (processingQueue.length > 5) {
    console.log(`[${requestId}] Queue too busy (${processingQueue.length}), using simple mode`);
    return await processSimpleAutoGet(sheetId, sheetName, requestId);
  }
  
  processingQueue.push({
    id: requestId,
    timestamp: Date.now(),
    sheetId: sheetId,
    sheetName: sheetName
  });
  
  console.log(`[${requestId}] Request added to queue. Queue size: ${processingQueue.length}`);

  // Create timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT);
  });

  // Main processing promise
  const processingPromise = async () => {
    // Fast path: skip queue if we're first or only request
    const ourIndex = processingQueue.findIndex(item => item.id === requestId);
    if (ourIndex <= 0) {
      console.log(`[${requestId}] Fast path - processing immediately`);
    } else {
      // Wait for our turn in the queue with timeout
      const waitForTurn = () => {
        return new Promise<void>((resolve, reject) => {
          const startTime = Date.now();
          const checkQueue = () => {
            // Check if request has timed out
            if (Date.now() - startTime > REQUEST_TIMEOUT) {
              reject(new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`));
              return;
            }
            
            const currentIndex = processingQueue.findIndex(item => item.id === requestId);
            if (currentIndex <= 0) {
              resolve();
            } else {
              console.log(`[${requestId}] Waiting in queue. Position: ${currentIndex + 1}/${processingQueue.length}`);
              setTimeout(checkQueue, 100);
            }
          };
          checkQueue();
        });
      };

      await waitForTurn();
    }
    console.log(`[${requestId}] Processing request...`);
    
    // Cleanup expired processing rows
    cleanupExpiredProcessingRows();

    // Try to use Service Account first, fallback to API key
    let sheets = getGoogleSheetsAuth();
    let data;

    if (sheets) {
      console.log(`[${requestId}] Using Service Account authentication with rotation`);
      
      const keys = getServiceAccountKeys();
      let lastError: any = null;
      let success = false;
      
      // Try with rotation - attempt all keys if needed
      for (let attempt = 0; attempt < keys.length && !success; attempt++) {
        try {
          console.log(`[${requestId}] Attempt ${attempt + 1}/${keys.length} with key ${currentKeyIndex + 1}`);
          
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${sheetName}!A:C`, // Ultra optimize: Use A:C for maximum speed
          });
          
          data = response.data;
          success = true;
          console.log(`[${requestId}] Successfully fetched data with key ${currentKeyIndex + 1}`);
          
        } catch (serviceError) {
          lastError = serviceError;
          console.error(`[${requestId}] Service Account error with key ${currentKeyIndex + 1}:`, serviceError);
          
          // Check if it's a quota error
          if (isQuotaError(serviceError)) {
            console.log(`[${requestId}] Quota exceeded for key ${currentKeyIndex + 1}, trying next key...`);
            recordKeyFailure(currentKeyIndex);
            
            // Get next sheets client for next attempt
            if (attempt < keys.length - 1) {
              sheets = getGoogleSheetsAuth();
              if (!sheets) {
                console.error(`[${requestId}] No more keys available`);
                break;
              }
            }
          } else {
            // Non-quota error, don't rotate
            console.error(`[${requestId}] Non-quota error, stopping rotation:`, serviceError);
            throw serviceError;
          }
        }
      }
      
      if (!success) {
        console.error(`[${requestId}] All Service Account keys failed`);
        throw lastError || new Error('All Service Account keys exhausted');
      }
      
    } else {
      return NextResponse.json({
        error: 'Service Account not configured',
        details: 'No GOOGLE_SERVICE_ACCOUNT_KEY environment variables found',
        availableKeys: getServiceAccountKeys().length
      }, { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const rows = data?.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({
        error: 'Sheet không có dữ liệu hoặc chỉ có header',
        sheetName,
        rowCount: rows?.length || 0
      }, { 
        status: 404,
        headers: corsHeaders 
      });
    }

    // If reset=true, reset all Status to empty
    if (reset && sheets) {
      console.log(`[${requestId}] Resetting all Status to empty...`);
      
      // Find Status column
      const headers = rows[0];
      let statusColumnIndex = -1;
      
      for (let i = 0; i < headers.length; i++) {
        if (headers[i] && headers[i].toString().toLowerCase().includes('status')) {
          statusColumnIndex = i;
          break;
        }
      }
      
      if (statusColumnIndex === -1) {
        statusColumnIndex = 1; // Default to column B if no Status column found
      }
      
      try {
        // Prepare update data to clear all status cells
        const updateData = [];
        for (let i = 1; i < rows.length; i++) {
          updateData.push(['']); // Empty string to clear status
        }
        
        const statusColumnLetter = String.fromCharCode(65 + statusColumnIndex);
        const updateRange = `${sheetName}!${statusColumnLetter}2:${statusColumnLetter}${rows.length}`;
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: updateRange,
          valueInputOption: 'RAW',
          requestBody: {
            values: updateData
          }
        });
        
        console.log(`[${requestId}] Reset ${updateData.length} status cells to empty`);
        
        // Clear used values cache for this sheet
        usedValues = usedValues.filter(u => !(u.sheetId === sheetId && u.sheetName === sheetName));
        
        return NextResponse.json({
          success: true,
          message: 'Reset completed',
          resetCount: updateData.length,
          sheetName,
          statusColumn: headers[statusColumnIndex] || `Column ${statusColumnLetter}`
        }, { 
          headers: corsHeaders 
        });
        
      } catch (resetError) {
        console.error(`[${requestId}] Error resetting status:`, resetError);
        return NextResponse.json({
          error: 'Failed to reset status',
          details: resetError instanceof Error ? resetError.message : 'Unknown error'
        }, { 
          status: 500,
          headers: corsHeaders 
        });
      }
    }

    // Find the Status column (assuming it's in column C or column with header "Status")
    const headers = rows[0];
    let statusColumnIndex = -1;
    
    // Look for Status column by header name first
    for (let i = 0; i < headers.length; i++) {
      if (headers[i] && headers[i].toString().toLowerCase().includes('status')) {
        statusColumnIndex = i;
        break;
      }
    }
    
    // If no Status column found, assume column C (index 2)
    if (statusColumnIndex === -1) {
      statusColumnIndex = 2;
    }

    // Find all rows with empty status or not "used" that haven't been used recently
    const availableRows = [];
    
    for (let i = 1; i < rows.length; i++) {
      const statusCell = rows[i][statusColumnIndex];
      const rowValue = rows[i][0]; // Column A value
      
      // Check if status is empty or not "used"
      const isAvailable = !statusCell || statusCell.toString().toLowerCase() !== 'used';
      
      if (isAvailable && rowValue) {
        // Create unique row key
        const rowKey = `${sheetId}:${sheetName}:${i}`;
        
        // Skip if row is currently being processed by another request
        if (processingRows.has(rowKey)) {
          console.log(`[${requestId}] Skipping row ${i + 1} - currently being processed`);
          continue;
        }
        
        // Check if this value was used recently
        const wasUsedRecently = usedValues.some(used => 
          used.sheetId === sheetId && 
          used.sheetName === sheetName && 
          used.row === i && 
          used.value === rowValue.toString()
        );
        
        if (!wasUsedRecently) {
          availableRows.push({
            row: i,
            value: rowValue.toString(),
            fullRowData: rows[i]
          });
        }
      }
    }

    if (availableRows.length === 0) {
      return NextResponse.json({
        error: true,
        note: 'Hết account'
      }, { 
        status: 404,
        headers: corsHeaders 
      });
    }

    // Select the first available row and mark it as being processed
    selectedRow = availableRows[0];
    const selectedRowKey = `${sheetId}:${sheetName}:${selectedRow.row}`;
    processingRows.set(selectedRowKey, Date.now());
    
    console.log(`[${requestId}] Selected row ${selectedRow.row + 1} with value: ${selectedRow.value}`);
    console.log(`[${requestId}] Marked row as processing: ${selectedRowKey}`);    

    // Update the Status to "used" using Service Account with rotation
    if (sheets) {
      const keys = getServiceAccountKeys();
      let updateSuccess = false;
      
      for (let attempt = 0; attempt < keys.length && !updateSuccess; attempt++) {
        try {
          const updateRange = `${sheetName}!${String.fromCharCode(65 + statusColumnIndex)}${selectedRow.row + 1}`;
          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: updateRange,
            valueInputOption: 'RAW',
            requestBody: {
              values: [['used']]
            }
          });
          
          console.log(`[${requestId}] Updated ${updateRange} to used with key ${currentKeyIndex + 1}`);
          updateSuccess = true;
          
        } catch (updateError) {
          console.error(`[${requestId}] Error updating status with key ${currentKeyIndex + 1}:`, updateError);
          
          if (isQuotaError(updateError)) {
            console.log(`[${requestId}] Quota exceeded during update, trying next key...`);
            recordKeyFailure(currentKeyIndex);
            
            if (attempt < keys.length - 1) {
              sheets = getGoogleSheetsAuth();
              if (!sheets) {
                console.error(`[${requestId}] No more keys available for update`);
                break;
              }
            }
          } else {
            // Non-quota error, stop trying
            break;
          }
        }
      }
      
      if (!updateSuccess) {
        console.error(`[${requestId}] Failed to update status with all available keys`);
        // Continue anyway, return the data but log the error
      }
    }

    // Track this value as used
    usedValues.push({
      sheetId,
      sheetName,
      row: selectedRow.row,
      value: selectedRow.value,
      timestamp: Date.now()
    });

    // Return simple format like main API - just name and value
    return NextResponse.json({
      "NAME": selectedRow.value.split('|')[0] || selectedRow.value, // Extract first part as name or use full value
      "VALUE": selectedRow.value
    }, { 
      headers: corsHeaders 
    });
  }; // End of processingPromise function

  try {
    // Race between processing and timeout
    return await Promise.race([processingPromise(), timeoutPromise]) as NextResponse;
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    
    // Check if it's a timeout error
    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json({
        error: 'Request timeout - please try again',
        timeout: `${REQUEST_TIMEOUT}ms`,
        queuePosition: processingQueue.findIndex(item => item.id === requestId) + 1
      }, { 
        status: 408, // Request Timeout
        headers: corsHeaders 
      });
    }
    
    return NextResponse.json({
      error: `Lỗi xử lý: ${error instanceof Error ? error.message : 'Unknown error'}`,
      queuePosition: processingQueue.findIndex(item => item.id === requestId) + 1,
      totalInQueue: processingQueue.length
    }, { 
      status: 500,
      headers: corsHeaders 
    });
  } finally {
    // Remove from queue and cleanup processing row
    processingQueue = processingQueue.filter(item => item.id !== requestId);
    
    // Remove all processing rows for this sheet (in case of error)
    const keysToRemove: string[] = [];
    processingRows.forEach((timestamp, key) => {
      if (key.startsWith(`${sheetId}:${sheetName}:`)) {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach(key => processingRows.delete(key));
    
    // Also cleanup based on selectedRow if available
    try {
      if (selectedRow) {
        const selectedRowKey = `${sheetId}:${sheetName}:${selectedRow.row}`;
        processingRows.delete(selectedRowKey);
        console.log(`[${requestId}] Released processing lock for row: ${selectedRowKey}`);
      }
    } catch (e) {
      // selectedRow might not be defined in error cases
    }
    
    console.log(`[${requestId}] Request completed. Queue size: ${processingQueue.length}, Processing rows: ${processingRows.size}`);
  }
}
