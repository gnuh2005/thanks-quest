import { computeQuestView, claimKeyOf } from '../domain/quests.js';
import { PlayerProgress } from '../models/progress.js';
import { uuid } from '../utils/crypto.js';
import { todayKey } from '../utils/date.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { getContent, type PoiDef } from './content.js';
import {
  addFacts, areaLock, checkAchievements, getProgress, grant, snapshotOf, type EarnedAchievement, type GrantResult, type Owner,
} from './progress.js';

export interface ActionOutcome {
  grant?: GrantResult;
  achievements: EarnedAchievement[];
  message?: string;
}

function merge(a: GrantResult | undefined, b: GrantResult): GrantResult {
  if (!a) return b;
  return {
    xp: a.xp + b.xp,
    items: [...a.items, ...b.items],
    levelUp: b.levelUp ? { from: a.levelUp?.from ?? b.levelUp.from, to: b.levelUp.to } : a.levelUp,
    capped: a.capped || b.capped,
    duplicate: a.duplicate && b.duplicate,
  };
}
export { merge as mergeGrants };

export async function enterArea(owner: Owner, areaId: string): Promise<ActionOutcome> {
  const [p, content] = await Promise.all([getProgress(owner), getContent()]);
  const area = content.areas.find((a) => a.areaId === areaId);
  if (!area) throw notFound('Khu vực không tồn tại');
  const lock = areaLock(area, p);
  if (!lock.unlocked) {
    throw forbidden(lock.reason ?? 'Khu vực đang bị khóa', lock.reason?.includes('tài khoản') ? 'ACCOUNT_REQUIRED' : 'AREA_LOCKED');
  }
  await addFacts(owner, [`visit:${areaId}`]);
  await PlayerProgress.updateOne({ ownerKey: owner.key }, { $set: { currentArea: areaId } });
  const g = await grant(owner, `visit:${areaId}`, { xp: 10 }, 'explore');
  const achievements = await checkAchievements(owner);
  return { grant: g, achievements };
}

export async function startQuest(owner: Owner, questId: string): Promise<ActionOutcome> {
  const [p, content] = await Promise.all([getProgress(owner), getContent()]);
  const q = content.quests.find((x) => x.questId === questId);
  if (!q) throw notFound('Nhiệm vụ không tồn tại');
  const today = todayKey();
  const view = computeQuestView(q, snapshotOf(p), today);
  if (view.status === 'locked') throw forbidden(view.lockedReason ?? 'Nhiệm vụ đang bị khóa', view.lockedReason?.includes('tài khoản') ? 'ACCOUNT_REQUIRED' : 'QUEST_LOCKED');
  if (view.status === 'claimed') throw conflict('Nhiệm vụ đã hoàn tất', 'ALREADY_CLAIMED');
  await PlayerProgress.updateOne({ ownerKey: owner.key }, { $addToSet: { startedQuests: claimKeyOf(q, today) } });
  return { achievements: [] };
}

/** Xác minh điều kiện hoàn thành ở server (không tin client). */
export async function completeQuest(owner: Owner, questId: string): Promise<ActionOutcome & { status: string }> {
  const [p, content] = await Promise.all([getProgress(owner), getContent()]);
  const q = content.quests.find((x) => x.questId === questId);
  if (!q) throw notFound('Nhiệm vụ không tồn tại');
  const view = computeQuestView(q, snapshotOf(p), todayKey());
  if (view.status !== 'completed' && view.status !== 'claimed') {
    throw conflict('Chưa đủ điều kiện hoàn thành nhiệm vụ', 'NOT_COMPLETED');
  }
  return { status: view.status, achievements: await checkAchievements(owner) };
}

