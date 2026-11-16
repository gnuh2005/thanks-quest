import { Link, NavLink } from 'react-router-dom'
import { Logo } from './Logo'
import { useSession } from '../stores/session'

export function PageShell({ title, sub, children, dark = false }: { title: string; sub?: string; children: React.ReactNode; dark?: boolean }) {
  const { role, user, logout } = useSession()
  const link = ({ isActive }: { isActive: boolean }) => `text-sm ${isActive ? 'text-gold' : 'text-white/75 hover:text-white'}`
  return (
    <div className={dark ? 'min-h-screen bg-navy text-white' : 'min-h-screen bg-paper'}>
      <header className="border-b border-white/10 bg-navy">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" aria-label="Trang chủ"><Logo light /></Link>
          <nav className="flex items-center gap-4 sm:gap-6" aria-label="Điều hướng">
            <NavLink to="/xep-hang" className={link}>Xếp hạng</NavLink>
            <NavLink to="/tuong-tri-an" className={link}>Tường tri ân</NavLink>
            {role === 'admin' && <NavLink to="/quan-tri" className={link}>Quản trị</NavLink>}
            {role === 'student' || role === 'admin' ? (
              <>
                <Link to="/choi" className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-navy">Vào game</Link>
                <button onClick={() => void logout()} className="hidden text-sm text-white/60 hover:text-white sm:block" title={user?.email}>Đăng xuất</button>
              </>
            ) : (
              <Link to="/choi-thu" className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-navy">Chơi thử</Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className={`text-3xl font-extrabold ${dark ? 'text-white' : 'text-navy'}`}>{title}</h1>
        {sub && <p className={`mt-2 max-w-2xl ${dark ? 'text-white/65' : 'text-ink/70'}`}>{sub}</p>}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  )
}
