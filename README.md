<div align="center">

# 🎓 THANKS QUEST

### Campus Adventure World

**Game web 2D phiêu lưu – giáo dục – tri ân thầy cô**

*Dự thi **CODE THE THANKS 2026** · Sáng tạo không giới hạn – Tri ân bằng công nghệ*

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Phaser](https://img.shields.io/badge/Phaser-3-8A2BE2)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Node](https://img.shields.io/badge/Node-20+-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)

[Giới thiệu](#-giới-thiệu) · [Tính năng](#-tính-năng) · [Công nghệ](#-công-nghệ) · [Chạy local](#-chạy-local) · [Kiểm thử](#-kiểm-thử) · [Triển khai](#-triển-khai) · [Cấu trúc](#-cấu-trúc-dự-án)

</div>

---

## 📖 Giới thiệu

Người chơi khám phá một khuôn viên trường **hư cấu, tự thiết kế** gồm **6 khu vực**, trò chuyện với **6 NPC**, nhận nhiệm vụ, chơi **4 mini game**, tích lũy XP và thành tựu, rồi gửi lời tri ân lên **Tường tri ân**. AI chỉ hỗ trợ trình bày câu chữ, **không bịa kỷ niệm**.

> 🎮 **Không cần tài khoản** để chơi thử (Guest Mode). Đăng ký sau vẫn giữ nguyên toàn bộ tiến độ.

---

## ✨ Tính năng

### 🌏 Thế giới & nhân vật

| | |
|---|---|
| 🧑‍🎓 **Nhân vật Chibi** | 4 nhân vật nguyên bản (Thầy giáo, Cô giáo, Học sinh nam, Học sinh nữ), phong cách cel-shading 3D-render, viền rim light, sprite atlas 128×128. Hỗ trợ thả file ảnh thật plug-and-play (xem `docs/ASSETS.md`). |
| 🏫 **6 khu vực** | Knowledge Plaza, Library of Wisdom, Technology Lab, Creative Garden, Memory Courtyard, Gratitude Hall. |
| 🌸 **Hiệu ứng** | Nắng ấm sân trường, cánh hoa phượng rơi, lá bay, bụi khi chạy, cây đung đưa, NPC thở idle, chuyển cảnh mờ dần. Có tùy chọn tắt "Hiệu ứng nâng cao" cho máy yếu. |
| 🗺️ **Mini Map** | Vẽ trực tiếp từ lưới ô Tiled của khu hiện tại (không dùng GPS/Leaflet): người chơi kèm mũi tên hướng, chấm vàng NPC (có dấu "!" khi có nhiệm vụ), chấm cyan vật phẩm (tự ẩn khi nhặt), cổng chuyển khu kèm trạng thái khóa. Thu gọn/mở rộng được, bấm để mở bản đồ chi tiết. |

### 🎯 Gameplay

| | |
|---|---|
| 📜 **Nhiệm vụ & phần thưởng** | Nhiệm vụ chính, phụ, hằng ngày, thành tựu; túi đồ; XP và cấp độ. |
| 🧩 **4 mini game giáo dục** | **Knowledge Quiz** · **Memory Matching** · **Code Debugging** (không chạy code của người dùng) · **Treasure Hunt** |
| 🏆 **Bảng xếp hạng** | Chỉ tính tài khoản chính thức. |

### 💌 Tri ân & AI

| | |
|---|---|
| 🤖 **AI Gratitude Storyteller** | Dùng Gemini/Groq qua backend. Không có key vẫn chạy ở chế độ mẫu. Người dùng xem, sửa và xác nhận trước khi gửi. |
| 🧱 **Tường tri ân** | Có kiểm duyệt và báo cáo nội dung. |
| 🛠️ **Trang quản trị** | Số liệu, kiểm duyệt, báo cáo, CRUD nội dung. |

### 🔊 Âm thanh (AudioManager)

- **Nhạc nền riêng cho từng khu:** Plaza (ukulele tươi vui), Library (êm dịu), Lab (điện tử nhịp nhanh), Garden (thư thái), Courtyard (hoài niệm), Hall (ấm áp trang trọng).
- **13 loại SFX:** XP, lên cấp, vật phẩm, thành tựu, bước chân, v.v.
- **Audio ducking** khi hội thoại hoặc mini game, tự dừng khi ẩn tab, nhớ cài đặt âm lượng bằng `localStorage`.

### 📱 Tối ưu điện thoại

- Giao diện gọn riêng cho chế độ **xoay ngang**, bố cục tránh joystick đè lên HUD và minimap.
- Nhắc người chơi xoay ngang, và hướng dẫn mở **trình duyệt ngoài** khi vào từ Facebook/Zalo (các trình duyệt này hay chặn xoay ngang).

### 👤 Tài khoản & Guest Mode

- Phiên khách phía máy chủ, tự hết hạn, có giới hạn XP.
- Đăng ký/đăng nhập bằng JWT kèm refresh rotation, chuyển Guest → tài khoản giữ nguyên tiến độ.

### 🎨 Tài nguyên nguyên bản

Mọi đồ họa và âm thanh đều là bản gốc (CC0 hoặc tự sinh). Chi tiết ở `docs/CREDITS.md` và `docs/ASSETS.md`.

---

## 🧰 Công nghệ

| Tầng | Công nghệ |
|---|---|
| **Frontend** | Vite · React · TypeScript · Tailwind CSS · Phaser 3 |
| **Backend** | Node.js 20+ · Express · TypeScript · Mongoose |
| **Cơ sở dữ liệu** | MongoDB (local hoặc Atlas) |
| **AI** | Gemini / Groq (qua backend) |
| **Triển khai** | Vercel (frontend) · Render (backend) · MongoDB Atlas |

---

## 🔐 Nguyên tắc an toàn dữ liệu

- **Máy chủ là nguồn sự thật:** XP, cấp, vật phẩm, kết quả mini game, đáp án và vị trí kho báu đều do backend tính và giữ.
- **Chống nhận thưởng trùng:** phần thưởng ghi qua sổ cái bất biến (`RewardEvent`, khóa duy nhất). Việc chuyển Guest → tài khoản là idempotent.
- **Khóa API chỉ ở backend**, không bao giờ xuất hiện ở frontend.

Xem thêm: [`docs/SECURITY.md`](docs/SECURITY.md)

---

## 🚀 Chạy local

**Yêu cầu:** Node 20+, MongoDB (local hoặc Atlas).

### 1. Clone dự án

```bash
git clone https://github.com/gnuh2005/thanks-quest.git
cd thanks-quest
```

### 2. Backend

```bash
cd backend
cp .env.example .env      # điền MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
npm install
npm run dev               # http://localhost:4000, tự nạp dữ liệu mẫu khi DB trống
```

> Windows PowerShell: dùng `copy .env.example .env`

### 3. Frontend (mở terminal khác)

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173 (proxy /api → :4000)
```

### 4. Tạo tài khoản Admin

Không có mật khẩu mặc định, bạn tự đặt (tối thiểu 12 ký tự):

```bash
ADMIN_EMAIL=ban@example.com ADMIN_PASSWORD='mat-khau-it-nhat-12-ky-tu' npm run create-admin
```

PowerShell:

```powershell
$env:ADMIN_EMAIL='ban@example.com'; $env:ADMIN_PASSWORD='mat-khau-it-nhat-12-ky-tu'; npm run create-admin
```

> ⚠️ **Không commit file `.env`** lên GitHub. Hãy chắc chắn nó đã nằm trong `.gitignore`.

---

## 🧪 Kiểm thử

```bash
cd backend
npm test                                                      # test đơn vị (không cần DB)
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/tq_test npm test   # thêm test tích hợp với MongoDB thật

cd ../frontend
npm run build                                                 # kiểm tra kiểu + build
```

Chi tiết: [`docs/TESTING.md`](docs/TESTING.md)

---

## ☁️ Triển khai

Vercel (frontend) + Render (backend) + MongoDB Atlas.

- Hướng dẫn: [`docs/DEPLOY.md`](docs/DEPLOY.md)
- Kịch bản demo: [`docs/DEMO.md`](docs/DEMO.md)

---

## 🗂️ Cấu trúc dự án

```
thanks-quest/
├── backend/     Express + TypeScript + Mongoose
│                (models, domain, services, routes, seed, tests)
├── frontend/    Vite + React + Tailwind + Phaser 3
│                (pages, components, game/scenes, stores)
└── docs/        PLAN · DEPLOY · DEMO · SECURITY · TESTING · API · ASSETS · CREDITS
```

---

## 📚 Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | Kế hoạch dự án |
| [`docs/API.md`](docs/API.md) | Mô tả API |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Mô hình bảo mật |
| [`docs/TESTING.md`](docs/TESTING.md) | Hướng dẫn kiểm thử |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Triển khai |
| [`docs/DEMO.md`](docs/DEMO.md) | Kịch bản demo |
| [`docs/ASSETS.md`](docs/ASSETS.md) · [`docs/CREDITS.md`](docs/CREDITS.md) | Tài nguyên & giấy phép |

---

<div align="center">

**THANKS QUEST** · Tri ân thầy cô bằng công nghệ 💛

*Dự thi CODE THE THANKS 2026*

</div>