import { create } from 'zustand'
import { EventBus } from '../game/events/EventBus'
import type { Acted, Dialogue, EarnedAchievement, GrantResult, PlayerState } from '../types/api'

export type OverlayKind =
  | 'quests' | 'inventory' | 'map' | 'pause' | 'summary' | 'signup' | 'character' | 'wall' | 'gratitude' | 'help'

export interface Toast {
  id: number
  kind: 'xp' | 'item' | 'level' | 'achievement' | 'info' | 'error'
  title: string
  text?: string
}

export interface Reader { title: string; text: string }
export interface SignupReason { reason: string }

interface GameStore {
  state: PlayerState | null
  overlay: OverlayKind | null
  signupReason: string | null
  dialogue: Dialogue | null
  reader: Reader | null
  minigame: string | null
  prompt: string | null
  areaName: string | null
  toasts: Toast[]
  busy: boolean
  gratitudeGenerated: boolean

  setState: (s: PlayerState) => void
  openOverlay: (o: OverlayKind) => void
  closeOverlay: () => void
  requireAccount: (reason: string) => void
  setDialogue: (d: Dialogue | null) => void
  setReader: (r: Reader | null) => void
  setMinigame: (id: string | null) => void
  setPrompt: (p: string | null) => void
  setAreaName: (n: string | null) => void
  setBusy: (b: boolean) => void
  setGratitudeGenerated: (b: boolean) => void
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
  /** Áp dụng kết quả từ server: cập nhật trạng thái và hiện thông báo cho mọi phần thưởng. */
  commit: (res: Acted | { state: PlayerState; outcome?: Acted['outcome'] }, extraAch?: EarnedAchievement[]) => void
  showGrant: (g?: GrantResult, ach?: EarnedAchievement[]) => void
  reset: () => void
}

let nextId = 1

export const useGame = create<GameStore>((set, get) => ({
  state: null,
  overlay: null,
  signupReason: null,
  dialogue: null,
  reader: null,
  minigame: null,
  prompt: null,
  areaName: null,
  toasts: [],
  busy: false,
  gratitudeGenerated: false,

  setState: (s) => {
    set({ state: s })
    EventBus.emit('state:update', s)
  },
  openOverlay: (overlay) => set({ overlay }),
  closeOverlay: () => set({ overlay: null, signupReason: null }),
  requireAccount: (reason) => set({ overlay: 'signup', signupReason: reason }),
  setDialogue: (dialogue) => set({ dialogue }),
  setReader: (reader) => set({ reader }),
  setMinigame: (minigame) => set({ minigame }),
  setPrompt: (prompt) => set({ prompt }),
  setAreaName: (areaName) => set({ areaName }),
  setBusy: (busy) => set({ busy }),
  setGratitudeGenerated: (gratitudeGenerated) => set({ gratitudeGenerated }),

  toast: (t) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts.slice(-4), { ...t, id }] }))
    setTimeout(() => get().dismissToast(id), t.kind === 'error' ? 5000 : 3600)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  showGrant: (g, ach) => {
    const { toast } = get()
    if (g?.xp) {
      toast({ kind: 'xp', title: `+${g.xp} điểm kinh nghiệm`, text: g.capped ? 'Đã chạm giới hạn điểm kinh nghiệm của chế độ chơi thử — hãy đăng ký để tiếp tục tích lũy.' : undefined })
      EventBus.emit('audio:playSfx', 'xp')
    }
    else if (g?.capped) toast({ kind: 'info', title: 'Đã đạt giới hạn điểm kinh nghiệm chơi thử', text: 'Đăng ký tài khoản để tiếp tục tích lũy.' })
    for (const it of g?.items ?? []) {
      toast({ kind: 'item', title: `Nhận vật phẩm ×${it.qty}`, text: it.itemId.replace(/_/g, ' ') })
      EventBus.emit('audio:playSfx', 'item')
    }
    if (g?.levelUp) {
      toast({ kind: 'level', title: `Lên cấp ${g.levelUp.to}!`, text: 'Bạn mạnh mẽ hơn rồi.' })
      EventBus.emit('audio:playSfx', 'levelUp')
    }
    for (const a of ach ?? []) {
      toast({ kind: 'achievement', title: `Thành tựu: ${a.name}`, text: a.description })
      EventBus.emit('audio:playSfx', 'achievement')
    }
  },

  commit: (res, extraAch) => {
    const outcome = res.outcome
    get().setState(res.state)
    get().showGrant(outcome?.grant, [...(outcome?.achievements ?? []), ...(extraAch ?? [])])
  },

  reset: () =>
    set({ state: null, overlay: null, signupReason: null, dialogue: null, reader: null, minigame: null, prompt: null, areaName: null, toasts: [], busy: false, gratitudeGenerated: false }),
}))

/** Có overlay nào đang chặn điều khiển thế giới không? */
export const selectBlocking = (s: GameStore): boolean =>
  !!(s.overlay || s.dialogue || s.reader || s.minigame)
