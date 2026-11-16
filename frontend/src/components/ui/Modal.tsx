import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { vi } from '../../i18n'

interface Props {
  title: string
  onClose?: () => void
  children: React.ReactNode
  wide?: boolean
  footer?: React.ReactNode
  /** Ẩn nút đóng (dùng khi cần bắt buộc chọn). */
  locked?: boolean
}

/** Hộp thoại kiểu kính tối dùng trong game. Đóng bằng nút X hoặc ESC (ESC do trang Play xử lý). */
export function Modal({ title, onClose, children, wide, footer, locked }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => prev?.focus?.()
  }, [])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/70 p-3 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && !locked && onClose?.()}>
      <div
        ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={vi(title)}
        className={`flex max-h-[92vh] w-full flex-col rounded-2xl border border-white/15 bg-navy/95 text-white shadow-2xl outline-none ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
          <h2 className="text-base font-bold tracking-wide">{vi(title)}</h2>
          {!locked && onClose && (
            <button onClick={onClose} aria-label="Đóng" className="grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-white/10 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Btn({
  children, onClick, kind = 'primary', disabled, type = 'button', className = '', title, testId,
}: {
  children: React.ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'cyan'; disabled?: boolean
  type?: 'button' | 'submit'; className?: string; title?: string; testId?: string
}) {
  const kinds = {
    primary: 'bg-gold text-navy hover:brightness-105',
    cyan: 'bg-cyan text-navy hover:brightness-105',
    ghost: 'border border-white/20 text-white hover:bg-white/10',
    danger: 'bg-red-500/90 text-white hover:bg-red-500',
  }
  return (
    <button
      type={type} title={title} disabled={disabled} onClick={onClick} data-testid={testId}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${kinds[kind]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Bar({ value, max = 1, color = 'bg-cyan', className = '' }: { value: number; max?: number; color?: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, max === 0 ? 0 : (value / max) * 100))
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-white/10 ${className}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
