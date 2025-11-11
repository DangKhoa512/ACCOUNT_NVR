"use client";

import { useState } from "react";

export default function TestPage() {
  const [result, setResult] = useState<any>(null);

  const testAPI = async () => {
    const testData = {
      sheetId: "160UG1GUU-NBBxUalNZimnHSS2LJ9SZsR843l4UXwg-E",
      sheetName: "WEB", 
      rowValue: "May1",
      columnValue: "TOTP",
      mode: "search"
    };

    console.log('Sending request:', testData);

    try {
      const response = await fetch("/api/sheets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testData),
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response body:', result);
      setResult({ status: response.status, data: result });
    } catch (error) {
      console.error('Error:', error);
      setResult({ error: error });
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Test</h1>
      
      <button 
        onClick={testAPI}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Test API
      </button>

      {result && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h2 className="font-bold">Result:</h2>
          <pre className="mt-2 text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}