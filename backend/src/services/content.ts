import { Achievement, GameArea, Item, MiniGame, Npc, Quest } from '../models/content.js';
import type { QuestDef } from '../domain/quests.js';
import type { AchievementCondition } from '../domain/achievements.js';

export interface AreaDef {
  areaId: string;
  name: string;
  description: string;
  order: number;
  theme: string;
  mapAsset: string;
  width?: number;
  height?: number;
  unlock: { minLevel?: number; claimedQuests?: string[]; accountOnly?: boolean };
  pois: PoiDef[];
}
export interface PoiDef {
  poiId: string;
  type: 'item' | 'story' | 'minigame' | 'gratitude' | 'wall' | 'sign';
  ref?: string;
  x: number;
  y: number;
  label: string;
  text?: string;
  itemId?: string;
  xp?: number;
}
export interface NpcDef {
  npcId: string; name: string; areaId: string; role: string; description: string;
  sprite: number; x?: number; y?: number; idle: string[]; lore: string[];
}
export interface ItemDef {
  itemId: string; name: string; category: string; description: string; icon: string; usable: boolean; useXp: number;
}
export interface AchDef {
  achId: string; name: string; description: string; icon: string; condition: AchievementCondition; rewardXp: number;
}
export interface MiniGameDef {
  minigameId: string; type: 'quiz' | 'memory' | 'debug' | 'treasure'; name: string; description: string;
  instructions: string[]; areaId: string; config: Record<string, any>;
}

export interface Content {
  areas: AreaDef[];
  npcs: NpcDef[];
  quests: QuestDef[];
  items: ItemDef[];
  achievements: AchDef[];
  minigames: MiniGameDef[];
}

let cache: Content | null = null;
let loadedAt = 0;
const TTL_MS = 30_000;

export async function getContent(): Promise<Content> {
  if (cache && Date.now() - loadedAt < TTL_MS) return cache;
  const [areas, npcs, quests, items, achievements, minigames] = await Promise.all([
    GameArea.find({ active: true }).sort({ order: 1 }).lean(),
    Npc.find({ active: true }).lean(),
    Quest.find({ active: true }).lean(),
    Item.find({ active: true }).lean(),
    Achievement.find({ active: true }).lean(),
    MiniGame.find({ active: true }).lean(),
  ]);
  cache = {
    areas: areas as unknown as AreaDef[],
    npcs: npcs as unknown as NpcDef[],
    quests: quests as unknown as QuestDef[],
    items: items as unknown as ItemDef[],
    achievements: achievements as unknown as AchDef[],
    minigames: minigames as unknown as MiniGameDef[],
  };
  loadedAt = Date.now();
  return cache;
}

/** Gọi sau mỗi lần admin sửa nội dung. */
export function invalidateContent(): void {
  cache = null;
}
