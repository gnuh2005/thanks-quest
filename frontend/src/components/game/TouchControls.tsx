import { useEffect, useRef, useState } from 'react'
import { Hand, Zap } from 'lucide-react'
import { EventBus } from '../../game/events/EventBus'

const COMPACT_QUERY = '(pointer: coarse) and (max-height: 500px)'

export function useIsTouch(): boolean {
  const [t, setT] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch')
  })
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const fn = () => setT(mq.matches || new URLSearchParams(location.search).has('touch'))
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return t
}

/** Điện thoại quay ngang: màn hình rộng nhưng rất thấp → dùng điều khiển gọn */
export function useIsCompact(): boolean {
  const [c, setC] = useState(() => typeof window !== 'undefined' && window.matchMedia(COMPACT_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY)
    const fn = () => setC(mq.matches)
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return c
}

/** Joystick ảo + nút tương tác/chạy cho thiết bị cảm ứng. */
export function TouchControls({ hidden }: { hidden: boolean }) {
  const compact = useIsCompact()
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [running, setRunning] = useState(false)
  const active = useRef<number | null>(null)

  // Kích thước theo chế độ
  const baseSize = compact ? 96 : 132
  const knobSize = compact ? 40 : 56
  const R = compact ? 36 : 54 // bán kính vùng kéo cần điều khiển (px)

  const move = (clientX: number, clientY: number) => {
    const el = base.current
    if (!el) return
    const b = el.getBoundingClientRect()
    let dx = clientX - (b.left + b.width / 2)
    let dy = clientY - (b.top + b.height / 2)
    const len = Math.hypot(dx, dy)
    if (len > R) {
      dx = (dx / len) * R
      dy = (dy / len) * R
    }
    setKnob({ x: dx, y: dy })
    EventBus.emit('touch:move', { x: dx / R, y: dy / R })
  }

  const release = () => {
    active.current = null
    setKnob({ x: 0, y: 0 })
    EventBus.emit('touch:move', { x: 0, y: 0 })
  }

  const toggleRun = () => {
    const next = !running
    setRunning(next)
    EventBus.emit('touch:run', next)
  }

  useEffect(() => {
    if (hidden) {
      release()
      setRunning(false)
      EventBus.emit('touch:run', false)
    }
  }, [hidden])

  if (hidden) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex select-none items-end justify-between"
      style={{
        paddingLeft: `max(${compact ? '0.75rem' : '1.25rem'}, env(safe-area-inset-left))`,
        paddingRight: `max(${compact ? '0.75rem' : '1.25rem'}, env(safe-area-inset-right))`,
        paddingBottom: `max(${compact ? '0.5rem' : '1.75rem'}, env(safe-area-inset-bottom))`,
      }}
    >
      <div
        ref={base}
        data-testid="joystick"
        className={`pointer-events-auto relative touch-none rounded-full border border-white/25 backdrop-blur-sm ${compact ? 'bg-navy/30' : 'bg-navy/45'}`}
        style={{ width: baseSize, height: baseSize }}
        onPointerDown={(e) => {
          active.current = e.pointerId
          e.currentTarget.setPointerCapture(e.pointerId)
          move(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => active.current === e.pointerId && move(e.clientX, e.clientY)}
        onPointerUp={release}
        onPointerCancel={release}
        aria-label="Cần điều khiển"
      >
        <div
          className="absolute left-1/2 top-1/2 rounded-full bg-white/70 shadow-lg"
          style={{
            width: knobSize,
            height: knobSize,
            transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
          }}
        />
      </div>

      <div className={`pointer-events-auto flex flex-col items-center ${compact ? 'gap-2' : 'gap-3'}`}>
        <button
          aria-label="Chạy"
          aria-pressed={running}
          className={`grid place-items-center rounded-full border border-white/25 backdrop-blur-sm ${compact ? 'h-10 w-10' : 'h-12 w-12'} ${running ? 'bg-cyan text-navy' : 'bg-navy/50 text-white'}`}
          onPointerDown={toggleRun}
        >
          <Zap size={compact ? 17 : 20} />
        </button>
        <button
          aria-label="Tương tác"
          data-testid="touch-interact"
          className={`grid place-items-center rounded-full bg-gold text-navy shadow-xl active:scale-95 ${compact ? 'h-14 w-14' : 'h-[72px] w-[72px]'}`}
          onPointerDown={() => EventBus.emit('touch:interact')}
        >
          <Hand size={compact ? 22 : 28} />
        </button>
      </div>
    </div>
  )
}