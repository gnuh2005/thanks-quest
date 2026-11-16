import { describe, it, expect } from 'vitest';
import { levelFromXp, levelInfo, xpForLevel } from '../src/domain/progression.js';
import { computeQuestView, type QuestDef, type ProgressSnapshot } from '../src/domain/quests.js';
import {
  applyDig, gradeDebug, gradeDebugOne, gradeQuiz, heatFor, normalizeCode, replayMemory, stripComments,
} from '../src/domain/grading.js';
import { newlyEarned } from '../src/domain/achievements.js';
import { planTransfer, xpOf } from '../src/domain/merge.js';
import { buildTemplateVersions } from '../src/domain/gratitudeTemplate.js';

describe('progression', () => {
  it('đường cong cấp độ có quy luật rõ ràng', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(299)).toBe(2);
    expect(levelFromXp(300)).toBe(3);
  });
  it('levelInfo trả tiến độ trong cấp', () => {
    const i = levelInfo(150);
    expect(i.level).toBe(2);
    expect(i.currentLevelXp).toBe(50);
    expect(i.nextLevelXp).toBe(200);
    expect(i.progress).toBeCloseTo(0.25);
  });
  it('xp âm hoặc lẻ không làm hỏng', () => {
    expect(levelFromXp(-5)).toBe(1);
    expect(levelFromXp(100.9)).toBe(2);
  });
});

