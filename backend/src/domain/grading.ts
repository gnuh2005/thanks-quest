/**
 * Chấm điểm mini game — toàn bộ là hàm thuần, chạy ở server.
 * Không có hàm nào thực thi mã người dùng nộp lên.
 */

// ───────────────────────── Knowledge Quiz ─────────────────────────
export interface QuizItem {
  qid: string;
  order: number[]; // order[i] = chỉ số lựa chọn gốc hiển thị ở vị trí i
  answerIndex: number; // chỉ số gốc của đáp án đúng
}
export interface QuizDetail {
  qid: string;
  correct: boolean;
  correctDisplayIndex: number;
  chosen: number | null;
}
export interface QuizResult {
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
  perfect: boolean;
  details: QuizDetail[];
}

export function gradeQuiz(
  items: QuizItem[],
  answers: { qid: string; choice: number }[],
  passPercent: number,
): QuizResult {
  const byQ = new Map<string, number>();
  for (const a of answers) if (!byQ.has(a.qid)) byQ.set(a.qid, a.choice);
  const details: QuizDetail[] = items.map((it) => {
    const choice = byQ.get(it.qid);
    const chosenOriginal =
      choice !== undefined && Number.isInteger(choice) && choice >= 0 && choice < it.order.length
        ? it.order[choice]!
        : null;
    return {
      qid: it.qid,
      correct: chosenOriginal !== null && chosenOriginal === it.answerIndex,
      correctDisplayIndex: it.order.indexOf(it.answerIndex),
      chosen: choice !== undefined && chosenOriginal !== null ? choice : null,
    };
  });
  const correct = details.filter((d) => d.correct).length;
  const total = items.length;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, total, percent, passed: percent >= passPercent, perfect: correct === total && total > 0, details };
}

// ───────────────────────── Memory Matching ─────────────────────────
export interface MemoryResult {
  valid: boolean;
  reason?: string;
  completed: boolean;
  moves: number;
  matches: number;
  stars: 0 | 1 | 2 | 3;
  passed: boolean;
}

/**
 * Phát lại chuỗi lật thẻ: mỗi lượt gồm 2 lần lật. Server giữ bộ bài, nên client không thể
 * khai khống số cặp hoặc số lượt.
 */
export function replayMemory(deck: string[], flips: number[], elapsedMs: number): MemoryResult {
  const pairs = deck.length / 2;
  const fail = (reason: string): MemoryResult => ({
    valid: false, reason, completed: false, moves: 0, matches: 0, stars: 0, passed: false,
  });
  if (flips.length === 0 || flips.length % 2 !== 0) return fail('Chuỗi lật thẻ không hoàn chỉnh');
  if (flips.length > deck.length * 6) return fail('Quá nhiều lượt lật');
  if (elapsedMs < flips.length * 250) return fail('Thời gian chơi không hợp lệ');

  const matched = new Set<number>();
  let moves = 0;
  for (let i = 0; i < flips.length; i += 2) {
    const a = flips[i]!;
    const b = flips[i + 1]!;
    const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n < deck.length;
    if (!inRange(a) || !inRange(b) || a === b) return fail('Thẻ không hợp lệ');
    if (matched.has(a) || matched.has(b)) return fail('Lật thẻ đã ghép');
    moves++;
    if (deck[a] === deck[b]) {
      matched.add(a);
      matched.add(b);
    }
  }
  const completed = matched.size === deck.length;
  const stars: 0 | 1 | 2 | 3 = !completed ? 0 : moves <= pairs + 2 ? 3 : moves <= pairs * 2 ? 2 : 1;
  return {
    valid: true,
    completed,
    moves,
    matches: matched.size / 2,
    stars,
    passed: completed && moves <= pairs * 3,
  };
}

// ───────────────────────── Code Debugging ─────────────────────────
export interface DebugDef {
  qid: string;
  accepted: string[];
  mustMatch: string[];
  mustNotMatch: string[];
}

/** Bỏ chú thích để người chơi không "đưa đáp án" vào comment. */
export function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/^\s*#.*$/gm, '');
}

export const normalizeCode = (code: string): string => stripComments(code).replace(/\s+/g, ' ').trim();

function safeRegex(src: string): RegExp | null {
  if (src.length > 300) return null;
  try {
    return new RegExp(src, 'i');
  } catch {
    return null;
  }
}

export function gradeDebugOne(def: DebugDef, code: string): boolean {
  if (typeof code !== 'string' || code.length === 0 || code.length > 2000) return false;
  const norm = normalizeCode(code);
  if (norm.length === 0) return false;

  const forbidden = def.mustNotMatch.map(safeRegex);
  if (forbidden.some((r) => r && r.test(norm))) return false;

  if (def.accepted.some((a) => normalizeCode(a) === norm)) return true;

  const required = def.mustMatch.map(safeRegex);
  if (required.length === 0 || required.some((r) => r === null)) return false;
  return required.every((r) => r!.test(norm));
}

export interface DebugResult {
  passedCount: number;
  total: number;
  passed: boolean;
  perfect: boolean;
  details: { qid: string; correct: boolean }[];
}

export function gradeDebug(defs: DebugDef[], answers: { qid: string; code: string }[], passCount: number): DebugResult {
  const byQ = new Map<string, string>();
  for (const a of answers) if (!byQ.has(a.qid)) byQ.set(a.qid, a.code);
  const details = defs.map((d) => ({ qid: d.qid, correct: gradeDebugOne(d, byQ.get(d.qid) ?? '') }));
  const passedCount = details.filter((d) => d.correct).length;
  return {
    passedCount,
    total: defs.length,
    passed: passedCount >= passCount,
    perfect: passedCount === defs.length && defs.length > 0,
    details,
  };
}

// ───────────────────────── Treasure Hunt ─────────────────────────
export interface Cell { x: number; y: number }

export type Heat = 'found' | 'hot' | 'warm' | 'cold';

export function heatFor(treasures: Cell[], found: Cell[], x: number, y: number): Heat {
  if (treasures.some((t) => t.x === x && t.y === y)) return 'found';
  const remaining = treasures.filter((t) => !found.some((f) => f.x === t.x && f.y === t.y));
  if (remaining.length === 0) return 'cold';
  const d = Math.min(...remaining.map((t) => Math.max(Math.abs(t.x - x), Math.abs(t.y - y)))); // khoảng cách Chebyshev
  return d <= 1 ? 'hot' : d <= 2 ? 'warm' : 'cold';
}

export interface DigOutcome {
  heat: Heat;
  foundCount: number;
  digsLeft: number;
  finished: boolean;
}

export function applyDig(
  treasures: Cell[],
  digs: Cell[],
  size: number,
  maxDigs: number,
  x: number,
  y: number,
): { error: string } | { outcome: DigOutcome; digs: Cell[] } {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size) {
    return { error: 'Ô không hợp lệ' };
  }
  if (digs.length >= maxDigs) return { error: 'Đã hết lượt đào' };
  if (digs.some((d) => d.x === x && d.y === y)) return { error: 'Ô này đã được đào' };

  const foundBefore = treasures.filter((t) => digs.some((d) => d.x === t.x && d.y === t.y));
  const heat = heatFor(treasures, foundBefore, x, y);
  const nextDigs = [...digs, { x, y }];
  const foundCount = treasures.filter((t) => nextDigs.some((d) => d.x === t.x && d.y === t.y)).length;
  const digsLeft = maxDigs - nextDigs.length;
  return {
    digs: nextDigs,
    outcome: { heat, foundCount, digsLeft, finished: digsLeft === 0 || foundCount === treasures.length },
  };
}
