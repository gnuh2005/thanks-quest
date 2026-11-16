# Kiểm thử
- **Backend**: `cd backend && npm test` — 108 test (miền tiến trình, chấm bài, thành tựu, gộp guest, API tích hợp: auth, rotation refresh, guest, quest, mini game, thưởng không trùng, chuyển đổi guest, tri ân, kiểm duyệt, admin, xếp hạng).
  Test tích hợp cần MongoDB thật: đặt `TEST_MONGODB_URI`. Không đặt thì chúng bị bỏ qua.
- **Frontend**: `npm run build` (TypeScript + Vite).
- **Thủ công / Playwright** (đã chạy trong quá trình phát triển): hành trình khách, di chuyển & va chạm, cổng chuyển khu, hội thoại, 4 mini game bằng giao diện, đăng ký + chuyển tiến độ, gọi chuyển lần hai bị từ chối (409), xếp hạng, tri ân → duyệt → hiển thị trên tường, phân quyền Admin, joystick di động.
