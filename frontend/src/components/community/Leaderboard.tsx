import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { boardApi } from '../../services/gameApi'
import { ApiError } from '../../services/api'
import type { LeaderPage } from '../../types/api'

const TABS = [['all', 'Mọi thời đại'], ['weekly', 'Tuần này'], ['daily', 'Hôm nay']] as const

/** Bảng xếp hạng lấy từ máy chủ (MongoDB Aggregation). Chỉ gồm tài khoản chính thức. */
export function LeaderboardTable({ limit = 10, compact = false }: { limit?: number; compact?: boolean }) {
  const [period, setPeriod] = useState<'all' | 'weekly' | 'daily'>('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<LeaderPage | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let off = false
    setData(null)
    setError(null)
    boardApi.get(period, page, limit)
      .then((d) => !off && setData(d))
      .catch((e) => !off && setError(e instanceof ApiError ? e.message : 'Không tải được bảng xếp hạng'))
    return () => { off = true }
  }, [period, page, limit])

  const pages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1
  return (
    <div data-testid="leaderboard">
      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Khoảng thời gian">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={period === k} onClick={() => { setPeriod(k); setPage(1) }}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${period === k ? 'border-navy bg-navy text-white' : 'border-navy/20 bg-white text-navy hover:bg-navy/5'}`}>{l}</button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {!data && !error && <p className="py-6 text-center text-sm text-ink/60" role="status">Đang tải…</p>}
      {data && data.rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-navy/25 bg-white p-8 text-center" data-testid="lb-empty">
          <Trophy className="mx-auto text-gold" size={30} aria-hidden />
          <p className="mt-2 font-semibold text-navy">Chưa có người chơi nào trong bảng này.</p>
          <p className="text-sm text-ink/60">Đăng ký tài khoản và chơi để là người đầu tiên!</p>
        </div>
      )}
      {data && data.rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-navy/10 bg-white">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-navy/5 text-xs uppercase tracking-wider text-ink/60">
              <tr><th className="px-4 py-2.5">Hạng</th><th className="px-2">Người chơi</th><th className="px-2">Cấp</th><th className="px-2">{period === 'all' ? 'Tổng điểm kinh nghiệm' : 'Điểm kinh nghiệm nhận được'}</th>{!compact && <><th className="px-2">Nhiệm vụ</th><th className="px-2">Trò chơi nhỏ</th></>}</tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.userId} className="border-t border-navy/10" data-testid="lb-row">
                  <td className="px-4 py-2.5 font-extrabold text-navy">{r.rank <= 3 ? <span className={r.rank === 1 ? 'text-gold' : r.rank === 2 ? 'text-slate-400' : 'text-amber-700'}>#{r.rank}</span> : `#${r.rank}`}</td>
                  <td className="px-2 font-semibold">{r.displayName}</td>
                  <td className="px-2">Cấp {r.level}</td>
                  <td className="px-2 tabular-nums">{period === 'all' ? r.xp : r.xpGained ?? 0}</td>
                  {!compact && <><td className="px-2 tabular-nums">{r.questsClaimed}</td><td className="px-2 tabular-nums">{r.minigamesPassed}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data?.me && <p className="mt-3 text-sm text-navy" data-testid="lb-me">Hạng của bạn: <b>#{data.me.rank}</b> · {data.me.xp} điểm kinh nghiệm</p>}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3 text-sm">
          <button className="rounded-lg border border-navy/20 px-3 py-1.5 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Trước</button>
          <span className="text-ink/60">Trang {page}/{pages}</span>
          <button className="rounded-lg border border-navy/20 px-3 py-1.5 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau ›</button>
        </div>
      )}
    </div>
  )
}
