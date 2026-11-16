import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2, RotateCw } from 'lucide-react'
import { Logo } from '../components/Logo'
import { ApiError } from '../services/api'
import { guestApi } from '../services/gameApi'
import { useSession } from '../stores/session'

type State = { kind: 'loading' } | { kind: 'error'; message: string }

// Tạo Guest Session thật trên máy chủ rồi chuyển vào game.
export default function GuestEntry() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const nav = useNavigate()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    const run = async () => {
      // Đã đăng nhập thì vào thẳng game bằng tài khoản, không tạo phiên khách thừa.
      await useSession.getState().load()
      if (useSession.getState().role === 'student' || useSession.getState().role === 'admin') return
      await guestApi.start()
    }
    run()
      .then(() => !cancelled && nav('/choi', { replace: true }))
      .catch((e) => !cancelled && setState({ kind: 'error', message: e instanceof ApiError ? e.message : 'Đã có lỗi xảy ra.' }))
    return () => { cancelled = true }
  }, [attempt])

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-navy to-purple px-4">
      <div className="w-full max-w-md rounded-2xl bg-paper p-8 text-center shadow-2xl">
        <div className="flex justify-center"><Logo /></div>
        {state.kind === 'loading' && (
          <p className="mt-8 flex items-center justify-center gap-2 text-navy" role="status">
            <Loader2 className="animate-spin" size={18} aria-hidden /> Đang tạo phiên chơi thử…
          </p>
        )}
        {state.kind === 'error' && (
          <div className="mt-8" role="alert">
            <p className="flex items-start justify-center gap-2 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {state.message}
            </p>
            <button onClick={() => setAttempt((n) => n + 1)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple">
              <RotateCw size={15} aria-hidden /> Thử lại
            </button>
          </div>
        )}
        <Link to="/" className="mt-6 inline-block text-sm text-ink/60 hover:text-navy">← Về trang chủ</Link>
      </div>
    </div>
  )
}
