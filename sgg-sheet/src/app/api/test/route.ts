import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'API is working!' });
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== Environment Variables Test ===');
    
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    console.log('API Key exists:', !!apiKey);
    console.log('API Key length:', apiKey?.length || 0);
    console.log('API Key preview:', apiKey?.substring(0, 20) + '...' || 'NOT_FOUND');
    
    console.log('Service Account exists:', !!serviceAccount);
    console.log('Service Account length:', serviceAccount?.length || 0);
    console.log('Service Account preview:', serviceAccount?.substring(0, 50) + '...' || 'NOT_FOUND');
    
    // Test Google Sheets API
    if (apiKey) {
      try {
        const testResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/160UG1GUU-NBBxUalNZimnHSS2LJ9SZsR843l4UXwg-E?key=${apiKey}`
        );
        console.log('Google Sheets API test status:', testResponse.status);
        if (testResponse.ok) {
          const data = await testResponse.json();
          console.log('Sheet access successful:', data.properties?.title);
        } else {
          const errorText = await testResponse.text();
          console.log('Google Sheets API error:', errorText);
        }
      } catch (error) {
        console.error('Google Sheets API test error:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      environment: process.env.NODE_ENV,
      envVars: {
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey?.length || 0,
        apiKeyPreview: apiKey?.substring(0, 20) + '...' || 'NOT_FOUND',
        hasServiceAccount: !!serviceAccount,
        serviceAccountLength: serviceAccount?.length || 0,
        serviceAccountPreview: serviceAccount?.substring(0, 50) + '...' || 'NOT_FOUND'
      }
    });
    
  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: process.env.NODE_ENV
    }, { status: 500 });
  }
}