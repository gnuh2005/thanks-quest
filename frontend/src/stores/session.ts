import { create } from 'zustand'
import { authApi } from '../services/gameApi'
import type { SessionUser } from '../types/api'

type Role = 'none' | 'guest' | 'student' | 'admin'

interface SessionStore {
  status: 'loading' | 'ready'
  role: Role
  user: SessionUser | null
  load: () => Promise<void>
  setUser: (u: SessionUser) => void
  logout: () => Promise<void>
}

export const useSession = create<SessionStore>((set) => ({
  status: 'loading',
  role: 'none',
  user: null,
  load: async () => {
    try {
      const me = await authApi.me()
      if (me.role === 'guest') set({ status: 'ready', role: 'guest', user: null })
      else set({ status: 'ready', role: me.role, user: me.user ?? null })
    } catch {
      set({ status: 'ready', role: 'none', user: null })
    }
  },
  setUser: (user) => set({ status: 'ready', role: user.role, user }),
  logout: async () => {
    try {
      await authApi.logout()
    } finally {
      set({ role: 'none', user: null })
    }
  },
}))
