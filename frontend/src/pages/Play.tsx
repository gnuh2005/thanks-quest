import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { GameCanvas } from '../components/game/GameCanvas'
import { Hud } from '../components/game/Hud'
import { TouchControls } from '../components/game/TouchControls'
import { DialogueBox } from '../components/game/DialogueBox'
import { CharacterSelect, HelpPanel, InventoryPanel, MapPanel, PauseMenu, QuestJournal } from '../components/game/Panels'
import { ReaderPanel, SignupModal, SummaryPanel } from '../components/game/Overlays'
import { MiniGameHost } from '../components/minigames/MiniGameHost'
import { GratitudeDesk, WallOverlay } from '../components/community/Gratitude'
import { EventBus, type InteractPayload } from '../game/events/EventBus'
import type { GameInit } from '../game/createGame'
import { gameApi, guestApi, playerApi, type GuestSummary } from '../services/gameApi'
import { ApiError } from '../services/api'
import { useGame, selectBlocking } from '../stores/game'
import { useSession } from '../stores/session'
import type { DialogueChoice, NpcInfo, PlayerState } from '../types/api'

const store = () => useGame.getState()

function journeyComplete(state: PlayerState): boolean {
  const campaignQuests = state.quests.filter((q) => q.type === 'main' || q.type === 'side')
  return campaignQuests.length > 0 && campaignQuests.every((q) => q.status === 'claimed')
}

