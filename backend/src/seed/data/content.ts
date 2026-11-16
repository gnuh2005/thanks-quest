import type { AchDef, ItemDef, MiniGameDef, NpcDef } from '../../services/content.js';
import type { QuestDef } from '../../domain/quests.js';
import { AREA_MAPS, px } from './maps.js';

// ───────────────────────── Khu vực ─────────────────────────
const AREA_META: Record<string, { name: string; description: string; theme: string; order: number; unlock: Record<string, unknown> }> = {
  plaza: { name: 'Quảng trường tri thức', description: 'Quảng trường tri thức — điểm bắt đầu hành trình.', theme: 'plaza', order: 1, unlock: {} },
  library: { name: 'Thư viện tri thức', description: 'Thư viện tri thức với trò trắc nghiệm và thẻ ghi nhớ.', theme: 'library', order: 2, unlock: {} },
  lab: { name: 'Phòng thí nghiệm công nghệ', description: 'Phòng thí nghiệm công nghệ — nơi sửa lỗi lập trình.', theme: 'lab', order: 3, unlock: { claimedQuests: ['main_03'] } },
  garden: { name: 'Khu vườn sáng tạo', description: 'Khu vườn sáng tạo với kho báu ẩn và câu đố.', theme: 'garden', order: 4, unlock: { claimedQuests: ['main_03'] } },
  courtyard: { name: 'Sân ký ức', description: 'Sân ký ức — những câu chuyện về người dẫn đường.', theme: 'courtyard', order: 5, unlock: { minLevel: 2 } },
  hall: { name: 'Hội trường tri ân', description: 'Hội trường tri ân — nơi gửi lời cảm ơn thầy cô.', theme: 'hall', order: 6, unlock: { claimedQuests: ['main_05'] } },
};

export const AREAS = AREA_MAPS.map((m) => ({
  areaId: m.areaId,
  ...AREA_META[m.areaId]!,
  mapAsset: `/maps/${m.areaId}.json`,
  width: m.cols * 32,
  height: m.rows * 32,
  // Tọa độ POI theo pixel của thế giới game (tâm ô).
  pois: m.pois.map((p) => ({ ...p, x: px(p.x), y: px(p.y) })),
}));

// ───────────────────────── NPC ─────────────────────────
const npcPos = (id: string) => {
  for (const m of AREA_MAPS) {
    const n = m.npcs.find((x) => x.npcId === id);
    if (n) return { areaId: m.areaId, x: px(n.x), y: px(n.y) };
  }
  throw new Error(`NPC ${id} chưa được đặt trên bản đồ`);
};

export const NPCS: NpcDef[] = [
  {
    npcId: 'professor', name: 'Giáo sư dẫn đường', role: 'Người dẫn đường', sprite: 0,
    description: 'Vị giáo sư hiền hậu đón người mới ở Quảng trường tri thức.',
    idle: ['Mỗi bước đi hôm nay đều bắt đầu từ một người đã chỉ đường cho mình.', 'Cứ đi khám phá đi, mình ở đây nếu bạn cần.'],
    lore: ['Ngày xưa, mình cũng từng là một sinh viên lạc đường giữa khuôn viên rộng lớn.', 'Có một người thầy đã dừng lại, chỉ cho mình hướng đi — và chẳng bao giờ đòi hỏi gì.', 'Thế giới này được dựng lên để nhắc ta nhớ những người như vậy.'],
    ...npcPos('professor'),
  },
  {
    npcId: 'librarian', name: 'Thủ thư', role: 'Thủ thư', sprite: 1,
    description: 'Người gìn giữ từng trang sách của Thư viện tri thức.',
    idle: ['Suỵt… thư viện là nơi tri thức ngủ say, đừng làm chúng thức giấc nhé.'],
    lore: ['Mỗi cuốn sách ở đây từng được một người thầy đọc to cho học trò nghe.', 'Mình tin rằng sách chỉ thực sự sống khi có người đọc.'],
    ...npcPos('librarian'),
  },
  {
    npcId: 'coding_mentor', name: 'Người hướng dẫn lập trình', role: 'Người hướng dẫn lập trình', sprite: 2,
    description: 'Người hướng dẫn kiên nhẫn ở Phòng thí nghiệm công nghệ, không bao giờ cười khi bạn viết sai.',
    idle: ['Gặp lỗi à? Tốt. Nghĩa là bạn đang thật sự viết code.'],
    lore: ['Lỗi không phải kẻ thù; nó là người thầy nghiêm khắc nhất, chỉ ra đúng chỗ bạn cần học.'],
    ...npcPos('coding_mentor'),
  },
  {
    npcId: 'creative_student', name: 'Sinh viên sáng tạo', role: 'Sinh viên sáng tạo', sprite: 3,
    description: 'Cô sinh viên suốt ngày lang thang trong Khu vườn sáng tạo.',
    idle: ['Ý tưởng hay thường nảy ra lúc mình đang không cố nghĩ ra nó.'],
    lore: ['Mình từng nghĩ mình không có năng khiếu gì, cho đến khi một cô giáo bảo: "Em chỉ chưa thử đủ nhiều thôi."'],
    ...npcPos('creative_student'),
  },
  {
    npcId: 'memory_keeper', name: 'Người giữ ký ức', role: 'Người giữ ký ức', sprite: 4,
    description: 'Người canh giữ những câu chuyện trong Sân ký ức.',
    idle: ['Có những ký ức nhỏ xíu mà theo ta suốt đời.'],
    lore: ['Mình không nhớ hết kiến thức đã học, nhưng nhớ rất rõ ánh mắt của người đã dạy mình.'],
    ...npcPos('memory_keeper'),
  },
  {
    npcId: 'gratitude_guardian', name: 'Người giữ cổng tri ân', role: 'Người gác cổng tri ân', sprite: 5,
    description: 'Người canh giữ Hội trường tri ân, nơi mọi lời cảm ơn được lắng nghe.',
    idle: ['Lời cảm ơn chân thành không cần hoa mỹ — chỉ cần thật.'],
    lore: ['Rất nhiều thầy cô không bao giờ biết mình đã thay đổi một cuộc đời. Một lời cảm ơn có thể cho họ biết điều đó.'],
    ...npcPos('gratitude_guardian'),
  },
];

