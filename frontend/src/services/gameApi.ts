import { api, patch, post, del } from './api'
import type {
  Acted, Dialogue, EarnedAchievement, GratitudeGenerated, GratitudeItem, LeaderPage, MiniGameInfo, NpcInfo, PlayerState, SessionUser,
} from '../types/api'

const q = (o: Record<string, string | number | undefined>) => {
  const s = Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
  return s ? `?${s}` : ''
}

export const authApi = {
  me: () => api<{ user?: SessionUser; role: 'guest' | 'student' | 'admin'; guestId?: string }>('/auth/me'),
  register: (b: { email: string; password: string; displayName: string }) => post<{ user: SessionUser }>('/auth/register', b),
  login: (b: { email: string; password: string }) => post<{ user: SessionUser }>('/auth/login', b),
  logout: () => post<{ ok: true }>('/auth/logout'),
}

export const guestApi = {
  start: () => post<{ guest: { guestId: string; expiresAt: string; resumed: boolean }; state: PlayerState }>('/guest/start'),
  session: () => api<{ guest: { guestId: string; expiresAt: string }; summary: GuestSummary; state: PlayerState }>('/guest/session'),
  end: () => post<{ ended: boolean }>('/guest/end'),
  convert: () => post<Acted>('/guest/convert'),
}
export interface GuestSummary { xp: number; questsClaimed: number; minigamesPassed: number; items: number; achievements: number; expiresAt?: string }

export const playerApi = {
  state: () => api<{ state: PlayerState }>('/player/state'),
  patchProfile: (b: { avatar?: number; outfit?: number }) => patch<{ state: PlayerState }>('/player/profile', b),
  useItem: (itemId: string) => post<Acted>('/player/inventory/use', { itemId }),
}

export const gameApi = {
  npcs: () => api<{ npcs: NpcInfo[] }>('/game/npcs'),
  enterArea: (areaId: string) => post<Acted>(`/game/areas/${areaId}/enter`),
  talk: (npcId: string, lore = false) => post<{ dialogue: Dialogue; achievements: EarnedAchievement[] }>(`/game/npcs/${npcId}/talk`, { lore }),
  collect: (poiId: string) => post<Acted>(`/game/pois/${poiId}/collect`),
  startQuest: (id: string) => post<Acted>(`/game/quests/${id}/start`),
  claimQuest: (id: string) => post<Acted>(`/game/quests/${id}/claim`),
}

export const miniApi = {
  get: (id: string) => api<{ minigame: MiniGameInfo }>(`/minigames/${id}`),
  start: (id: string) => post<{ attempt: Record<string, any> }>(`/minigames/${id}/start`),
  dig: (id: string, attemptId: string, x: number, y: number) =>
    post<{ dig: { heat: 'found' | 'hot' | 'warm' | 'cold'; foundCount: number; digsLeft: number; finished: boolean } }>(`/minigames/${id}/dig`, { attemptId, x, y }),
  submit: (id: string, attemptId: string, answer: unknown) => post<Acted>(`/minigames/${id}/submit`, { attemptId, answer }),
}

export const gratitudeApi = {
  generate: (b: { recipient?: string; memory?: string; learned?: string; thanks?: string; message?: string }) =>
    post<Acted & { outcome: { generated: GratitudeGenerated } }>('/gratitude/generate', b),
  create: (b: { title: string; body: string; recipient?: string; style: string; aiAssisted: boolean; confirmPublic: true }) =>
    post<Acted>('/gratitude', b),
  list: (page = 1, limit = 12) => api<{ items: GratitudeItem[]; total: number; page: number; limit: number }>(`/gratitude${q({ page, limit })}`),
  mine: (page = 1) => api<{ items: GratitudeItem[]; total: number }>(`/gratitude${q({ mine: 'true', page })}`),
  remove: (id: string) => del<{ deleted: boolean }>(`/gratitude/${id}`),
  report: (id: string, reason: string) => post<{ reported: boolean }>(`/gratitude/${id}/report`, { reason }),
}

export const boardApi = {
  get: (period: 'all' | 'daily' | 'weekly', page = 1, limit = 20) =>
    api<LeaderPage>(`/leaderboard${period === 'all' ? '' : '/' + period}${q({ page, limit })}`),
}
