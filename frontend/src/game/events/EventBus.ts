/**
 * Cầu nối sự kiện giữa React và Phaser.
 * Không import Phaser hay React ở đây để cả hai phía đều dùng được mà không kéo theo nhau vào bundle.
 */
type Handler<T> = (payload: T) => void

export interface InteractPayload {
  kind: 'npc' | 'poi'
  id: string
  poiType?: 'item' | 'story' | 'minigame' | 'gratitude' | 'wall' | 'sign'
  label?: string
  ref?: string
  itemId?: string
  text?: string
}

export type MiniMapTile = 'grass' | 'path' | 'floor' | 'water' | 'solid'

export interface MiniMapPortal {
  id: string
  to: string
  label: string
  x: number
  y: number
  w: number
  h: number
  locked?: boolean
}

export interface MiniMapNpc {
  id: string
  name: string
  x: number
  y: number
  hasQuest?: boolean
}

export interface MiniMapPoi {
  id: string
  label: string
  type: string
  x: number
  y: number
  collected?: boolean
}

export interface MiniMapData {
  areaId: string
  areaName: string
  cols: number
  rows: number
  mapPx: { w: number; h: number }
  grid: MiniMapTile[]
  portals: MiniMapPortal[]
  npcs: MiniMapNpc[]
  pois: MiniMapPoi[]
}

export interface MiniMapPos {
  x: number
  y: number
  dir: 'down' | 'left' | 'right' | 'up'
  collectedPois: string[]
}

export type AudioSfx =
  | 'xp'
  | 'levelUp'
  | 'item'
  | 'achievement'
  | 'npc'
  | 'dialogOpen'
  | 'dialogClose'
  | 'portal'
  | 'footstep'
  | 'button'
  | 'minigameCorrect'
  | 'minigameWrong'
  | 'questComplete'

export interface GameEvents {
  // Phaser → React
  'area:ready': { areaId: string }
  prompt: { text: string } | null
  interact: InteractPayload
  'portal:request': { to: string; spawn: string; label: string; resolve: (ok: boolean) => void }
  'game:error': { message: string }
  'minimap:map': MiniMapData
  'minimap:pos': MiniMapPos

  // React → Phaser
  'state:update': import('../../types/api').PlayerState
  'ui:freeze': boolean
  'touch:move': { x: number; y: number }
  'touch:run': boolean
  'touch:interact': undefined
  'player:action': 'collect' | 'celebrate' | 'interact'
  'fx:toggle': boolean

  // Shared Audio Events
  'audio:bgm': string
  'audio:playSfx': AudioSfx
  'audio:duck': boolean
}

class Bus {
  private map = new Map<string, Set<Handler<any>>>()

  on<K extends keyof GameEvents>(event: K, fn: Handler<GameEvents[K]>): () => void {
    let set = this.map.get(event)
    if (!set) this.map.set(event, (set = new Set()))
    set.add(fn)
    return () => set!.delete(fn)
  }

  emit<K extends keyof GameEvents>(event: K, payload?: GameEvents[K]): void {
    this.map.get(event)?.forEach((fn) => fn(payload))
  }

  clear(): void {
    this.map.clear()
  }
}

export const EventBus = new Bus()