// ───────────────────────── Vật phẩm ─────────────────────────
export const ITEMS: ItemDef[] = [
  { itemId: 'ancient_book', name: 'Cuốn sách cổ', category: 'book', description: 'Cuốn sách ố vàng, từng được truyền qua nhiều thế hệ học trò.', icon: 'book-open', usable: false, useXp: 0 },
  { itemId: 'knowledge_fragment', name: 'Mảnh tri thức', category: 'knowledge', description: 'Một mảnh ghép phát sáng của thư viện.', icon: 'gem', usable: false, useXp: 0 },
  { itemId: 'memory_fragment', name: 'Mảnh ký ức', category: 'memory', description: 'Mảnh ký ức ấm áp về một buổi học cũ.', icon: 'sparkles', usable: false, useXp: 0 },
  { itemId: 'circuit_chip', name: 'Chip mạch', category: 'tech', description: 'Linh kiện thất lạc của phòng thí nghiệm.', icon: 'cpu', usable: false, useXp: 0 },
  { itemId: 'garden_seed', name: 'Hạt giống', category: 'collectible', description: 'Hạt giống của một loài hoa chưa có tên.', icon: 'sprout', usable: false, useXp: 0 },
  { itemId: 'golden_chalk', name: 'Viên phấn vàng', category: 'collectible', description: 'Biểu tượng của người thầy kiên nhẫn.', icon: 'pencil', usable: false, useXp: 0 },
  { itemId: 'study_notes', name: 'Tập ghi chép', category: 'book', description: 'Đọc để ôn bài nhanh. Dùng để nhận thêm 15 XP.', icon: 'notebook-pen', usable: true, useXp: 15 },
  { itemId: 'focus_tea', name: 'Trà tập trung', category: 'collectible', description: 'Một tách trà thơm giúp tỉnh táo. Dùng để nhận thêm 10 XP.', icon: 'coffee', usable: true, useXp: 10 },
  { itemId: 'gratitude_card', name: 'Tấm thiệp tri ân', category: 'event', description: 'Tấm thiệp trắng đang chờ được viết.', icon: 'mail', usable: false, useXp: 0 },
  { itemId: 'teacher_day_badge', name: 'Huy hiệu 20/11', category: 'event', description: 'Huy hiệu dành cho người gửi lời tri ân ngày Nhà giáo Việt Nam.', icon: 'badge-check', usable: false, useXp: 0 },
];

// ───────────────────────── Nhiệm vụ ─────────────────────────
const Q = (q: Omit<QuestDef, 'order'> & { order?: number }, i: number): QuestDef => ({ order: q.order ?? i, ...q });
const obj = (id: string, kind: any, label: string, extra: Record<string, unknown> = {}) => ({ id, kind, label, ...extra });

