# THANKS QUEST — Kế hoạch kiến trúc & triển khai (Phase 1)

## 1. Hiện trạng
- Workspace ban đầu trống, không có repository. Dự án được khởi tạo mới.
- Môi trường: Node 22, npm 10, git 2.43. Chưa xác nhận có MongoDB cục bộ hay MongoDB Atlas; chưa có API key Gemini/Groq.
- Hệ quả: phần cần dịch vụ ngoài (Atlas, AI) sẽ được thiết kế để chạy được khi thiếu dịch vụ (dùng `mongodb-memory-server` cho test, AI có chế độ fallback có nhãn rõ ràng), và sẽ ghi rõ mục nào chưa kiểm thử thật.

## 2. Quyết định kiến trúc

| Hạng mục | Quyết định | Lý do |
|---|---|---|
| Cấu trúc | Monorepo `frontend/` + `backend/` (npm workspaces không bắt buộc) | Đúng yêu cầu, deploy độc lập Vercel/Render |
| React ↔ Phaser | Phaser tạo 1 lần trong `useEffect` (guard bằng ref), giao tiếp qua `EventBus` (mitt-like) + Zustand | Tránh khởi tạo lại game khi React re-render |
| Bản đồ | Tilemap JSON tương thích Tiled, sinh bằng script cho 6 khu vực; tileset pixel art tự vẽ bằng code (nguyên bản) | Không phụ thuộc tài nguyên bên ngoài, tránh vi phạm bản quyền |
| Nguồn sự thật | Backend quyết định XP, phần thưởng, vật phẩm, kết quả mini game | Chống gian lận, đúng yêu cầu bảo mật |
| Guest | `guestSessions` + token ngẫu nhiên (lưu hash SHA-256), TTL index, cookie HttpOnly + header | Chơi thử không cần tài khoản, tải lại không mất tiến độ |
| Mini game | Backend phát `attemptId` + đề (không kèm đáp án), client nộp câu trả lời, backend chấm | Chống nộp kết quả giả, chống nộp trùng |
| Code Debugging | Không chạy code; so khớp với đáp án/bộ kiểm tra khai báo sẵn (chuẩn hóa khoảng trắng + test dạng pattern) | An toàn, đúng yêu cầu |
| AI | Backend gọi Gemini (ưu tiên) hoặc Groq; prompt cấm bịa kỷ niệm; có rate limit | Không lộ key |
| Auth | bcrypt, JWT access ngắn hạn, refresh token xoay vòng (lưu hash), cookie HttpOnly | Theo đặc tả |

## 3. Mô hình dữ liệu (MongoDB/Mongoose)
Các collection theo đặc tả: users, refreshTokens, guestSessions (TTL `expiresAt`), playerProfiles, gameAreas, gamePOIs, npcs, quests, gameLevels, questions, gameSessions, playerProgress, inventories, achievements, userAchievements, gratitudeMessages, notifications, reports.

Điểm thiết kế quan trọng:
- `playerProgress`: `{ owner: {kind: 'user'|'guest', id}, xp, level, completedQuests[], claimedQuests[], unlockedAreas[], visitedAreas[] }`. Chỉ mục unique theo owner.
- `gameSessions`: `{ owner, minigameId, attemptId (unique), status: started|submitted|expired, score, xpAwarded, startedAt, submittedAt }` → chống nộp trùng bằng cập nhật nguyên tử `status: started → submitted`.
- Phần thưởng quest: cập nhật nguyên tử `claimedQuests` dùng `$addToSet` có điều kiện `$ne` để đảm bảo chỉ nhận một lần.
- Chuyển Guest → User: dùng `guestSessions.conversionStatus` (none → converting → converted) cập nhật nguyên tử; gộp XP/vật phẩm/quest theo quy tắc hợp (union quest, cộng XP không vượt trần, vật phẩm lấy max số lượng đã gộp một lần); lỗi giữa chừng sẽ rollback trạng thái về `none`.
- Leaderboard: chỉ đọc từ `playerProgress` của `owner.kind = 'user'`; Aggregation + index `{xp:-1}`, phân trang.

## 4. API
Theo đúng danh sách trong đặc tả (auth, guest, player, game, minigames, leaderboard, gratitude, admin). Response thống nhất: `{ ok, data, error: {code, message} }`. Validation Zod, rate limit cho auth/guest/AI.

## 5. Lộ trình & tiêu chí hoàn thành từng Phase

| Phase | Nội dung | Bằng chứng hoàn thành |
|---|---|---|
| 1 | Audit, kế hoạch, khung dự án | Cả hai package build thành công |
| 2 | Design tokens, Landing, Auth UI, Guest entry | Build + chụp màn hình responsive |
| 3 | Phaser: map 6 khu vực, player, camera, collision, chuyển map | Chạy thật, test thủ công + unit test logic |
| 4 | NPC, hội thoại, quest, Quest Journal | Test luồng quest |
| 5 | 4 mini game (Quiz, Memory, Debug, Treasure) | Test chấm điểm + chống nộp trùng |
| 6 | Backend, MongoDB, Guest session, tiến độ | Integration test với mongodb-memory-server |
| 7 | XP, Level, Inventory, Achievement, Leaderboard | Test tính toán và chống trùng |
| 8 | AI Gratitude + Wall + kiểm duyệt + báo cáo | Test; AI thật cần API key |
| 9 | Admin Dashboard | Test phân quyền |
| 10 | Test tổng, build, tài liệu, deploy | Báo cáo kết quả thực tế |

Thứ tự thực hiện thực tế sẽ bám Mục 29 của đặc tả: ưu tiên một hành trình Guest xuyên suốt (Landing → Plaza → NPC → Quiz → Debug → Gratitude → Kết quả) trước, rồi mới mở rộng.

## 6. Rủi ro và cách xử lý
1. **Quy mô rất lớn so với một phiên làm việc.** Giải pháp: làm theo lát cắt dọc (vertical slice) cho hành trình Guest trước; mỗi Phase đều có build + test.
2. **Tài nguyên đồ họa.** Không dùng tài nguyên ngoài; sprite/tileset sinh bằng code (canvas/Phaser Graphics → texture) để nguyên bản và nhẹ.
3. **MongoDB Atlas/AI key chưa có.** Test dùng `mongodb-memory-server` (có thể cần tải binary, sẽ kiểm tra); AI ghi rõ "chưa kiểm thử với API thật".
4. **Tham khảo website daklaktoday.vn.** Chỉ lấy ý tưởng cơ chế; không sao chép code/hình/thiết kế.
5. **Hiệu năng di động.** Lazy-load Phaser, tilemap nhỏ, joystick ảo, giới hạn DPR.

## 7. Điểm cần người dùng cung cấp (không chặn tiến độ)
- `MONGODB_URI` (Atlas) để chạy thật; local sẽ dùng bộ nhớ khi test.
- `GEMINI_API_KEY` hoặc `GROQ_API_KEY` cho AI Gratitude.
- Thông tin tạo Admin đầu tiên (qua biến môi trường + script, không có mật khẩu mặc định).