export async function claimQuest(owner: Owner, questId: string): Promise<ActionOutcome> {
  const [p, content] = await Promise.all([getProgress(owner), getContent()]);
  const q = content.quests.find((x) => x.questId === questId);
  if (!q) throw notFound('Nhiệm vụ không tồn tại');
  const today = todayKey();
  const view = computeQuestView(q, snapshotOf(p), today);
  if (view.status === 'claimed') throw conflict('Phần thưởng đã được nhận', 'ALREADY_CLAIMED');
  if (view.status !== 'completed') throw conflict('Nhiệm vụ chưa hoàn thành', 'NOT_COMPLETED');

  const key = claimKeyOf(q, today);
  // 1) Thưởng ghi qua sổ cái idempotent (unique ownerKey+sourceKey): dù gọi lặp/song song vẫn chỉ cộng một lần.
  //    Ghi thưởng TRƯỚC khi đánh dấu: nếu sự cố xảy ra giữa chừng, thử lại sẽ không làm mất thưởng.
  const g = await grant(owner, `quest:${key}`, q.reward, 'quest');
  // 2) Đánh dấu "đã nhận" nguyên tử: chỉ đúng một request thắng; các request còn lại nhận 409.
  const marked = await PlayerProgress.updateOne(
    { ownerKey: owner.key, claimedQuests: { $ne: key } },
    { $addToSet: { claimedQuests: key } },
  );
  if (marked.modifiedCount !== 1) throw conflict('Phần thưởng đã được nhận', 'ALREADY_CLAIMED');
  const achievements = await checkAchievements(owner);
  return { grant: g, achievements };
}

function findPoi(areas: { areaId: string; pois: PoiDef[] }[], poiId: string) {
  for (const a of areas) {
    const poi = a.pois?.find((x) => x.poiId === poiId);
    if (poi) return { area: a, poi };
  }
  return null;
}

export async function collectPoi(owner: Owner, poiId: string): Promise<ActionOutcome> {
  const [p, content] = await Promise.all([getProgress(owner), getContent()]);
  const found = findPoi(content.areas, poiId);
  if (!found) throw notFound('Điểm tương tác không tồn tại');
  const { area, poi } = found;
  const lock = areaLock(content.areas.find((a) => a.areaId === area.areaId)!, p);
  if (!lock.unlocked) throw forbidden(lock.reason ?? 'Khu vực đang bị khóa', 'AREA_LOCKED');
  if (poi.type !== 'item' && poi.type !== 'story' && poi.type !== 'sign') throw badRequest('Điểm này không thu thập được');

  const facts = [`poi:${poi.poiId}`, ...(poi.type === 'story' ? [`story:${poi.poiId}`] : [])];
  await addFacts(owner, facts);
  const g = await grant(
    owner,
    `poi:${poi.poiId}`,
    { xp: poi.xp ?? 5, items: poi.itemId ? [{ itemId: poi.itemId, qty: 1 }] : [] },
    poi.type === 'story' ? 'story' : 'collect',
  );
  const achievements = await checkAchievements(owner);
  return { grant: g, achievements, message: g.duplicate ? 'Bạn đã nhận phần thưởng này rồi' : undefined };
}

export async function recordTalk(owner: Owner, npcId: string): Promise<void> {
  await addFacts(owner, [`talk:${npcId}`]);
}

export async function useItem(owner: Owner, itemId: string): Promise<ActionOutcome> {
  const content = await getContent();
  const def = content.items.find((i) => i.itemId === itemId);
  if (!def) throw notFound('Vật phẩm không tồn tại');
  if (!def.usable) throw badRequest('Vật phẩm này không thể sử dụng');
  const res = await PlayerProgress.updateOne(
    { ownerKey: owner.key, [`inventory.${itemId}`]: { $gte: 1 } },
    { $inc: { [`inventory.${itemId}`]: -1 } },
  );
  if (res.modifiedCount !== 1) throw conflict('Bạn không có vật phẩm này', 'NO_ITEM');
  const g = await grant(owner, `use:${itemId}:${uuid()}`, { xp: def.useXp }, 'item_use');
  return { grant: g, achievements: await checkAchievements(owner), message: `Đã dùng ${def.name}` };
}