export const QUESTS: QuestDef[] = [
  Q({ questId: 'main_01', type: 'main', title: 'Bước chân đầu tiên', npcId: 'professor', areaId: 'plaza',
    description: 'Đọc bảng hướng dẫn ở quảng trường để làm quen điều khiển.',
    objectives: [obj('o1', 'poi', 'Đọc bảng hướng dẫn', { ref: 'plaza_board' })],
    reward: { xp: 30, items: [{ itemId: 'study_notes', qty: 1 }] },
    dialogue: {
      offer: ['Chào mừng đến THANKS QUEST! Mình là Professor Guide.', 'Trước tiên, hãy đến đọc bảng hướng dẫn ở gần đây. Nhấn E khi đứng cạnh nó.'],
      progress: ['Bảng hướng dẫn ở phía trên-bên trái mình đó. Đứng gần rồi nhấn E nhé.'],
      complete: ['Tốt lắm! Bạn đã nắm cách di chuyển và tương tác rồi.'],
    } }, 1),
  Q({ questId: 'main_02', type: 'main', title: 'Lời mời từ thư viện', npcId: 'professor', areaId: 'plaza',
    requires: { quests: ['main_01'] },
    description: 'Đến Library of Wisdom (cửa phía Tây) và chào Thủ thư.',
    objectives: [obj('o1', 'visit', 'Đến Library of Wisdom', { ref: 'library' }), obj('o2', 'talk', 'Trò chuyện với Thủ thư', { ref: 'librarian' })],
    reward: { xp: 25 },
    dialogue: {
      offer: ['Giờ hãy đến Thư viện ở phía Tây. Thủ thư đang có một thử thách dành cho bạn.'],
      progress: ['Đi về phía Tây, qua cánh cửa cuối đường. Thủ thư đang chờ.'],
      complete: ['Bạn đã gặp Thủ thư rồi. Hãy nhận thưởng, rồi tiếp tục nhé!'],
    } }, 2),
  Q({ questId: 'main_03', type: 'main', title: 'Thử thách trí tuệ', npcId: 'librarian', areaId: 'library',
    requires: { quests: ['main_02'] },
    description: 'Vượt qua bài Knowledge Quiz tại bàn giữa thư viện.',
    objectives: [obj('o1', 'minigame', 'Vượt qua Knowledge Quiz', { ref: 'quiz' })],
    reward: { xp: 50, items: [{ itemId: 'study_notes', qty: 1 }] },
    dialogue: {
      offer: ['Chào bạn. Thư viện có một bài quiz nhỏ dành cho khách mới.', 'Bàn Knowledge Quiz ở giữa phòng — trả lời đúng ít nhất 3/5 câu là đạt.'],
      progress: ['Bàn quiz nằm ngay giữa phòng, trên tấm thảm. Cứ bình tĩnh nhé.'],
      complete: ['Xuất sắc! Kiến thức của bạn không tệ chút nào.'],
    } }, 3),
  Q({ questId: 'main_04', type: 'main', title: 'Phòng thí nghiệm công nghệ', npcId: 'coding_mentor', areaId: 'lab',
    requires: { quests: ['main_03'] },
    description: 'Đến Technology Lab (cửa phía Đông) và gặp Coding Mentor.',
    objectives: [obj('o1', 'visit', 'Đến Technology Lab', { ref: 'lab' }), obj('o2', 'talk', 'Gặp Coding Mentor', { ref: 'coding_mentor' })],
    reward: { xp: 30 },
    dialogue: {
      offer: ['Chào bạn mới! Mình là Coding Mentor.', 'Lab đang có vài đoạn code bị lỗi. Hãy lại gần bàn Code Debugging ở giữa phòng nhé.'],
      progress: ['Nhớ rằng: đọc kỹ từng dòng trước khi sửa.'],
      complete: ['Bạn đã tìm được đường tới đây. Phần thưởng của bạn đây!'],
    } }, 4),
  Q({ questId: 'main_05', type: 'main', title: 'Bắt lỗi', npcId: 'coding_mentor', areaId: 'lab',
    requires: { quests: ['main_04'] },
    description: 'Sửa lỗi các đoạn code tại trạm Code Debugging. Hoàn thành sẽ mở khóa Gratitude Hall.',
    objectives: [obj('o1', 'minigame', 'Vượt qua Code Debugging', { ref: 'debug' })],
    reward: { xp: 60, items: [{ itemId: 'focus_tea', qty: 1 }] },
    dialogue: {
      offer: ['Thử thách thật sự đây: sửa lỗi cho 3 đoạn code.', 'Làm được, Gratitude Hall sẽ mở cửa cho bạn.'],
      progress: ['Trạm Code Debugging nằm ở giữa phòng. Hãy đọc kỹ gợi ý.'],
      complete: ['Bạn vừa sửa lỗi như một lập trình viên thực thụ. Đây là phần thưởng!'],
    } }, 5),
  Q({ questId: 'main_06', type: 'main', title: 'Cánh cửa tri ân', npcId: 'gratitude_guardian', areaId: 'hall',
    requires: { quests: ['main_05'] },
    description: 'Đến Gratitude Hall (cửa phía Bắc, bên phải) và gặp Gratitude Guardian.',
    objectives: [obj('o1', 'visit', 'Đến Gratitude Hall', { ref: 'hall' }), obj('o2', 'talk', 'Gặp Gratitude Guardian', { ref: 'gratitude_guardian' })],
    reward: { xp: 40 },
    dialogue: {
      offer: ['Hội trường đã mở cửa cho bạn. Ở đây, chúng ta không chấm điểm — chỉ lắng nghe.'],
      progress: ['Hãy bước vào trong và nói chuyện với mình.'],
      complete: ['Bạn đã đến được đây. Giờ hãy cùng nghĩ về người đã dẫn đường cho bạn.'],
    } }, 6),
  Q({ questId: 'main_07', type: 'main', title: 'Viết lời tri ân', npcId: 'gratitude_guardian', areaId: 'hall',
    requires: { quests: ['main_06'] },
    description: 'Dùng bàn viết ở giữa hội trường để tạo thử một lời cảm ơn.',
    objectives: [obj('o1', 'gratitude_preview', 'Tạo một lời tri ân (xem trước)')],
    reward: { xp: 60, items: [{ itemId: 'golden_chalk', qty: 1 }] },
    dialogue: {
      offer: ['Hãy nghĩ đến một người thầy, một người cô. Kể lại điều bạn muốn cảm ơn — bằng chính lời của bạn.', 'AI chỉ giúp bạn sắp xếp câu chữ, không thay bạn nhớ lại kỷ niệm.'],
      progress: ['Bàn viết ở giữa hội trường. Nhấn E khi đứng gần.'],
      complete: ['Những lời chân thành nhất luôn bắt đầu từ chuyện nhỏ. Cảm ơn bạn đã viết.'],
    } }, 7),
  Q({ questId: 'main_08', type: 'main', title: 'Khu vườn sáng tạo', npcId: 'creative_student', areaId: 'garden',
    requires: { quests: ['main_03'] },
    description: 'Đến Creative Garden (cửa phía Nam) và gặp Creative Student.',
    objectives: [obj('o1', 'visit', 'Đến Creative Garden', { ref: 'garden' }), obj('o2', 'talk', 'Gặp Creative Student', { ref: 'creative_student' })],
    reward: { xp: 30 },
    dialogue: {
      offer: ['Ê, bạn mới! Vườn này có kho báu giấu dưới đất đấy.', 'Đi dạo một vòng rồi quay lại nói chuyện với mình nhé.'],
      progress: ['Cứ đi dạo xem vườn đã.'],
      complete: ['Vui quá, có người ghé vườn của mình! Đây, quà nhỏ.'],
    } }, 8),
  Q({ questId: 'main_09', type: 'main', title: 'Ký ức của người dẫn đường', npcId: 'memory_keeper', areaId: 'courtyard',
    requires: { quests: ['main_02'] },
    description: 'Đọc ít nhất 3 câu chuyện rải rác trong thế giới game (cần cấp 2 để vào Memory Courtyard).',
    objectives: [obj('o1', 'story_count', 'Đọc 3 câu chuyện', { count: 3 })],
    reward: { xp: 50 },
    dialogue: {
      offer: ['Mỗi câu chuyện ở đây đều là một lời cảm ơn chưa kịp nói.', 'Hãy đọc ít nhất ba câu chuyện, rồi quay lại với mình.'],
      progress: ['Những tấm biển, cuốn sổ, bức ảnh… đều giấu một câu chuyện. Nhấn E để đọc.'],
      complete: ['Bạn đã lắng nghe. Đó là cách tốt nhất để giữ ký ức sống mãi.'],
    } }, 9),
  Q({ questId: 'main_10', type: 'main', title: 'Hoàn tất hành trình', npcId: 'gratitude_guardian', areaId: 'hall',
    requires: { quests: ['main_07'], account: true },
    description: 'Gửi một lời tri ân công khai (cần tài khoản) và hoàn thành ít nhất 9 nhiệm vụ.',
    objectives: [obj('o1', 'claimed_count', 'Nhận thưởng 9 nhiệm vụ', { count: 9 }), obj('o2', 'gratitude_post', 'Gửi lời tri ân lên tường')],
    reward: { xp: 100, items: [{ itemId: 'teacher_day_badge', qty: 1 }] },
    dialogue: {
      offer: ['Bước cuối cùng: gửi lời cảm ơn của bạn lên Tường tri ân để mọi người cùng đọc.'],
      progress: ['Hãy viết và gửi lời tri ân bằng tài khoản của bạn.'],
      complete: ['Hành trình của bạn đã trọn vẹn. Cảm ơn bạn đã trân trọng người dẫn đường!'],
    } }, 10),

  Q({ questId: 'side_01', type: 'side', title: 'Nhặt nhạnh tri thức', npcId: 'librarian', areaId: 'library',
    requires: { quests: ['main_02'] }, description: 'Tìm 3 Mảnh tri thức giấu trong các kệ sách.',
    objectives: [obj('o1', 'collect', 'Thu thập Mảnh tri thức', { ref: 'knowledge_fragment', count: 3 })],
    reward: { xp: 40 }, dialogue: { offer: ['Có vài mảnh tri thức rơi khỏi kệ. Giúp mình tìm 3 mảnh nhé?'] } }, 11),
  Q({ questId: 'side_02', type: 'side', title: 'Ghép ký ức', npcId: 'librarian', areaId: 'library',
    requires: { quests: ['main_02'] }, description: 'Vượt qua trò Memory Matching.',
    objectives: [obj('o1', 'minigame', 'Vượt qua Memory Matching', { ref: 'memory' })],
    reward: { xp: 30 }, dialogue: { offer: ['Bàn Memory Matching bên cạnh bàn quiz. Thử lật thẻ xem trí nhớ bạn tốt cỡ nào?'] } }, 12),
  Q({ questId: 'side_03', type: 'side', title: 'Linh kiện thất lạc', npcId: 'coding_mentor', areaId: 'lab',
    requires: { quests: ['main_04'] }, description: 'Tìm 2 Chip mạch trong phòng thí nghiệm.',
    objectives: [obj('o1', 'collect', 'Thu thập Chip mạch', { ref: 'circuit_chip', count: 2 })],
    reward: { xp: 35 }, dialogue: { offer: ['Mình làm rơi hai con chip đâu đó trong lab. Tìm giúp mình nhé.'] } }, 13),
  Q({ questId: 'side_04', type: 'side', title: 'Săn kho báu', npcId: 'creative_student', areaId: 'garden',
    requires: { quests: ['main_08'] }, description: 'Vượt qua thử thách Treasure Hunt.',
    objectives: [obj('o1', 'minigame', 'Vượt qua Treasure Hunt', { ref: 'treasure' })],
    reward: { xp: 40 }, dialogue: { offer: ['Bãi đất ở giữa vườn có kho báu đấy. Đào thử xem!'] } }, 14),
  Q({ questId: 'side_05', type: 'side', title: 'Gieo hạt', npcId: 'creative_student', areaId: 'garden',
    requires: { quests: ['main_08'] }, description: 'Nhặt 3 Hạt giống trong vườn.',
    objectives: [obj('o1', 'collect', 'Thu thập Hạt giống', { ref: 'garden_seed', count: 3 })],
    reward: { xp: 40 }, dialogue: { offer: ['Mình muốn trồng thêm hoa. Bạn nhặt giúp 3 hạt giống nhé?'] } }, 15),
  Q({ questId: 'side_06', type: 'side', title: 'Người kể chuyện', npcId: 'memory_keeper', areaId: 'courtyard',
    requires: { quests: ['main_09'] }, description: 'Đọc tổng cộng 6 câu chuyện trong thế giới game.',
    objectives: [obj('o1', 'story_count', 'Đọc 6 câu chuyện', { count: 6 })],
    reward: { xp: 45 }, dialogue: { offer: ['Còn nhiều câu chuyện nữa. Đọc đủ sáu câu rồi quay lại nhé.'] } }, 16),
  Q({ questId: 'side_07', type: 'side', title: 'Làm quen cả trường', npcId: 'professor', areaId: 'plaza',
    requires: { quests: ['main_01'] }, description: 'Trò chuyện với 5 NPC khác nhau.',
    objectives: [obj('o1', 'talk_count', 'Trò chuyện với 5 NPC', { count: 5 })],
    reward: { xp: 30 }, dialogue: { offer: ['Đi chào hỏi mọi người đi. Ai cũng có chuyện để kể.'] } }, 17),
  Q({ questId: 'side_08', type: 'side', title: 'Mảnh ký ức', npcId: 'memory_keeper', areaId: 'courtyard',
    requires: { quests: ['main_09'] }, description: 'Tìm 2 Mảnh ký ức trong sân.',
    objectives: [obj('o1', 'collect', 'Thu thập Mảnh ký ức', { ref: 'memory_fragment', count: 2 })],
    reward: { xp: 35 }, dialogue: { offer: ['Có hai mảnh ký ức bị gió thổi đi mất. Giúp mình tìm lại nhé.'] } }, 18),
  Q({ questId: 'side_09', type: 'side', title: 'Người chơi toàn năng', npcId: 'gratitude_guardian', areaId: 'hall',
    requires: { quests: ['main_06'] }, description: 'Vượt qua cả 4 mini game.',
    objectives: [obj('o1', 'minigames_passed', 'Vượt qua 4 mini game', { count: 4 })],
    reward: { xp: 80 }, dialogue: { offer: ['Quiz, Memory, Debug, Treasure. Đủ cả bốn, mình sẽ thưởng lớn.'] } }, 19),
  Q({ questId: 'side_10', type: 'side', title: 'Học trò chăm chỉ', npcId: 'professor', areaId: 'plaza',
    requires: { quests: ['main_02'] }, description: 'Đạt cấp 4.',
    objectives: [obj('o1', 'level', 'Đạt cấp 4', { count: 4 })],
    reward: { xp: 60, items: [{ itemId: 'study_notes', qty: 1 }] }, dialogue: { offer: ['Chăm chỉ sẽ được đền đáp. Hãy đạt cấp 4 rồi gặp mình.'] } }, 20),

  Q({ questId: 'daily_01', type: 'daily', title: 'Ôn bài mỗi ngày', npcId: 'professor', areaId: 'plaza',
    requires: { quests: ['main_03'] }, description: 'Vượt qua Knowledge Quiz trong hôm nay.',
    objectives: [obj('o1', 'minigame', 'Vượt Knowledge Quiz hôm nay', { ref: 'quiz' })],
    reward: { xp: 20 }, dialogue: { offer: ['Mỗi ngày một ít, kiến thức sẽ thành thói quen.'] } }, 21),
  Q({ questId: 'daily_02', type: 'daily', title: 'Luyện bắt lỗi', npcId: 'coding_mentor', areaId: 'lab',
    requires: { quests: ['main_05'] }, description: 'Vượt qua Code Debugging trong hôm nay.',
    objectives: [obj('o1', 'minigame', 'Vượt Code Debugging hôm nay', { ref: 'debug' })],
    reward: { xp: 25 }, dialogue: { offer: ['Thợ giỏi phải luyện tay mỗi ngày.'] } }, 22),
  Q({ questId: 'ach_01', type: 'achievement', title: 'Người đồng hành', npcId: 'professor', areaId: 'plaza',
    requires: { quests: ['main_01'] }, description: 'Nhận thưởng ít nhất 8 nhiệm vụ.',
    objectives: [obj('o1', 'claimed_count', 'Nhận thưởng 8 nhiệm vụ', { count: 8 })],
    reward: { xp: 100, items: [{ itemId: 'golden_chalk', qty: 1 }] }, dialogue: { offer: ['Khi bạn đã đi đủ xa, hãy quay lại gặp mình.'] } }, 23),
  Q({ questId: 'event_01', type: 'event', title: 'Lời tri ân 20/11', npcId: 'gratitude_guardian', areaId: 'hall',
    requires: { quests: ['main_07'], account: true }, description: 'Sự kiện Ngày Nhà giáo Việt Nam: gửi một lời tri ân lên Tường tri ân (cần tài khoản).',
    objectives: [obj('o1', 'gratitude_post', 'Gửi lời tri ân lên tường')],
    reward: { xp: 80, items: [{ itemId: 'teacher_day_badge', qty: 1 }] }, dialogue: { offer: ['Ngày 20/11 sắp đến. Hãy để thầy cô biết bạn nhớ họ.'] } }, 24),
];

