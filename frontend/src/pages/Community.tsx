import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { PageShell } from '../components/PageShell'
import { LeaderboardTable } from '../components/community/Leaderboard'
import { GratitudeCard, WallList } from '../components/community/Gratitude'
import { gratitudeApi } from '../services/gameApi'
import { ApiError } from '../services/api'
import { useSession } from '../stores/session'
import type { GratitudeItem } from '../types/api'

export function LeaderboardPage() {
  return (
    <PageShell title="Bảng xếp hạng" sub="Chỉ tài khoản chính thức được xếp hạng. Điểm kinh nghiệm do máy chủ xác minh, không thể tự khai báo.">
      <LeaderboardTable limit={15} />
    </PageShell>
  )
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Đang chờ duyệt', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Đã hiển thị', cls: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Chưa được duyệt', cls: 'bg-red-100 text-red-800' },
}

function MyMessages() {
  const [items, setItems] = useState<GratitudeItem[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(() => {
    gratitudeApi.mine().then((r) => setItems(r.items)).catch((e) => setErr(e instanceof ApiError ? e.message : 'Không tải được'))
  }, [])
  useEffect(load, [load])
  if (err) return <p className="text-sm text-red-600" role="alert">{err}</p>
  if (!items || items.length === 0) return <p className="text-sm text-ink/60" data-testid="mine-empty">Bạn chưa gửi lời cảm ơn nào. Hãy vào game và tới Hội trường Tri ân để viết nhé.</p>
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="mine">
      {items.map((m) => (
        <GratitudeCard key={m.id} item={m} footer={
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS[m.status ?? 'pending']!.cls}`}>{STATUS[m.status ?? 'pending']!.label}</span>
            {m.moderationReason && <span className="text-[11px] opacity-70">{m.moderationReason}</span>}
            <button aria-label="Xóa lời cảm ơn" onClick={async () => { if (window.confirm('Xóa lời cảm ơn này?')) { await gratitudeApi.remove(m.id); load() } }} className="opacity-60 hover:opacity-100"><Trash2 size={14} /></button>
          </div>
        } />
      ))}
    </div>
  )
}

export function WallPage() {
  const { role } = useSession()
  const loggedIn = role === 'student' || role === 'admin'
  return (
    <PageShell title="Tường tri ân" sub="Những lời cảm ơn dành cho thầy cô. Mọi thông điệp đều được kiểm duyệt trước khi hiển thị.">
      <div className="text-navy"><WallList canReport={loggedIn} pageSize={9} onNeedAccount={() => { location.href = '/dang-nhap' }} /></div>
      <h2 className="mb-4 mt-14 text-xl font-extrabold text-navy">Lời cảm ơn của tôi</h2>
      {loggedIn ? <MyMessages /> : (
        <p className="text-sm text-ink/70"><Link to="/dang-nhap" className="font-semibold text-electric hover:underline">Đăng nhập</Link> để gửi và theo dõi lời cảm ơn của bạn. Khách chỉ có thể xem.</p>
      )}
    </PageShell>
  )
}
