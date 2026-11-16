import { useEffect, useRef, useState } from 'react'
import { Hand, Zap } from 'lucide-react'
import { EventBus } from '../../game/events/EventBus'

const R = 54 // bán kính vùng cần điều khiển (px)

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

/** Joystick ảo + nút tương tác/chạy cho thiết bị cảm ứng. */
export function TouchControls({ hidden }: { hidden: boolean }) {
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [running, setRunning] = useState(false)
  const active = useRef<number | null>(null)

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

  useEffect(() => {
    if (hidden) {
      release()
      setRunning(false)
      EventBus.emit('touch:run', false)
    }
  }, [hidden])

  if (hidden) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between p-5 pb-7 select-none">
      <div
        ref={base} data-testid="joystick"
        className="pointer-events-auto relative h-[132px] w-[132px] touch-none rounded-full border border-white/25 bg-navy/45 backdrop-blur-sm"
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
          className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 shadow-lg"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>
      <div className="pointer-events-auto flex flex-col items-center gap-3">
        <button
          aria-label="Chạy" aria-pressed={running}
          className={`grid h-12 w-12 place-items-center rounded-full border border-white/25 backdrop-blur-sm ${running ? 'bg-cyan text-navy' : 'bg-navy/50 text-white'}`}
          onPointerDown={() => { setRunning((r) => { EventBus.emit('touch:run', !r); return !r }) }}
        >
          <Zap size={20} />
        </button>
        <button
          aria-label="Tương tác" data-testid="touch-interact"
          className="grid h-[72px] w-[72px] place-items-center rounded-full bg-gold text-navy shadow-xl active:scale-95"
          onPointerDown={() => EventBus.emit('touch:interact')}
        >
          <Hand size={28} />
        </button>
      </div>
    </div>
  )
}