// ───────────────────────── Thành tựu ─────────────────────────
export const ACHIEVEMENTS: AchDef[] = [
  { achId: 'first_step', name: 'Bước chân đầu tiên', description: 'Trò chuyện với Giáo sư dẫn đường.', icon: 'footprints', condition: { kind: 'fact', value: 'talk:professor' }, rewardXp: 10 },
  { achId: 'knowledge_seeker', name: 'Người tìm kiếm tri thức', description: 'Vượt qua trò Trắc nghiệm kiến thức.', icon: 'book-open', condition: { kind: 'fact', value: 'mg:quiz:passed' }, rewardXp: 20 },
  { achId: 'code_explorer', name: 'Nhà khám phá lập trình', description: 'Vượt qua trò Sửa lỗi lập trình.', icon: 'code-2', condition: { kind: 'fact', value: 'mg:debug:passed' }, rewardXp: 20 },
  { achId: 'memory_keeper', name: 'Người giữ ký ức', description: 'Vượt qua trò Ghép thẻ ghi nhớ.', icon: 'brain', condition: { kind: 'fact', value: 'mg:memory:passed' }, rewardXp: 20 },
  { achId: 'creative_mind', name: 'Tư duy sáng tạo', description: 'Vượt qua trò Săn kho báu.', icon: 'lightbulb', condition: { kind: 'fact', value: 'mg:treasure:passed' }, rewardXp: 20 },
  { achId: 'quest_master', name: 'Bậc thầy nhiệm vụ', description: 'Nhận thưởng 8 nhiệm vụ.', icon: 'scroll-text', condition: { kind: 'claimed_count', value: 8 }, rewardXp: 50 },
  { achId: 'gratitude_heart', name: 'Gratitude Heart', description: 'Tạo lời tri ân đầu tiên của bạn.', icon: 'heart', condition: { kind: 'fact', value: 'gratitude:preview' }, rewardXp: 30 },
  { achId: 'rising_scholar', name: 'Rising Scholar', description: 'Đạt cấp 4.', icon: 'graduation-cap', condition: { kind: 'level', value: 4 }, rewardXp: 40 },
];

