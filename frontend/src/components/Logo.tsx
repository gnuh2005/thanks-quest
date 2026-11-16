import { Star } from 'lucide-react'

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="Hành trình tri ân">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy text-gold pixel-border">
        <Star size={18} fill="currentColor" aria-hidden />
      </span>
      <span className={`font-sans text-xs font-extrabold leading-tight tracking-[0.06em] ${light ? 'text-white' : 'text-navy'}`}>
        HÀNH TRÌNH
        <br />
        <span className="text-electric">TRI ÂN</span>
      </span>
    </span>
  )
}
