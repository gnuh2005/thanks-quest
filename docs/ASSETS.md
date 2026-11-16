# Hướng dẫn Thả Tài nguyên Tùy chỉnh (ASSETS GUIDE)

Hệ thống tài nguyên của **THANKS QUEST** được thiết kế theo cơ chế **Plug-and-Play**: Bạn có thể tự do thả file ảnh nhân vật hoặc nhạc/âm thanh thật vào thư mục `frontend/public/assets/`, trò chơi sẽ **tự động nhận diện và ưu tiên sử dụng file thật**, không cần sửa bất kỳ dòng mã nguồn nào!

---

## 1. Thay thế Nhân vật (Character Spritesheets)

Thư mục lưu trữ: `frontend/public/assets/characters/`

### Danh sách file nhân vật:
1. `teacher_m.png` (+ `teacher_m.json`) — Thầy giáo
2. `teacher_f.png` (+ `teacher_f.json`) — Cô giáo
3. `student_m.png` (+ `student_m.json`) — Học sinh nam
4. `student_f.png` (+ `student_f.json`) — Học sinh nữ

### Quy chuẩn định dạng:
- **Kích thước file ảnh:** `1024 × 1024 px` (PNG 32-bit trong suốt).
- **Kích thước mỗi khung hình (frame):** `128 × 128 px`, lưới 8 cột × 8 hàng (tổng cộng 64 ô).
- **Phân bổ khung hình trên lưới (8×8):**
  - **Hàng 0 (ô 0..3):** Đi xuống (Walk Down - 4 khung)
  - **Hàng 1 (ô 8..11):** Đi sang trái (Walk Left - 4 khung)
  - **Hàng 2 (ô 16..19):** Đi sang phải (Walk Right - 4 khung)
  - **Hàng 3 (ô 24..27):** Đi lên trên (Walk Up - 4 khung)
  - **Hàng 4 (ô 32..35):** Tương tác / giơ tay (Interact - 4 khung)
  - **Hàng 5 (ô 40..43):** Cúi nhặt đồ (Collect - 4 khung)
  - **Hàng 6 (ô 48..51):** Nhảy ăn mừng (Celebrate - 4 khung)
  - **Hàng 7:** Đứng thở nhịp nhàng (Idle):
    - Ô 56, 57: Idle nhìn xuống
    - Ô 58, 59: Idle nhìn trái
    - Ô 60, 61: Idle nhìn phải
    - Ô 62, 63: Idle nhìn lên
- **File Atlas JSON (tùy chọn):** Chuẩn TexturePacker JSON Hash/Array. Nếu không có file JSON, hệ thống sẽ tự động cắt ảnh theo lưới đều 128×128.
- **Phong cách khuyến nghị:** Chibi 3D cel-shaded, viền sáng rim light trên đỉnh đầu/vai, bóng đổ mềm dưới chân, góc nhìn 3/4.

---

## 2. Thay thế Nhạc nền & Hiệu ứng Âm thanh (Audio & SFX)

Thư mục lưu trữ: `frontend/public/assets/audio/`

### A. Nhạc nền (BGM) theo từng khu vực:
Định dạng khuyến nghị: `.mp3` (hoặc `.ogg`, `.wav`), âm thanh stereo, nén 128–192 kbps, tối ưu vòng lặp (loop mượt).

| Tên file | Khu vực tương ứng | Thể loại gợi ý |
|---|---|---|
| `bgm_plaza.mp3` | Knowledge Plaza (Quảng trường Tri thức) | Ukulele, Glockenspiel, Acoustic vui tươi (~120 BPM) |
| `bgm_library.mp3` | Library of Wisdom (Thư viện Trí tuệ) | Rhodes piano, chuông gió, êm dịu, tập trung (~80 BPM) |
| `bgm_lab.mp3` | Technology Lab (Phòng Thí nghiệm Công nghệ) | Electronic chiptune, Synthpop rộn ràng (~128 BPM) |
| `bgm_garden.mp3` | Creative Garden (Vườn Sáng tạo) | Acoustic guitar, sáo tre, tiếng chim, thư thái (~96 BPM) |
| `bgm_courtyard.mp3` | Memory Courtyard (Sân Ký ức) | Piano hoài niệm, cello ấm áp về tuổi học trò (~84 BPM) |
| `bgm_hall.mp3` | Gratitude Hall (Hội trường Tri ân) | Giao hưởng vĩ cầm, celesta trang nghiêm, ấm áp (~92 BPM) |

### B. Hiệu ứng âm thanh (SFX):
Định dạng: `.mp3` ngắn (0.2 – 1.5 giây), không độ trễ đầu file.

| Tên file | Hành động kích hoạt |
|---|---|
| `sfx_xp.mp3` | Nhận điểm kinh nghiệm (XP) |
| `sfx_levelup.mp3` | Thăng cấp độ (Level Up) |
| `sfx_item.mp3` | Nhặt vật phẩm vào túi đồ |
| `sfx_achievement.mp3` | Mở khóa thành tựu mới |
| `sfx_npc.mp3` | Bắt đầu trò chuyện với NPC |
| `sfx_dialogopen.mp3` | Hộp thoại mở ra |
| `sfx_dialogclose.mp3` | Hộp thoại đóng lại |
| `sfx_portal.mp3` | Bước qua cổng chuyển khu vực |
| `sfx_footstep.mp3` | Tiếng bước chân khi di chuyển |
| `sfx_button.mp3` | Bấm nút giao diện |
| `sfx_correct.mp3` | Trả lời đúng trong mini game |
| `sfx_wrong.mp3` | Trả lời sai trong mini game |
| `sfx_questcomplete.mp3` | Hoàn thành và nhận thưởng nhiệm vụ |

---

## 3. Cơ chế Dự phòng Tự động (Procedural Fallback)

- Nếu thư mục `assets/` chưa có file hoặc file bị lỗi mạng:
  - **Nhân vật:** Bộ sinh Procedural 128×128 Chibi trong `textures.ts` sẽ vẽ trực tiếp lên Canvas với đầy đủ hiệu ứng đổ bóng, viền sáng và gradient.
  - **Âm thanh:** Bộ WebAudio Synthesizer trong `AudioManager.ts` sẽ tự động tổng hợp âm thanh và nhạc nền theo thời gian thực.
