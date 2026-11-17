import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Award, Backpack, Clock, Home, LogOut, Map as MapIcon, Menu, Save, ScrollText, Sparkles, Trophy, UserPlus, Volume2, VolumeX, X } from 'lucide-react'
import { useGame } from '../../stores/game'
import { Bar } from '../ui/Modal'
import { previewDataUrl } from '../../game/systems/textures'
import { useIsTouch, useIsCompact } from './TouchControls'
import { Minimap } from './Minimap'
import { AudioManager } from '../../game/audio/AudioManager'
import type { QuestView } from '../../types/api'
import { vi } from '../../i18n'
import { useEffect } from 'react'

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

function Tracker({ quests, compact }: { quests: QuestView[]; compact: boolean }) {
  const q = quests.find((x) => x.status === 'completed') ?? quests.find((x) => x.status === 'in_progress' && x.type === 'main') ?? quests.find((x) => x.status === 'in_progress')
  if (!q) return null
  // Chế độ gọn: chỉ hiện mục tiêu chưa xong đầu tiên
  const objectives = compact ? q.objectives.filter((o) => !o.done).slice(0, 1) : q.objectives
  return (
    <div
      className={compact ? 'w-44 rounded-lg border border-white/15 bg-navy/75 p-2 text-white backdrop-blur' : 'hidden w-64 rounded-xl border border-white/15 bg-navy/75 p-3 text-white backdrop-blur md:block'}
      data-testid="tracker"
    >
      <p className={`font-semibold uppercase tracking-wider text-cyan ${compact ? 'text-[9px]' : 'text-[11px]'}`}>{q.status === 'completed' ? 'Sẵn sàng nhận thưởng' : 'Nhiệm vụ hiện tại'}</p>
      <p className={`mt-0.5 font-bold ${compact ? 'truncate text-xs' : 'text-sm'}`}>{vi(q.title)}</p>
      <ul className="mt-1 space-y-1">
        {objectives.map((o) => (
          <li key={o.id} className={`flex items-start gap-1.5 ${compact ? 'text-[10px]' : 'text-xs'} ${o.done ? 'text-white/45 line-through' : 'text-white/85'}`}>
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
  const compact = useIsCompact()
  const remaining = useRemaining(state?.guest?.expiresAt)
  // Panel khách: mặc định thu gọn trên điện thoại (cả dọc lẫn ngang)
  const [gOpen, setGOpen] = useState(
    () => !(typeof window !== 'undefined' && (window.matchMedia('(max-width: 640px)').matches || window.matchMedia('(pointer: coarse) and (max-height: 500px)').matches)),
  )
  const [audioMuted, setAudioMuted] = useState(() => AudioManager.getSettings().bgmMuted)

  if (!state) return null
  const guest = state.kind === 'guest'
  const lv = state.level
  const avatar = previewDataUrl(state.profile.avatar, state.profile.outfit)
  const readyCount = state.quests.filter((q) => q.status === 'completed').length

  const iconSize = compact ? 16 : 19
  const iconBtn = `relative grid place-items-center border border-white/15 bg-navy/75 text-white backdrop-blur transition hover:bg-navy ${
    compact ? 'h-8 w-8 rounded-lg' : 'h-8 w-8 rounded-lg sm:h-10 sm:w-10 sm:rounded-xl'
  }`

  // Chừa chỗ cho tai thỏ khi quay ngang (cần viewport-fit=cover trong index.html)
  const safeStyle = compact
    ? { paddingTop: 'max(0.375rem, env(safe-area-inset-top))', paddingLeft: 'max(0.5rem, env(safe-area-inset-left))', paddingRight: 'max(0.5rem, env(safe-area-inset-right))' }
    : undefined

  return (
    <>
      <div className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-1.5 ${compact ? 'pb-1.5' : 'p-2 sm:p-4'}`} style={safeStyle}>
        {/* ── Cột trái ── */}
        <div className={`pointer-events-auto flex flex-col gap-1.5 ${compact ? 'max-w-[38vw]' : 'max-w-[55vw] sm:max-w-xs sm:gap-2'}`}>
          <div
            className={`flex items-center rounded-xl border border-white/15 bg-navy/80 text-white backdrop-blur ${compact ? 'gap-1.5 p-1 pr-2' : 'gap-2 p-1.5 pr-2.5 sm:gap-2.5 sm:p-2 sm:pr-3'}`}
            data-testid="hud-card"
          >
            <img src={avatar} alt="" width={32} height={32} className={`shrink-0 rounded-lg bg-purple object-contain ${compact ? 'h-7 w-7' : 'h-8 w-8 sm:h-10 sm:w-10'}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <p className={`truncate font-bold ${compact ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>{state.displayName}</p>
                <span className={`shrink-0 rounded bg-gold font-extrabold text-navy ${compact ? 'px-1 text-[9px]' : 'px-1 py-0.5 text-[10px] sm:px-1.5 sm:text-[11px]'}`} data-testid="level">Cấp {lv.level}</span>
              </div>
              <Bar value={lv.currentLevelXp} max={lv.maxed ? 1 : lv.nextLevelXp} color="bg-cyan" className="mt-0.5 sm:mt-1" />
              {!compact && (
                <p className="mt-0.5 hidden text-[10px] text-white/60 sm:block sm:text-[11px]" data-testid="xp-text">
                  {lv.maxed ? `${lv.xp} điểm · Cấp tối đa` : `${lv.currentLevelXp}/${lv.nextLevelXp} điểm`}
                  {guest && <span className="ml-1 text-gold">· tạm thời</span>}
                </p>
              )}
            </div>
          </div>

          {guest && (
            <div className={`rounded-xl border border-gold/40 bg-navy/80 text-white backdrop-blur ${compact ? 'p-1.5' : 'p-2'}`} data-testid="guest-panel">
              <button onClick={() => setGOpen(!gOpen)} aria-expanded={gOpen} className={`flex w-full items-center gap-1.5 font-extrabold uppercase tracking-widest text-gold ${compact ? 'text-[9px]' : 'text-[11px]'}`}>
                <Sparkles size={compact ? 11 : 13} aria-hidden /> Đang chơi thử <span className="ml-auto text-white/50">{gOpen ? '▴' : '▾'}</span>
              </button>
              {gOpen && remaining && <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/60"><Clock size={10} aria-hidden /> Phiên còn {remaining}</p>}
              {gOpen && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <button onClick={() => requireAccount('Đăng ký để lưu tiến độ và nhận điểm kinh nghiệm vĩnh viễn.')} className="inline-flex items-center gap-1 rounded-md bg-gold px-2 py-1 text-[10px] font-bold text-navy sm:text-[11px]">
                    <Save size={11} aria-hidden /> Lưu tiến độ
                  </button>
                  <button onClick={() => requireAccount('Tạo tài khoản để tham gia bảng xếp hạng và đăng lời tri ân.')} className="inline-flex items-center gap-1 rounded-md border border-white/25 px-2 py-1 text-[10px] font-semibold sm:text-[11px]">
                    <UserPlus size={11} aria-hidden /> Đăng ký
                  </button>
                  <button onClick={onExitGuest} className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[10px] text-white/70 sm:text-[11px]">
                    <LogOut size={11} aria-hidden /> Thoát
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Minimap: chế độ gọn thì thu nhỏ (khung 96x96, scale 0.6 từ ~160px); desktop/tablet hiện đầy đủ */}
          {compact ? (
            <div className="h-24 w-24 overflow-hidden rounded-lg">
              <div className="w-[160px] origin-top-left scale-[0.6]">
                <Minimap />
              </div>
            </div>
          ) : (
            <div className="hidden sm:block">
              <Minimap />
            </div>
          )}
        </div>

        {/* ── Cột phải ── */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex gap-1.5">
            <button
              className={iconBtn}
              aria-label={audioMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              title={audioMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              onClick={() => setAudioMuted(AudioManager.toggleBgmMute())}
              data-testid="btn-audio-mute"
            >
              {audioMuted ? <VolumeX size={iconSize} /> : <Volume2 size={iconSize} />}
            </button>
            <button className={iconBtn} aria-label="Nhật ký nhiệm vụ (J)" title="Nhật ký nhiệm vụ (J)" onClick={() => openOverlay('quests')} data-testid="btn-quests">
              <ScrollText size={iconSize} />
              {readyCount > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-extrabold text-navy">{readyCount}</span>}
            </button>
            <button className={iconBtn} aria-label="Túi đồ (I)" title="Túi đồ (I)" onClick={() => openOverlay('inventory')} data-testid="btn-inventory"><Backpack size={iconSize} /></button>
            <button className={iconBtn} aria-label="Bản đồ (M)" title="Bản đồ (M)" onClick={() => openOverlay('map')} data-testid="btn-map"><MapIcon size={iconSize} /></button>
            <button className={iconBtn} aria-label="Về trang chủ để xem bảng xếp hạng và tường tri ân" title="Về trang chủ" onClick={() => { closeOverlay(); navigate('/') }} data-testid="btn-home"><Home size={iconSize} /></button>
            <button className={iconBtn} aria-label="Bảng chọn (Esc)" title="Bảng chọn (Esc)" onClick={() => openOverlay('pause')} data-testid="btn-menu"><Menu size={iconSize} /></button>
          </div>
          <Tracker quests={state.quests} compact={compact} />
        </div>
      </div>

      {areaName && (
        <div key={areaName} className={`pointer-events-none absolute inset-x-0 z-30 flex justify-center ${compact ? 'top-12' : 'top-24'}`}>
          <p className={`animate-[fadeout_3s_ease-out_forwards] rounded-full border border-gold/50 bg-navy/80 font-bold tracking-wide text-gold backdrop-blur ${compact ? 'px-3 py-1 text-xs' : 'px-5 py-1.5 text-sm'}`} data-testid="area-banner">{vi(areaName)}</p>
        </div>
      )}

      {prompt && (
        <div className={`pointer-events-none absolute inset-x-0 z-30 flex justify-center ${touch ? (compact ? 'bottom-28' : 'bottom-44') : 'bottom-8'}`}>
          <p className="rounded-xl border border-white/20 bg-navy/85 px-4 py-2 text-sm font-semibold text-white backdrop-blur" data-testid="prompt">
            <kbd className="mr-2 rounded bg-gold px-1.5 py-0.5 text-xs font-extrabold text-navy">{touch ? '✋' : 'E'}</kbd>
            {vi(prompt)}
          </p>
        </div>
      )}

      <div className={`pointer-events-none absolute inset-x-0 z-[60] flex flex-col items-center gap-2 px-3 ${compact ? 'top-12' : 'top-16'}`} aria-live="polite" role="status">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl border text-white shadow-xl backdrop-blur animate-[slidein_.25s_ease-out] ${compact ? 'px-3 py-1.5' : 'px-4 py-2.5'} ${
              t.kind === 'error' ? 'border-red-400/60 bg-red-950/90' : t.kind === 'achievement' ? 'border-gold bg-purple/95' : t.kind === 'level' ? 'border-cyan bg-navy/95' : 'border-white/20 bg-navy/90'
            }`}
          >
            {t.kind === 'achievement' && <Award className="mt-0.5 shrink-0 text-gold" size={18} />}
            {t.kind === 'level' && <Trophy className="mt-0.5 shrink-0 text-cyan" size={18} />}
            <div>
              <p className={`font-bold ${compact ? 'text-xs' : 'text-sm'} ${t.kind === 'xp' ? 'text-cyan' : t.kind === 'item' ? 'text-gold' : ''}`}>{vi(t.title)}</p>
              {t.text && <p className="text-xs text-white/70">{vi(t.text)}</p>}
            </div>
            <button onClick={() => dismissToast(t.id)} aria-label="Ẩn thông báo" className="ml-1 text-white/40 hover:text-white"><X size={14} /></button>
          </div>
        ))}
      </div>
    </>
  )
}