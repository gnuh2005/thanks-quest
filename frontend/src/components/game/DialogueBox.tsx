import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { EventBus } from '../../game/events/EventBus'
import type { Dialogue, DialogueChoice } from '../../types/api'
import { vi } from '../../i18n'

interface Props {
  dialogue: Dialogue
  busy: boolean
  onChoice: (c: DialogueChoice) => void
  onClose: () => void
}

const CPS = 55 // ký tự/giây cho hiệu ứng gõ chữ

/** Hộp hội thoại nhiều dòng; hết dòng cuối mới hiện các lựa chọn (nhận nhiệm vụ, nhận thưởng...). */
export function DialogueBox({ dialogue, busy, onChoice, onClose }: Props) {
  const [line, setLine] = useState(0)
  const [shown, setShown] = useState(0)
  const text = vi(dialogue.lines[line] ?? '')
  const typing = shown < text.length
  const last = line >= dialogue.lines.length - 1
  const ref = useRef({ typing, last, line })
  ref.current = { typing, last, line }

  useEffect(() => {
    EventBus.emit('audio:playSfx', 'dialogOpen')
    EventBus.emit('audio:playSfx', 'npc')
    return () => {
      EventBus.emit('audio:playSfx', 'dialogClose')
    }
  }, [])

  useEffect(() => {
    setLine(0)
  }, [dialogue])

  useEffect(() => {
    setShown(0)
    const start = performance.now()
    const id = window.setInterval(() => {
      const n = Math.min(text.length, Math.floor(((performance.now() - start) / 1000) * CPS))
      setShown(n)
      if (n >= text.length) window.clearInterval(id)
    }, 30)
    return () => window.clearInterval(id)
  }, [text])

  const advance = () => {
    const r = ref.current
    if (r.typing) setShown(text.length)
    else if (!r.last) setLine(r.line + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return
      const r = ref.current
      if (['e', 'E', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault()
        advance()
      } else if (r.last && !r.typing && /^[1-9]$/.test(e.key)) {
        const c = dialogue.choices[Number(e.key) - 1]
        if (c) onChoice(c)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialogue, onChoice, text])

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center p-3 pb-4 sm:p-5">
      <div
        role="dialog" aria-label={`Hội thoại với ${vi(dialogue.name)}`} data-testid="dialogue"
        className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-white/20 bg-navy/95 p-4 text-white shadow-2xl backdrop-blur"
      >
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="font-bold text-gold">{vi(dialogue.name)} <span className="ml-1 text-xs font-medium text-white/55">{vi(dialogue.role)}</span></p>
          <button onClick={onClose} className="text-xs text-white/55 hover:text-white">Đóng (Esc)</button>
        </div>
        <button className="block min-h-[3.5rem] w-full text-left text-[15px] leading-relaxed" onClick={advance} aria-live="polite">
          {vi(text.slice(0, shown))}
          {!typing && !last && <ChevronRight className="ml-1 inline animate-pulse text-cyan" size={16} aria-label="Tiếp tục" />}
        </button>
        {last && !typing && (
          <div className="mt-3 flex flex-wrap gap-2">
            {dialogue.choices.map((c, i) => (
              <button
                key={`${c.action}-${i}`} disabled={busy} onClick={() => onChoice(c)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                  c.action === 'accept' || c.action === 'claim' ? 'bg-gold text-navy hover:brightness-105' : 'border border-white/25 text-white hover:bg-white/10'
                }`}
              >
                <span className="mr-1.5 text-xs opacity-60">{i + 1}</span>
                {vi(c.label)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