// ───────────────────────── Mini game ─────────────────────────
export const MINIGAMES: MiniGameDef[] = [
  { minigameId: 'quiz', type: 'quiz', name: 'Trắc nghiệm kiến thức', areaId: 'library',
    description: 'Trả lời 5 câu hỏi trắc nghiệm trước khi hết giờ.',
    instructions: ['Mỗi câu có 4 lựa chọn, chỉ một đáp án đúng.', 'Đúng từ 3/5 câu trở lên là đạt.', 'Sau khi nộp bài, bạn sẽ xem được giải thích từng câu.'],
    config: { count: 5, timeLimitSec: 120, passPercent: 60, reward: { first: 60, repeat: 10, repeatPerDay: 3, perfect: 25 } } },
  { minigameId: 'memory', type: 'memory', name: 'Ghép thẻ ghi nhớ', areaId: 'library',
    description: 'Lật thẻ và tìm các cặp giống nhau với ít lượt nhất.',
    instructions: ['Lật hai thẻ mỗi lượt.', 'Hai thẻ giống nhau sẽ được giữ lại.', 'Ghép hết các cặp trong số lượt cho phép để đạt.'],
    config: { pairs: 6, timeLimitSec: 150, reward: { first: 50, repeat: 8, repeatPerDay: 3, perfect: 20 } } },
  { minigameId: 'debug', type: 'debug', name: 'Sửa lỗi lập trình', areaId: 'lab',
    description: 'Tìm và sửa lỗi trong 3 đoạn code ngắn.',
    instructions: ['Đọc đoạn code và gợi ý.', 'Sửa trực tiếp trong khung soạn thảo.', 'Hệ thống kiểm tra bằng quy tắc, không chạy code của bạn. Đúng 2/3 đoạn là đạt.'],
    config: { count: 3, timeLimitSec: 300, passCount: 2, reward: { first: 70, repeat: 10, repeatPerDay: 3, perfect: 30 } } },
  { minigameId: 'treasure', type: 'treasure', name: 'Săn kho báu', areaId: 'garden',
    description: 'Đào các ô trong khu vườn để tìm kho báu, dựa vào gợi ý nóng/lạnh.',
    instructions: ['Có 3 kho báu ẩn trong lưới 6×6.', 'Bạn có 10 lượt đào.', 'Gợi ý: NÓNG (sát bên), ẤM (cách 2 ô), LẠNH (xa). Tìm được 2/3 kho báu là đạt.'],
    config: { size: 6, treasures: 3, maxDigs: 10, passFound: 2, timeLimitSec: 180, reward: { first: 50, repeat: 8, repeatPerDay: 3, perfect: 20 } } },
];

