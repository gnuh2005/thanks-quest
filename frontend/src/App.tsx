import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import { useSession } from './stores/session'

const Auth = lazy(() => import('./pages/Auth'))
const GuestEntry = lazy(() => import('./pages/GuestEntry'))
const Play = lazy(() => import('./pages/Play'))
const Admin = lazy(() => import('./pages/Admin'))
const LeaderboardPage = lazy(() => import('./pages/Community').then((m) => ({ default: m.LeaderboardPage })))
const WallPage = lazy(() => import('./pages/Community').then((m) => ({ default: m.WallPage })))

export default function App() {
  const load = useSession((s) => s.load)
  useEffect(() => { void load() }, [load])
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="grid min-h-screen place-items-center bg-navy text-white/70" role="status">Đang tải…</div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dang-nhap" element={<Auth mode="login" />} />
          <Route path="/dang-ky" element={<Auth mode="register" />} />
          <Route path="/choi-thu" element={<GuestEntry />} />
          <Route path="/choi" element={<Play />} />
          <Route path="/xep-hang" element={<LeaderboardPage />} />
          <Route path="/tuong-tri-an" element={<WallPage />} />
          <Route path="/quan-tri" element={<Admin />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}