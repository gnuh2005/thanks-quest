import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowRight, Compass, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { Logo } from '../components/Logo'
import { ApiError } from '../services/api'
import { authApi, guestApi } from '../services/gameApi'
import { useSession } from '../stores/session'

const loginSchema = z.object({
  email: z.string().email('Địa chỉ thư điện tử không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
})

const registerSchema = loginSchema
  .extend({
    displayName: z.string().trim().min(2, 'Tên hiển thị tối thiểu 2 ký tự').max(40, 'Tối đa 40 ký tự'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Mật khẩu nhập lại không khớp' })

type FormValues = { email: string; password: string; displayName?: string; confirm?: string }

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-navy/90">{label}</span>
      <div className="mt-1">{children}</div>
      {error && <span role="alert" className="mt-1.5 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-sm text-navy shadow-sm shadow-navy/[0.03] outline-none transition duration-200 placeholder:text-ink/35 hover:border-navy/30 focus:border-electric focus:ring-4 focus:ring-electric/15'

export default function Auth({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const nav = useNavigate()
  const setUser = useSession((x) => x.setUser)
  const wantsGame = new URLSearchParams(location.search).get('tiep') === 'choi'
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(isRegister ? registerSchema : loginSchema) as never })

  const onSubmit = async (v: FormValues) => {
    setServerError(null)
    try {
      const { user } = isRegister
        ? await authApi.register({ email: v.email, password: v.password, displayName: v.displayName ?? '' })
        : await authApi.login({ email: v.email, password: v.password })
      setUser(user)
      // Nếu đang có phiên khách, chuyển tiến độ (máy chủ chống nhận thưởng trùng). Không có phiên → bỏ qua.
      try {
        const r = await guestApi.convert()
        if (r.outcome.conversion) sessionStorage.setItem('tq_conv', JSON.stringify(r.outcome.conversion))
      } catch { /* không có phiên khách hợp lệ */ }
      nav(user.role === 'admin' && !wantsGame ? '/quan-tri' : '/choi')
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : 'Đã có lỗi xảy ra.')
    }
  }

  return (
    <div className="relative isolate grid min-h-screen overflow-hidden place-items-center bg-[#0b1020] px-4 py-8 sm:py-12">
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-electric/20 blur-[100px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-purple/80 blur-[110px]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />

      <motion.main
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/15 bg-paper shadow-[0_30px_100px_-30px_rgba(0,0,0,0.75)] md:grid-cols-[0.9fr_1.1fr]"
      >
        <aside className="relative hidden min-h-[610px] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#17233f] via-navy to-purple p-10 text-white md:flex">
          <div aria-hidden className="absolute -right-20 top-24 h-64 w-64 rounded-full border border-cyan/20" />
          <div aria-hidden className="absolute -right-8 top-36 h-40 w-40 rounded-full border border-gold/20" />
          <div aria-hidden className="absolute bottom-24 right-12 h-28 w-28 rounded-3xl border border-white/10 bg-white/[0.04] rotate-12" />
          <Link to="/" aria-label="Về trang chủ" className="relative z-10 w-fit"><Logo light /></Link>
          <div className="relative z-10 my-auto max-w-sm py-12">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold">
              <Sparkles size={14} /> Hành trình tri thức và lòng biết ơn
            </div>
            <h2 className="text-4xl font-extrabold leading-tight">Mỗi bước tiến<br /><span className="text-gold">đều đáng nhớ.</span></h2>
            <p className="mt-4 text-sm leading-relaxed text-white/65">
              Lưu lại những thử thách đã vượt qua, gặp gỡ người dẫn đường và gửi lời tri ân đến thầy cô.
            </p>
            <div className="mt-8 space-y-3 text-sm text-white/80">
              <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan/10 text-cyan"><Compass size={17} /></span>Khám phá thế giới học đường</div>
              <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gold/10 text-gold"><ShieldCheck size={17} /></span>Tiến độ được lưu an toàn</div>
            </div>
          </div>
          <p className="relative z-10 text-xs text-white/40">Hành trình tri ân · Học hỏi, khám phá, sẻ chia</p>
        </aside>

        <section className="p-6 sm:p-10 md:p-12">
          <Link to="/" aria-label="Về trang chủ" className="mb-7 inline-flex md:hidden"><Logo /></Link>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-electric">{isRegister ? 'Bắt đầu hành trình' : 'Chào mừng trở lại'}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-navy">{isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink/65">
            {isRegister ? 'Lưu tiến độ và tham gia bảng xếp hạng.' : 'Tiếp tục hành trình của bạn.'}
          </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-5" noValidate>
          {isRegister && (
            <Field label="Tên hiển thị" error={errors.displayName?.message}>
              <input className={inputCls} autoComplete="nickname" {...register('displayName')} />
            </Field>
          )}
          <Field label="Địa chỉ thư điện tử" error={errors.email?.message}>
            <input type="email" className={inputCls} autoComplete="email" {...register('email')} />
          </Field>
          <Field label="Mật khẩu" error={errors.password?.message}>
            <input type="password" className={inputCls} autoComplete={isRegister ? 'new-password' : 'current-password'} {...register('password')} />
          </Field>
          {isRegister && (
            <Field label="Nhập lại mật khẩu" error={errors.confirm?.message}>
              <input type="password" className={inputCls} autoComplete="new-password" {...register('confirm')} />
            </Field>
          )}

          {serverError && (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {serverError}
            </p>
          )}

          <button
            type="submit" disabled={isSubmitting}
            className="group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-navy to-purple py-3.5 font-bold text-white shadow-lg shadow-purple/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden />}
            {isRegister ? 'Đăng ký' : 'Đăng nhập'}
            {!isSubmitting && <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" aria-hidden />}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3 border-t border-navy/10 pt-5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <Link to={isRegister ? '/dang-nhap' : '/dang-ky'} className="font-semibold text-electric transition hover:text-navy hover:underline">
            {isRegister ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
          </Link>
          <Link to="/choi-thu" className="text-ink/60 transition hover:text-navy">Chơi thử không cần đăng ký</Link>
        </div>
        </section>
      </motion.main>
    </div>
  )
}
