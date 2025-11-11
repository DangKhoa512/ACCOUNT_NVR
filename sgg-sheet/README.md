# Google Sheets Reader

Ứng dụng Next.js để đọc dữ liệu từ Google Sheets với tham số tùy chỉnh.

## Tính năng

- 🎯 **Tìm kiếm theo tọa độ**: Tìm giá trị tại giao điểm của dòng và cột cụ thể
- � **Auto-Get với Queue System**: Lấy giá trị tự động từ cột NVR_ALL với xếp hàng đợi
- 🗂️ **Lấy toàn bộ cột**: Truy xuất dữ liệu theo tên header của cột
- �📊 Đọc và ghi dữ liệu từ Google Sheets
- 💻 Giao diện 3 tab hiện đại với Tailwind CSS
- ⚡ API route tối ưu với Next.js 14
- 🔒 Bảo mật với Google Sheets API + Service Account
- � Copy to clipboard cho mọi giá trị
- 🚀 **Deploy sẵn sàng trên Vercel**

## Cài đặt

1. Cài đặt dependencies:
```bash
npm install
```

2. Tạo file `.env.local` và thêm Google Sheets API key + Service Account:
```
GOOGLE_SHEETS_API_KEY=your_google_api_key_here
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"..."}'
```

3. Chạy ứng dụng:
```bash
npm run dev
```

## Cách sử dụng

1. **Lấy Google Sheets API Key:**
   - Truy cập [Google Cloud Console](https://console.cloud.google.com/)
   - Tạo project mới hoặc chọn project có sẵn
   - Enable Google Sheets API
   - Tạo credentials (API Key)
   - Copy API key và thêm vào `.env.local`

2. **Chuẩn bị Google Sheet (Private Sheet):**
   
   **✅ Ưu điểm của Private Sheet:**
   - Không cần public sheet, bảo mật cao hơn  
   - Chỉ Service Account có quyền truy cập
   - Kiểm soát quyền truy cập chặt chẽ

   **📋 Cách setup:**
   - Tạo Google Sheet (private, không cần public)
   - **Share Sheet với Service Account:**
     - Click "Share" trên Google Sheet
     - Thêm email Service Account: `ggsheet@still-function-403307.iam.gserviceaccount.com`
     - Chọn quyền: **Editor** (để Auto-Get có thể cập nhật Status)
   - Copy Sheet ID từ URL (phần giữa `/spreadsheets/d/` và `/edit`)

   **⚠️ Lưu ý:** Sheet KHÔNG cần public, chỉ cần share với Service Account

3. **Sử dụng ứng dụng:**

   **Chế độ Tìm kiếm theo tọa độ:**
   - Nhập Google Sheet ID (ví dụ: `160UG1GUU-NBBxUalNZimnHSS2LJ9SZsR843l4UXwg-E`)
   - Nhập tên Sheet (ví dụ: `WEB`)
   - Nhập giá trị dòng tìm kiếm (ví dụ: `May1`) - sẽ tìm trong cột A
   - Nhập giá trị cột tìm kiếm (ví dụ: `TOTP`) - sẽ tìm trong dòng 1
   - Click "Tìm kiếm" để lấy giá trị tại giao điểm

   **Chế độ Xem toàn bộ sheet:**
   - Nhập Google Sheet ID và tên Sheet
   - Click "Lấy dữ liệu" để xem toàn bộ sheet dạng bảng

## Cấu trúc Project

```
src/
├── app/
│   ├── api/
│   │   └── sheets/
│   │       └── route.ts          # API endpoint
│   ├── globals.css               # Tailwind CSS
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Main page
└── ...
```

## Công nghệ sử dụng

- **Next.js 14** - React framework với App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Google Sheets API** - Đọc dữ liệu từ sheets
- **googleapis** - Google API client

## API Endpoints

### POST /api/sheets

**Chế độ Tìm kiếm (Search Mode):**

**Request Body:**
```json
{
  "sheetId": "160UG1GUU-NBBxUalNZimnHSS2LJ9SZsR843l4UXwg-E",
  "sheetName": "WEB",
  "rowValue": "May1",
  "columnValue": "TOTP",
  "mode": "search"
}
```

**Response:**
```json
{
  "result": {
    "value": "2raypvSPRVPaM7ZTFyXWdu0Ho",
    "row": 5,
    "column": "E",
    "rowHeader": "May1",
    "columnHeader": "TOTP"
  }
}
```

**Chế độ Xem (View Mode):**

**Request Body:**
```json
{
  "sheetId": "your_sheet_id",
  "sheetName": "WEB",
  "mode": "view"
}
```

**Response:**
```json
{
  "data": [
    {
      "Column1": "value1",
      "Column2": "value2"
    }
  ]
}
```

## Lưu ý

- Google Sheet phải được chia sẻ công khai để API có thể truy cập
- **Chế độ tìm kiếm:** Tìm giá trị dòng ở cột A (cột đầu tiên), tìm giá trị cột ở dòng 1 (dòng đầu tiên)
- **Kết quả:** Trả về giá trị tại giao điểm của dòng và cột tìm được
- Tìm kiếm không phân biệt chữ hoa/thường và hỗ trợ tìm kiếm một phần

## Scripts

```bash
# Development
npm run dev

# Build
npm run build

# Start production
npm start

# Lint
npm run lint
```