export async function setProfile(owner: Owner, patch: { avatar?: number; outfit?: number }): Promise<void> {
  const $set: Record<string, number> = {};
  if (patch.avatar !== undefined) $set['profile.avatar'] = patch.avatar;
  if (patch.outfit !== undefined) $set['profile.outfit'] = patch.outfit;
  if (Object.keys($set).length) await PlayerProgress.updateOne({ ownerKey: owner.key }, { $set });
}

export async function setPosition(owner: Owner, areaId: string | undefined, x?: number, y?: number): Promise<void> {
  const [p, content] = await Promise.all([getProgress(owner), getContent()]);
  const $set: Record<string, unknown> = {};
  if (areaId) {
    const area = content.areas.find((a) => a.areaId === areaId);
    if (!area || !areaLock(area, p).unlocked) throw forbidden('Khu vực không khả dụng', 'AREA_LOCKED');
    $set.currentArea = areaId;
  }
  if (Number.isFinite(x) && Number.isFinite(y)) $set.lastPos = { x: Math.round(x!), y: Math.round(y!) };
  if (Object.keys($set).length) await PlayerProgress.updateOne({ ownerKey: owner.key }, { $set });
}

export interface DialogueChoice {
  label: string;
  action: 'accept' | 'claim' | 'lore' | 'close';
  questId?: string;
}
export interface Dialogue {
  npcId: string; name: string; role: string; lines: string[]; choices: DialogueChoice[]; questId?: string;
}

export async function buildDialogue(owner: Owner, npcId: string, lore: boolean): Promise<Dialogue> {
  const content = await getContent();
  const npc = content.npcs.find((n) => n.npcId === npcId);
  if (!npc) throw notFound('NPC không tồn tại');
  await recordTalk(owner, npcId);
  const p = await getProgress(owner);
  const today = todayKey();
  const base = { npcId, name: npc.name, role: npc.role };

  if (lore && npc.lore.length) {
    return { ...base, lines: npc.lore, choices: [{ label: 'Cảm ơn bạn', action: 'close' }] };
  }

  const views = content.quests
    .filter((q) => q.npcId === npcId)
    .map((q) => ({ q, v: computeQuestView(q, snapshotOf(p), today) }))
    .sort((a, b) => a.q.order - b.q.order);

  const done = views.find((x) => x.v.status === 'completed');
  const doing = views.find((x) => x.v.status === 'in_progress');
  const offer = views.find((x) => x.v.status === 'available');
  const loreChoice: DialogueChoice[] = npc.lore.length ? [{ label: 'Kể thêm cho mình nghe', action: 'lore' }] : [];

  if (done) {
    return {
      ...base, questId: done.q.questId,
      lines: done.q.dialogue?.complete?.length ? done.q.dialogue.complete : [`Làm tốt lắm! Đây là phần thưởng cho "${done.q.title}".`],
      choices: [{ label: 'Nhận thưởng', action: 'claim', questId: done.q.questId }, ...loreChoice],
    };
  }
  if (doing) {
    return {
      ...base, questId: doing.q.questId,
      lines: doing.q.dialogue?.progress?.length ? doing.q.dialogue.progress : [`Cố lên, "${doing.q.title}" đang chờ bạn.`],
      choices: [{ label: 'Mình sẽ tiếp tục', action: 'close' }, ...loreChoice],
    };
  }
  if (offer) {
    return {
      ...base, questId: offer.q.questId,
      lines: offer.q.dialogue?.offer?.length ? offer.q.dialogue.offer : [`Mình có nhiệm vụ "${offer.q.title}" cho bạn.`],
      choices: [
        { label: 'Nhận nhiệm vụ', action: 'accept', questId: offer.q.questId },
        { label: 'Để sau nhé', action: 'close' },
        ...loreChoice,
      ],
    };
  }
  const idle = npc.idle.length ? npc.idle : ['Chúc bạn một ngày học tập thật vui!'];
  return { ...base, lines: idle, choices: [...loreChoice, { label: 'Tạm biệt', action: 'close' }] };
}
