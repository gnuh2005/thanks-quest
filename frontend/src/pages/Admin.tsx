import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, patch, post, del, ApiError } from '../services/api'
import { useSession } from '../stores/session'
import { Logo } from '../components/Logo'
import { vi } from '../i18n'

type Tab = 'dashboard' | 'users' | 'gratitude' | 'reports' | 'content' | 'settings'
const TABS: [Tab, string][] = [
  ['dashboard', 'Tổng quan'], ['users', 'Người dùng'], ['gratitude', 'Kiểm duyệt tri ân'],
  ['reports', 'Báo cáo'], ['content', 'Nội dung game'], ['settings', 'Cài đặt'],
]
const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Đã có lỗi xảy ra')
const qs = (o: Record<string, string | number | undefined>) =>
  '?' + Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')

function Err({ text }: { text: string | null }) {
  return text ? <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{text}</p> : null
}
function Pager({ page, total, limit, set }: { page: number; total: number; limit: number; set: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit))
  return (
    <div className="mt-3 flex items-center justify-center gap-3 text-sm">
      <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => set(page - 1)}>‹</button>
      <span>Trang {page}/{pages} · {total} mục</span>
      <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={page >= pages} onClick={() => set(page + 1)}>›</button>
    </div>
  )
}

// ───────── Dashboard ─────────
interface Dash {
  rangeDays: number
  totals: { users: number; activePlayers: number; questsCompleted: number; minigamePlays: number; minigamePasses: number; gratitude: { pending: number; approved: number; rejected: number; total: number }; guestSessions: number; guestActive: number; guestConverted: number; reportsOpen: number }
  series: Record<'minigamePlays' | 'guestSessions' | 'newUsers', { _id: string; n: number }[]>
}
function Bars({ title, data }: { title: string; data: { _id: string; n: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.n))
  return (
    <figure className="rounded-xl border border-navy/10 bg-white p-4">
      <figcaption className="mb-2 text-sm font-semibold text-navy">{title}</figcaption>
      {data.length === 0 ? <p className="py-6 text-center text-xs text-ink/50">Chưa có dữ liệu trong khoảng này</p> : (
        <svg viewBox={`0 0 ${data.length * 24} 80`} className="h-28 w-full" role="img" aria-label={title}>
          {data.map((d, i) => (
            <g key={d._id}>
              <rect x={i * 24 + 4} y={70 - (d.n / max) * 64} width="16" height={(d.n / max) * 64} rx="2" fill="#4f8cff"><title>{`${d._id}: ${d.n}`}</title></rect>
              <text x={i * 24 + 12} y="79" fontSize="6" textAnchor="middle" fill="#64748b">{d._id.slice(5)}</text>
            </g>
          ))}
        </svg>
      )}
    </figure>
  )
}
function Dashboard() {
  const [days, setDays] = useState(7)
  const [d, setD] = useState<Dash | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    setD(null)
    api<Dash>(`/admin/dashboard${qs({ days })}`).then(setD).catch((e) => setErr(msg(e)))
  }, [days])
  const t = d?.totals
  const cards: [string, number | string | undefined][] = t ? [
    ['Tài khoản', t.users], ['Người chơi hoạt động', t.activePlayers], ['Nhiệm vụ hoàn thành', t.questsCompleted],
    ['Lượt trò chơi nhỏ', t.minigamePlays], ['Trò chơi nhỏ đạt', t.minigamePasses], ['Tri ân chờ duyệt', t.gratitude.pending],
    ['Tri ân đã duyệt', t.gratitude.approved], ['Phiên khách', t.guestSessions], ['Khách đang chơi', t.guestActive],
    ['Khách đã đăng ký', t.guestConverted], ['Báo cáo đang mở', t.reportsOpen],
  ] : []
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm">Khoảng thời gian:
        {[7, 14, 30].map((n) => <button key={n} onClick={() => setDays(n)} className={`rounded-full border px-3 py-1 ${days === n ? 'bg-navy text-white' : 'bg-white'}`}>{n} ngày</button>)}
      </div>
      <Err text={err} />
      {!d && !err && <p role="status">Đang tải…</p>}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="admin-stats">
            {cards.map(([l, v]) => (
              <div key={l} className="rounded-xl border border-navy/10 bg-white p-4"><p className="text-xs text-ink/60">{l}</p><p className="mt-1 text-2xl font-extrabold text-navy tabular-nums">{v}</p></div>
            ))}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Bars title="Lượt mini game theo ngày" data={d.series.minigamePlays} />
            <Bars title="Phiên khách theo ngày" data={d.series.guestSessions} />
            <Bars title="Tài khoản mới theo ngày" data={d.series.newUsers} />
          </div>
        </>
      )}
    </div>
  )
}