// ───────────────────────── Câu hỏi ─────────────────────────
interface Mcq { qid: string; category: string; text: string; choices: string[]; answerIndex: number; explanation: string }
const mcq = (qid: string, category: string, text: string, choices: string[], answerIndex: number, explanation: string): Mcq =>
  ({ qid, category, text, choices, answerIndex, explanation });

export const MCQ_QUESTIONS: Mcq[] = [
  mcq('mcq_01', 'gratitude', 'Ngày Nhà giáo Việt Nam là ngày nào?', ['20/10', '20/11', '8/3', '1/6'], 1, 'Ngày Nhà giáo Việt Nam được tổ chức vào ngày 20 tháng 11 hằng năm.'),
  mcq('mcq_02', 'gratitude', 'Ngày Nhà giáo Việt Nam 20/11 được tổ chức chính thức từ năm nào?', ['1945', '1975', '1982', '1990'], 2, 'Năm 1982, Hội đồng Bộ trưởng quyết định lấy ngày 20/11 làm Ngày Nhà giáo Việt Nam.'),
  mcq('mcq_03', 'gratitude', 'Câu tục ngữ "Không thầy đố mày làm nên" nhấn mạnh điều gì?', ['Vai trò quan trọng của người thầy', 'Học một mình là tốt nhất', 'Chỉ cần thông minh là đủ', 'Không nên nhờ người khác'], 0, 'Câu tục ngữ khẳng định công lao dạy dỗ của người thầy trong thành công của mỗi người.'),
  mcq('mcq_04', 'gratitude', '"Tôn sư trọng đạo" có nghĩa là gì?', ['Học thật nhiều', 'Kính trọng thầy và coi trọng đạo lý', 'Làm theo mọi điều được dạy', 'Thích đi học sớm'], 1, 'Đây là truyền thống đề cao việc kính trọng thầy cô và những giá trị đạo lý họ truyền dạy.'),
  mcq('mcq_05', 'gratitude', '"Uống nước nhớ nguồn" khuyên chúng ta điều gì?', ['Tiết kiệm nước', 'Nhớ ơn những người đã giúp đỡ mình', 'Chỉ uống nước sạch', 'Luôn quay về quê hương'], 1, 'Câu tục ngữ nhắc nhở lòng biết ơn đối với những người đã tạo nên thành quả cho ta hưởng.'),
  mcq('mcq_06', 'gratitude', 'Câu "Muốn sang thì bắc cầu Kiều, muốn con hay chữ phải yêu lấy thầy" khuyên điều gì?', ['Nên đi qua cầu Kiều', 'Phải yêu quý và kính trọng thầy', 'Con nên học nhiều chữ', 'Cần có nhiều bạn'], 1, 'Muốn con học giỏi thì phải biết yêu quý, kính trọng thầy cô.'),
  mcq('mcq_07', 'general', 'Văn Miếu – Quốc Tử Giám, nơi được xem là trường đại học đầu tiên của Việt Nam, nằm ở đâu?', ['Huế', 'Hà Nội', 'Đà Nẵng', 'Hải Phòng'], 1, 'Quốc Tử Giám được lập năm 1076 tại Thăng Long (Hà Nội ngày nay).'),
  mcq('mcq_08', 'general', 'Chu Văn An nổi tiếng trong lịch sử Việt Nam với vai trò nào?', ['Nhà thầu xây dựng', 'Người thầy mẫu mực của nền giáo dục', 'Nhà hàng hải', 'Thợ rèn'], 1, 'Chu Văn An (thời Trần) được tôn vinh là nhà giáo mẫu mực, "vạn thế sư biểu".'),
  mcq('mcq_09', 'general', 'Ngày Quốc tế Nhà giáo (World Teachers\' Day) do UNESCO khởi xướng được tổ chức vào ngày nào?', ['5/10', '20/11', '10/12', '1/1'], 0, 'World Teachers\' Day được tổ chức vào ngày 5 tháng 10 hằng năm.'),
  mcq('mcq_10', 'general', 'Phương pháp học Pomodoro thường chia thời gian như thế nào?', ['25 phút tập trung, nghỉ 5 phút', '2 giờ học liên tục', '10 phút học, nghỉ 1 giờ', 'Học cả ngày, nghỉ cuối tuần'], 0, 'Pomodoro: tập trung 25 phút rồi nghỉ ngắn 5 phút, lặp lại nhiều chu kỳ.'),
  mcq('mcq_11', 'tech', 'HTML là viết tắt của cụm từ nào?', ['HyperText Markup Language', 'High Tech Modern Language', 'Home Tool Markup Language', 'Hyper Transfer Machine Link'], 0, 'HTML — HyperText Markup Language — là ngôn ngữ đánh dấu để tạo cấu trúc trang web.'),
  mcq('mcq_12', 'tech', 'Ngôn ngữ nào thường dùng để tạo kiểu (màu sắc, bố cục) cho trang web?', ['SQL', 'CSS', 'Bash', 'XML'], 1, 'CSS (Cascading Style Sheets) mô tả cách hiển thị của các phần tử HTML.'),
  mcq('mcq_13', 'tech', 'Trong JavaScript, từ khóa nào dùng để khai báo một hằng số?', ['var', 'let', 'const', 'static'], 2, '`const` khai báo biến không thể gán lại.'),
  mcq('mcq_14', 'tech', 'Số nhị phân 101 bằng số nào trong hệ thập phân?', ['3', '5', '6', '7'], 1, '1×4 + 0×2 + 1×1 = 5.'),
  mcq('mcq_15', 'tech', 'CPU là viết tắt của cụm từ nào?', ['Central Processing Unit', 'Computer Personal Unit', 'Control Program Utility', 'Central Power Unit'], 0, 'CPU — Central Processing Unit — là bộ xử lý trung tâm của máy tính.'),
  mcq('mcq_16', 'tech', 'Cấu trúc dữ liệu nào hoạt động theo nguyên tắc "vào sau, ra trước" (LIFO)?', ['Queue (hàng đợi)', 'Stack (ngăn xếp)', 'Array (mảng)', 'Graph (đồ thị)'], 1, 'Stack: phần tử đưa vào sau cùng sẽ được lấy ra đầu tiên.'),
  mcq('mcq_17', 'tech', 'Trong Python, hàm nào dùng để in nội dung ra màn hình?', ['echo()', 'print()', 'console.log()', 'printf()'], 1, 'Python dùng `print()` để in ra màn hình.'),
  mcq('mcq_18', 'tech', 'Trong hầu hết ngôn ngữ lập trình, chỉ số của phần tử đầu tiên trong mảng là?', ['0', '1', '-1', '10'], 0, 'Đa số ngôn ngữ (C, C++, JavaScript, Python…) đánh chỉ số mảng từ 0.'),
  mcq('mcq_19', 'tech', 'Git chủ yếu được dùng để làm gì?', ['Quản lý phiên bản mã nguồn', 'Thiết kế đồ họa', 'Soạn thảo văn bản', 'Nén video'], 0, 'Git là hệ thống quản lý phiên bản phân tán cho mã nguồn.'),
  mcq('mcq_20', 'tech', 'Độ phức tạp thời gian của tìm kiếm nhị phân trên mảng đã sắp xếp là?', ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], 1, 'Mỗi bước chia đôi miền tìm kiếm nên độ phức tạp là O(log n).'),
  mcq('mcq_21', 'tech', 'Đơn vị nhỏ nhất của thông tin trong máy tính là gì?', ['byte', 'bit', 'pixel', 'hertz'], 1, 'Bit (0 hoặc 1) là đơn vị thông tin nhỏ nhất; 8 bit tạo thành 1 byte.'),
  mcq('mcq_22', 'tech', 'Kết quả của 2^10 là bao nhiêu?', ['100', '512', '1024', '2048'], 2, '2^10 = 1024.'),
];

