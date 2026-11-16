# Triển khai

## 1. MongoDB Atlas
1. Tạo cluster (M0 miễn phí), tạo database user, mở Network Access cho IP của Render (hoặc 0.0.0.0/0 khi demo).
2. Lấy connection string `mongodb+srv://...` → `MONGODB_URI` (thêm tên DB, ví dụ `/thanksquest`).

## 2. Backend trên Render
- New → Blueprint, chọn repo (dùng `render.yaml`) hoặc tạo Web Service: Root `backend`, Build `npm ci && npm run build`, Start `npm start`.
- Biến môi trường: `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (Render có thể tự sinh), `CORS_ORIGINS` (URL Vercel), tùy chọn `GEMINI_API_KEY` / `GROQ_API_KEY`.
- Lần chạy đầu, DB trống sẽ tự nạp dữ liệu mẫu (`AUTO_SEED=true`).
- Tạo Admin: mở Shell của Render → `ADMIN_EMAIL=... ADMIN_PASSWORD='...' npx tsx src/scripts/createAdmin.ts` (hoặc chạy từ máy bạn với `MONGODB_URI` của Atlas).

## 3. Frontend trên Vercel
- Root Directory `frontend`, framework Vite.
- Mở `frontend/vercel.json`, thay `THAY-BANG-URL-RENDER.onrender.com` bằng domain Render của bạn.
  Rewrite `/api/*` giúp cookie là **same-site**, không cần bật `COOKIE_CROSS_SITE`.
- `CORS_ORIGINS` phía Render = domain Vercel.

## 4. Kiểm tra sau triển khai
`GET /api/health` trả `db: connected`; vào `/choi-thu`, chơi một vòng, đăng ký, xem `/xep-hang`; đăng nhập Admin tại `/quan-tri`.
Lưu ý: Render gói free ngủ khi nhàn rỗi, lần gọi đầu có thể chậm vài chục giây.
