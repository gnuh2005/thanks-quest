import { z } from 'zod';
import {
  applyDig, gradeDebug, gradeQuiz, replayMemory, type Cell, type DebugDef, type QuizItem,
} from '../domain/grading.js';
import { Question } from '../models/content.js';
import { GameSession, PlayerProgress } from '../models/progress.js';
import { randomInt, sample, shuffle, uuid } from '../utils/crypto.js';
import { todayKey } from '../utils/date.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { getContent, type MiniGameDef } from './content.js';
import { mergeGrants, type ActionOutcome } from './gameService.js';
import { addFacts, checkAchievements, getProgress, grant, type GrantResult, type Owner } from './progress.js';

export const MEMORY_SYMBOLS = ['book', 'star', 'pencil', 'laptop', 'globe', 'flask', 'lamp', 'medal', 'key', 'heart', 'music', 'leaf'];
const GRACE_MS = 15_000;

const quizAnswer = z.object({ answers: z.array(z.object({ qid: z.string().max(60), choice: z.number().int() })).max(30) });
const memoryAnswer = z.object({ flips: z.array(z.number().int()).min(2).max(200) });
const debugAnswer = z.object({ answers: z.array(z.object({ qid: z.string().max(60), code: z.string().max(2500) })).max(10) });

export async function listMiniGames() {
  const c = await getContent();
  return c.minigames.map(publicDef);
}

export function publicDef(d: MiniGameDef) {
  const { reward, timeLimitSec, count, pairs, size, maxDigs, treasures, passPercent, passCount } = d.config as Record<string, any>;
  return {
    minigameId: d.minigameId, type: d.type, name: d.name, description: d.description, instructions: d.instructions, areaId: d.areaId,
    config: { timeLimitSec, count, pairs, size, maxDigs, treasures, passPercent, passCount },
    reward: reward ? { first: reward.first, repeat: reward.repeat, perfect: reward.perfect } : undefined,
  };
}

async function getDef(id: string): Promise<MiniGameDef> {
  const c = await getContent();
  const d = c.minigames.find((m) => m.minigameId === id);
  if (!d) throw notFound('Mini game không tồn tại');
  return d;
}

export async function startMinigame(owner: Owner, minigameId: string) {
  const def = await getDef(minigameId);
  const progress = await getProgress(owner);
  const cfg = def.config as Record<string, any>;
  const limit = Number(cfg.timeLimitSec ?? 180);
  const startedAt = new Date();
  const deadline = new Date(startedAt.getTime() + limit * 1000 + GRACE_MS);
  const attemptId = uuid();

  let payload: Record<string, unknown> = {};
  let client: Record<string, unknown> = {};

  if (def.type === 'quiz') {
    const pool = await Question.find({ kind: 'mcq', active: true, ...(cfg.category ? { category: cfg.category } : {}) }).lean();
    const picked = sample(pool, Math.min(Number(cfg.count ?? 5), pool.length));
    if (picked.length === 0) throw conflict('Chưa có câu hỏi cho mini game này', 'NO_QUESTIONS');
    const items = picked.map((q) => ({
      qid: q.qid, order: shuffle(q.choices.map((_, i) => i)), answerIndex: q.answerIndex ?? 0,
    }));
    payload = { items };
    client = {
      questions: items.map((it, i) => ({
        qid: it.qid, text: picked[i]!.text, category: picked[i]!.category,
        choices: it.order.map((o) => picked[i]!.choices[o]),
      })),
    };
  } else if (def.type === 'memory') {
    const pairs = Math.min(Number(cfg.pairs ?? 6), MEMORY_SYMBOLS.length);
    const deck = shuffle([...MEMORY_SYMBOLS.slice(0, pairs), ...MEMORY_SYMBOLS.slice(0, pairs)]);
    payload = { deck };
    client = { deck, pairs };
  } else if (def.type === 'debug') {
    const pool = await Question.find({ kind: 'debug', active: true }).lean();
    const picked = sample(pool, Math.min(Number(cfg.count ?? 3), pool.length));
    if (picked.length === 0) throw conflict('Chưa có thử thách cho mini game này', 'NO_QUESTIONS');
    payload = { items: picked.map((q) => ({ qid: q.qid })) };
    client = {
      challenges: picked.map((q) => ({ qid: q.qid, title: q.text, language: q.language, buggyCode: q.buggyCode, hint: q.hint })),
    };
  } else {
    const size = Number(cfg.size ?? 6);
    const n = Number(cfg.treasures ?? 3);
    const cells: Cell[] = [];
    while (cells.length < n) {
      const c = { x: randomInt(size), y: randomInt(size) };
      if (!cells.some((e) => e.x === c.x && e.y === c.y)) cells.push(c);
    }
    payload = { treasures: cells, digs: [] as Cell[] };
    client = { size, maxDigs: Number(cfg.maxDigs ?? 10), treasures: n };
  }

  await GameSession.create({
    attemptId, ownerKey: owner.key, minigameId, status: 'started', payload, startedAt, deadline,
    ...(progress.expiresAt ? { expiresAt: progress.expiresAt } : {}),
  });
  return { attemptId, minigameId, type: def.type, timeLimitSec: limit, startedAt, ...client };
}