// ───────── Users ─────────
interface U { id: string; email: string; displayName: string; role: 'student' | 'admin'; disabled: boolean; isDemo: boolean; xp: number; level: number }
function Users({ me }: { me?: string }) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ items: U[]; total: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(() => {
    api<{ items: U[]; total: number }>(`/admin/users${qs({ q, page, limit: 15 })}`).then(setData).catch((e) => setErr(msg(e)))
  }, [q, page])
  useEffect(load, [load])
  const act = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); load() } catch (e) { setErr(msg(e)) } }
  return (
    <div>
      <input aria-label="Tìm người dùng" placeholder="Tìm theo email hoặc tên…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="mb-3 w-full max-w-sm rounded-lg border border-navy/20 px-3 py-2 text-sm" />
      <Err text={err} />
      <div className="overflow-x-auto rounded-xl border border-navy/10 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-navy/5 text-xs uppercase text-ink/60"><tr><th className="p-3">Tên</th><th>Địa chỉ thư điện tử</th><th>Vai trò</th><th>Cấp / điểm kinh nghiệm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {data?.items.map((u) => (
              <tr key={u.id} className="border-t border-navy/10">
                <td className="p-3 font-semibold">{u.displayName}{u.isDemo && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px]">mẫu</span>}</td>
                <td>{u.email}</td><td>{vi(u.role)}</td><td>Cấp {u.level} · {u.xp}</td>
                <td>{u.disabled ? <span className="text-red-600">Đã khóa</span> : 'Hoạt động'}</td>
                <td className="space-x-2 whitespace-nowrap">
                  <button disabled={u.id === me} className="rounded border px-2 py-1 text-xs disabled:opacity-40" onClick={() => act(() => patch(`/admin/users/${u.id}`, { disabled: !u.disabled }))}>{u.disabled ? 'Mở khóa' : 'Khóa'}</button>
                  <button className="rounded border px-2 py-1 text-xs" onClick={() => { if (window.confirm(`Đặt lại điểm kinh nghiệm/bảng xếp hạng của ${u.displayName}?`)) void act(() => post(`/admin/leaderboard/${u.id}/reset`, { confirm: true })) }}>Đặt lại điểm</button>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-ink/50">Không có người dùng</td></tr>}
          </tbody>
        </table>
      </div>
      {data && <Pager page={page} total={data.total} limit={15} set={setPage} />}
    </div>
  )
}

// ───────── Gratitude moderation ─────────
interface G { id: string; title: string; body: string; authorName: string; recipient?: string; status: string; reportCount?: number; moderation?: { reason?: string } }
function Gratitude() {
  const [status, setStatus] = useState('pending')
  const [data, setData] = useState<{ items: G[]; total: number } | null>(null)
  const [page, setPage] = useState(1)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(() => {
    api<{ items: G[]; total: number }>(`/admin/gratitude${qs({ status, page, limit: 10 })}`).then(setData).catch((e) => setErr(msg(e)))
  }, [status, page])
  useEffect(load, [load])
  const mod = async (id: string, action: 'approve' | 'reject' | 'delete') => {
    let reason: string | undefined
    if (action === 'reject') { reason = window.prompt('Lý do từ chối (hiển thị cho tác giả):') ?? undefined; if (reason === undefined) return }
    if (action === 'delete' && !window.confirm('Xóa vĩnh viễn thông điệp này?')) return
    setErr(null)
    try { await patch(`/admin/gratitude/${id}/moderate`, { action, reason }); load() } catch (e) { setErr(msg(e)) }
  }
  return (
    <div>
      <div className="mb-3 flex gap-2 text-sm">
        {[['pending', 'Chờ duyệt'], ['approved', 'Đã duyệt'], ['rejected', 'Đã từ chối']].map(([k, l]) => (
          <button key={k} onClick={() => { setStatus(k!); setPage(1) }} className={`rounded-full border px-3 py-1 ${status === k ? 'bg-navy text-white' : 'bg-white'}`}>{l}</button>
        ))}
      </div>
      <Err text={err} />
      <div className="space-y-3" data-testid="admin-gratitude">
        {data?.items.map((m) => (
          <article key={m.id} className="rounded-xl border border-navy/10 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><h3 className="font-bold text-navy">{m.title}</h3><p className="text-xs text-ink/60">{m.authorName} → {m.recipient || 'Thầy cô'}</p></div>
              <div className="flex gap-2">
                {m.status !== 'approved' && <button className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white" onClick={() => mod(m.id, 'approve')}>Duyệt</button>}
                {m.status !== 'rejected' && <button className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white" onClick={() => mod(m.id, 'reject')}>Từ chối</button>}
                <button className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white" onClick={() => mod(m.id, 'delete')}>Xóa</button>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
            {m.moderation?.reason && <p className="mt-1 text-xs text-ink/60">Lý do: {m.moderation.reason}</p>}
          </article>
        ))}
        {data && data.items.length === 0 && <p className="py-8 text-center text-sm text-ink/50">Không có thông điệp nào.</p>}
      </div>
      {data && <Pager page={page} total={data.total} limit={10} set={setPage} />}
    </div>
  )
}

// ───────── Reports ─────────
interface R { id: string; reason: string; status: string; messageId?: { title: string; body: string; authorName: string; status: string } | null }
function Reports() {
  const [status, setStatus] = useState('open')
  const [data, setData] = useState<{ items: R[] } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(() => { api<{ items: R[] }>(`/admin/reports${qs({ status })}`).then(setData).catch((e) => setErr(msg(e))) }, [status])
  useEffect(load, [load])
  const act = async (id: string, action: 'resolve' | 'dismiss', rejectMessage = false) => {
    setErr(null)
    try { await patch(`/admin/reports/${id}`, { action, rejectMessage }); load() } catch (e) { setErr(msg(e)) }
  }
  return (
    <div>
      <div className="mb-3 flex gap-2 text-sm">
        {[['open', 'Đang mở'], ['resolved', 'Đã xử lý'], ['dismissed', 'Đã bỏ qua']].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k!)} className={`rounded-full border px-3 py-1 ${status === k ? 'bg-navy text-white' : 'bg-white'}`}>{l}</button>
        ))}
      </div>
      <Err text={err} />
      <div className="space-y-3">
        {data?.items.map((r) => (
          <article key={r.id} className="rounded-xl border border-navy/10 bg-white p-4">
            <p className="text-sm"><b>Lý do báo cáo:</b> {r.reason}</p>
            {r.messageId ? <blockquote className="mt-2 border-l-4 border-gold pl-3 text-sm"><b>{r.messageId.title}</b> — {r.messageId.authorName}<br />{r.messageId.body}</blockquote> : <p className="mt-2 text-xs text-ink/50">Thông điệp đã bị xóa.</p>}
            {r.status === 'open' && (
              <div className="mt-3 flex gap-2">
                <button className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white" onClick={() => act(r.id, 'resolve', true)}>Gỡ thông điệp</button>
                <button className="rounded border px-3 py-1 text-xs" onClick={() => act(r.id, 'resolve')}>Đã xử lý</button>
                <button className="rounded border px-3 py-1 text-xs" onClick={() => act(r.id, 'dismiss')}>Bỏ qua</button>
              </div>
            )}
          </article>
        ))}
        {data && data.items.length === 0 && <p className="py-8 text-center text-sm text-ink/50">Không có báo cáo.</p>}
      </div>
    </div>
  )
}

