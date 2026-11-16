import { useMemo, useState } from 'react'
import { Award, CheckCircle2, Gift, Lock, MapPin, Play, Sparkles, UserPlus, Volume2, VolumeX } from 'lucide-react'
import { Bar, Btn, Modal } from '../ui/Modal'
import { CATEGORY_LABEL, ItemIcon, QUEST_TYPE_LABEL, STATUS_LABEL } from '../ui/icons'
import { useGame } from '../../stores/game'
import { AVATAR_DESCRIPTIONS, AVATAR_NAMES, OUTFIT_NAMES, OUTFITS, previewDataUrl } from '../../game/systems/textures'
import { AudioManager } from '../../game/audio/AudioManager'
import { EventBus } from '../../game/events/EventBus'
import type { QuestView } from '../../types/api'
import { vi } from '../../i18n'

// ───────────────────────── Nhật ký nhiệm vụ ─────────────────────────
const FILTERS = [
  ['active', 'Đang làm'], ['available', 'Có thể nhận'], ['completed', 'Chờ nhận thưởng'], ['claimed', 'Đã hoàn tất'], ['locked', 'Đang khóa'], ['all', 'Tất cả'],
] as const

function QuestCard({ q, onClaim, busy }: { q: QuestView; onClaim: (id: string) => void; busy: boolean }) {
  const done = q.objectives.filter((o) => o.done).length
  const rewardItems = q.reward.items?.map((i) => `${i.itemId.replace(/_/g, ' ')} ×${i.qty}`).join(', ')
  return (
    <li className={`rounded-xl border p-3.5 ${q.status === 'completed' ? 'border-gold/70 bg-gold/10' : 'border-white/10 bg-white/5'} ${q.status === 'locked' ? 'opacity-60' : ''}`} data-testid={`quest-${q.questId}`} data-status={q.status}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan">{QUEST_TYPE_LABEL[q.type]} · {STATUS_LABEL[q.status]}</p>
          <h3 className="mt-0.5 font-bold">{vi(q.title)}</h3>
        </div>
        {q.status === 'claimed' && <CheckCircle2 className="shrink-0 text-cyan" size={20} aria-label="Đã nhận thưởng" />}
        {q.status === 'locked' && <Lock className="shrink-0 text-white/50" size={18} aria-label="Đang khóa" />}
      </div>
      <p className="mt-1 text-sm text-white/70">{vi(q.description)}</p>
      {q.status === 'locked' ? (
        <p className="mt-2 text-xs text-gold">{vi(q.lockedReason ?? '')}</p>
      ) : (
        <>
          <ul className="mt-2 space-y-1.5">
            {q.objectives.map((o) => (
              <li key={o.id} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className={o.done ? 'text-white/45 line-through' : 'text-white/85'}>{vi(o.label)}</span>
                  <span className="shrink-0 text-white/55">{o.current}/{o.target}</span>
                </div>
                <Bar value={o.current} max={o.target} className="mt-0.5 !h-1" color={o.done ? 'bg-cyan' : 'bg-gold'} />
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs text-white/70"><Gift size={13} className="text-gold" aria-hidden /> +{q.reward.xp} điểm kinh nghiệm{rewardItems ? ` · ${vi(rewardItems)}` : ''}</p>
            {q.status === 'completed' ? (
              <Btn onClick={() => onClaim(q.questId)} disabled={busy} className="!py-1.5 !text-xs" title="Nhận thưởng"><Gift size={14} /> Nhận thưởng</Btn>
            ) : (
              q.status !== 'claimed' && <span className="text-xs text-white/50">{done}/{q.objectives.length} mục tiêu</span>
            )}
          </div>
        </>
      )}
    </li>
  )
}

export function QuestJournal({ onClaim }: { onClaim: (id: string) => void }) {
  const { state, closeOverlay, busy } = useGame()
  const [tab, setTab] = useState<'quests' | 'ach'>('quests')
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('active')
  const list = useMemo(() => {
    const qs = state?.quests ?? []
    const f = (q: QuestView) => (filter === 'all' ? true : filter === 'active' ? q.status === 'in_progress' || q.status === 'completed' : q.status === filter)
    return qs.filter(f)
  }, [state, filter])
  if (!state) return null
  const unlocked = state.achievements.filter((a) => a.unlocked).length

  return (
    <Modal title="Nhật ký hành trình" onClose={closeOverlay} wide>
      <div className="mb-3 flex gap-2" role="tablist">
        <button role="tab" aria-selected={tab === 'quests'} onClick={() => setTab('quests')} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === 'quests' ? 'bg-white/15' : 'text-white/60 hover:bg-white/5'}`}>Nhiệm vụ</button>
        <button role="tab" aria-selected={tab === 'ach'} onClick={() => setTab('ach')} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === 'ach' ? 'bg-white/15' : 'text-white/60 hover:bg-white/5'}`} data-testid="tab-ach">
          Thành tựu <span className="text-white/50">{unlocked}/{state.achievements.length}</span>
        </button>
      </div>
      {tab === 'quests' ? (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {FILTERS.map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-xs ${filter === k ? 'border-gold bg-gold/15 text-gold' : 'border-white/15 text-white/65 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/55">Không có nhiệm vụ nào trong mục này.</p>
          ) : (
            <ul className="space-y-2.5">{list.map((q) => <QuestCard key={q.questId} q={q} onClaim={onClaim} busy={busy} />)}</ul>
          )}
        </>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2" data-testid="achievements">
          {state.achievements.map((a) => (
            <li key={a.achId} className={`flex gap-3 rounded-xl border p-3 ${a.unlocked ? 'border-gold/60 bg-gold/10' : 'border-white/10 bg-white/5 opacity-60'}`} data-unlocked={a.unlocked}>
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${a.unlocked ? 'bg-gold text-navy' : 'bg-white/10 text-white/50'}`}>
                {a.unlocked ? <ItemIcon name={a.icon} /> : <Lock size={18} />}
              </span>
              <div>
                <p className="font-bold">{vi(a.name)}</p>
        <p className="text-xs text-white/65">{vi(a.description)}</p>
                <p className="mt-1 text-[11px] text-white/45">
                  {a.unlocked ? `Đạt ${a.at ? new Date(a.at).toLocaleDateString('vi-VN') : ''}` : 'Chưa đạt'} {a.rewardXp ? `· +${a.rewardXp} điểm kinh nghiệm` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

// ───────────────────────── Túi đồ ─────────────────────────
export function InventoryPanel({ onUse }: { onUse: (itemId: string) => void }) {
  const { state, closeOverlay, busy } = useGame()
  const [cat, setCat] = useState('all')
  const [sel, setSel] = useState<string | null>(null)
  if (!state) return null
  const cats = ['all', ...new Set(state.inventory.map((i) => i.category))]
  const items = state.inventory.filter((i) => cat === 'all' || i.category === cat)
  const cur = state.inventory.find((i) => i.itemId === sel) ?? items[0]

  return (
    <Modal title="Túi đồ" onClose={closeOverlay} wide>
      {state.inventory.length === 0 ? (
        <p className="py-10 text-center text-sm text-white/60" data-testid="inv-empty">Túi đồ còn trống. Hãy khám phá thế giới và nhặt vật phẩm nhé!</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-3 py-1 text-xs ${cat === c ? 'border-gold bg-gold/15 text-gold' : 'border-white/15 text-white/65'}`}>{CATEGORY_LABEL[c] ?? c}</button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5" data-testid="inventory-grid">
              {items.map((i) => (
                <li key={i.itemId}>
                  <button
                    onClick={() => setSel(i.itemId)} aria-label={`${i.name}, số lượng ${i.qty}`}
                    className={`relative grid aspect-square w-full place-items-center rounded-xl border ${cur?.itemId === i.itemId ? 'border-gold bg-gold/15' : 'border-white/15 bg-white/5 hover:bg-white/10'}`}
                  >
                    <ItemIcon name={i.icon} size={26} className="text-gold" />
                    <span className="absolute bottom-0.5 right-1.5 text-xs font-bold">×{i.qty}</span>
                  </button>
                </li>
              ))}
            </ul>
            {cur && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3.5" data-testid="item-detail">
                <ItemIcon name={cur.icon} size={30} className="text-gold" />
                <h3 className="mt-2 font-bold">{vi(cur.name)}</h3>
                <p className="text-[11px] uppercase tracking-wider text-cyan">{CATEGORY_LABEL[cur.category] ?? cur.category} · Số lượng {cur.qty}</p>
                <p className="mt-2 text-sm text-white/75">{vi(cur.description)}</p>
                {cur.usable && <Btn onClick={() => onUse(cur.itemId)} disabled={busy} className="mt-3 w-full">Sử dụng</Btn>}
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}

// ───────────────────────── Bản đồ ─────────────────────────
const POS: Record<string, [number, number]> = { plaza: [50, 52], library: [14, 52], lab: [86, 52], garden: [50, 86], courtyard: [32, 16], hall: [68, 16] }
const LINKS: [string, string][] = [['plaza', 'library'], ['plaza', 'lab'], ['plaza', 'garden'], ['plaza', 'courtyard'], ['plaza', 'hall']]

export function MapPanel({ current }: { current: string | null }) {
  const { state, closeOverlay } = useGame()
  if (!state) return null
  return (
    <Modal title="Bản đồ thế giới" onClose={closeOverlay} wide>
      <div className="relative mx-auto aspect-[16/10] w-full max-w-2xl overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br from-purple to-navy" data-testid="world-map">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          {LINKS.map(([a, b]) => (
            <line key={a + b} x1={POS[a]![0]} y1={POS[a]![1]} x2={POS[b]![0]} y2={POS[b]![1]} stroke="#f5c96a" strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {state.areas.map((a) => {
          const [x, y] = POS[a.areaId] ?? [50, 50]
          const here = a.areaId === current
          return (
            <div key={a.areaId} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
              <div className={`flex w-24 flex-col items-center rounded-lg border px-1.5 py-1 text-center sm:w-28 ${here ? 'border-gold bg-gold/20' : a.unlocked ? 'border-cyan/50 bg-navy/85' : 'border-white/15 bg-navy/70 opacity-70'}`} data-area={a.areaId} data-unlocked={a.unlocked}>
                {here ? <MapPin size={14} className="text-gold" aria-label="Bạn đang ở đây" /> : a.unlocked ? <Sparkles size={13} className="text-cyan" aria-hidden /> : <Lock size={13} className="text-white/50" aria-label="Đang khóa" />}
                <span className="text-[10px] font-bold leading-tight sm:text-xs">{vi(a.name)}</span>
              </div>
            </div>
          )
        })}
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {state.areas.filter((a) => !a.unlocked).map((a) => (
          <li key={a.areaId} className="text-white/65"><Lock size={12} className="mr-1.5 inline text-white/45" aria-hidden />{vi(a.name)}: <span className="text-gold">{vi(a.reason ?? '')}</span></li>
        ))}
      </ul>
    </Modal>
  )
}

// ───────────────────────── Menu tạm dừng ─────────────────────────
export function PauseMenu({ onSummary, onExitGuest, onLogout, onCharacter }: { onSummary: () => void; onExitGuest: () => void; onLogout: () => void; onCharacter: () => void }) {
  const { state, closeOverlay, openOverlay, requireAccount } = useGame()
  const [audio, setAudio] = useState(() => AudioManager.getSettings())
  const [advFx, setAdvFx] = useState(() => {
    try {
      return localStorage.getItem('tq_advanced_fx') !== 'false'
    } catch {
      return true
    }
  })

  if (!state) return null
  const guest = state.kind === 'guest'

  const updateBgmVol = (v: number) => {
    AudioManager.setSettings({ bgmVolume: v, bgmMuted: v === 0 })
    setAudio(AudioManager.getSettings())
  }
  const updateSfxVol = (v: number) => {
    AudioManager.setSettings({ sfxVolume: v, sfxMuted: v === 0 })
    setAudio(AudioManager.getSettings())
  }
  const toggleBgmMute = () => {
    AudioManager.toggleBgmMute()
    setAudio(AudioManager.getSettings())
  }
  const toggleSfxMute = () => {
    AudioManager.toggleSfxMute()
    setAudio(AudioManager.getSettings())
  }

  const toggleFx = () => {
    const next = !advFx
    setAdvFx(next)
    try {
      localStorage.setItem('tq_advanced_fx', String(next))
    } catch {}
    EventBus.emit('fx:toggle', next)
  }

  return (
    <Modal title="Tạm dừng" onClose={closeOverlay}>
      <div className="flex flex-col gap-3">
        {/* Cài đặt Âm thanh & Nhạc nền */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-cyan">Âm thanh & Hiệu ứng</p>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5 min-w-24 text-white/80">
              <button onClick={toggleBgmMute} className="text-white/60 hover:text-white" aria-label="Bật/Tắt nhạc nền">
                {audio.bgmMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              Nhạc nền
            </span>
            <input
              type="range" min="0" max="1" step="0.05"
              value={audio.bgmMuted ? 0 : audio.bgmVolume}
              onChange={(e) => updateBgmVol(parseFloat(e.target.value))}
              className="w-full accent-cyan cursor-pointer"
              aria-label="Âm lượng nhạc nền"
              data-testid="slider-bgm"
            />
            <span className="w-8 text-right text-[11px] text-white/50">{audio.bgmMuted ? '0%' : `${Math.round(audio.bgmVolume * 100)}%`}</span>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5 min-w-24 text-white/80">
              <button onClick={toggleSfxMute} className="text-white/60 hover:text-white" aria-label="Bật/Tắt hiệu ứng âm thanh">
                {audio.sfxMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              Hiệu ứng âm thanh
            </span>
            <input
              type="range" min="0" max="1" step="0.05"
              value={audio.sfxMuted ? 0 : audio.sfxVolume}
              onChange={(e) => updateSfxVol(parseFloat(e.target.value))}
              className="w-full accent-gold cursor-pointer"
              aria-label="Âm lượng hiệu ứng"
              data-testid="slider-sfx"
            />
            <span className="w-8 text-right text-[11px] text-white/50">{audio.sfxMuted ? '0%' : `${Math.round(audio.sfxVolume * 100)}%`}</span>
          </div>

          {/* Bật/Tắt Hiệu ứng nâng cao */}
          <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
            <span className="flex items-center gap-1.5 text-white/80">
              <Sparkles size={14} className="text-gold" /> Hiệu ứng nâng cao (ánh sáng, lá rơi)
            </span>
            <button
              onClick={toggleFx}
              className={`px-2.5 py-1 rounded text-xs font-bold transition ${advFx ? 'bg-cyan text-navy' : 'bg-white/10 text-white/60'}`}
              data-testid="btn-toggle-fx"
            >
              {advFx ? 'BẬT' : 'TẮT'}
            </button>
          </div>
        </div>

        <Btn onClick={closeOverlay} kind="primary"><Play size={16} /> Tiếp tục chơi</Btn>
        <Btn kind="ghost" onClick={() => openOverlay('help')}>Hướng dẫn điều khiển</Btn>
        <Btn kind="ghost" onClick={onCharacter}>Đổi nhân vật & trang phục</Btn>
        <Btn kind="ghost" onClick={onSummary}><Award size={16} /> Xem kết quả hành trình</Btn>
        {guest ? (
          <>
            <Btn kind="cyan" onClick={() => requireAccount('Đăng ký để lưu tiến độ và tham gia bảng xếp hạng.')}><UserPlus size={16} /> Lưu tiến độ / Đăng ký</Btn>
            <Btn kind="ghost" onClick={onExitGuest}>Thoát chơi thử</Btn>
          </>
        ) : (
          <Btn kind="ghost" onClick={onLogout}>Đăng xuất</Btn>
        )}
      </div>
    </Modal>
  )
}

export function HelpPanel() {
  const { closeOverlay } = useGame()
  const rows = [['W A S D / ← ↑ ↓ →', 'Di chuyển'], ['Shift', 'Chạy'], ['E / Space', 'Tương tác'], ['J', 'Nhật ký nhiệm vụ'], ['I', 'Túi đồ'], ['M', 'Bản đồ'], ['Esc', 'Tạm dừng / đóng']]
  return (
    <Modal title="Hướng dẫn điều khiển" onClose={closeOverlay}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (<div key={k} className="contents"><dt><kbd className="rounded bg-white/15 px-2 py-0.5 text-xs font-bold">{k}</kbd></dt><dd className="text-white/80">{v}</dd></div>))}
      </dl>
      <p className="mt-4 text-xs text-white/55">Trên điện thoại: dùng cần điều khiển bên trái, nút ✋ để tương tác và ⚡ để chạy.</p>
    </Modal>
  )
}

// ───────────────────────── Chọn nhân vật (4 Nhân vật Chibi) ─────────────────────────
export function CharacterSelect({ initialAvatar, initialOutfit, onConfirm, onCancel }: {
  initialAvatar: number; initialOutfit: number; onConfirm: (avatar: number, outfit: number) => void; onCancel?: () => void
}) {
  const [avatar, setAvatar] = useState(initialAvatar)
  const [outfit, setOutfit] = useState(initialOutfit)

  return (
    <Modal title="Chọn nhân vật đồng hành" onClose={onCancel} locked={!onCancel}
      footer={<div className="flex justify-end"><Btn onClick={() => onConfirm(avatar, outfit)} className="min-w-40"><Play size={16} /> Bắt đầu hành trình</Btn></div>}>
      <div className="flex flex-col items-center gap-4">
        {/* Hình ảnh xem trước Chibi 3D */}
        <div className="flex flex-col items-center text-center">
          <img
            src={previewDataUrl(avatar, outfit)}
            alt={`Nhân vật ${AVATAR_NAMES[avatar]}`}
            width={128}
            height={128}
            className="h-32 w-32 rounded-2xl bg-gradient-to-b from-purple/40 to-navy/90 border border-white/20 p-2 shadow-xl"
            data-testid="char-preview"
          />
          <h3 className="mt-2 text-base font-bold text-gold">{AVATAR_NAMES[avatar]}</h3>
          <p className="max-w-xs text-xs text-white/70 mt-0.5">{AVATAR_DESCRIPTIONS[avatar]}</p>
        </div>

        {/* 4 Nhân vật Chibi */}
        <div className="w-full">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-cyan">Chọn 1 trong 4 nhân vật</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {AVATAR_NAMES.map((name, i) => (
              <button
                key={i}
                onClick={() => setAvatar(i)}
                aria-label={name}
                aria-pressed={avatar === i}
                data-testid={`avatar-${i}`}
                className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition ${avatar === i ? 'border-gold bg-gold/20 shadow-md ring-2 ring-gold/40' : 'border-white/15 bg-white/5 hover:bg-white/10'}`}
              >
                <img src={previewDataUrl(i, outfit)} alt="" width={56} height={56} className="h-14 w-14" />
                <span className="text-xs font-bold text-white truncate max-w-full">{name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tùy chỉnh màu sắc phong cách */}
        <div>
          <p className="mb-1.5 text-center text-xs font-semibold uppercase tracking-wider text-white/60">Tông màu trang phục</p>
          <div className="flex gap-3 justify-center">
            {OUTFITS.map((c, i) => (
              <button
                key={c}
                onClick={() => setOutfit(i)}
                aria-label={OUTFIT_NAMES[i]}
                aria-pressed={outfit === i}
                data-testid={`outfit-${i}`}
                className={`h-8 w-8 rounded-full border-2 transition transform hover:scale-105 ${outfit === i ? 'border-gold ring-2 ring-gold/50 scale-110' : 'border-white/20'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