const quest = (over: Partial<QuestDef> = {}): QuestDef => ({
  questId: 'q1', type: 'main', title: 'T', description: '', npcId: 'n', areaId: 'plaza', order: 1,
  objectives: [{ id: 'o1', kind: 'minigame', ref: 'quiz', label: 'Vượt quiz' }],
  reward: { xp: 10 },
  ...over,
});
const snap = (over: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({
  kind: 'user', xp: 0, facts: [], startedQuests: [], claimedQuests: [], collected: {}, ...over,
});

describe('quest status', () => {
  const today = '2026-11-15';
  it('available → in_progress → completed → claimed', () => {
    expect(computeQuestView(quest(), snap(), today).status).toBe('available');
    expect(computeQuestView(quest(), snap({ startedQuests: ['q1'] }), today).status).toBe('in_progress');
    expect(computeQuestView(quest(), snap({ startedQuests: ['q1'], facts: ['mg:quiz:passed'] }), today).status).toBe('completed');
    expect(computeQuestView(quest(), snap({ claimedQuests: ['q1'], facts: ['mg:quiz:passed'] }), today).status).toBe('claimed');
  });
  it('khóa theo nhiệm vụ tiên quyết, cấp độ và tài khoản', () => {
    expect(computeQuestView(quest({ requires: { quests: ['x'] } }), snap(), today).status).toBe('locked');
    expect(computeQuestView(quest({ requires: { level: 3 } }), snap({ xp: 100 }), today).status).toBe('locked');
    expect(computeQuestView(quest({ requires: { level: 2 } }), snap({ xp: 100 }), today).status).toBe('available');
    expect(computeQuestView(quest({ requires: { account: true } }), snap({ kind: 'guest' }), today).status).toBe('locked');
  });
  it('nhiệm vụ thu thập đếm theo tổng đã nhận', () => {
    const q = quest({ objectives: [{ id: 'c', kind: 'collect', ref: 'book', count: 2, label: 'Sách' }] });
    const v = computeQuestView(q, snap({ collected: { book: 1 } }), today);
    expect(v.objectives[0]).toMatchObject({ current: 1, target: 2, done: false });
    expect(computeQuestView(q, snap({ collected: { book: 2 } }), today).status).toBe('completed');
  });
  it('nhiệm vụ hằng ngày reset theo ngày', () => {
    const d = quest({ type: 'daily' });
    const facts = ['mg:quiz:passed:2026-11-15'];
    expect(computeQuestView(d, snap({ facts, claimedQuests: ['q1@2026-11-15'] }), today).status).toBe('claimed');
    expect(computeQuestView(d, snap({ facts, claimedQuests: ['q1@2026-11-15'] }), '2026-11-16').status).toBe('in_progress');
    expect(computeQuestView(d, snap({ facts }), '2026-11-15').status).toBe('completed');
  });
});

describe('quiz', () => {
  const items = [
    { qid: 'a', order: [2, 0, 1, 3], answerIndex: 0 }, // đáp án gốc 0 hiển thị ở vị trí 1
    { qid: 'b', order: [0, 1, 2, 3], answerIndex: 3 },
  ];
  it('chấm theo thứ tự hiển thị đã xáo', () => {
    const r = gradeQuiz(items, [{ qid: 'a', choice: 1 }, { qid: 'b', choice: 3 }], 60);
    expect(r.correct).toBe(2);
    expect(r.perfect).toBe(true);
    expect(r.details[0]!.correctDisplayIndex).toBe(1);
  });
  it('bỏ trống, sai, trùng và ngoài phạm vi đều tính sai', () => {
    const r = gradeQuiz(items, [{ qid: 'a', choice: 99 }, { qid: 'a', choice: 1 }], 60);
    expect(r.correct).toBe(0);
    expect(r.passed).toBe(false);
  });
  it('ngưỡng đạt', () => {
    const r = gradeQuiz(items, [{ qid: 'b', choice: 3 }], 50);
    expect(r.percent).toBe(50);
    expect(r.passed).toBe(true);
  });
});

describe('memory', () => {
  const deck = ['a', 'b', 'a', 'b'];
  it('hoàn thành đúng', () => {
    const r = replayMemory(deck, [0, 2, 1, 3], 5000);
    expect(r).toMatchObject({ valid: true, completed: true, moves: 2, matches: 2, passed: true, stars: 3 });
  });
  it('tính cả lượt sai', () => {
    const r = replayMemory(deck, [0, 1, 0, 2, 1, 3], 5000);
    expect(r.moves).toBe(3);
    expect(r.completed).toBe(true);
  });
  it('từ chối dữ liệu gian lận', () => {
    expect(replayMemory(deck, [0, 2, 1], 5000).valid).toBe(false); // lẻ lượt
    expect(replayMemory(deck, [0, 0], 5000).valid).toBe(false); // lật cùng thẻ
    expect(replayMemory(deck, [0, 9], 5000).valid).toBe(false); // ngoài phạm vi
    expect(replayMemory(deck, [0, 2, 0, 2], 5000).valid).toBe(false); // lật thẻ đã ghép
    expect(replayMemory(deck, [0, 2, 1, 3], 100).valid).toBe(false); // nhanh phi thực tế
  });
  it('chưa hoàn thành thì không đạt', () => {
    const r = replayMemory(deck, [0, 1], 5000);
    expect(r.completed).toBe(false);
    expect(r.passed).toBe(false);
  });
});

describe('debug', () => {
  const def = {
    qid: 'd1',
    accepted: [],
    mustMatch: ['for\\s*\\(\\s*let i = 0;\\s*i\\s*<\\s*arr\\.length'],
    mustNotMatch: ['<=\\s*arr\\.length'],
  };
  it('chấp nhận bản sửa đúng, bỏ qua khoảng trắng', () => {
    expect(gradeDebugOne(def, 'for (let i = 0;   i < arr.length; i++) { total += arr[i]; }')).toBe(true);
  });
  it('từ chối lỗi gốc', () => {
    expect(gradeDebugOne(def, 'for (let i = 0; i <= arr.length; i++) {}')).toBe(false);
  });
  it('không cho giấu đáp án trong chú thích', () => {
    const cheat = '// for (let i = 0; i < arr.length; i++)\nfor (let i = 0; i <= arr.length; i++) {}';
    expect(gradeDebugOne(def, cheat)).toBe(false);
    expect(stripComments('a // x\nb')).not.toContain('x');
    expect(normalizeCode('a   b\n c')).toBe('a b c');
  });
  it('mã rỗng, quá dài hoặc không phải chuỗi đều bị từ chối', () => {
    expect(gradeDebugOne(def, '')).toBe(false);
    expect(gradeDebugOne(def, 'x'.repeat(2001))).toBe(false);
    expect(gradeDebugOne(def, 42 as unknown as string)).toBe(false);
  });
  it('regex hỏng không làm sập chương trình', () => {
    expect(gradeDebugOne({ qid: 'x', accepted: [], mustMatch: ['(['], mustNotMatch: [] }, 'abc')).toBe(false);
  });
  it('gradeDebug tổng hợp theo ngưỡng', () => {
    const defs = [def, { ...def, qid: 'd2' }];
    const r = gradeDebug(defs, [{ qid: 'd1', code: 'for (let i = 0; i < arr.length; i++) {}' }], 1);
    expect(r).toMatchObject({ passedCount: 1, total: 2, passed: true, perfect: false });
  });
});

describe('treasure', () => {
  const treasures = [{ x: 2, y: 2 }, { x: 5, y: 5 }];
  it('gợi ý nóng/ấm/lạnh', () => {
    expect(heatFor(treasures, [], 2, 2)).toBe('found');
    expect(heatFor(treasures, [], 3, 3)).toBe('hot');
    expect(heatFor(treasures, [], 4, 2)).toBe('warm');
    expect(heatFor(treasures, [], 0, 5)).toBe('cold');
  });
  it('đào hợp lệ, đào trùng, hết lượt, ngoài lưới', () => {
    const a = applyDig(treasures, [], 6, 3, 2, 2);
    expect('outcome' in a && a.outcome.heat).toBe('found');
    if (!('digs' in a)) throw new Error('expected digs');
    expect('error' in applyDig(treasures, a.digs, 6, 3, 2, 2)).toBe(true);
    expect('error' in applyDig(treasures, [], 6, 3, 9, 9)).toBe(true);
    expect('error' in applyDig(treasures, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], 6, 3, 4, 4)).toBe(true);
  });
  it('kết thúc khi tìm đủ', () => {
    const a = applyDig(treasures, [{ x: 2, y: 2 }], 6, 5, 5, 5);
    if (!('outcome' in a)) throw new Error('expected outcome');
    expect(a.outcome.finished).toBe(true);
    expect(a.outcome.foundCount).toBe(2);
  });
});