// ───────── Content CRUD (7 collections) ─────────
const COLLS: [string, string, string][] = [
  ['quests', 'Nhiệm vụ', 'questId'], ['npcs', 'Nhân vật', 'npcId'], ['areas', 'Khu vực', 'areaId'], ['minigames', 'Trò chơi nhỏ', 'minigameId'],
  ['questions', 'Câu hỏi', 'qid'], ['items', 'Vật phẩm', 'itemId'], ['achievements', 'Thành tựu', 'achId'],
]
type Row = Record<string, unknown>
function Content() {
  const [coll, setColl] = useState(COLLS[0]![0])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ items: Row[]; total: number } | null>(null)
  const [editing, setEditing] = useState<{ id?: string; text: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const idField = COLLS.find((c) => c[0] === coll)![2]
  const [tick, setTick] = useState(0)
  const load = useCallback(() => setTick((t) => t + 1), [])
  useEffect(() => {
    let off = false
    setData(null)
    api<{ items: Row[]; total: number }>(`/admin/${coll}${qs({ q, page, limit: 10 })}`)
      .then((d) => { if (!off) setData(d) })
      .catch((e) => { if (!off) setErr(msg(e)) })
    return () => { off = true }
  }, [coll, q, page, tick])
  const strip = (r: Row) => { const c = { ...r }; for (const k of ['_id', '__v', 'createdAt', 'updatedAt', 'isSample']) delete c[k]; return c }
  const save = async () => {
    if (!editing) return
    setErr(null)
    let obj: Record<string, unknown>
    try { obj = JSON.parse(editing.text) } catch { return setErr('JSON không hợp lệ') }
    try {
      if (editing.id) await patch(`/admin/${coll}/${editing.id}`, obj)
      else await post(`/admin/${coll}`, obj)
      setEditing(null); load()
    } catch (e) { setErr(msg(e)) }
  }
  const remove = async (id: string) => {
    if (!window.confirm(`Xóa "${id}"? Hành động này không thể hoàn tác.`)) return
    try { await del(`/admin/${coll}/${id}`); load() } catch (e) { setErr(msg(e)) }
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2 text-sm" role="tablist">
        {COLLS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={coll === k} onClick={() => { setColl(k); setPage(1); setQ(''); setEditing(null) }} className={`rounded-full border px-3 py-1 ${coll === k ? 'bg-navy text-white' : 'bg-white'}`}>{l}</button>
        ))}
      </div>
      <div className="mb-3 flex gap-2">
        <input aria-label="Tìm nội dung" placeholder="Tìm…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="w-full max-w-xs rounded-lg border border-navy/20 px-3 py-2 text-sm" />
        <button className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white" onClick={() => setEditing({ text: JSON.stringify({ [idField]: '' }, null, 2) })}>+ Thêm mới</button>
      </div>
      <Err text={err} />
      {editing && (
        <div className="mb-4 rounded-xl border border-electric/40 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-navy">{editing.id ? `Sửa ${editing.id}` : 'Thêm mới'} (JSON — máy chủ kiểm tra hợp lệ)</p>
          <textarea aria-label="Dữ liệu JSON" value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} rows={14} className="w-full rounded-lg border border-navy/20 p-3 font-mono text-xs" spellCheck={false} />
          <div className="mt-2 flex gap-2"><button onClick={save} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Lưu</button><button onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2 text-sm">Hủy</button></div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-navy/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy/5 text-xs uppercase text-ink/60"><tr><th className="p-3">Mã</th><th>Tên / nội dung</th><th>Thao tác</th></tr></thead>
          <tbody>
            {data?.items.map((r) => {
              const id = String(r[idField])
              return (
                <tr key={id} className="border-t border-navy/10">
                  <td className="p-3 font-mono text-xs">{id}</td>
                  <td className="max-w-md truncate">{String(r.title ?? r.name ?? r.text ?? '')}</td>
                  <td className="space-x-2 whitespace-nowrap">
                    <button className="rounded border px-2 py-1 text-xs" onClick={() => setEditing({ id, text: JSON.stringify(strip(r), null, 2) })}>Sửa</button>
                    <button className="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={() => remove(id)}>Xóa</button>
                  </td>
                </tr>
              )
            })}
            {data && data.items.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-ink/50">Không có dữ liệu</td></tr>}
          </tbody>
        </table>
      </div>
      {data && <Pager page={page} total={data.total} limit={10} set={setPage} />}
    </div>
  )
}