interface DebugSeed {
  qid: string; language: 'javascript' | 'python' | 'cpp'; text: string; buggyCode: string; hint: string; explanation: string;
  solution: string; mustMatch: string[]; mustNotMatch: string[];
}

export const DEBUG_QUESTIONS: DebugSeed[] = [
  {
    qid: 'dbg_01', language: 'javascript', text: 'Hàm tính tổng bị lỗi vòng lặp',
    buggyCode: `function sum(arr) {\n  let total = 0;\n  for (let i = 0; i <= arr.length; i++) {\n    total += arr[i];\n  }\n  return total;\n}`,
    hint: 'Chỉ số cuối cùng của mảng là arr.length - 1.',
    explanation: 'Điều kiện `i <= arr.length` làm vòng lặp đọc ra ngoài mảng (arr[arr.length] là undefined). Phải dùng `i < arr.length`.',
    solution: `function sum(arr) {\n  let total = 0;\n  for (let i = 0; i < arr.length; i++) {\n    total += arr[i];\n  }\n  return total;\n}`,
    mustMatch: ['i\\s*(<\\s*arr\\.length|<=\\s*arr\\.length\\s*-\\s*1)', 'return\\s+total'],
    mustNotMatch: ['i\\s*<=\\s*arr\\.length(?!\\s*-)'],
  },
  {
    qid: 'dbg_02', language: 'javascript', text: 'Điều kiện kiểm tra tuổi bị lỗi',
    buggyCode: `function isAdult(age) {\n  if (age = 18) {\n    return true;\n  }\n  return false;\n}`,
    hint: 'Một dấu = là phép gán. Người từ 18 tuổi trở lên đều là người lớn.',
    explanation: '`age = 18` gán giá trị thay vì so sánh. Cần so sánh `age >= 18`.',
    solution: `function isAdult(age) {\n  if (age >= 18) {\n    return true;\n  }\n  return false;\n}`,
    mustMatch: ['if\\s*\\(\\s*(age\\s*>=\\s*18|age\\s*>\\s*17|18\\s*<=\\s*age)\\s*\\)'],
    mustNotMatch: ['if\\s*\\(\\s*age\\s*=\\s*18'],
  },
  {
    qid: 'dbg_03', language: 'python', text: 'Hàm chào bị lỗi cú pháp',
    buggyCode: `def greet(name)\n    print("Xin chào, " + name)`,
    hint: 'Dòng khai báo hàm trong Python cần kết thúc bằng một ký tự đặc biệt.',
    explanation: 'Câu lệnh `def` phải kết thúc bằng dấu hai chấm (:).',
    solution: `def greet(name):\n    print("Xin chào, " + name)`,
    mustMatch: ['def\\s+greet\\(\\s*name\\s*\\)\\s*:', 'print\\s*\\('],
    mustNotMatch: [],
  },
  {
    qid: 'dbg_04', language: 'python', text: 'Tính tổng từ 1 đến 5 nhưng kết quả sai',
    buggyCode: `total = 0\nfor n in range(1, 6):\n    total = n\nprint(total)`,
    hint: 'Kết quả mong muốn là 15, nhưng chương trình in ra 5.',
    explanation: '`total = n` ghi đè giá trị mỗi vòng lặp. Cần cộng dồn: `total += n`.',
    solution: `total = 0\nfor n in range(1, 6):\n    total += n\nprint(total)`,
    mustMatch: ['total\\s*(\\+=\\s*n|=\\s*total\\s*\\+\\s*n|=\\s*n\\s*\\+\\s*total)', 'print\\s*\\(\\s*total\\s*\\)'],
    mustNotMatch: ['total\\s*=\\s*n(?!\\s*\\+)'],
  },
  {
    qid: 'dbg_05', language: 'cpp', text: 'Vòng lặp while chạy mãi không dừng',
    buggyCode: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int i = 0;\n    while (i < 5) {\n        cout << i << endl;\n    }\n    return 0;\n}`,
    hint: 'Biến i không bao giờ thay đổi bên trong vòng lặp.',
    explanation: 'Thiếu lệnh tăng i trong thân vòng lặp nên điều kiện `i < 5` luôn đúng. Cần `i++` bên trong khối while.',
    solution: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int i = 0;\n    while (i < 5) {\n        cout << i << endl;\n        i++;\n    }\n    return 0;\n}`,
    mustMatch: ['while\\s*\\(\\s*i\\s*<\\s*5\\s*\\)\\s*\\{[^}]*(i\\+\\+|\\+\\+i|i\\s*\\+=\\s*1|i\\s*=\\s*i\\s*\\+\\s*1)[^}]*\\}', 'cout'],
    mustNotMatch: [],
  },
  {
    qid: 'dbg_06', language: 'cpp', text: 'Chương trình không biên dịch được',
    buggyCode: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int x = 10\n    cout << x << endl;\n    return 0;\n}`,
    hint: 'Mỗi câu lệnh khai báo trong C++ cần được kết thúc đúng cách.',
    explanation: 'Thiếu dấu chấm phẩy sau `int x = 10`.',
    solution: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int x = 10;\n    cout << x << endl;\n    return 0;\n}`,
    mustMatch: ['int\\s+x\\s*=\\s*10\\s*;', 'cout\\s*<<\\s*x'],
    mustNotMatch: [],
  },
  {
    qid: 'dbg_07', language: 'javascript', text: 'Biến đếm không thể tăng',
    buggyCode: `const count = 0;\nfor (let i = 0; i < 3; i++) {\n  count = count + 1;\n}\nconsole.log(count);`,
    hint: 'Một biến khai báo bằng const không thể gán lại giá trị.',
    explanation: '`const` không cho gán lại. Dùng `let` (hoặc `var`) cho biến cần thay đổi.',
    solution: `let count = 0;\nfor (let i = 0; i < 3; i++) {\n  count = count + 1;\n}\nconsole.log(count);`,
    mustMatch: ['(let|var)\\s+count\\s*=\\s*0', 'count\\s*(=\\s*count\\s*\\+\\s*1|\\+=\\s*1|\\+\\+)|\\+\\+\\s*count'],
    mustNotMatch: ['const\\s+count'],
  },
  {
    qid: 'dbg_08', language: 'javascript', text: 'Hàm tìm số lớn hơn trả về sai',
    buggyCode: `function max(a, b) {\n  if (a < b) {\n    return a;\n  }\n  return b;\n}`,
    hint: 'Hiện tại hàm đang trả về số nhỏ hơn.',
    explanation: 'Khi `a < b`, số lớn hơn là b chứ không phải a. Đổi dấu so sánh hoặc đổi giá trị trả về.',
    solution: `function max(a, b) {\n  if (a > b) {\n    return a;\n  }\n  return b;\n}`,
    mustMatch: ['(if\\s*\\(\\s*a\\s*>=?\\s*b\\s*\\)\\s*\\{\\s*return\\s+a\\s*;?\\s*\\}\\s*return\\s+b|if\\s*\\(\\s*a\\s*<=?\\s*b\\s*\\)\\s*\\{\\s*return\\s+b\\s*;?\\s*\\}\\s*return\\s+a)'],
    mustNotMatch: [],
  },
];

