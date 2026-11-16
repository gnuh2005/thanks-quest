/**
 * Thế giới game 2D — nguồn dữ liệu duy nhất cho bản đồ.
 * Hệ tọa độ là ô lưới (tile) của thế giới game, KHÔNG phải tọa độ địa lý.
 * `scripts/exportMaps.ts` xuất dữ liệu này ra Tiled JSON cho Phaser; seed dùng cùng dữ liệu cho POI/NPC.
 */
export const TILE = 32;

/** Ký tự bản đồ → loại ô */
export const SOLID = new Set(['#', 'B', 'C', 'T', 'S', 'H', '~']);

export interface Portal { id: string; x: number; y: number; w: number; h: number; to: string; spawn: string; label: string }
export interface MapPoi {
  poiId: string; type: 'item' | 'story' | 'minigame' | 'gratitude' | 'wall' | 'sign';
  x: number; y: number; label: string; ref?: string; itemId?: string; xp?: number; text?: string;
}
export interface MapNpc { npcId: string; x: number; y: number }
export interface AreaMap {
  areaId: string;
  cols: number;
  rows: number;
  grid: string[]; // rows × cols ký tự
  indoor: boolean;
  spawns: Record<string, [number, number]>;
  portals: Portal[];
  pois: MapPoi[];
  npcs: MapNpc[];
}

class Grid {
  cells: string[][];
  constructor(public cols: number, public rows: number, fill: string) {
    this.cells = Array.from({ length: rows }, () => Array<string>(cols).fill(fill));
  }
  set(x: number, y: number, ch: string) {
    if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) this.cells[y]![x] = ch;
  }
  rect(x: number, y: number, w: number, h: number, ch: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, ch);
  }
  border(ch: string) {
    this.rect(0, 0, this.cols, 1, ch);
    this.rect(0, this.rows - 1, this.cols, 1, ch);
    this.rect(0, 0, 1, this.rows, ch);
    this.rect(this.cols - 1, 0, 1, this.rows, ch);
  }
  lines(): string[] {
    return this.cells.map((r) => r.join(''));
  }
}

const door = (g: Grid, p: Portal) => g.rect(p.x, p.y, p.w, p.h, 'D');

// ───────────────────────── 1. Knowledge Plaza ─────────────────────────
function plaza(): AreaMap {
  const g = new Grid(36, 24, '.');
  g.border('T');
  g.rect(0, 10, 36, 4, ','); // trục ngang
  g.rect(16, 0, 4, 24, ','); // trục dọc
  g.rect(8, 0, 2, 11, ','); // lối lên Memory Courtyard
  g.rect(26, 0, 2, 11, ','); // lối lên Gratitude Hall
  g.rect(17, 11, 2, 2, 'S'); // đài phun nước
  g.rect(2, 2, 5, 4, '#'); // mặt tiền cổng sân ký ức
  g.rect(29, 2, 5, 4, '#'); // mặt tiền hội trường
  for (const [x, y] of [[13, 16], [22, 17], [4, 20], [30, 19], [10, 6], [23, 7], [31, 8], [3, 15], [14, 20]] as const) g.set(x, y, 'T');
  for (const [x, y] of [[15, 9], [20, 9], [15, 14], [20, 14], [6, 18], [28, 16], [12, 21]] as const) g.set(x, y, 'F');

  const portals: Portal[] = [
    { id: 'to_library', x: 0, y: 11, w: 1, h: 2, to: 'library', spawn: 'from_plaza', label: 'Thư viện tri thức' },
    { id: 'to_lab', x: 35, y: 11, w: 1, h: 2, to: 'lab', spawn: 'from_plaza', label: 'Phòng thí nghiệm công nghệ' },
    { id: 'to_garden', x: 17, y: 23, w: 2, h: 1, to: 'garden', spawn: 'from_plaza', label: 'Khu vườn sáng tạo' },
    { id: 'to_courtyard', x: 8, y: 0, w: 2, h: 1, to: 'courtyard', spawn: 'from_plaza', label: 'Sân ký ức' },
    { id: 'to_hall', x: 26, y: 0, w: 2, h: 1, to: 'hall', spawn: 'from_plaza', label: 'Hội trường tri ân' },
  ];
  portals.forEach((p) => door(g, p));
  return {
    areaId: 'plaza', cols: 36, rows: 24, grid: g.lines(), indoor: false,
    spawns: {
      default: [17, 15], from_library: [2, 11], from_lab: [33, 11], from_garden: [17, 21],
      from_courtyard: [8, 2], from_hall: [26, 2],
    },
    portals,
    npcs: [{ npcId: 'professor', x: 14, y: 8 }],
    pois: [
      { poiId: 'plaza_board', type: 'sign', x: 12, y: 8, label: 'Bảng hướng dẫn', xp: 5,
        text: 'WASD / phím mũi tên để di chuyển. Nhấn E gần NPC hoặc vật phẩm để tương tác. J mở nhật ký nhiệm vụ, I mở túi đồ. Giữ Shift để chạy.' },
      { poiId: 'plaza_notes', type: 'item', x: 5, y: 17, label: 'Tập ghi chép', itemId: 'study_notes', xp: 5 },
    ],
  };
}

