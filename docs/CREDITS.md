# THANKS QUEST — Tài liệu Bản quyền & Giấy phép Tài nguyên (CREDITS)

Dự án **THANKS QUEST — Campus Adventure World** được phát triển cho cuộc thi **CODE THE THANKS 2026**.
Mọi tài nguyên hình ảnh, nhân vật, bản đồ, âm thanh và mã nguồn trong trò chơi đều là **BẢN GỐC (ORIGINAL)** hoặc sử dụng tài nguyên tự do bản quyền (CC0 / Public Domain / MIT). Trò chơi không sao chép bố cục, sprite, tên khu vực hay dữ liệu từ bất kỳ game nào khác.

---

## 1. Đồ họa & Nhân vật (Sprites & Tilesets)

| Tài nguyên | Định dạng | Tác giả / Nguồn | Giấy phép | Mô tả chi tiết |
|---|---|---|---|---|
| **Bộ nhân vật Chibi 3D-render** (`teacher_m`, `teacher_f`, `student_m`, `student_f`) | PNG Atlas (1024×1024, mỗi frame 128×128) + JSON Atlas | Tự vẽ & sinh bằng thuật toán chuyên biệt của THANKS QUEST (`generateCharacters.cjs`) | Bản quyền tác giả THANKS QUEST / CC0 | 4 nhân vật: Thầy giáo, Cô giáo, Học sinh nam, Học sinh nữ với cel-shading mềm, viền sáng rim light, mắt to biểu cảm, bóng đổ chân thực, đầy đủ 4 hướng đi, tương tác, nhặt đồ, ăn mừng, thở idle. |
| **Hệ thống nhân vật NPC** (6 NPC khuôn viên) | Procedural Canvas 128×128 / Dynamic Canvas | Tự vẽ bằng mã nguồn Canvas 2D (`textures.ts`) | Bản quyền tác giả THANKS QUEST / CC0 | Giáo sư, Cô giáo khoa học, Thủ thư, Hướng dẫn viên IT, Thầy giáo lịch sử, Thầy cô nghệ thuật. |
| **Tileset khuôn viên 6 khu vực** (13 GID tiles 32×32 / 64×64) | Procedural Canvas 2D (`textures.ts`) | Tự thiết kế & lập trình | Bản quyền tác giả THANKS QUEST / CC0 | Cỏ hoa sân trường, đường gạch đá, sàn gạch men trong nhà, hồ sen xanh mát, tường gạch ngói đỏ, cây phượng vĩ nở hoa đỏ, kệ sách gỗ thư viện, bàn lab máy tính, bồn hoa, đài phun nước đá, hàng rào tỉa, thảm đỏ danh dự, cổng trường vòm kính. |
| **Biểu tượng POI & Markers** (`icon-item`, `mark-new`, `mark-done`, `glow`, v.v.) | Canvas 2D & SVG Vector | Tự thiết kế (`textures.ts`, `icons.svg`) | MIT / CC0 | Biểu tượng nhiệm vụ, vật phẩm, hào quang ánh sáng tại điểm tương tác. |
| **Hệ thống Icon giao diện** | Lucide Icons | [Lucide](https://lucide.dev) | ISC License | Các biểu tượng UI: ba lô, cúp, sách, bản đồ, loa âm thanh, la bàn, v.v. |
| **Font chữ chính** | Google Fonts | [Be Vietnam Pro](https://fonts.google.com/specimen/Be+Vietnam+Pro) | SIL Open Font License (OFL) | Font chữ tiếng Việt hiện đại, rõ nét trên mọi thiết bị. |

---

## 2. Âm thanh & Nhạc nền (Audio & Music)

| Tài nguyên | Đường dẫn | Tác giả / Cơ chế sinh | Giấy phép | Mô tả chi tiết |
|---|---|---|---|---|
| **BGM Knowledge Plaza** | `/assets/audio/bgm_plaza.mp3` | WebAudio Synthesizer & PCM Generator tự sinh | Bản quyền tác giả THANKS QUEST / CC0 | Điệu Ukulele & Glockenspiel rộn rã, tươi vui, nhịp ~120 BPM. |
| **BGM Library of Wisdom** | `/assets/audio/bgm_library.mp3` | WebAudio Synthesizer & PCM Generator tự sinh | Bản quyền tác giả THANKS QUEST / CC0 | Giai điệu Rhodes piano & chuông gió thanh tịnh, nhẹ nhàng, tập trung (~80 BPM). |
| **BGM Technology Lab** | `/assets/audio/bgm_lab.mp3` | WebAudio Synthesizer & PCM Generator tự sinh | Bản quyền tác giả THANKS QUEST / CC0 | Tiết tấu điện tử sôi động, âm bass techno hiện đại (~128 BPM). |
| **BGM Creative Garden** | `/assets/audio/bgm_garden.mp3` | WebAudio Synthesizer & PCM Generator tự sinh | Bản quyền tác giả THANKS QUEST / CC0 | Giai điệu guitar mộc và tiếng sáo thư thái, hòa quyện thiên nhiên (~96 BPM). |
| **BGM Memory Courtyard** | `/assets/audio/bgm_courtyard.mp3` | WebAudio Synthesizer & PCM Generator tự sinh | Bản quyền tác giả THANKS QUEST / CC0 | Tiếng đàn piano hoài niệm, sâu lắng về tình thầy trò (~84 BPM). |
| **BGM Gratitude Hall** | `/assets/audio/bgm_hall.mp3` | WebAudio Synthesizer & PCM Generator tự sinh | Bản quyền tác giả THANKS QUEST / CC0 | Hợp âm celesta và giao hưởng ấm áp, trang trọng (~92 BPM). |
| **Bộ 13 hiệu ứng âm thanh SFX** (`xp`, `levelup`, `item`, `achievement`, `npc`, `dialogopen`, `dialogclose`, `portal`, `footstep`, `button`, `correct`, `wrong`, `questcomplete`) | `/assets/audio/sfx_*.mp3` & WebAudio Synth | WebAudio Real-time Synthesizer | Bản quyền tác giả THANKS QUEST / CC0 | Âm thanh nhận điểm, thăng cấp, mở cổng, bước chân, chạm NPC, lật thẻ, chúc mừng hoàn thành nhiệm vụ. |

---

## 3. Bản đồ & Dữ liệu Khuôn viên

- Toàn bộ 6 bản đồ khu vực (`plaza`, `library`, `lab`, `garden`, `courtyard`, `hall`) được tạo tự động từ ma trận ô lưới thế giới game 2D độc lập (`backend/src/seed/data/maps.ts`), xuất ra định dạng Tiled JSON tiêu chuẩn (`frontend/public/maps/*.json`).
- Không sử dụng bản đồ địa lý thực tế, GPS hay OpenStreetMap/Leaflet.
- Mini Map ở góc trái được tổng hợp trực tiếp từ ma trận Tiled JSON thời gian thực qua `EventBus` giữa Phaser và React.
