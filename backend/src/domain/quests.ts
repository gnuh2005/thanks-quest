import { levelFromXp } from './progression.js';

export type ObjectiveKind =
  | 'talk' // đã trò chuyện với NPC (ref = npcId)
  | 'visit' // đã vào khu vực (ref = areaId)
  | 'minigame' // đã vượt mini game (ref = minigameId)
  | 'collect' // đã thu thập tổng cộng >= count vật phẩm (ref = itemId)
  | 'poi' // đã tương tác điểm POI (ref = poiId)
  | 'story_count' // đã đọc >= count câu chuyện
  | 'gratitude_preview'
  | 'gratitude_post'
  | 'level'
  | 'claimed_count' // đã nhận thưởng >= count nhiệm vụ (không tính nhiệm vụ lặp ngày)
  | 'minigames_passed'
  | 'talk_count';

export interface Objective {
  id: string;
  kind: ObjectiveKind;
  ref?: string;
  count?: number;
  label: string;
}

export interface QuestDef {
  questId: string;
  type: 'main' | 'side' | 'daily' | 'achievement' | 'event';
  title: string;
  description: string;
  npcId: string;
  areaId: string;
  order: number;
  requires?: { quests?: string[]; level?: number; account?: boolean };
  objectives: Objective[];
  reward: { xp: number; items?: { itemId: string; qty: number }[] };
  dialogue?: { offer?: string[]; progress?: string[]; complete?: string[] };
}

export interface ProgressSnapshot {
  kind: 'user' | 'guest';
  xp: number;
  facts: string[];
  startedQuests: string[];
  claimedQuests: string[];
  collected: Record<string, number>;
}

export type QuestStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'claimed';

export interface ObjectiveView {
  id: string;
  label: string;
  current: number;
  target: number;
  done: boolean;
}

export interface QuestView {
  questId: string;
  type: QuestDef['type'];
  title: string;
  description: string;
  npcId: string;
  areaId: string;
  order: number;
  status: QuestStatus;
  lockedReason?: string;
  objectives: ObjectiveView[];
  reward: QuestDef['reward'];
}

/** Các loại mục tiêu có ngưỡng `count`; các loại còn lại là có/không. */
const COUNTED = new Set<ObjectiveKind>([
  'collect',
  'story_count',
  'level',
  'claimed_count',
  'minigames_passed',
  'talk_count',
]);

export const claimKeyOf =(q: Pick<QuestDef, 'questId' | 'type'>, today: string): string =>
  q.type === 'daily' ? `${q.questId}@${today}` : q.questId;

export function evaluateObjective(
  obj: Objective,
  p: ProgressSnapshot,
  isDaily: boolean,
  today: string,
): ObjectiveView {
  const facts = new Set(p.facts);
  const target = obj.count ?? 1;
  let current = 0;
  switch (obj.kind) {
    case 'talk':
      current = facts.has(`talk:${obj.ref}`) ? 1 : 0;
      break;
    case 'visit':
      current = facts.has(`visit:${obj.ref}`) ? 1 : 0;
      break;
    case 'minigame':
      current = facts.has(isDaily ? `mg:${obj.ref}:passed:${today}` : `mg:${obj.ref}:passed`) ? 1 : 0;
      break;
    case 'poi':
      current = facts.has(`poi:${obj.ref}`) ? 1 : 0;
      break;
    case 'collect':
      current = Math.min(target, Math.floor(p.collected[obj.ref ?? ''] ?? 0));
      break;
    case 'story_count':
      current = Math.min(target, p.facts.filter((f) => f.startsWith('story:')).length);
      break;
    case 'gratitude_preview':
      current = facts.has('gratitude:preview') ? 1 : 0;
      break;
    case 'gratitude_post':
      current = facts.has('gratitude:posted') ? 1 : 0;
      break;
    case 'level':
      current = Math.min(target, levelFromXp(p.xp));
      break;
    case 'claimed_count':
      current = Math.min(target, new Set(p.claimedQuests.filter((c) => !c.includes('@'))).size);
      break;
    case 'minigames_passed':
      current = Math.min(
        target,
        p.facts.filter((f) => /^mg:[a-z0-9_]+:passed$/.test(f)).length,
      );
      break;
    case 'talk_count':
      current = Math.min(target, p.facts.filter((f) => f.startsWith('talk:')).length);
      break;
  }
  const effectiveTarget = COUNTED.has(obj.kind) ? target : 1;
  return { id: obj.id, label: obj.label, current, target: effectiveTarget, done: current >= effectiveTarget };
}

export function computeQuestView(q: QuestDef, p: ProgressSnapshot, today: string): QuestView {
  const isDaily = q.type === 'daily';
  const key = claimKeyOf(q, today);
  const claimed = new Set(p.claimedQuests);
  const objectives = q.objectives.map((o) => evaluateObjective(o, p, isDaily, today));
  const base = {
    questId: q.questId,
    type: q.type,
    title: q.title,
    description: q.description,
    npcId: q.npcId,
    areaId: q.areaId,
    order: q.order,
    objectives,
    reward: q.reward,
  };

  if (claimed.has(key)) return { ...base, status: 'claimed' };

  const req = q.requires ?? {};
  if (req.account && p.kind === 'guest') {
    return { ...base, status: 'locked', lockedReason: 'Cần tài khoản để mở nhiệm vụ này' };
  }
  const missing = (req.quests ?? []).filter((id) => !claimed.has(id));
  if (missing.length) {
    return { ...base, status: 'locked', lockedReason: 'Hoàn thành nhiệm vụ trước đó để mở khóa' };
  }
  if (req.level && levelFromXp(p.xp) < req.level) {
    return { ...base, status: 'locked', lockedReason: `Cần đạt cấp ${req.level}` };
  }
  if (objectives.length > 0 && objectives.every((o) => o.done)) return { ...base, status: 'completed' };
  if (isDaily || p.startedQuests.includes(key)) return { ...base, status: 'in_progress' };
  return { ...base, status: 'available' };
}

export function computeQuestViews(defs: QuestDef[], p: ProgressSnapshot, today: string): QuestView[] {
  return defs.map((d) => computeQuestView(d, p, today)).sort((a, b) => a.order - b.order);
}
