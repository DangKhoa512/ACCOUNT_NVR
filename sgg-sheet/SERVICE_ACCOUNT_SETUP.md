# Service Account Setup Guide

## Bước 1: Tạo Service Account trên Google Cloud Console

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Chọn project hoặc tạo project mới
3. Vào **APIs & Services** > **Credentials**
4. Click **CREATE CREDENTIALS** > **Service account**
5. Nhập tên Service Account (ví dụ: `sheets-updater`)
6. Click **CREATE AND CONTINUE**
7. Chọn Role: **Editor** hoặc **Owner**
8. Click **DONE**

## Bước 2: Tạo JSON Key cho Service Account

1. Click vào Service Account vừa tạo
2. Vào tab **KEYS**
3. Click **ADD KEY** > **Create new key**
4. Chọn **JSON**
5. Click **CREATE**
6. File JSON sẽ được download về máy

## Bước 3: Cấu hình Environment Variables

1. Mở file JSON vừa download
2. Copy toàn bộ nội dung
3. Thêm vào file `.env.local`:

```bash
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id",...}'
```

**Lưu ý**: Bao quanh JSON bằng dấu nháy đơn để tránh lỗi parsing

## Bước 4: Chia sẻ Google Sheet với Service Account

1. Mở Google Sheet cần update
2. Click **Share** (chia sẻ)
3. Add email của Service Account (có trong file JSON: `client_email`)
4. Chọn permission: **Editor**
5. Click **Send**

## Bước 5: Enable Google Sheets API

1. Vào Google Cloud Console
2. **APIs & Services** > **Library**
3. Tìm **Google Sheets API**
4. Click **ENABLE**

## Test

Sau khi setup xong, restart development server:
```bash
npm run dev
```

Thử sử dụng Auto-get, nó sẽ tự động detect và sử dụng Service Account để update Status column.

## Troubleshooting

- **Permission denied**: Kiểm tra Service Account đã được share với Sheet chưa
- **Authentication error**: Kiểm tra JSON trong `.env.local` có đúng format không
- **API not enabled**: Enable Google Sheets API trên Google Cloud Console