describe('achievements', () => {
  const defs = [
    { achId: 'first', condition: { kind: 'fact' as const, value: 'talk:professor' } },
    { achId: 'q', condition: { kind: 'claimed_count' as const, value: 2 } },
    { achId: 'lv', condition: { kind: 'level' as const, value: 2 } },
  ];
  const s = { xp: 100, facts: ['talk:professor'], claimedQuests: ['a', 'b@2026-01-01', 'c'], passedMinigames: [], collected: {} };
  it('chỉ trả thành tựu mới và không lặp lại', () => {
    expect(newlyEarned(defs, s, [])).toEqual(['first', 'q', 'lv']);
    expect(newlyEarned(defs, s, ['first'])).toEqual(['q', 'lv']);
  });
  it('nhiệm vụ lặp ngày không tính vào số nhiệm vụ', () => {
    expect(newlyEarned(defs, { ...s, claimedQuests: ['a', 'b@2026-01-01'] }, [])).not.toContain('q');
  });
});

describe('chuyển Guest → tài khoản', () => {
  const g = [
    { sourceKey: 'quest:main_01:xp', kind: 'xp' as const, amount: 30 },
    { sourceKey: 'poi:lib_shelf_1', kind: 'item' as const, itemId: 'book', amount: 1 },
    { sourceKey: 'mg:quiz:first:xp', kind: 'xp' as const, amount: 40 },
  ];
  it('bỏ phần thưởng tài khoản đã có để không cộng trùng', () => {
    const plan = planTransfer(g, new Set(['quest:main_01:xp']));
    expect(plan.map((e) => e.sourceKey)).toEqual(['poi:lib_shelf_1', 'mg:quiz:first:xp']);
    expect(xpOf(plan)).toBe(40);
  });
  it('chạy lại kế hoạch với kết quả đã chuyển thì không còn gì để chuyển (idempotent)', () => {
    const first = planTransfer(g, new Set());
    const keys = new Set(first.map((e) => e.sourceKey));
    expect(planTransfer(g, keys)).toEqual([]);
  });
  it('loại bỏ khóa trùng trong chính danh sách guest', () => {
    expect(planTransfer([g[0]!, g[0]!], new Set())).toHaveLength(1);
  });
});

describe('gratitude template', () => {
  it('chỉ dùng nội dung người dùng đã nhập', () => {
    const r = buildTemplateVersions({ recipient: 'cô Lan', thanks: 'đã kiên nhẫn chỉ bài cho em' });
    expect(r.versions.formal).toContain('cô Lan');
    expect(r.versions.formal).toContain('kiên nhẫn');
    expect(r.versions.emotional).not.toMatch(/năm \d{4}|mùa hè/);
  });
  it('không có đầu vào vẫn tạo được lời cảm ơn chung', () => {
    expect(buildTemplateVersions({}).versions.short.length).toBeGreaterThan(0);
  });
});