/** Đào một ô trong Treasure Hunt: server giữ vị trí kho báu, chỉ trả gợi ý nóng/ấm/lạnh. */
export async function treasureDig(owner: Owner, attemptId: string, x: number, y: number) {
  const s = await GameSession.findOne({ attemptId, ownerKey: owner.key, minigameId: { $exists: true } }).lean();
  if (!s) throw notFound('Lượt chơi không tồn tại');
  const def = await getDef(s.minigameId);
  if (def.type !== 'treasure') throw badRequest('Lượt chơi này không hỗ trợ thao tác đào');
  if (s.status !== 'started' || s.deadline.getTime() < Date.now()) throw conflict('Lượt chơi đã kết thúc', 'ATTEMPT_CLOSED');

  const payload = s.payload as { treasures: Cell[]; digs: Cell[] };
  const cfg = def.config as Record<string, any>;
  const r = applyDig(payload.treasures, payload.digs, Number(cfg.size ?? 6), Number(cfg.maxDigs ?? 10), x, y);
  if ('error' in r) throw badRequest(r.error, 'INVALID_DIG');

  // Khóa lạc quan: chỉ ghi nếu số lượt đào chưa thay đổi (chống hai request đào cùng lúc).
  const upd = await GameSession.updateOne(
    { attemptId, ownerKey: owner.key, status: 'started', 'payload.digs': { $size: payload.digs.length } },
    { $set: { 'payload.digs': r.digs } },
  );
  if (upd.modifiedCount !== 1) throw conflict('Thao tác bị trùng, hãy thử lại', 'RACE');
  return r.outcome;
}

async function applyMinigameRewards(owner: Owner, def: MiniGameDef, perfect: boolean): Promise<GrantResult> {
  const cfg = (def.config.reward ?? {}) as { first?: number; repeat?: number; repeatPerDay?: number; perfect?: number; items?: { itemId: string; qty: number }[] };
  const today = todayKey();
  let total: GrantResult | undefined;

  const first = await grant(owner, `mg:${def.minigameId}:first`, { xp: cfg.first ?? 0, items: cfg.items ?? [] }, 'minigame');
  total = mergeGrants(total, first);

  if (first.duplicate) {
    // Đã nhận thưởng lần đầu → chỉ còn thưởng lặp giới hạn mỗi ngày.
    for (let n = 1; n <= (cfg.repeatPerDay ?? 3); n++) {
      const r = await grant(owner, `mg:${def.minigameId}:rep:${today}:${n}`, { xp: cfg.repeat ?? 0 }, 'minigame');
      if (!r.duplicate) {
        total = mergeGrants(total, r);
        break;
      }
    }
  }
  if (perfect && (cfg.perfect ?? 0) > 0) {
    total = mergeGrants(total, await grant(owner, `mg:${def.minigameId}:perfect`, { xp: cfg.perfect }, 'minigame'));
  }
  // `duplicate` chỉ đúng khi không có gì mới được cộng ở mọi bước.
  return { ...total, duplicate: total.xp === 0 && total.items.length === 0 && !total.capped };
}

export interface SubmitOutcome extends ActionOutcome {
  result: Record<string, unknown>;
  passed: boolean;
}

