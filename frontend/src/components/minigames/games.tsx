import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen, Clock, FlaskConical, Flame, Gem, Globe, Heart, KeyRound, Lamp, Laptop, Leaf, Lightbulb, Medal, Music, Pencil, Snowflake, Star, Thermometer, type LucideIcon,
} from 'lucide-react'
import { Bar, Btn } from '../ui/Modal'
import { miniApi } from '../../services/gameApi'
import { ApiError } from '../../services/api'
import { EventBus } from '../../game/events/EventBus'
import { vi } from '../../i18n'

export interface GameProps {
  minigameId: string
  attempt: Record<string, any>
  submit: (answer: unknown) => Promise<void>
  onError: (message: string) => void
}

function useCountdown(totalSec: number, running: boolean, onExpire: () => void) {
  const [left, setLeft] = useState(totalSec)
  const start = useRef(Date.now())
  const expire = useRef(onExpire)
  expire.current = onExpire
  useEffect(() => {
    if (!running) return
    start.current = Date.now()
    const id = window.setInterval(() => {
      const l = Math.max(0, totalSec - Math.floor((Date.now() - start.current) / 1000))
      setLeft(l)
      if (l === 0) {
        window.clearInterval(id)
        expire.current()
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [running, totalSec])
  return left
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function Timer({ left, total }: { left: number; total: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Còn ${left} giây`}>
      <Clock size={15} className={left <= 15 ? 'text-red-400' : 'text-cyan'} aria-hidden />
      <span className={`w-11 text-sm font-bold tabular-nums ${left <= 15 ? 'text-red-400' : ''}`} data-testid="timer">{fmt(left)}</span>
      <Bar value={left} max={total} color={left <= 15 ? 'bg-red-400' : 'bg-cyan'} className="w-24 sm:w-40" />
    </div>
  )
}

// ───────────────────────── Knowledge Quiz ─────────────────────────
export function QuizGame({ attempt, submit }: GameProps) {
  const questions = attempt.questions as { qid: string; text: string; category: string; choices: string[] }[]
  const total = attempt.timeLimitSec as number
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [sending, setSending] = useState(false)
  const answersRef = useRef(answers)
  answersRef.current = answers

  const send = useCallback(async () => {
    if (sending) return
    setSending(true)
    await submit({ answers: Object.entries(answersRef.current).map(([qid, choice]) => ({ qid, choice })) })
  }, [sending, submit])

  const left = useCountdown(total, !sending, () => void send())
  const q = questions[idx]!
  const picked = answers[q.qid]
  const answered = Object.keys(answers).length

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (n >= 1 && n <= q.choices.length) setAnswers((a) => ({ ...a, [q.qid]: n - 1 }))
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [q])

  return (
    <div data-testid="quiz">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white/80">Câu {idx + 1}/{questions.length}</p>
        <Timer left={left} total={total} />
      </div>
      <Bar value={idx + 1} max={questions.length} color="bg-gold" className="mb-4 !h-1" />
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-cyan">{vi(q.category)}</p>
      <h3 className="mb-4 text-lg font-bold leading-snug">{vi(q.text)}</h3>
      <div className="grid gap-2" role="radiogroup" aria-label="Các lựa chọn">
        {q.choices.map((c, i) => (
          <button
            key={i} role="radio" aria-checked={picked === i} data-testid={`choice-${i}`}
            onClick={() => setAnswers((a) => ({ ...a, [q.qid]: i }))}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${picked === i ? 'border-gold bg-gold/15' : 'border-white/15 bg-white/5 hover:bg-white/10'}`}
          >
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${picked === i ? 'bg-gold text-navy' : 'bg-white/15'}`}>{i + 1}</span>
            {vi(c)}
          </button>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between gap-2">
        <Btn kind="ghost" disabled={idx === 0 || sending} onClick={() => setIdx(idx - 1)}>‹ Câu trước</Btn>
        {idx < questions.length - 1 ? (
          <Btn onClick={() => setIdx(idx + 1)} disabled={sending} testId="next">Câu tiếp ›</Btn>
        ) : (
          <Btn onClick={() => void send()} disabled={sending || answered === 0} title="Nộp bài">{sending ? 'Đang chấm…' : `Nộp bài (${answered}/${questions.length})`}</Btn>
        )}
      </div>
    </div>
  )
}

// ───────────────────────── Memory Matching ─────────────────────────
const SYMBOLS: Record<string, LucideIcon> = {
  book: BookOpen, star: Star, pencil: Pencil, laptop: Laptop, globe: Globe, flask: FlaskConical, lamp: Lamp, medal: Medal, key: KeyRound, heart: Heart, music: Music, leaf: Leaf,
}
const LABELS: Record<string, string> = { book: 'Sách', star: 'Sao', pencil: 'Bút chì', laptop: 'Laptop', globe: 'Quả địa cầu', flask: 'Bình thí nghiệm', lamp: 'Đèn', medal: 'Huy chương', key: 'Chìa khóa', heart: 'Trái tim', music: 'Nốt nhạc', leaf: 'Chiếc lá' }

export function MemoryGame({ attempt, submit }: GameProps) {
  const deck = attempt.deck as string[]
  const total = attempt.timeLimitSec as number
  const [open, setOpen] = useState<number[]>([])
  const [matched, setMatched] = useState<Set<number>>(new Set())
  const [flips, setFlips] = useState<number[]>([])
  const [locked, setLocked] = useState(false)
  const [sending, setSending] = useState(false)
  const flipsRef = useRef(flips)
  flipsRef.current = flips
  const moves = flips.length / 2 | 0

  const send = useCallback(async () => {
    if (sending || flipsRef.current.length < 2) {
      if (!sending) await submit({ flips: [0, 1] }) // hết giờ khi chưa lật: nộp lượt tối thiểu để đóng phiên
      return
    }
    setSending(true)
    await submit({ flips: flipsRef.current })
  }, [sending, submit])

  const left = useCountdown(total, !sending, () => void send())

  const flip = (i: number) => {
    if (locked || sending || matched.has(i) || open.includes(i)) return
    EventBus.emit('audio:playSfx', 'button')
    const next = [...open, i]
    setOpen(next)
    if (next.length === 2) {
      setLocked(true)
      const nf = [...flips, next[0]!, next[1]!]
      setFlips(nf)
      const isMatch = deck[next[0]!] === deck[next[1]!]
      window.setTimeout(() => {
        if (isMatch) {
          EventBus.emit('audio:playSfx', 'minigameCorrect')
          const m = new Set(matched)
          m.add(next[0]!)
          m.add(next[1]!)
          setMatched(m)
          if (m.size === deck.length) {
            setSending(true)
            void submit({ flips: nf })
          }
        } else {
          EventBus.emit('audio:playSfx', 'minigameWrong')
        }
        setOpen([])
        setLocked(false)
      }, isMatch ? 350 : 800)
    }
  }

  return (
    <div data-testid="memory">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white/80">Lượt: <span data-testid="moves">{moves}</span> · Cặp: {matched.size / 2}/{deck.length / 2}</p>
        <Timer left={left} total={total} />
      </div>
      <div className="mx-auto grid max-w-md grid-cols-4 gap-2.5">
        {deck.map((sym, i) => {
          const up = open.includes(i) || matched.has(i)
          const Icon = SYMBOLS[sym] ?? Star
          return (
            <button
              key={i} onClick={() => flip(i)} data-testid={`card-${i}`} data-symbol={sym} data-up={up}
              aria-label={up ? LABELS[sym] ?? sym : `Thẻ úp số ${i + 1}`} aria-pressed={up}
              className={`grid aspect-square place-items-center rounded-xl border-2 transition-transform duration-200 ${
                matched.has(i) ? 'border-cyan bg-cyan/20 text-cyan' : up ? 'border-gold bg-gold/20 text-gold' : 'border-white/20 bg-purple text-white/20 hover:border-white/40'
              }`}
            >
              {up ? <Icon size={30} /> : <span className="text-2xl font-extrabold">?</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ───────────────────────── Code Debugging ─────────────────────────
export function DebugGame({ attempt, submit }: GameProps) {
  const challenges = attempt.challenges as { qid: string; title: string; language: string; buggyCode: string; hint: string }[]
  const total = attempt.timeLimitSec as number
  const [idx, setIdx] = useState(0)
  const [code, setCode] = useState<Record<string, string>>(() => Object.fromEntries(challenges.map((c) => [c.qid, c.buggyCode])))
  const [hint, setHint] = useState<Record<string, boolean>>({})
  const [sending, setSending] = useState(false)
  const codeRef = useRef(code)
  codeRef.current = code

  const send = useCallback(async () => {
    if (sending) return
    setSending(true)
    await submit({ answers: challenges.map((c) => ({ qid: c.qid, code: codeRef.current[c.qid] ?? '' })) })
  }, [sending, submit, challenges])

  const left = useCountdown(total, !sending, () => void send())
  const c = challenges[idx]!
  const changed = challenges.filter((x) => code[x.qid] !== x.buggyCode).length

  return (
    <div data-testid="debug">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex gap-1.5" role="tablist" aria-label="Thử thách">
          {challenges.map((x, i) => (
            <button key={x.qid} role="tab" aria-selected={i === idx} onClick={() => setIdx(i)}
              className={`rounded-lg px-3 py-1 text-xs font-bold ${i === idx ? 'bg-gold text-navy' : code[x.qid] !== x.buggyCode ? 'bg-cyan/25 text-cyan' : 'bg-white/10'}`}>
              Bài {i + 1}
            </button>
          ))}
        </div>
        <Timer left={left} total={total} />
      </div>
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-electric/25 px-2 py-0.5 text-[11px] font-bold uppercase text-electric">{vi(c.language)}</span>
        <h3 className="text-base font-bold">{vi(c.title)}</h3>
      </div>
      <textarea
        value={code[c.qid] ?? ''} data-testid="code-editor" aria-label={`Mã nguồn bài ${idx + 1}`}
        onChange={(e) => setCode((p) => ({ ...p, [c.qid]: e.target.value }))}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            e.preventDefault()
            const el = e.currentTarget
            const s = el.selectionStart
            const v = el.value
            setCode((p) => ({ ...p, [c.qid]: v.slice(0, s) + '  ' + v.slice(el.selectionEnd) }))
            requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2))
          }
          e.stopPropagation()
        }}
        spellCheck={false} autoCapitalize="off" autoCorrect="off" rows={9}
        className="w-full resize-y rounded-xl border border-white/15 bg-black/40 p-3 font-mono text-[13px] leading-relaxed text-cyan outline-none focus:border-electric"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Btn kind="ghost" className="!py-1.5 !text-xs" onClick={() => setHint((h) => ({ ...h, [c.qid]: !h[c.qid] }))}><Lightbulb size={14} /> Gợi ý</Btn>
          <Btn kind="ghost" className="!py-1.5 !text-xs" onClick={() => setCode((p) => ({ ...p, [c.qid]: c.buggyCode }))}>Đặt lại</Btn>
        </div>
        <Btn onClick={() => void send()} disabled={sending || changed === 0} title="Nộp bài">{sending ? 'Đang kiểm tra…' : `Nộp bài (${changed}/${challenges.length} đã sửa)`}</Btn>
      </div>
      {hint[c.qid] && <p className="mt-2 rounded-lg bg-gold/10 p-2.5 text-xs text-gold" data-testid="hint">{vi(c.hint)}</p>}
      <p className="mt-2 text-[11px] text-white/45">Mã của bạn không được chạy trên máy chủ — hệ thống chỉ kiểm tra bản sửa theo quy tắc an toàn.</p>
    </div>
  )
}

// ───────────────────────── Treasure Hunt ─────────────────────────
type Heat = 'found' | 'hot' | 'warm' | 'cold'
const HEAT: Record<Heat, { label: string; cls: string; Icon: LucideIcon }> = {
  found: { label: 'Kho báu!', cls: 'border-gold bg-gold/30 text-gold', Icon: Gem },
  hot: { label: 'Rất nóng', cls: 'border-red-400 bg-red-500/25 text-red-300', Icon: Flame },
  warm: { label: 'Ấm', cls: 'border-orange-300 bg-orange-400/20 text-orange-200', Icon: Thermometer },
  cold: { label: 'Lạnh', cls: 'border-sky-400/60 bg-sky-500/15 text-sky-300', Icon: Snowflake },
}

export function TreasureGame({ minigameId, attempt, submit, onError }: GameProps) {
  const size = attempt.size as number
  const maxDigs = attempt.maxDigs as number
  const treasures = attempt.treasures as number
  const total = attempt.timeLimitSec as number
  const attemptId = attempt.attemptId as string
  const [cells, setCells] = useState<Record<string, Heat>>({})
  const [digsLeft, setDigsLeft] = useState(maxDigs)
  const [found, setFound] = useState(0)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const doneRef = useRef(false)

  const finish = useCallback(async () => {
    if (doneRef.current) return
    doneRef.current = true
    setDone(true)
    await submit({})
  }, [submit])
  const left = useCountdown(total, !done, () => void finish())

  const dig = async (x: number, y: number) => {
    if (busy || done || cells[`${x},${y}`]) return
    setBusy(true)
    try {
      const { dig: r } = await miniApi.dig(minigameId, attemptId, x, y)
      setCells((c) => ({ ...c, [`${x},${y}`]: r.heat }))
      setDigsLeft(r.digsLeft)
      setFound(r.foundCount)
      if (r.finished) await finish()
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Không đào được ô này')
    } finally {
      setBusy(false)
    }
  }

  const grid = useMemo(() => Array.from({ length: size * size }, (_, i) => ({ x: i % size, y: Math.floor(i / size) })), [size])

  return (
    <div data-testid="treasure">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white/80">Kho báu: <span data-testid="found">{found}</span>/{treasures} · Lượt đào còn: <span data-testid="digs-left">{digsLeft}</span></p>
        <Timer left={left} total={total} />
      </div>
      <div className="mx-auto grid max-w-sm gap-1.5" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
        {grid.map(({ x, y }) => {
          const h = cells[`${x},${y}`]
          const H = h ? HEAT[h] : null
          return (
            <button
              key={`${x},${y}`} onClick={() => void dig(x, y)} disabled={!!h || busy || done} data-testid={`cell-${x}-${y}`} data-heat={h ?? ''}
              aria-label={H ? `Ô ${x + 1},${y + 1}: ${H.label}` : `Đào ô ${x + 1},${y + 1}`}
              className={`grid aspect-square place-items-center rounded-lg border ${H ? H.cls : 'border-white/15 bg-[#6b4a2b]/60 hover:bg-[#8a6b4a]/70'}`}
            >
              {H ? <H.Icon size={18} /> : null}
            </button>
          )
        })}
      </div>
      <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-white/65">
        {(Object.keys(HEAT) as Heat[]).map((k) => { const I = HEAT[k].Icon; return <li key={k} className="flex items-center gap-1"><I size={13} aria-hidden /> {HEAT[k].label}</li> })}
      </ul>
      <p className="mt-2 text-center text-xs text-white/50">Gợi ý cho biết khoảng cách tới kho báu gần nhất chưa tìm thấy.</p>
      <div className="mt-3 flex justify-center">
        <Btn kind="ghost" onClick={() => void finish()} disabled={done || busy}>Kết thúc sớm</Btn>
      </div>
    </div>
  )
}
