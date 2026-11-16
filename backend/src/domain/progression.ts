export const MAX_LEVEL = 30;

/** Tổng XP tối thiểu để đạt `level` (Level 1 = 0, 2 = 100, 3 = 300, 4 = 600, 5 = 1000, ...). */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return 50 * l * (l - 1);
}

export function levelFromXp(xp: number): number {
  const safe = Math.max(0, Math.floor(xp));
  let level = 1;
  while (level < MAX_LEVEL && safe >= xpForLevel(level + 1)) level++;
  return level;
}

export interface LevelInfo {
  level: number;
  xp: number;
  currentLevelXp: number; // XP đã tích lũy trong cấp hiện tại
  nextLevelXp: number; // XP cần để lên cấp kế tiếp (độ dài cấp hiện tại)
  progress: number; // 0..1
  maxed: boolean;
}

export function levelInfo(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  const level = levelFromXp(safe);
  const base = xpForLevel(level);
  if (level >= MAX_LEVEL) {
    return { level, xp: safe, currentLevelXp: safe - base, nextLevelXp: 0, progress: 1, maxed: true };
  }
  const span = xpForLevel(level + 1) - base;
  return { level, xp: safe, currentLevelXp: safe - base, nextLevelXp: span, progress: (safe - base) / span, maxed: false };
}
