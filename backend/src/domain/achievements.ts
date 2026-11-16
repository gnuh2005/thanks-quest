import { levelFromXp } from './progression.js';

export type AchievementCondition =
  | { kind: 'fact'; value: string }
  | { kind: 'claimed_count'; value: number }
  | { kind: 'passed_count'; value: number }
  | { kind: 'level'; value: number }
  | { kind: 'items_total'; value: number };

export interface AchievementDef {
  achId: string;
  condition: AchievementCondition;
}

export interface AchievementSnapshot {
  xp: number;
  facts: string[];
  claimedQuests: string[];
  passedMinigames: string[];
  collected: Record<string, number>;
}

export function isSatisfied(c: AchievementCondition, s: AchievementSnapshot): boolean {
  switch (c.kind) {
    case 'fact':
      return s.facts.includes(c.value);
    case 'claimed_count':
      return new Set(s.claimedQuests.filter((q) => !q.includes('@'))).size >= c.value;
    case 'passed_count':
      return new Set(s.passedMinigames).size >= c.value;
    case 'level':
      return levelFromXp(s.xp) >= c.value;
    case 'items_total':
      return Object.values(s.collected).reduce((a, b) => a + (Number(b) || 0), 0) >= c.value;
    default:
      return false;
  }
}

/** Trả về các thành tựu đã đủ điều kiện nhưng chưa được ghi nhận. */
export function newlyEarned(defs: AchievementDef[], s: AchievementSnapshot, already: string[]): string[] {
  const have = new Set(already);
  return defs.filter((d) => !have.has(d.achId) && isSatisfied(d.condition, s)).map((d) => d.achId);
}
