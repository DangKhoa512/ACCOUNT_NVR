"use client";

import { useState } from "react";

interface SearchResult {
  value: string;
  row: number;
  column: string;
  rowHeader: string;
  columnHeader: string;
}

interface AutoGetResult {
  value: string;
  row: number;
  column?: string;
  updatedAt?: string;
  timestamp?: string;
  queuePosition?: number;
  statusUpdated?: boolean;
  memoryTracking?: boolean;
  serviceAccount?: boolean;
  usedCount?: number;
  note?: string;
}

export default function Home() {
  // Tab state
  const [activeTab, setActiveTab] = useState<"search" | "autoget" | "getrow">("search");
  
  // Search tab states
  const [sheetId, setSheetId] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [rowValue, setRowValue] = useState("");
  const [columnValue, setColumnValue] = useState("");

  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [copied, setCopied] = useState(false);

  // Auto-get tab states
  const [autoGetSheetId, setAutoGetSheetId] = useState("");
  const [autoGetSheetName, setAutoGetSheetName] = useState("");
  const [autoGetResult, setAutoGetResult] = useState<AutoGetResult | null>(null);
  const [autoGetLoading, setAutoGetLoading] = useState(false);
  const [autoGetError, setAutoGetError] = useState("");

  // Get row tab states
  const [getRowSheetId, setGetRowSheetId] = useState("");
  const [getRowSheetName, setGetRowSheetName] = useState("");
  const [getRowValue, setGetRowValue] = useState("");
  const [getRowResult, setGetRowResult] = useState<any>(null);
  const [getRowLoading, setGetRowLoading] = useState(false);
  const [getRowError, setGetRowError] = useState("");

  const autoGetValue = async () => {
    if (!autoGetSheetId.trim() || !autoGetSheetName.trim()) {
      setAutoGetError("Vui lòng nhập Sheet ID và Sheet Name");
      return;
    }

    setAutoGetLoading(true);
    setAutoGetError("");
    setAutoGetResult(null);

    try {
      const response = await fetch("/api/autoget", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sheetId: autoGetSheetId.trim(),
          sheetName: autoGetSheetName.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Lỗi khi lấy dữ liệu");
      }

      setAutoGetResult(result);
    } catch (err) {
      setAutoGetError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setAutoGetLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getRowData = async () => {
    if (!getRowSheetId.trim() || !getRowSheetName.trim() || !getRowValue.trim()) {
      setGetRowError("Vui lòng nhập đầy đủ Sheet ID, Sheet Name và Row Value");
      return;
    }

    setGetRowLoading(true);
    setGetRowError("");
    setGetRowResult(null);

    try {
      const response = await fetch("/api/sheets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sheetId: getRowSheetId.trim(),
          sheetName: getRowSheetName.trim(),
          rowValue: getRowValue.trim(),
          mode: "getrow"
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Lỗi khi lấy dữ liệu");
      }

      setGetRowResult(result.result);
    } catch (err) {
      setGetRowError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setGetRowLoading(false);
    }
  };

  const fetchSheetData = async () => {
    if (!sheetId.trim()) {
      setError("Vui lòng nhập Sheet ID");
      return;
    }

    setLoading(true);
    setError("");

    setSearchResult(null);
    setCopied(false);

    try {
      const requestBody = {
        sheetId: sheetId.trim(),
        sheetName: sheetName.trim(),
        rowValue: rowValue.trim(),
        columnValue: columnValue.trim(),
        mode: "search"
      };

      const response = await fetch("/api/sheets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Lỗi khi lấy dữ liệu");
      }

      setSearchResult(result.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Google Sheets Data Reader
        </h1>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-md mb-8">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("search")}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === "search"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              🔍 Tìm kiếm theo tọa độ
            </button>
            <button
              onClick={() => setActiveTab("autoget")}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === "autoget"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              🤖 Lấy giá trị tự động
            </button>
            <button
              onClick={() => setActiveTab("getrow")}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === "getrow"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              📊 Lấy toàn bộ cột
            </button>
          </div>
        </div>

        {/* Auto-Get Tab Content */}
        {activeTab === "autoget" && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Lấy giá trị tự động từ cột NVR_ALL
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label
                  htmlFor="autoGetSheetId"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Google Sheet ID
                </label>
                <input
                  type="text"
                  id="autoGetSheetId"
                  value={autoGetSheetId}
                  onChange={(e) => setAutoGetSheetId(e.target.value)}
                  placeholder="Nhập Google Sheet ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor="autoGetSheetName"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Tên Sheet
                </label>
                <input
                  type="text"
                  id="autoGetSheetName"
                  value={autoGetSheetName}
                  onChange={(e) => setAutoGetSheetName(e.target.value)}
                  placeholder="Ví dụ: WEB"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">📋 Cách hoạt động:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Tự động tìm dòng đầu tiên có cột Status chưa có &quot;used&quot;</li>
                <li>• Lấy giá trị từ cột NVR_ALL ở dòng đó</li>
                <li>• Đánh dấu &quot;used&quot; vào cột Status để tránh lấy trùng</li>
                <li>• Có hệ thống xếp hàng khi nhiều máy cùng truy cập</li>
              </ul>
            </div>

            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-medium text-yellow-900 mb-2">🔧 Cấu hình Status Update:</h3>
              <div className="text-sm text-yellow-800 space-y-1">
                <p><strong>✅ Service Account:</strong> Đã được cấu hình</p>
                <p><strong>❌ Permission:</strong> Cần share Google Sheet với Service Account</p>
                <details className="mt-2">
                  <summary className="cursor-pointer font-medium">�️ Cách sửa lỗi Permission Denied</summary>
                  <div className="mt-2 p-3 bg-white rounded border">
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Mở Google Sheet của bạn</li>
                      <li>Click nút <strong>&quot;Share&quot;</strong> (chia sẻ)</li>
                      <li>Add email này: <code className="bg-gray-100 px-1 rounded">ggsheet@still-function-403307.iam.gserviceaccount.com</code></li>
                      <li>Chọn quyền: <strong>&quot;Editor&quot;</strong></li>
                      <li>Click <strong>&quot;Send&quot;</strong></li>
                      <li>Refresh trang web này và test lại</li>
                    </ol>
                  </div>
                </details>
              </div>
            </div>

            <button
              onClick={autoGetValue}
              disabled={autoGetLoading}
              className="w-full md:w-auto px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {autoGetLoading ? "🔄 Đang lấy..." : "🚀 Lấy giá trị tự động"}
            </button>

            {autoGetError && (
              <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {autoGetError}
              </div>
            )}

            {autoGetResult && (
              <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-800 mb-4">
                  ✅ Đã lấy thành công!
                </h3>
                <div className="space-y-4">
                  {/* Value Section */}
                  <div>
                    <span className="font-medium text-gray-700 block mb-2">Giá trị lấy được:</span>
                    <div className="bg-white border rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div 
                            className="text-sm font-mono break-all text-gray-800 max-h-20 overflow-y-auto leading-relaxed"
                            title={autoGetResult.value}
                          >
                            {autoGetResult.value}
                          </div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(autoGetResult.value)}
                          className={`flex-shrink-0 px-3 py-2 rounded text-sm font-medium transition-colors ${
                            copied 
                              ? 'bg-green-600 text-white' 
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                          title="Copy to clipboard"
                        >
                          {copied ? '✓ Copied' : '📋 Copy'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Details Section */}
                  <div>
                    <span className="font-medium text-gray-700 block mb-2">Chi tiết:</span>
                    <div className="bg-white border rounded-lg p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                        <div>
                          <strong>Dòng:</strong> {autoGetResult.row}
                        </div>
                        <div>
                          <strong>Cột:</strong> {autoGetResult.column || 'A'}
                        </div>
                        <div className="sm:col-span-2">
                          <strong>Thời gian:</strong> {new Date(autoGetResult.updatedAt || autoGetResult.timestamp || Date.now()).toLocaleString('vi-VN')}
                        </div>
                        {autoGetResult.queuePosition && (
                          <div className="text-blue-600 sm:col-span-2">
                            <strong>Vị trí hàng chờ:</strong> {autoGetResult.queuePosition}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Section */}
                  <div>
                    <div className="bg-white border rounded-lg p-3">
                      {autoGetResult.serviceAccount && (
                        <div className="text-green-600 text-sm">
                          ✅ <strong>Service Account:</strong> Status đã được cập nhật trong Google Sheets
                        </div>
                      )}
                      {autoGetResult.memoryTracking && (
                        <div className="text-purple-600 text-sm">
                          📝 <strong>Memory tracking:</strong> {autoGetResult.usedCount} values đã sử dụng
                        </div>
                      )}
                      {autoGetResult.note && (
                        <div className="text-orange-600 text-xs mt-1 italic">
                          ℹ️ {autoGetResult.note}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {copied && (
                  <div className="mt-3 text-sm text-green-700 font-medium">
                    ✓ Đã copy vào clipboard!
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Search Tab Content */}
        {activeTab === "search" && (
          <>
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <div className="mb-6">
                <div className="text-sm font-medium text-gray-700 mb-3">
                  🔍 Tìm kiếm theo tọa độ
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label
                    htmlFor="sheetId"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Google Sheet ID
                  </label>
                  <input
                    type="text"
                    id="sheetId"
                    value={sheetId}
                    onChange={(e) => setSheetId(e.target.value)}
                    placeholder="Nhập Google Sheet ID"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label
                    htmlFor="sheetName"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Tên Sheet
                  </label>
                  <input
                    type="text"
                    id="sheetName"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    placeholder="Ví dụ: WEB"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rowValue"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Giá trị dòng (Row)
                  </label>
                  <input
                    type="text"
                    id="rowValue"
                    value={rowValue}
                    onChange={(e) => setRowValue(e.target.value)}
                    placeholder="Ví dụ: May1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label
                    htmlFor="columnValue"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Giá trị cột (Column)
                  </label>
                  <input
                    type="text"
                    id="columnValue"
                    value={columnValue}
                    onChange={(e) => setColumnValue(e.target.value)}
                    placeholder="Ví dụ: TOTP"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                onClick={fetchSheetData}
                disabled={loading}
                className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Đang tải..." : "🔍 Tìm kiếm"}
              </button>

              {error && (
                <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}
            </div>

            {searchResult && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Kết quả tìm kiếm
                </h2>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium text-gray-700">Giá trị:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-lg font-mono bg-gray-100 px-3 py-2 rounded flex-1">
                          {searchResult.value}
                        </div>
                        <button
                          onClick={() => copyToClipboard(searchResult.value)}
                          className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                            copied 
                              ? 'bg-green-600 text-white' 
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                          title="Copy to clipboard"
                        >
                          {copied ? '✓' : '📋'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Tọa độ:</span>
                      <div className="text-sm text-gray-600 mt-1">
                        <div>Dòng {searchResult.row} ({searchResult.rowHeader})</div>
                        <div>Cột {searchResult.column} ({searchResult.columnHeader})</div>
                      </div>
                    </div>
                  </div>
                  
                  {copied && (
                    <div className="mt-3 text-sm text-green-700 font-medium">
                      ✓ Đã copy vào clipboard!
                    </div>
                  )}
                </div>
              </div>
            )}


          </>
        )}

        {/* Get Row Tab Content */}
        {activeTab === "getrow" && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="mb-6">
              <div className="text-sm font-medium text-gray-700 mb-3">
                📊 Lấy toàn bộ dữ liệu của một cột
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label
                  htmlFor="getRowSheetId"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Google Sheet ID
                </label>
                <input
                  type="text"
                  id="getRowSheetId"
                  value={getRowSheetId}
                  onChange={(e) => setGetRowSheetId(e.target.value)}
                  placeholder="1abc..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor="getRowSheetName"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Sheet Name
                </label>
                <input
                  type="text"
                  id="getRowSheetName"
                  value={getRowSheetName}
                  onChange={(e) => setGetRowSheetName(e.target.value)}
                  placeholder="Ví dụ: TEST"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor="getRowValue"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Column Name (Header)
                </label>
                <input
                  type="text"
                  id="getRowValue"
                  value={getRowValue}
                  onChange={(e) => setGetRowValue(e.target.value)}
                  placeholder="Ví dụ: Roothide"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">📋 Cách hoạt động:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Tìm cột có header chứa Column Name</li>
                <li>• Trả về toàn bộ dữ liệu của cột đó</li>
                <li>• Hiển thị từng value với row number tương ứng</li>
                <li>• Ví dụ: nhập &quot;Roothide&quot; → lấy toàn bộ cột A</li>
              </ul>
            </div>

            <button
              onClick={getRowData}
              disabled={getRowLoading}
              className="w-full md:w-auto px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {getRowLoading ? "Đang tải..." : "📊 Lấy Column Data"}
            </button>

            {getRowError && (
              <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {getRowError}
              </div>
            )}

            {getRowResult && (
              <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-800 mb-4">
                  ✅ Dữ liệu cột tìm được!
                </h3>
                <div className="space-y-3">
                  <div className="text-sm text-green-700 grid grid-cols-2 gap-4">
                    <div><strong>Header:</strong> {getRowResult.columnHeader}</div>
                    <div><strong>Cột:</strong> {getRowResult.columnLetter}</div>
                    <div><strong>Tổng values:</strong> {getRowResult.totalValues}</div>
                    <div><strong>Index:</strong> {getRowResult.columnIndex}</div>
                  </div>
                  
                  <div className="bg-white border rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-3">Dữ liệu của cột {getRowResult.columnHeader}:</h4>
                    <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
                      {getRowResult.data && getRowResult.data.map((item: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="font-medium text-gray-600 text-sm">Row {item.row}:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-gray-800 bg-white px-2 py-1 rounded border max-w-md truncate">
                              {item.value || "---"}
                            </span>
                            <button
                              onClick={() => copyToClipboard(item.value?.toString() || "")}
                              className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 flex-shrink-0"
                              title="Copy value"
                            >
                              📋
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {getRowResult.data && getRowResult.data.length === 0 && (
                      <div className="text-center text-gray-500 py-4">
                        Không có dữ liệu trong cột này
                      </div>
                    )}
                  </div>
                  
                  {copied && (
                    <div className="mt-3 text-sm text-green-700 font-medium">
                      ✓ Đã copy vào clipboard!
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}