// ───────────────────────── 2. Library of Wisdom ─────────────────────────
function library(): AreaMap {
  const g = new Grid(30, 20, '_');
  g.border('#');
  for (const [x, w] of [[2, 11], [17, 11]] as const) g.rect(x, 2, w, 1, 'B');
  for (const [x, w] of [[3, 6], [21, 6]] as const) { g.rect(x, 5, w, 1, 'B'); g.rect(x, 9, w, 1, 'B'); }
  g.rect(12, 11, 6, 4, 'R');
  const portal: Portal = { id: 'to_plaza', x: 14, y: 19, w: 2, h: 1, to: 'plaza', spawn: 'from_library', label: 'Quảng trường' };
  door(g, portal);
  return {
    areaId: 'library', cols: 30, rows: 20, grid: g.lines(), indoor: true,
    spawns: { default: [14, 17], from_plaza: [14, 17] },
    portals: [portal],
    npcs: [{ npcId: 'librarian', x: 15, y: 7 }],
    pois: [
      { poiId: 'lib_shelf_1', type: 'item', x: 10, y: 4, label: 'Mảnh tri thức', itemId: 'knowledge_fragment', xp: 8 },
      { poiId: 'lib_shelf_2', type: 'item', x: 24, y: 7, label: 'Mảnh tri thức', itemId: 'knowledge_fragment', xp: 8 },
      { poiId: 'lib_shelf_3', type: 'item', x: 4, y: 11, label: 'Mảnh tri thức', itemId: 'knowledge_fragment', xp: 8 },
      { poiId: 'lib_book', type: 'item', x: 14, y: 3, label: 'Cuốn sách cổ', itemId: 'ancient_book', xp: 10 },
      { poiId: 'lib_quiz', type: 'minigame', ref: 'quiz', x: 13, y: 12, label: 'Bàn trắc nghiệm kiến thức' },
      { poiId: 'lib_memory', type: 'minigame', ref: 'memory', x: 16, y: 12, label: 'Bàn ghép thẻ ghi nhớ' },
    ],
  };
}

