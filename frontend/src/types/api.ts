export type QuestStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'claimed'
export type QuestType = 'main' | 'side' | 'daily' | 'achievement' | 'event'

export interface ObjectiveView { id: string; label: string; current: number; target: number; done: boolean }
export interface QuestReward { xp: number; items?: { itemId: string; qty: number }[] }
export interface QuestView {
  questId: string; type: QuestType; title: string; description: string; npcId: string; areaId: string; order: number
  status: QuestStatus; lockedReason?: string; objectives: ObjectiveView[]; reward: QuestReward
}
export interface LevelInfo { level: number; xp: number; currentLevelXp: number; nextLevelXp: number; progress: number; maxed: boolean }
export interface InventoryItem { itemId: string; qty: number; name: string; category: string; description: string; icon: string; usable: boolean }
export interface AchievementView { achId: string; name: string; description: string; icon: string; rewardXp: number; unlocked: boolean; at?: string }
export interface AreaView { areaId: string; name: string; description: string; unlocked: boolean; reason?: string; visited: boolean }

export interface PlayerState {
  kind: 'user' | 'guest'
  displayName: string
  profile: { avatar: number; outfit: number }
  level: LevelInfo
  currentArea: string
  areas: AreaView[]
  quests: QuestView[]
  inventory: InventoryItem[]
  achievements: AchievementView[]
  collectedPois: string[]
  passedMinigames: string[]
  stats: { questsClaimed: number; minigamesPassed: number; itemsCollected: number; xp: number }
  guest?: { expiresAt?: string; xpCap: number }
}

export interface GrantResult { xp: number; items: { itemId: string; qty: number }[]; levelUp?: { from: number; to: number }; capped?: boolean; duplicate: boolean }
export interface EarnedAchievement { achId: string; name: string; description: string; icon: string; rewardXp: number }
export interface Outcome {
  grant?: GrantResult
  achievements?: EarnedAchievement[]
  message?: string
  result?: Record<string, any>
  passed?: boolean
  generated?: GratitudeGenerated
  conversion?: { transferredXp: number; transferredItems: number; skippedDuplicates: number }
  note?: string
  message_?: unknown
}
export interface Acted { outcome: Outcome; state: PlayerState }

export interface DialogueChoice { label: string; action: 'accept' | 'claim' | 'lore' | 'close'; questId?: string }
export interface Dialogue { npcId: string; name: string; role: string; lines: string[]; choices: DialogueChoice[]; questId?: string }

export interface NpcInfo { npcId: string; name: string; areaId: string; role: string; description: string; sprite: number }

export interface MiniGameInfo {
  minigameId: string; type: 'quiz' | 'memory' | 'debug' | 'treasure'; name: string; description: string; instructions: string[]; areaId: string
  config: Record<string, number | undefined>
  reward?: { first?: number; repeat?: number; perfect?: number }
}

export interface GratitudeGenerated {
  title: string; titleSuggestions: string[]
  versions: { short: string; formal: string; emotional: string }
  source: 'gemini' | 'groq' | 'template'; degraded: boolean
}
export interface GratitudeItem {
  id: string; title: string; body: string; recipient: string; style: 'classic' | 'sunrise' | 'night' | 'garden'
  authorName: string; createdAt: string; aiAssisted: boolean; status?: 'pending' | 'approved' | 'rejected'; moderationReason?: string
}

export interface LeaderRow {
  rank: number; userId: string; displayName: string; level: number; xp: number; questsClaimed: number; minigamesPassed: number; xpGained?: number
}
export interface LeaderPage { rows: LeaderRow[]; total: number; page: number; limit: number; period: 'all' | 'daily' | 'weekly'; me?: { rank: number; xp: number } | null }

export interface SessionUser { id: string; email: string; displayName: string; role: 'student' | 'admin' }
