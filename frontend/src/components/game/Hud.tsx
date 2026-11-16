import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Award, Backpack, Clock, Home, LogOut, Map as MapIcon, Menu, Save, ScrollText, Sparkles, Trophy, UserPlus, Volume2, VolumeX, X } from 'lucide-react'
import { useGame } from '../../stores/game'
import { Bar } from '../ui/Modal'
import { previewDataUrl } from '../../game/systems/textures'
import { useIsTouch } from './TouchControls'
import { Minimap } from './Minimap'
import { AudioManager } from '../../game/audio/AudioManager'
import type { QuestView } from '../../types/api'
import { vi } from '../../i18n'

function useRemaining(expiresAt?: string): string | null {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - now
  if (ms <= 0) return 'Đã hết hạn'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`
}

function Tracker({ quests }: { quests: QuestView[] }) {
  const q = quests.find((x) => x.status === 'completed') ?? quests.find((x) => x.status === 'in_progress' && x.type === 'main') ?? quests.find((x) => x.status === 'in_progress')
  if (!q) return null
  return (
    <div className="hidden w-64 rounded-xl border border-white/15 bg-navy/75 p-3 text-white backdrop-blur md:block" data-testid="tracker">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan">{q.status === 'completed' ? 'Sẵn sàng nhận thưởng' : 'Nhiệm vụ hiện tại'}</p>
      <p className="mt-0.5 text-sm font-bold">{vi(q.title)}</p>
      <ul className="mt-1.5 space-y-1">
        {q.objectives.map((o) => (
          <li key={o.id} className={`flex items-start gap-1.5 text-xs ${o.done ? 'text-white/45 line-through' : 'text-white/85'}`}>
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${o.done ? 'bg-cyan' : 'bg-gold'}`} />
            <span>{vi(o.label)}{o.target > 1 ? ` (${o.current}/${o.target})` : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Hud({ onExitGuest }: { onExitGuest: () => void }) {
  const { state, prompt, openOverlay, closeOverlay, toasts, dismissToast, areaName, requireAccount } = useGame()
  const navigate = useNavigate()
  const touch = useIsTouch()
  const remaining = useRemaining(state?.guest?.expiresAt)
  const [gOpen, setGOpen] = useState(() => !(typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches))
  const [audioMuted, setAudioMuted] = useState(() => AudioManager.getSettings().bgmMuted)

  if (!state) return null
  const guest = state.kind === 'guest'
  const lv = state.level
  const avatar = previewDataUrl(state.profile.avatar, state.profile.outfit)
  const readyCount = state.quests.filter((q) => q.status === 'completed').length

  const iconBtn = 'relative grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-navy/75 text-white backdrop-blur transition hover:bg-navy'
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2.5 sm:p-4">
        <div className="pointer-events-auto flex max-w-[62vw] flex-col gap-2 sm:max-w-xs">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/15 bg-navy/80 p-2 pr-3 text-white backdrop-blur" data-testid="hud-card">
            <img src={avatar} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg bg-purple object-contain" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-bold">{state.displayName}</p>
                <span className="shrink-0 rounded bg-gold px-1.5 py-0.5 text-[11px] font-extrabold text-navy" data-testid="level">Cấp {lv.level}</span>
              </div>
              <Bar value={lv.currentLevelXp} max={lv.maxed ? 1 : lv.nextLevelXp} color="bg-cyan" className="mt-1" />
              <p className="mt-0.5 text-[11px] text-white/60" data-testid="xp-text">
                {lv.maxed ? `${lv.xp} điểm kinh nghiệm · Cấp tối đa` : `${lv.currentLevelXp}/${lv.nextLevelXp} điểm kinh nghiệm`}
                {guest && <span className="ml-1 text-gold">· tạm thời</span>}
              </p>
            </div>
          </div>
          {guest && (
            <div className="rounded-xl border border-gold/40 bg-navy/80 p-2 text-white backdrop-blur" data-testid="guest-panel">
              <button onClick={() => setGOpen(!gOpen)} aria-expanded={gOpen} className="flex w-full items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-gold">
                <Sparkles size={13} aria-hidden /> Đang chơi thử <span className="ml-auto text-white/50">{gOpen ? '▴' : '▾'}</span>
              </button>
              {gOpen && remaining && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/60"><Clock size={11} aria-hidden /> Phiên còn {remaining}</p>}
              {gOpen && <div className="mt-2 flex flex-wrap gap-1.5">
                <button onClick={() => requireAccount('Đăng ký để lưu tiến độ và nhận điểm kinh nghiệm vĩnh viễn.')} className="inline-flex items-center gap-1 rounded-md bg-gold px-2 py-1 text-[11px] font-bold text-navy">
                  <Save size={12} aria-hidden /> Lưu tiến độ
                </button>
                <button onClick={() => requireAccount('Tạo tài khoản để tham gia bảng xếp hạng và đăng lời tri ân.')} className="inline-flex items-center gap-1 rounded-md border border-white/25 px-2 py-1 text-[11px] font-semibold">
                  <UserPlus size={12} aria-hidden /> Đăng ký tài khoản
                </button>
                <button onClick={onExitGuest} className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/70">
                  <LogOut size={12} aria-hidden /> Thoát
                </button>
              </div>}
            </div>
          )}

          {/* Mini Map góc trái hiển thị dưới thẻ người chơi */}
          <Minimap />
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex gap-1.5">
            <button
              className={iconBtn}
              aria-label={audioMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              title={audioMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              onClick={() => {
                const next = AudioManager.toggleBgmMute()
                setAudioMuted(next)
              }}
              data-testid="btn-audio-mute"
            >
              {audioMuted ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </button>
            <button className={iconBtn} aria-label="Nhật ký nhiệm vụ (J)" title="Nhật ký nhiệm vụ (J)" onClick={() => openOverlay('quests')} data-testid="btn-quests">
              <ScrollText size={19} />
              {readyCount > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-extrabold text-navy">{readyCount}</span>}
            </button>
            <button className={iconBtn} aria-label="Túi đồ (I)" title="Túi đồ (I)" onClick={() => openOverlay('inventory')} data-testid="btn-inventory"><Backpack size={19} /></button>
            <button className={iconBtn} aria-label="Bản đồ (M)" title="Bản đồ (M)" onClick={() => openOverlay('map')} data-testid="btn-map"><MapIcon size={19} /></button>
            <button className={iconBtn} aria-label="Về trang chủ để xem bảng xếp hạng và tường tri ân" title="Về trang chủ" onClick={() => { closeOverlay(); navigate('/') }} data-testid="btn-home"><Home size={19} /></button>
            <button className={iconBtn} aria-label="Bảng chọn (Esc)" title="Bảng chọn (Esc)" onClick={() => openOverlay('pause')} data-testid="btn-menu"><Menu size={19} /></button>
          </div>
          <Tracker quests={state.quests} />
        </div>
      </div>

      {areaName && (
        <div key={areaName} className="pointer-events-none absolute inset-x-0 top-24 z-30 flex justify-center">
          <p className="animate-[fadeout_3s_ease-out_forwards] rounded-full border border-gold/50 bg-navy/80 px-5 py-1.5 text-sm font-bold tracking-wide text-gold backdrop-blur" data-testid="area-banner">{vi(areaName)}</p>
        </div>
      )}

      {prompt && (
        <div className={`pointer-events-none absolute inset-x-0 z-30 flex justify-center ${touch ? 'bottom-44' : 'bottom-8'}`}>
          <p className="rounded-xl border border-white/20 bg-navy/85 px-4 py-2 text-sm font-semibold text-white backdrop-blur" data-testid="prompt">
            <kbd className="mr-2 rounded bg-gold px-1.5 py-0.5 text-xs font-extrabold text-navy">{touch ? '✋' : 'E'}</kbd>
            {vi(prompt)}
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-16 z-[60] flex flex-col items-center gap-2 px-3" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl border px-4 py-2.5 text-white shadow-xl backdrop-blur animate-[slidein_.25s_ease-out] ${
              t.kind === 'error' ? 'border-red-400/60 bg-red-950/90' : t.kind === 'achievement' ? 'border-gold bg-purple/95' : t.kind === 'level' ? 'border-cyan bg-navy/95' : 'border-white/20 bg-navy/92'
            }`}
          >
            {t.kind === 'achievement' && <Award className="mt-0.5 shrink-0 text-gold" size={18} />}
            {t.kind === 'level' && <Trophy className="mt-0.5 shrink-0 text-cyan" size={18} />}
            <div>
              <p className={`text-sm font-bold ${t.kind === 'xp' ? 'text-cyan' : t.kind === 'item' ? 'text-gold' : ''}`}>{vi(t.title)}</p>
              {t.text && <p className="text-xs text-white/70">{vi(t.text)}</p>}
            </div>
            <button onClick={() => dismissToast(t.id)} aria-label="Ẩn thông báo" className="ml-1 text-white/40 hover:text-white"><X size={14} /></button>
          </div>
        ))}
      </div>
    </>
  )
}