// ───────────────────────── 3. Technology Lab ─────────────────────────
function lab(): AreaMap {
  const g = new Grid(30, 20, '_');
  g.border('#');
  for (const [x, w] of [[3, 6], [21, 6]] as const) { g.rect(x, 3, w, 1, 'C'); g.rect(x, 7, w, 1, 'C'); g.rect(x, 12, w, 1, 'C'); }
  g.rect(13, 14, 4, 3, 'R');
  const portal: Portal = { id: 'to_plaza', x: 14, y: 19, w: 2, h: 1, to: 'plaza', spawn: 'from_lab', label: 'Quảng trường' };
  door(g, portal);
  return {
    areaId: 'lab', cols: 30, rows: 20, grid: g.lines(), indoor: true,
    spawns: { default: [14, 17], from_plaza: [14, 17] },
    portals: [portal],
    npcs: [{ npcId: 'coding_mentor', x: 15, y: 6 }],
    pois: [
      { poiId: 'lab_chip_1', type: 'item', x: 10, y: 4, label: 'Chip mạch', itemId: 'circuit_chip', xp: 8 },
      { poiId: 'lab_chip_2', type: 'item', x: 19, y: 10, label: 'Chip mạch', itemId: 'circuit_chip', xp: 8 },
      { poiId: 'lab_debug', type: 'minigame', ref: 'debug', x: 14, y: 10, label: 'Trạm sửa lỗi lập trình' },
      { poiId: 'lab_board', type: 'story', x: 6, y: 16, label: 'Bảng ghi chú của Mentor', xp: 8,
        text: 'Lỗi đầu tiên mình sửa mất cả buổi chiều, hóa ra chỉ là một dấu chấm phẩy. Đừng ngại lỗi — mỗi lỗi là một bài học đang chờ.' },
    ],
  };
}

// ───────────────────────── 4. Creative Garden ─────────────────────────
function garden(): AreaMap {
  const g = new Grid(30, 20, '.');
  g.border('H');
  g.rect(14, 1, 2, 17, ','); // lối chính
  g.rect(6, 9, 18, 2, ','); // lối ngang
  g.rect(20, 12, 5, 4, '~'); // hồ nước
  g.rect(8, 3, 4, 1, 'H'); g.rect(18, 3, 4, 1, 'H'); g.rect(8, 14, 4, 1, 'H'); g.rect(3, 6, 1, 4, 'H');
  for (const [x, y] of [[5, 5], [24, 6], [7, 17], [26, 10], [11, 12], [18, 17]] as const) g.set(x, y, 'T');
  for (const [x, y] of [[12, 6], [17, 6], [10, 16], [22, 4], [4, 13], [27, 17], [9, 7]] as const) g.set(x, y, 'F');
  const portal: Portal = { id: 'to_plaza', x: 14, y: 0, w: 2, h: 1, to: 'plaza', spawn: 'from_garden', label: 'Quảng trường' };
  door(g, portal);
  return {
    areaId: 'garden', cols: 30, rows: 20, grid: g.lines(), indoor: false,
    spawns: { default: [14, 2], from_plaza: [14, 2] },
    portals: [portal],
    npcs: [{ npcId: 'creative_student', x: 9, y: 9 }],
    pois: [
      { poiId: 'garden_seed_1', type: 'item', x: 4, y: 4, label: 'Hạt giống', itemId: 'garden_seed', xp: 8 },
      { poiId: 'garden_seed_2', type: 'item', x: 25, y: 5, label: 'Hạt giống', itemId: 'garden_seed', xp: 8 },
      { poiId: 'garden_seed_3', type: 'item', x: 6, y: 17, label: 'Hạt giống', itemId: 'garden_seed', xp: 8 },
      { poiId: 'garden_treasure', type: 'minigame', ref: 'treasure', x: 15, y: 12, label: 'Bãi đất kho báu' },
      { poiId: 'garden_sign', type: 'story', x: 21, y: 9, label: 'Tấm biển trong vườn', xp: 8,
        text: 'Sáng tạo không phải là nghĩ ra điều chưa ai nghĩ, mà là dám đặt điều mình nghĩ lên bàn để mọi người cùng nhìn.' },
    ],
  };
}