export const QUESTIONS = [
  ...MCQ_QUESTIONS.map((q) => ({ ...q, kind: 'mcq' as const, language: '', buggyCode: '', hint: '', accepted: [] as string[], mustMatch: [] as string[], mustNotMatch: [] as string[] })),
  ...DEBUG_QUESTIONS.map((q) => ({
    qid: q.qid, kind: 'debug' as const, category: 'debug', text: q.text, choices: [] as string[], explanation: q.explanation,
    language: q.language, buggyCode: q.buggyCode, hint: q.hint, accepted: [q.solution], mustMatch: q.mustMatch, mustNotMatch: q.mustNotMatch,
  })),
];

// ───────────────────────── Lời tri ân mẫu (đánh dấu rõ là dữ liệu mẫu) ─────────────────────────
export const SAMPLE_GRATITUDE = [
  { title: 'Cảm ơn cô đã không bỏ cuộc với em', recipient: 'Cô giáo chủ nhiệm', style: 'classic' as const,
    body: 'Em từng rất sợ môn Toán. Cô không bao giờ la mắng mà luôn ngồi lại giảng thêm cho em sau giờ học. Nhờ cô, em dần dám giơ tay phát biểu. Em xin cảm ơn cô rất nhiều.' },
  { title: 'Người thầy dạy em cách học', recipient: 'Thầy hướng dẫn', style: 'night' as const,
    body: 'Thầy không chỉ dạy em kiến thức mà còn dạy em cách đặt câu hỏi. Mỗi lần em bí, thầy chỉ hỏi lại một câu, và em tự tìm ra lối đi. Cảm ơn thầy vì sự kiên nhẫn ấy.' },
  { title: 'Một lời cảm ơn muộn', recipient: 'Thầy cô cũ', style: 'sunrise' as const,
    body: 'Đã nhiều năm trôi qua, nhưng em vẫn nhớ từng lời dặn của thầy cô. Em xin gửi lời cảm ơn chân thành nhân ngày Nhà giáo Việt Nam 20/11.' },
];
