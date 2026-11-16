# THANKS QUEST — Campus Adventure World

Game web 2D phiêu lưu – giáo dục – tri ân thầy cô, dự thi **CODE THE THANKS 2026**
(*Sáng tạo không giới hạn – Tri ân bằng công nghệ*).

Người chơi khám phá một khuôn viên trường **hư cấu, tự thiết kế** gồm 6 khu vực, trò chuyện với 6 NPC, nhận nhiệm vụ,
chơi 4 mini game, tích lũy XP/thành tựu và gửi lời tri ân lên **Tường tri ân** (có AI hỗ trợ trình bày, không bịa kỷ niệm).
**Không cần tài khoản** để chơi thử (Guest Mode); đăng ký sau sẽ giữ nguyên tiến độ.

## Tính năng
- **Nhân vật Chibi 3D-render phong cách cel-shading:** 4 nhân vật nguyên bản (Thầy giáo, Cô giáo, Học sinh nam, Học sinh nữ) với viền sáng rim light, mắt to long lanh, bóng đổ chân thực, hỗ trợ sprite atlas 128×128 và cơ chế thả file ảnh thật plug-and-play (`docs/ASSETS.md`).
- **Thế giới Phaser 3 nâng cấp:** 6 khu vực khuôn viên trường (Knowledge Plaza, Library of Wisdom, Technology Lab, Creative Garden, Memory Courtyard, Gratitude Hall), nắng ấm sân trường, cánh hoa phượng rơi, lá bay, bụi chạy, cây đung đưa, NPC thở idle, chuyển cảnh mờ dần, tùy chọn bật/tắt "Hiệu ứng nâng cao" cho máy yếu.
- **Mini Map ở góc trái màn hình:** Hiển thị trực tiếp từ lưới ô Tiled của khu hiện tại (không dùng GPS/Leaflet), hiển thị người chơi kèm mũi tên hướng đi, chấm vàng NPC (kèm dấu "!" khi có nhiệm vụ), chấm cyan vật phẩm (tự ẩn khi nhặt), cổng chuyển khu kèm trạng thái khóa. Có nút thu gọn/mở rộng, bấm vào mở bản đồ chi tiết, thiết kế chống chồng đè joystick trên điện thoại.
- **Hệ thống Âm thanh & Nhạc nền (AudioManager):** Nhạc nền riêng 6 khu vực (Plaza: ukulele tươi vui, Library: êm dịu, Lab: điện tử nhịp nhanh, Garden: thư thái, Courtyard: hoài niệm, Hall: ấm áp trang trọng), 13 loại SFX (XP, level up, vật phẩm, thành tựu, bước chân, v.v.), cơ chế giảm âm lượng nền (audio ducking) khi hội thoại/mini game, tự dừng khi ẩn tab, nhớ cài đặt âm lượng bằng localStorage.
- **Landing page & Guest Mode:** Phiên khách phía máy chủ, hết hạn tự động, giới hạn XP, đăng ký/đăng nhập (JWT + refresh rotation) giữ nguyên toàn bộ tiến độ.
- **Nhiệm vụ & Phần thưởng:** Hệ thống nhiệm vụ (chính/phụ/hằng ngày/thành tựu), túi đồ, XP & cấp độ.
- **4 mini game giáo dục:** **Knowledge Quiz, Memory Matching, Code Debugging (không chạy code người dùng), Treasure Hunt**.
- **AI Gratitude Storyteller:** Gemini/Groq qua backend; không có key vẫn chạy ở chế độ mẫu; người dùng xem/sửa/xác nhận trước khi gửi.
- **Tường tri ân & Bảng xếp hạng:** Kiểm duyệt + báo cáo; Bảng xếp hạng (chỉ tài khoản chính thức); Trang quản trị (số liệu, kiểm duyệt, báo cáo, CRUD nội dung).
- **Tài nguyên nguyên bản & Giấy phép rõ ràng:** Mọi tài nguyên đồ họa và âm thanh là bản gốc (CC0/tự sinh), xem chi tiết tại `docs/CREDITS.md` và `docs/ASSETS.md`.

## Nguyên tắc an toàn dữ liệu
Máy chủ là nguồn sự thật: XP, cấp, vật phẩm, kết quả mini game, đáp án và vị trí kho báu đều do backend tính/giữ.
Phần thưởng ghi qua sổ cái bất biến (`RewardEvent`, khóa duy nhất) nên không nhận trùng; chuyển Guest → tài khoản là idempotent.
Khóa API chỉ tồn tại ở backend. Xem `docs/SECURITY.md`.

## Chạy local
Yêu cầu: Node 20+, MongoDB (local hoặc Atlas).

```bash
# Backend
cd backend
cp .env.example .env      # điền MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
npm install
npm run dev               # http://localhost:4000, tự nạp dữ liệu mẫu khi DB trống

# Frontend (terminal khác)
cd frontend
npm install
npm run dev               # http://localhost:5173 (proxy /api → :4000)
```
Windows PowerShell: dùng `copy .env.example .env`.

Tạo tài khoản Admin (không có mật khẩu mặc định):
```bash
ADMIN_EMAIL=ban@example.com ADMIN_PASSWORD='mat-khau-it-nhat-12-ky-tu' npm run create-admin
```
PowerShell: `$env:ADMIN_EMAIL='...'; $env:ADMIN_PASSWORD='...'; npm run create-admin`.

## Kiểm thử
```bash
cd backend
npm test                                  # test đơn vị (không cần DB)
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/tq_test npm test   # thêm test tích hợp với MongoDB thật
cd ../frontend && npm run build           # kiểm tra kiểu + build
```
Chi tiết: `docs/TESTING.md`.

## Triển khai
Vercel (frontend) + Render (backend) + MongoDB Atlas: xem `docs/DEPLOY.md`. Kịch bản demo: `docs/DEMO.md`.

## Cấu trúc
```
backend/   Express + TypeScript + Mongoose (models, domain, services, routes, seed, tests)
frontend/  Vite + React + Tailwind + Phaser 3 (pages, components, game/scenes, stores)
docs/      PLAN, DEPLOY, DEMO, SECURITY, TESTING, API
```