// ───────────────────────── 5. Memory Courtyard ─────────────────────────
function courtyard(): AreaMap {
  const g = new Grid(30, 20, ',');
  g.border('T');
  g.rect(2, 2, 26, 15, '.'); // thảm cỏ thu
  g.rect(13, 1, 4, 18, ','); // lối giữa
  g.rect(2, 9, 26, 2, ',');
  g.rect(14, 9, 2, 2, 'S'); // tượng nhớ ơn (đi vòng được)
  for (const [x, y] of [[4, 3], [25, 3], [4, 16], [25, 16], [9, 6], [20, 13], [8, 13], [21, 6]] as const) g.set(x, y, 'T');
  for (const [x, y] of [[11, 4], [18, 4], [11, 15], [18, 15]] as const) g.set(x, y, 'F');
  const portal: Portal = { id: 'to_plaza', x: 14, y: 19, w: 2, h: 1, to: 'plaza', spawn: 'from_courtyard', label: 'Quảng trường' };
  door(g, portal);
  return {
    areaId: 'courtyard', cols: 30, rows: 20, grid: g.lines(), indoor: false,
    spawns: { default: [14, 17], from_plaza: [14, 17] },
    portals: [portal],
    npcs: [{ npcId: 'memory_keeper', x: 12, y: 8 }],
    pois: [
      { poiId: 'story_1', type: 'story', x: 6, y: 5, label: 'Thư của một cựu sinh viên', xp: 8,
        text: 'Em còn nhớ buổi chiều cô ở lại thêm một tiếng chỉ để giảng lại bài cho cả lớp. Lúc ấy em chưa biết cảm ơn, giờ thì em biết.' },
      { poiId: 'story_2', type: 'story', x: 23, y: 5, label: 'Cuốn sổ cũ', xp: 8,
        text: 'Trang đầu cuốn sổ ghi dòng chữ nắn nót: "Học không phải để hơn ai, mà để hôm nay hiểu nhiều hơn hôm qua."' },
      { poiId: 'story_3', type: 'story', x: 6, y: 14, label: 'Bức ảnh lớp học', xp: 8,
        text: 'Trong ảnh, ai cũng cười. Chỉ có một người đứng cuối hàng, tay còn cầm viên phấn — người luôn nhường chỗ đẹp nhất cho học trò.' },
      { poiId: 'story_4', type: 'story', x: 24, y: 14, label: 'Hộp thời gian', xp: 8,
        text: 'Một chiếc hộp thời gian chứa những lời nhắn: "Mong mười năm nữa chúng ta vẫn nhớ người đã dạy mình tập viết chữ đầu tiên."' },
      { poiId: 'memory_frag_1', type: 'item', x: 14, y: 3, label: 'Mảnh ký ức', itemId: 'memory_fragment', xp: 8 },
      { poiId: 'memory_frag_2', type: 'item', x: 27, y: 9, label: 'Mảnh ký ức', itemId: 'memory_fragment', xp: 8 },
    ],
  };
}

// ───────────────────────── 6. Gratitude Hall ─────────────────────────
function hall(): AreaMap {
  const g = new Grid(30, 20, '_');
  g.border('#');
  g.rect(13, 1, 4, 18, 'R'); // thảm đỏ
  for (const y of [4, 8, 12]) { g.set(9, y, 'S'); g.set(20, y, 'S'); }
  const portal: Portal = { id: 'to_plaza', x: 14, y: 19, w: 2, h: 1, to: 'plaza', spawn: 'from_hall', label: 'Quảng trường' };
  door(g, portal);
  return {
    areaId: 'hall', cols: 30, rows: 20, grid: g.lines(), indoor: true,
    spawns: { default: [14, 17], from_plaza: [14, 17] },
    portals: [portal],
    npcs: [{ npcId: 'gratitude_guardian', x: 12, y: 4 }],
    pois: [
      { poiId: 'hall_desk', type: 'gratitude', x: 14, y: 10, label: 'Bàn viết lời tri ân' },
      { poiId: 'hall_wall', type: 'wall', x: 20, y: 6, label: 'Tường tri ân' },
      { poiId: 'hall_card', type: 'item', x: 5, y: 10, label: 'Tấm thiệp', itemId: 'gratitude_card', xp: 10 },
    ],
  };
}

export const AREA_MAPS: AreaMap[] = [plaza(), library(), lab(), garden(), courtyard(), hall()];
export const mapOf = (areaId: string): AreaMap => {
  const m = AREA_MAPS.find((a) => a.areaId === areaId);
  if (!m) throw new Error(`Không có bản đồ ${areaId}`);
  return m;
};
export const px = (tile: number): number => tile * TILE + TILE / 2;
