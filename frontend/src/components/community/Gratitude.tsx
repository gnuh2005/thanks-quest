import { useEffect, useState } from 'react'
import { AlertTriangle, Flag, Loader2, Send, Sparkles, UserPlus } from 'lucide-react'
import { Btn, Modal } from '../ui/Modal'
import { gratitudeApi } from '../../services/gameApi'
import { ApiError } from '../../services/api'
import { useGame } from '../../stores/game'
import { EventBus } from '../../game/events/EventBus'
import type { GratitudeGenerated, GratitudeItem } from '../../types/api'

export const STYLES: { id: GratitudeItem['style']; label: string; cls: string }[] = [
  { id: 'classic', label: 'Cổ điển', cls: 'bg-[#fff7e0] text-[#3a2f22] border-[#d9b87c]' },
  { id: 'sunrise', label: 'Bình minh', cls: 'bg-linear-to-br from-[#ffd9a8] to-[#ffb3c7] text-[#4a2230] border-[#ff9aa8]' },
  { id: 'night', label: 'Đêm sao', cls: 'bg-linear-to-br from-[#251b46] to-[#101426] text-[#f5e3b0] border-gold' },
  { id: 'garden', label: 'Khu vườn', cls: 'bg-linear-to-br from-[#d9f2dc] to-[#bfe6cf] text-[#1f4a35] border-[#58b07a]' },
]

