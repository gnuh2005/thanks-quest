import { env } from '../config/env.js';
import { levelFromXp, levelInfo } from '../domain/progression.js';
import { computeQuestViews, type ProgressSnapshot, type QuestView } from '../domain/quests.js';
import { newlyEarned } from '../domain/achievements.js';
import { PlayerProgress, RewardEvent } from '../models/progress.js';
import { todayKey } from '../utils/date.js';
import { getContent, type AreaDef } from './content.js';
import { notFound } from '../utils/errors.js';

export interface Owner {
  kind: 'user' | 'guest';
  id: string;
  key: string;
}

export interface ProgressDoc {
  _id: unknown;
  ownerKey: string;
  kind: 'user' | 'guest';
  ownerId: string;
  xp: number;
  level: number;
  currentArea: string;
  profile: { avatar: number; outfit: number };
  facts: string[];
  startedQuests: string[];
  claimedQuests: string[];
  passedMinigames: string[];
  inventory: Record<string, number>;
  collected: Record<string, number>;
  achievements: { id: string; at: Date }[];
  expiresAt?: Date;
  createdAt?: Date;
}

const isDup = (e: unknown) => (e as { code?: number })?.code === 11000;

export async function ensureProgress(owner: Owner, expiresAt?: Date): Promise<ProgressDoc> {
  const make = () =>
    PlayerProgress.findOneAndUpdate(
      { ownerKey: owner.key },
      { $setOnInsert: { ownerKey: owner.key, kind: owner.kind, ownerId: owner.id, ...(expiresAt ? { expiresAt } : {}) } },
      { upsert: true, returnDocument: 'after', lean: true },
    );
  try {
    return (await make()) as unknown as ProgressDoc;
  } catch (e) {
    if (isDup(e)) return (await make()) as unknown as ProgressDoc; // hai request tạo đồng thời
    throw e;
  }
}

export async function getProgress(owner: Owner): Promise<ProgressDoc> {
  if (owner.kind === 'guest') {
    const p = await PlayerProgress.findOne({ ownerKey: owner.key }).lean();
    if (!p) throw notFound('Phiên chơi thử không còn tồn tại', 'GUEST_GONE');
    return p as unknown as ProgressDoc;
  }
  return ensureProgress(owner);
}

export const snapshotOf = (p: ProgressDoc): ProgressSnapshot => ({
  kind: p.kind,
  xp: p.xp,
  facts: p.facts ?? [],
  startedQuests: p.startedQuests ?? [],
  claimedQuests: p.claimedQuests ?? [],
  collected: (p.collected ?? {}) as Record<string, number>,
});

export async function addFacts(owner: Owner, facts: string[]): Promise<void> {
  if (facts.length === 0) return;
  await PlayerProgress.updateOne({ ownerKey: owner.key }, { $addToSet: { facts: { $each: facts } } });
}

// ───────────────────────── Phần thưởng (idempotent) ─────────────────────────
export interface GrantResult {
  xp: number;
  items: { itemId: string; qty: number }[];
  levelUp?: { from: number; to: number };
  capped?: boolean;
  duplicate: boolean;
}

async function insertEvent(doc: {
  ownerKey: string; sourceKey: string; kind: 'xp' | 'item' | 'marker'; itemId?: string; amount: number; source: string; expiresAt?: Date;
}): Promise<boolean> {
  try {
    await RewardEvent.create(doc);
    return true;
  } catch (e) {
    if (isDup(e)) return false;
    throw e;
  }
}

/**
 * Ghi phần thưởng đúng một lần cho mỗi `sourceKey`.
 * Sổ cái RewardEvent (unique ownerKey+sourceKey) là khóa chống trùng: request lặp hoặc song song
 * chỉ có một request chèn được sự kiện, các request còn lại nhận `duplicate: true`.
 */