// ───────── Settings ─────────
function Settings() {
  const [s, setS] = useState<Record<string, unknown> | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { api<Record<string, unknown>>('/admin/settings').then(setS).catch((e) => setErr(msg(e))) }, [])
  return (
    <div>
      <Err text={err} />
      <p className="mb-3 text-sm text-ink/70">Chỉ đọc. Khóa API và bí mật không bao giờ được hiển thị; cấu hình qua biến môi trường trên máy chủ.</p>
      {s && (
        <dl className="grid max-w-xl gap-2 rounded-xl border border-navy/10 bg-white p-4 text-sm">
          {Object.entries(s).map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-navy/5 pb-1"><dt className="font-mono text-xs text-ink/60">{k}</dt><dd className="font-semibold">{Array.isArray(v) ? v.join(', ') : String(v)}</dd></div>)}
        </dl>
      )}
    </div>
  )
}

export default function Admin() {
  const { status, role, user, logout } = useSession()
  const [tab, setTab] = useState<Tab>('dashboard')
  if (status === 'loading') return <div className="grid min-h-screen place-items-center" role="status">Đang tải…</div>
  if (role !== 'admin') return <Navigate to="/dang-nhap" replace />
  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/"><Logo light /></Link>
          <div className="flex items-center gap-4 text-sm"><span className="text-white/70">{user?.displayName} · Quản trị</span><button onClick={() => void logout().then(() => { location.href = '/' })} className="text-gold">Đăng xuất</button></div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4" aria-label="Quản trị" role="tablist">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm ${tab === k ? 'border-gold text-gold' : 'border-transparent text-white/70 hover:text-white'}`}>{l}</button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'users' && <Users me={user?.id} />}
        {tab === 'gratitude' && <Gratitude />}
        {tab === 'reports' && <Reports />}
        {tab === 'content' && <Content />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  )
}
