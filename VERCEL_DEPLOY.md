# 🚀 Deploy lên Vercel

## Quick Deploy Steps

### 1. Chuẩn bị code
```bash
# Build và test local
npm run build
npm start
```

### 2. Push lên GitHub
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### 3. Deploy trên Vercel

#### Option 1: Automatic (Recommended)
1. Truy cập [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Vercel sẽ tự động detect Next.js project
5. Click "Deploy"

#### Option 2: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow the prompts
```

### 4. Configure Environment Variables

Tại Vercel Dashboard → Project Settings → Environment Variables:

**Cách thêm từng variable:**

1. **GOOGLE_SHEETS_API_KEY**
   - Name: `GOOGLE_SHEETS_API_KEY`
   - Value: `AIzaSyApn6KYq2ou1oJiU1N9XUVp6B__XOK4tOI`
   - Environment: Production, Preview, Development (chọn tất cả)

2. **GOOGLE_SERVICE_ACCOUNT_KEY**
   - Name: `GOOGLE_SERVICE_ACCOUNT_KEY`
   - Value: Copy toàn bộ JSON từ .env.local (bao gồm cả dấu ngoặc nhọn)
   - Environment: Production, Preview, Development (chọn tất cả)

**⚠️ Lưu ý quan trọng:**
- Paste JSON content EXACTLY như trong .env.local
- KHÔNG escape quotes hoặc thay đổi format
- Bao gồm cả dấu ngoặc nhọn `{...}`
- Sau khi thêm env vars → REDEPLOY project

### 5. Final Deploy
- Sau khi add environment variables → Deploy lại
- Vercel sẽ tự động redeploy với new settings

## 🔧 Production Checklist

- [ ] Google Sheets API enabled
- [ ] Service Account created với JSON key
- [ ] Google Sheets được share với Service Account email (Editor quyền)
- [ ] Environment variables configured trên Vercel
- [ ] Build successful locally
- [ ] All 3 tabs tested

## 📊 Post-Deploy

### Monitoring
- **Vercel Dashboard:** Functions tab để xem logs
- **Analytics:** Monitor API calls
- **Errors:** Set up alerts

### Testing Production
```bash
# Test API endpoints
curl https://your-app.vercel.app/api/sheets \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"sheetId":"your-sheet-id","sheetName":"Sheet1","mode":"search","rowValue":"test","columnValue":"test"}'
```

### Auto Deployment
- Mỗi git push → main branch sẽ trigger auto deployment
- Preview deployments cho pull requests
- Rollback dễ dàng qua Vercel Dashboard

## 🚨 Troubleshooting

### Build Errors
```bash
# Check build locally first
npm run build

# Common fixes:
npm run lint -- --fix
```

### Environment Variables
- Paste JSON **exactly** như trong file .env.local
- Không escape quotes trong Vercel interface
- Redeploy sau khi change env vars

### API Errors
- Check Function logs tại Vercel Dashboard
- Verify Google Sheets permissions
- Test Service Account credentials

### Domain Setup (Optional)
- Vercel Dashboard → Settings → Domains
- Add custom domain nếu cần

## ⚡ Performance Tips

- Vercel Edge Network tự động optimize
- API routes được cache hợp lý
- Static files served via CDN
- Automatic HTTPS

---

**🎉 Sau khi deploy thành công, app sẽ available tại: `https://your-project-name.vercel.app`**