export async function grant(
  owner: Owner,
  sourceKey: string,
  reward: { xp?: number; items?: { itemId: string; qty: number }[] },
  source: string,
): Promise<GrantResult> {
  const result: GrantResult = { xp: 0, items: [], duplicate: false };
  let requested = 0;
  let applied = 0;

  const prog = owner.kind === 'guest' ? await PlayerProgress.findOne({ ownerKey: owner.key }).select('xp expiresAt').lean() : null;
  if (owner.kind === 'guest' && !prog) throw notFound('Phiên chơi thử không còn tồn tại', 'GUEST_GONE');
  const expiresAt = prog?.expiresAt ?? undefined;

  if (reward.xp && reward.xp > 0) {
    requested++;
    let amount = Math.floor(reward.xp);
    if (owner.kind === 'guest') {
      const room = env.GUEST_XP_CAP - (prog?.xp ?? 0);
      if (amount > room) {
        amount = Math.max(0, room);
        result.capped = true;
      }
    }
    if (amount > 0 && (await insertEvent({ ownerKey: owner.key, sourceKey: `${sourceKey}:xp`, kind: 'xp', amount, source, expiresAt }))) {
      const before = await PlayerProgress.findOneAndUpdate({ ownerKey: owner.key }, { $inc: { xp: amount } }, { returnDocument: 'before' }).select('xp level').lean();
      const prevXp = before?.xp ?? 0;
      const from = levelFromXp(prevXp);
      const to = levelFromXp(prevXp + amount);
      if (to !== (before?.level ?? 1)) await PlayerProgress.updateOne({ ownerKey: owner.key }, { $set: { level: to } });
      if (to > from) result.levelUp = { from, to };
      result.xp = amount;
      applied++;
    }
  }

  for (const it of reward.items ?? []) {
    if (!/^[a-z0-9_]+$/.test(it.itemId) || it.qty <= 0) continue;
    requested++;
    if (await insertEvent({ ownerKey: owner.key, sourceKey: `${sourceKey}:item:${it.itemId}`, kind: 'item', itemId: it.itemId, amount: it.qty, source, expiresAt })) {
      await PlayerProgress.updateOne(
        { ownerKey: owner.key },
        { $inc: { [`inventory.${it.itemId}`]: it.qty, [`collected.${it.itemId}`]: it.qty } },
      );
      result.items.push({ itemId: it.itemId, qty: it.qty });
      applied++;
    }
  }

  result.duplicate = requested > 0 && applied === 0 && !result.capped;
  return result;
}

/** Khóa "đã nhận" dạng marker: chỉ request đầu tiên chèn được → chống nhận thưởng nhiệm vụ hai lần. */
export async function claimLock(owner: Owner, key: string, source: string, expiresAt?: Date): Promise<boolean> {
  return insertEvent({ ownerKey: owner.key, sourceKey: key, kind: 'marker', amount: 0, source, expiresAt });
}

export async function releaseLock(owner: Owner, key: string): Promise<void> {
  await RewardEvent.deleteOne({ ownerKey: owner.key, sourceKey: key, kind: 'marker' });
}

// ───────────────────────── Thành tựu ─────────────────────────
export interface EarnedAchievement { achId: string; name: string; description: string; icon: string; rewardXp: number }

export async function checkAchievements(owner: Owner): Promise<EarnedAchievement[]> {
  const [p, content] = await Promise.all([getProgress(owner), getContent()]);
  const ids = newlyEarned(
    content.achievements,
    { xp: p.xp, facts: p.facts, claimedQuests: p.claimedQuests, passedMinigames: p.passedMinigames, collected: p.collected },
    (p.achievements ?? []).map((a) => a.id),
  );
  const earned: EarnedAchievement[] = [];
  for (const id of ids) {
    const def = content.achievements.find((a) => a.achId === id);
    if (!def) continue;
    const res = await PlayerProgress.updateOne(
      { ownerKey: owner.key, 'achievements.id': { $ne: id } },
      { $push: { achievements: { id, at: new Date() } } },
    );
    if (res.modifiedCount !== 1) continue;
    if (def.rewardXp > 0) await grant(owner, `ach:${id}`, { xp: def.rewardXp }, 'achievement');
    earned.push({ achId: id, name: def.name, description: def.description, icon: def.icon, rewardXp: def.rewardXp });
  }
  return earned;
}