export function GratitudeCard({ item, footer }: { item: Pick<GratitudeItem, 'title' | 'body' | 'recipient' | 'style' | 'authorName'> & { createdAt?: string }; footer?: React.ReactNode }) {
  const s = STYLES.find((x) => x.id === item.style) ?? STYLES[0]!
  return (
    <article className={`flex h-full flex-col rounded-2xl border-2 p-5 shadow-md ${s.cls}`} data-testid="gratitude-card">
      {item.recipient && <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Gửi {item.recipient}</p>}
      <h3 className="mt-1 text-lg font-extrabold leading-snug">{item.title}</h3>
      <p className="mt-2 flex-1 whitespace-pre-line text-[15px] leading-relaxed">{item.body}</p>
      <p className="mt-4 text-xs font-medium opacity-75">— {item.authorName}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString('vi-VN')}` : ''}</p>
      {footer}
    </article>
  )
}

// ───────────────────────── Tường tri ân ─────────────────────────
export function WallList({ canReport, onNeedAccount, pageSize = 6 }: { canReport: boolean; onNeedAccount?: (reason: string) => void; pageSize?: number }) {
  const [items, setItems] = useState<GratitudeItem[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [reporting, setReporting] = useState<GratitudeItem | null>(null)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let off = false
    setItems(null)
    gratitudeApi.list(page, pageSize)
      .then((r) => { if (!off) { setItems(r.items); setTotal(r.total) } })
      .catch((e) => !off && setError(e instanceof ApiError ? e.message : 'Không tải được tường tri ân'))
    return () => { off = true }
  }, [page, pageSize])

  const sendReport = async () => {
    if (!reporting) return
    try {
      await gratitudeApi.report(reporting.id, reason)
      setNote('Cảm ơn bạn. Báo cáo đã được gửi tới quản trị viên.')
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : 'Không gửi được báo cáo')
    }
    setReporting(null)
    setReason('')
  }

  if (error) return <p className="text-sm text-red-300" role="alert">{error}</p>
  if (!items) return <p className="py-8 text-center text-sm opacity-70" role="status">Đang tải…</p>
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div data-testid="wall">
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-current/30 p-8 text-center text-sm opacity-75" data-testid="wall-empty">Chưa có thông điệp nào được duyệt. Hãy là người đầu tiên gửi lời cảm ơn!</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => (
            <GratitudeCard key={m.id} item={m} footer={
              <button
                onClick={() => (canReport ? setReporting(m) : onNeedAccount?.('Đăng nhập để báo cáo nội dung không phù hợp.'))}
                className="mt-3 inline-flex items-center gap-1 self-end text-[11px] opacity-60 hover:opacity-100" aria-label={`Báo cáo "${m.title}"`}
              ><Flag size={12} aria-hidden /> Báo cáo</button>
            } />
          ))}
        </div>
      )}
      {note && <p className="mt-3 text-sm text-cyan" role="status">{note}</p>}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <Btn kind="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Trước</Btn>
          <span className="opacity-70">Trang {page}/{pages}</span>
          <Btn kind="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau ›</Btn>
        </div>
      )}
      {reporting && (
        <Modal title="Báo cáo nội dung" onClose={() => setReporting(null)}
          footer={<div className="flex justify-end gap-2"><Btn kind="ghost" onClick={() => setReporting(null)}>Hủy</Btn><Btn onClick={sendReport} disabled={reason.trim().length < 3}>Gửi báo cáo</Btn></div>}>
          <p className="mb-2 text-sm text-white/75">Bạn báo cáo: <b>{reporting.title}</b></p>
          <label className="text-sm text-white/80" htmlFor="rp-reason">Lý do</label>
          <textarea id="rp-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3}
            className="mt-1 w-full rounded-lg border border-white/20 bg-black/30 p-2.5 text-sm text-white outline-none focus:border-electric" />
        </Modal>
      )}
    </div>
  )
}

export function WallOverlay({ guest }: { guest: boolean }) {
  const { closeOverlay, requireAccount } = useGame()
  return (
    <Modal title="Tường tri ân" onClose={closeOverlay} wide>
      <div className="text-white [&_article]:text-left">
        <WallList canReport={!guest} onNeedAccount={requireAccount} pageSize={4} />
      </div>
    </Modal>
  )
}

// ───────────────────────── Bàn viết lời tri ân ─────────────────────────
const field = 'mt-1 w-full rounded-xl border border-white/15 bg-[#0b1020]/80 px-3.5 py-3 text-sm leading-relaxed text-white shadow-inner shadow-black/20 outline-none transition placeholder:text-white/35 focus:border-gold/80 focus:ring-2 focus:ring-gold/20'

export function GratitudeDesk({ guest }: { guest: boolean }) {
  const { closeOverlay, commit, requireAccount, toast, setGratitudeGenerated } = useGame()
  const [step, setStep] = useState<'form' | 'edit'>('form')
  const [form, setForm] = useState({ recipient: '', memory: '', learned: '', thanks: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [gen, setGen] = useState<GratitudeGenerated | null>(null)
  const [version, setVersion] = useState<'short' | 'formal' | 'emotional'>('emotional')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [style, setStyle] = useState<GratitudeItem['style']>('classic')
  const [confirm, setConfirm] = useState(false)
  const [edited, setEdited] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const generate = async () => {
    setBusy(true)
    setErr(null)
    try {
      const res = await gratitudeApi.generate(form)
      commit(res)
      const g = res.outcome.generated
      setGen(g)
      setTitle(g.title)
      setBody(g.versions.emotional)
      setVersion('emotional')
      setEdited(false)
      setStep('edit')
      setGratitudeGenerated(true)
      EventBus.emit('player:action', 'celebrate')
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Không tạo được lời tri ân')
    } finally {
      setBusy(false)
    }
  }

  const pickVersion = (v: typeof version) => {
    if (edited && !window.confirm('Bạn đã chỉnh sửa nội dung. Đổi phiên bản sẽ thay thế nội dung hiện tại. Tiếp tục?')) return
    setVersion(v)
    setBody(gen!.versions[v])
    setEdited(false)
  }

  const publish = async () => {
    setBusy(true)
    setErr(null)
    try {
      const res = await gratitudeApi.create({ title, body, recipient: form.recipient, style, aiAssisted: !!gen, confirmPublic: true })
      commit(res)
      toast({ kind: 'info', title: 'Đã gửi lời tri ân', text: res.outcome.note ?? 'Đang chờ kiểm duyệt trước khi hiển thị công khai.' })
      closeOverlay()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ACCOUNT_REQUIRED') requireAccount(e.message)
      else setErr(e instanceof ApiError ? e.message : 'Không gửi được')
    } finally {
      setBusy(false)
    }
  }

  const ready = [form.memory, form.learned, form.thanks, form.message].some((s) => s.trim())

  return (
    <Modal title="Bàn viết lời tri ân" onClose={closeOverlay} wide>
      {step === 'form' && (
        <form onSubmit={(e) => { e.preventDefault(); void generate() }} onKeyDown={(e) => e.stopPropagation()} className="space-y-4" data-testid="gratitude-form">
          <div className="mb-5 rounded-2xl border border-gold/25 bg-linear-to-br from-gold/10 via-white/3 to-purple/20 p-4 sm:p-5">
            <p className="text-base font-bold text-gold">Một lời chân thành có thể ở lại rất lâu</p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/75">Hãy kể bằng lời của bạn. Trợ lý chỉ sắp xếp lại <b className="text-white">đúng những gì bạn viết</b> — không bịa thêm kỷ niệm hay sự kiện.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-white/90">Gửi đến (thầy/cô)<input className={field} value={form.recipient} onChange={set('recipient')} maxLength={60} placeholder="Ví dụ: cô Giang, cô Như…" /></label>
            <label className="text-sm font-semibold text-white/90 sm:col-span-2">Kỷ niệm với thầy cô<textarea className={field} rows={3} value={form.memory} onChange={set('memory')} maxLength={1200} placeholder="Một khoảnh khắc em vẫn nhớ…" data-testid="g-memory" /></label>
            <label className="text-sm font-semibold text-white/90">Điều em đã học được<textarea className={field} rows={3} value={form.learned} onChange={set('learned')} maxLength={1200} placeholder="Kiến thức hay bài học em mang theo…" /></label>
            <label className="text-sm font-semibold text-white/90">Điều em muốn cảm ơn<textarea className={field} rows={3} value={form.thanks} onChange={set('thanks')} maxLength={1200} placeholder="Điều em trân trọng nhất…" data-testid="g-thanks" /></label>
            <label className="text-sm font-semibold text-white/90 sm:col-span-2">Thông điệp muốn gửi<textarea className={field} rows={3} value={form.message} onChange={set('message')} maxLength={1200} placeholder="Viết lời nhắn em muốn thầy cô đọc…" /></label>
          </div>
          {err && <p role="alert" className="mt-3 text-sm text-red-300">{err}</p>}
          <div className="mt-5 flex justify-end">
            <Btn type="submit" disabled={busy || !ready} testId="g-generate">{busy ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} Tạo lời tri ân</Btn>
          </div>
        </form>
      )}

      {step === 'edit' && gen && (
        <div data-testid="gratitude-edit">
          <p className={`mb-3 flex items-start gap-2 rounded-lg p-2.5 text-xs ${gen.source === 'template' ? 'bg-white/5 text-white/65' : 'bg-cyan/10 text-cyan'}`} data-testid="g-source" data-source={gen.source}>
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            {gen.source === 'template'
              ? gen.degraded ? 'Trí tuệ nhân tạo tạm thời không phản hồi nên hệ thống dùng bản mẫu dựng từ nội dung bạn nhập.' : 'Chế độ mẫu (chưa cấu hình trí tuệ nhân tạo): nội dung được dựng từ chính điều bạn đã nhập.'
              : `Được hỗ trợ bởi ${gen.source === 'gemini' ? 'Google Gemini' : 'Groq'}. Hãy đọc lại và sửa cho đúng với kỷ niệm của bạn.`}
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Phiên bản">
            {([['short', 'Ngắn gọn'], ['formal', 'Trang trọng'], ['emotional', 'Cảm xúc']] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={version === k} onClick={() => pickVersion(k)} className={`rounded-full border px-3 py-1 text-xs ${version === k ? 'border-gold bg-gold/15 text-gold' : 'border-white/20 text-white/70'}`}>{l}</button>
            ))}
          </div>
          <label className="text-sm">Tiêu đề<input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} data-testid="g-title" /></label>
          {gen.titleSuggestions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">{gen.titleSuggestions.map((t) => <button key={t} onClick={() => setTitle(t)} className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] hover:bg-white/20">{t}</button>)}</div>
          )}
          <label className="mt-3 block text-sm">Nội dung (bạn có thể chỉnh sửa)
            <textarea className={field} rows={8} value={body} onChange={(e) => { setBody(e.target.value); setEdited(true) }} maxLength={1500} data-testid="g-body" />
          </label>
          <div className="mt-3">
            <p className="mb-1.5 text-sm">Phong cách thiệp</p>
            <div className="flex flex-wrap gap-2">{STYLES.map((s) => (
              <button key={s.id} onClick={() => setStyle(s.id)} aria-pressed={style === s.id} className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold ${s.cls} ${style === s.id ? 'ring-2 ring-gold ring-offset-2 ring-offset-navy' : 'opacity-80'}`}>{s.label}</button>
            ))}</div>
          </div>
          <div className="mt-4"><p className="mb-1.5 text-sm text-white/70">Xem trước</p>
            <GratitudeCard item={{ title: title || '(chưa có tiêu đề)', body, recipient: form.recipient, style, authorName: guest ? 'Khách (xem trước)' : 'Bạn' }} />
          </div>

          {err && <p role="alert" className="mt-3 text-sm text-red-300">{err}</p>}
          {guest ? (
            <div className="mt-4 rounded-xl border border-gold/40 bg-gold/10 p-3" data-testid="g-guest-note">
              <p className="text-sm text-gold">Đây là bản xem trước. Chế độ chơi thử không thể đăng công khai.</p>
              <Btn className="mt-2" onClick={() => requireAccount('Tạo tài khoản để đăng lời tri ân lên Tường tri ân.')}><UserPlus size={15} /> Đăng ký để đăng</Btn>
            </div>
          ) : (
            <div className="mt-4">
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} data-testid="g-confirm" />
                <span>Tôi đã đọc lại nội dung và đồng ý gửi để hiển thị công khai sau khi được quản trị viên duyệt.</span></label>
              <div className="mt-3 flex justify-between gap-2">
                <Btn kind="ghost" onClick={() => setStep('form')}>‹ Quay lại</Btn>
                <Btn onClick={publish} disabled={busy || !confirm || title.trim().length < 2 || body.trim().length < 10} testId="g-publish">{busy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Gửi lên Tường tri ân</Btn>
              </div>
            </div>
          )}
          {guest && <div className="mt-3"><Btn kind="ghost" onClick={() => setStep('form')}>‹ Quay lại</Btn></div>}
        </div>
      )}
    </Modal>
  )
}