export async function submitMinigame(owner: Owner, minigameId: string, attemptId: string, rawAnswer: unknown): Promise<SubmitOutcome> {
  const def = await getDef(minigameId);
  const now = new Date();

  // Chuyển trạng thái started → submitted một cách nguyên tử: chỉ một lần nộp được chấp nhận.
  const session = await GameSession.findOneAndUpdate(
    { attemptId, ownerKey: owner.key, minigameId, status: 'started' },
    { $set: { status: 'submitted', submittedAt: now } },
    { returnDocument: 'after' },
  ).lean();
  if (!session) {
    const exists = await GameSession.exists({ attemptId, ownerKey: owner.key, minigameId });
    if (!exists) throw notFound('Lượt chơi không tồn tại');
    throw conflict('Lượt chơi này đã được nộp', 'ALREADY_SUBMITTED');
  }

  const finish = async (result: Record<string, unknown>) => GameSession.updateOne({ attemptId }, { $set: { result } });

  if (session.deadline.getTime() < now.getTime()) {
    const result = { passed: false, expired: true };
    await GameSession.updateOne({ attemptId }, { $set: { status: 'expired', result } });
    return { passed: false, result, achievements: [], message: 'Đã hết thời gian' };
  }

  const cfg = def.config as Record<string, any>;
  const payload = session.payload as Record<string, any>;
  const elapsedMs = now.getTime() - session.startedAt.getTime();
  let passed = false;
  let perfect = false;
  let result: Record<string, unknown> = {};

  try {
    if (def.type === 'quiz') {
      const a = quizAnswer.parse(rawAnswer);
      const g = gradeQuiz(payload.items as QuizItem[], a.answers, Number(cfg.passPercent ?? 60));
      const qs = await Question.find({ qid: { $in: g.details.map((d) => d.qid) } }).lean();
      passed = g.passed; perfect = g.perfect;
      result = {
        passed, perfect, correct: g.correct, total: g.total, percent: g.percent, elapsedMs,
        details: g.details.map((d) => ({ ...d, explanation: qs.find((q) => q.qid === d.qid)?.explanation ?? '' })),
      };
    } else if (def.type === 'memory') {
      const a = memoryAnswer.parse(rawAnswer);
      const r = replayMemory(payload.deck as string[], a.flips, elapsedMs);
      if (!r.valid) {
        result = { passed: false, invalid: true, reason: r.reason };
      } else {
        passed = r.passed; perfect = r.completed && r.stars === 3;
        result = { passed, perfect, moves: r.moves, matches: r.matches, stars: r.stars, completed: r.completed, elapsedMs };
      }
    } else if (def.type === 'debug') {
      const a = debugAnswer.parse(rawAnswer);
      const qids = (payload.items as { qid: string }[]).map((i) => i.qid);
      const qs = await Question.find({ qid: { $in: qids } }).lean();
      const defs: DebugDef[] = qs.map((q) => ({ qid: q.qid, accepted: q.accepted, mustMatch: q.mustMatch, mustNotMatch: q.mustNotMatch }));
      const g = gradeDebug(defs, a.answers, Number(cfg.passCount ?? 2));
      passed = g.passed; perfect = g.perfect;
      result = {
        passed, perfect, passedCount: g.passedCount, total: g.total, elapsedMs,
        details: g.details.map((d) => ({ ...d, explanation: qs.find((q) => q.qid === d.qid)?.explanation ?? '' })),
      };
    } else {
      const treasures = payload.treasures as Cell[];
      const digs = payload.digs as Cell[];
      const found = treasures.filter((t) => digs.some((d) => d.x === t.x && d.y === t.y)).length;
      passed = found >= Number(cfg.passFound ?? 2);
      perfect = found === treasures.length;
      result = { passed, perfect, found, total: treasures.length, digsUsed: digs.length, treasures, elapsedMs };
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      await finish({ passed: false, invalid: true, reason: 'Dữ liệu nộp không hợp lệ' });
      throw badRequest('Dữ liệu nộp không hợp lệ', 'VALIDATION');
    }
    throw e;
  }

  await finish(result);

  let reward: GrantResult | undefined;
  if (passed) {
    await addFacts(owner, [`mg:${minigameId}:passed`, `mg:${minigameId}:passed:${todayKey()}`]);
    await PlayerProgress.updateOne({ ownerKey: owner.key }, { $addToSet: { passedMinigames: minigameId } });
    reward = await applyMinigameRewards(owner, def, perfect);
  }
  const achievements = await checkAchievements(owner);
  return {
    passed,
    result: { ...result, ...(reward ? { reward } : {}) },
    grant: reward,
    achievements,
  };
}

export async function minigameHistory(owner: Owner, limit = 20) {
  const rows = await GameSession.find({ ownerKey: owner.key }).sort({ startedAt: -1 }).limit(limit).select('-payload').lean();
  return rows.map((r) => ({
    attemptId: r.attemptId, minigameId: r.minigameId, status: r.status, startedAt: r.startedAt, submittedAt: r.submittedAt,
    passed: (r.result as { passed?: boolean } | undefined)?.passed ?? false,
  }));
}