// ───────────────────────── Khu vực ─────────────────────────
export function areaLock(area: AreaDef, p: ProgressDoc): { unlocked: boolean; reason?: string } {
  const u = area.unlock ?? {};
  if (u.accountOnly && p.kind === 'guest') return { unlocked: false, reason: 'Đăng ký tài khoản để mở khu vực này' };
  if (u.minLevel && levelFromXp(p.xp) < u.minLevel) return { unlocked: false, reason: `Cần đạt cấp ${u.minLevel}` };
  const missing = (u.claimedQuests ?? []).filter((q) => !(p.claimedQuests ?? []).includes(q));
  if (missing.length) return { unlocked: false, reason: 'Hoàn thành thêm nhiệm vụ chính để mở khóa' };
  return { unlocked: true };
}

// ───────────────────────── Trạng thái gửi cho client ─────────────────────────
export interface PlayerState {
  kind: 'user' | 'guest';
  displayName: string;
  profile: { avatar: number; outfit: number };
  level: ReturnType<typeof levelInfo>;
  currentArea: string;
  areas: { areaId: string; name: string; description: string; unlocked: boolean; reason?: string; visited: boolean }[];
  quests: QuestView[];
  inventory: { itemId: string; qty: number; name: string; category: string; description: string; icon: string; usable: boolean }[];
  achievements: { achId: string; name: string; description: string; icon: string; rewardXp: number; unlocked: boolean; at?: Date }[];
  collectedPois: string[];
  passedMinigames: string[];
  stats: { questsClaimed: number; minigamesPassed: number; itemsCollected: number; xp: number };
  guest?: { expiresAt?: Date; xpCap: number };
}

export async function buildState(owner: Owner, displayName: string): Promise<PlayerState> {
  const [p, content] = await Promise.all([getProgress(owner), getContent()]);
  const today = todayKey();
  const inv = (p.inventory ?? {}) as Record<string, number>;
  const earned = new Map((p.achievements ?? []).map((a) => [a.id, a.at]));

  return {
    kind: p.kind,
    displayName,
    profile: { avatar: p.profile?.avatar ?? 0, outfit: p.profile?.outfit ?? 0 },
    level: levelInfo(p.xp),
    currentArea: p.currentArea,
    areas: content.areas.map((a) => {
      const lock = areaLock(a, p);
      return {
        areaId: a.areaId, name: a.name, description: a.description,
        unlocked: lock.unlocked, reason: lock.reason, visited: p.facts.includes(`visit:${a.areaId}`),
      };
    }),
    quests: computeQuestViews(content.quests, snapshotOf(p), today),
    inventory: Object.entries(inv)
      .filter(([, q]) => q > 0)
      .map(([itemId, qty]) => {
        const d = content.items.find((i) => i.itemId === itemId);
        return {
          itemId, qty, name: d?.name ?? itemId, category: d?.category ?? 'collectible',
          description: d?.description ?? '', icon: d?.icon ?? 'package', usable: !!d?.usable,
        };
      }),
    achievements: content.achievements.map((a) => ({
      achId: a.achId, name: a.name, description: a.description, icon: a.icon, rewardXp: a.rewardXp,
      unlocked: earned.has(a.achId), at: earned.get(a.achId),
    })),
    collectedPois: p.facts.filter((f) => f.startsWith('poi:')).map((f) => f.slice(4)),
    passedMinigames: p.passedMinigames ?? [],
    stats: {
      questsClaimed: new Set((p.claimedQuests ?? []).filter((c) => !c.includes('@'))).size,
      minigamesPassed: new Set(p.passedMinigames ?? []).size,
      itemsCollected: Object.values((p.collected ?? {}) as Record<string, number>).reduce((a, b) => a + (Number(b) || 0), 0),
      xp: p.xp,
    },
    guest: p.kind === 'guest' ? { expiresAt: p.expiresAt, xpCap: env.GUEST_XP_CAP } : undefined,
  };
}