function typing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export default function Play() {
  const nav = useNavigate()
  const session = useSession()
  const g = useGame()
  const blocking = useGame(selectBlocking)
  const [init, setInit] = useState<GameInit | null>(null)
  const [picker, setPicker] = useState<{ state: PlayerState; npcs: NpcInfo[]; startArea: string } | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const [summary, setSummary] = useState<GuestSummary | null>(null)
  const [area, setArea] = useState<string | null>(null)
  const summaryShown = useRef(false)

  const guest = g.state?.kind === 'guest'

  useEffect(() => {
    EventBus.emit('audio:duck', blocking)
  }, [blocking])

  const handleError = useCallback((e: unknown) => {
    const s = store()
    if (e instanceof ApiError) {
      if (e.code === 'ACCOUNT_REQUIRED') return s.requireAccount(e.message)
      if (e.code === 'NO_SESSION' || e.code === 'GUEST_GONE') {
        s.toast({ kind: 'error', title: 'Phiên chơi đã hết hạn', text: 'Hãy bắt đầu lại hoặc đăng nhập.' })
        window.setTimeout(() => nav('/', { replace: true }), 1500)
        return
      }
      return s.toast({ kind: 'error', title: e.message })
    }
    s.toast({ kind: 'error', title: 'Đã có lỗi xảy ra. Vui lòng thử lại.' })
  }, [nav])

  // ── Khởi động: lấy trạng thái thật từ máy chủ ──
  useEffect(() => {
    let off = false
    store().reset()
    ;(async () => {
      try {
        const [{ state }, { npcs }] = await Promise.all([playerApi.state(), gameApi.npcs()])
        if (off) return
        const start = state.areas.find((a) => a.areaId === state.currentArea && a.unlocked) ? state.currentArea : 'plaza'
        store().setState(state)
        if (!state.areas.some((a) => a.visited)) setPicker({ state, npcs, startArea: start })
        else setInit({ startArea: start, npcs, state })
        const conv = sessionStorage.getItem('tq_conv')
        if (conv) {
          sessionStorage.removeItem('tq_conv')
          const c = JSON.parse(conv) as { transferredXp: number; transferredItems: number }
          store().toast({ kind: 'info', title: 'Đã lưu tiến độ chơi thử', text: `Chuyển ${c.transferredXp} điểm kinh nghiệm và ${c.transferredItems} vật phẩm vào tài khoản.` })
        }
      } catch (e) {
        if (off) return
        if (e instanceof ApiError && (e.status === 401 || e.code === 'NO_SESSION')) nav('/', { replace: true })
        else setFatal(e instanceof ApiError ? e.message : 'Không tải được trò chơi.')
      }
    })()
    return () => { off = true }
  }, [nav])

  const beginFrom = async (avatar: number, outfit: number) => {
    if (!picker) return
    try {
      await playerApi.patchProfile({ avatar, outfit })
      const res = await gameApi.enterArea(picker.startArea)
      store().commit(res)
      setInit({ startArea: picker.startArea, npcs: picker.npcs, state: res.state })
      setPicker(null)
      store().openOverlay('help')
    } catch (e) { handleError(e) }
  }

  // ── Cầu nối Phaser → React ──
  useEffect(() => {
    if (!init) return
    const off = [
      EventBus.on('prompt', (p) => store().setPrompt(p?.text ?? null)),
      EventBus.on('area:ready', ({ areaId }) => {
        setArea(areaId)
        const a = store().state?.areas.find((x) => x.areaId === areaId)
        store().setAreaName(a?.name ?? null)
        EventBus.emit('ui:freeze', selectBlocking(store()))
      }),
      EventBus.on('game:error', ({ message }) => store().toast({ kind: 'info', title: message })),
      EventBus.on('portal:request', async ({ to, resolve }) => {
        try {
          const res = await gameApi.enterArea(to)
          store().commit(res)
          resolve(true)
        } catch (e) {
          resolve(false)
          handleError(e)
        }
      }),
      EventBus.on('interact', (p) => void onInteract(p)),
    ]
    return () => off.forEach((f) => f())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init])

  const onInteract = async (p: InteractPayload) => {
    const s = store()
    try {
      if (p.kind === 'npc') {
        const r = await gameApi.talk(p.id)
        s.setDialogue(r.dialogue)
        if (r.achievements.length) {
          s.showGrant(undefined, r.achievements)
          const fresh = await playerApi.state()
          s.setState(fresh.state)
        }
        return
      }
      switch (p.poiType) {
        case 'item': {
          const r = await gameApi.collect(p.id)
          s.commit(r)
          EventBus.emit('player:action', 'collect')
          break
        }
        case 'story':
        case 'sign': {
          if (!s.state?.collectedPois.includes(p.id)) {
            const r = await gameApi.collect(p.id)
            s.commit(r)
          }
          s.setReader({ title: p.label ?? 'Thông tin', text: p.text ?? '' })
          break
        }
        case 'minigame': s.setMinigame(p.ref ?? null); break
        case 'gratitude': s.openOverlay('gratitude'); break
        case 'wall': s.openOverlay('wall'); break
      }
    } catch (e) { handleError(e) }
  }

  const openSummary = useCallback(async () => {
    summaryShown.current = true
    if (store().state?.kind === 'guest') {
      try { setSummary((await guestApi.session()).summary) } catch (e) { handleError(e); return }
    }
    store().openOverlay('summary')
  }, [handleError])

  // Also recognize progress completed before the ending screen was added.
  useEffect(() => {
    if (!g.state || !journeyComplete(g.state) || summaryShown.current) return
    void openSummary()
  }, [g.state, openSummary])

  const onChoice = useCallback(async (c: DialogueChoice) => {
    const s = store()
    const d = s.dialogue
    if (!d) return
    s.setBusy(true)
    try {
      if (c.action === 'close') s.setDialogue(null)
      else if (c.action === 'lore') s.setDialogue((await gameApi.talk(d.npcId, true)).dialogue)
      else if (c.action === 'accept' && c.questId) {
        const r = await gameApi.startQuest(c.questId)
        s.commit(r)
        const q = r.state.quests.find((x) => x.questId === c.questId)
        s.toast({ kind: 'info', title: `Nhận nhiệm vụ: ${q?.title ?? ''}`, text: 'Mở Nhật ký (J) để xem mục tiêu.' })
        s.setDialogue(null)
      } else if (c.action === 'claim' && c.questId) {
        const r = await gameApi.claimQuest(c.questId)
        s.commit(r)
        EventBus.emit('player:action', 'celebrate')
        EventBus.emit('audio:playSfx', 'questComplete')
        if (journeyComplete(r.state)) {
          s.setDialogue(null)
          void openSummary()
          return
        }
        const next = await gameApi.talk(d.npcId)
        s.setDialogue(next.dialogue.choices.some((x) => x.action === 'accept') ? next.dialogue : null)
      }
    } catch (e) { handleError(e); s.setDialogue(null) }
    finally { s.setBusy(false) }
  }, [handleError, openSummary])

  const claim = async (id: string) => {
    const s = store()
    s.setBusy(true)
    try {
      const r = await gameApi.claimQuest(id)
      s.commit(r)
      EventBus.emit('player:action', 'celebrate')
      EventBus.emit('audio:playSfx', 'questComplete')
      if (journeyComplete(r.state)) void openSummary()
    } catch (e) { handleError(e) } finally { s.setBusy(false) }
  }

  const useItem = async (id: string) => {
    const s = store()
    s.setBusy(true)
    try { s.commit(await playerApi.useItem(id)) } catch (e) { handleError(e) } finally { s.setBusy(false) }
  }

  const exitGuest = async () => {
    if (!window.confirm('Thoát chơi thử sẽ xóa tiến độ tạm thời của bạn. Bạn có chắc không?')) return
    try { await guestApi.end() } catch { /* phiên có thể đã hết hạn */ }
    store().reset()
    await session.load()
    nav('/', { replace: true })
  }

  const logout = async () => {
    await session.logout()
    store().reset()
    nav('/', { replace: true })
  }

  // ── Đóng bàn viết tri ân → hiện kết quả (một lần mỗi phiên) ──
  const prevOverlay = useRef(g.overlay)
  useEffect(() => {
    if (prevOverlay.current === 'gratitude' && g.overlay === null && g.gratitudeGenerated && !summaryShown.current) void openSummary()
    prevOverlay.current = g.overlay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.overlay])

  // ── Đóng băng thế giới khi có overlay ──
  useEffect(() => { EventBus.emit('ui:freeze', blocking) }, [blocking])

  // ── Phím tắt ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = store()
      if (!s.state || (e.ctrlKey || e.metaKey || e.altKey)) return
      if (e.key === 'Escape') {
        if (s.reader) s.setReader(null)
        else if (s.dialogue) s.setDialogue(null)
        else if (s.minigame) return
        else if (s.overlay) { if (s.overlay !== 'character') s.closeOverlay() }
        else s.openOverlay('pause')
        return
      }
      if (typing(e.target) || s.dialogue || s.minigame || s.reader) return
      const map: Record<string, 'quests' | 'inventory' | 'map' | 'help'> = { j: 'quests', i: 'inventory', m: 'map', h: 'help' }
      const o = map[e.key.toLowerCase()]
      if (!o) return
      if (s.overlay === o) s.closeOverlay()
      else if (!s.overlay || ['quests', 'inventory', 'map', 'help', 'pause'].includes(s.overlay)) s.openOverlay(o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (fatal) {
    return <div className="grid min-h-screen place-items-center bg-navy p-6 text-center text-white" role="alert"><div><p className="text-red-300">{fatal}</p><button className="mt-4 rounded-lg bg-gold px-4 py-2 font-semibold text-navy" onClick={() => location.reload()}>Tải lại</button></div></div>
  }

  const o = g.overlay
  return (
    <div className="fixed inset-0 overflow-hidden bg-navy font-sans" data-area={area ?? ''} data-testid="play-root">
      {init ? <GameCanvas init={init} /> : (
        <div className="grid h-full place-items-center text-white/70" role="status"><span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Đang vào thế giới…</span></div>
      )}
      {init && <Hud onExitGuest={exitGuest} />}
      {init && <TouchControls hidden={blocking} />}

      {picker && (
        <CharacterSelect initialAvatar={picker.state.profile.avatar} initialOutfit={picker.state.profile.outfit} onConfirm={beginFrom} />
      )}
      {g.dialogue && <DialogueBox dialogue={g.dialogue} busy={g.busy} onChoice={onChoice} onClose={() => g.setDialogue(null)} />}
      {g.reader && <ReaderPanel title={g.reader.title} text={g.reader.text} onClose={() => g.setReader(null)} />}
      {g.minigame && <MiniGameHost key={g.minigame} minigameId={g.minigame} onClose={() => g.setMinigame(null)} onRequireAccount={(r) => { g.setMinigame(null); g.requireAccount(r) }} />}

      {o === 'quests' && <QuestJournal onClaim={claim} />}
      {o === 'inventory' && <InventoryPanel onUse={useItem} />}
      {o === 'map' && <MapPanel current={area} />}
      {o === 'help' && <HelpPanel />}
      {o === 'pause' && <PauseMenu onSummary={openSummary} onExitGuest={exitGuest} onLogout={logout} onCharacter={() => g.openOverlay('character')} />}
      {o === 'summary' && <SummaryPanel summary={summary} guest={!!guest} />}
      {o === 'signup' && <SignupModal />}
      {o === 'gratitude' && <GratitudeDesk guest={!!guest} />}
      {o === 'wall' && <WallOverlay guest={!!guest} />}
      {o === 'character' && g.state && (
        <CharacterSelect initialAvatar={g.state.profile.avatar} initialOutfit={g.state.profile.outfit} onCancel={g.closeOverlay}
          onConfirm={async (a, f) => { try { const r = await playerApi.patchProfile({ avatar: a, outfit: f }); g.setState(r.state); g.closeOverlay() } catch (e) { handleError(e) } }} />
      )}
    </div>
  )
}
