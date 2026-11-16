import { Link } from 'react-router-dom'
import { Award, BookOpen, Gift, LogIn, Package, ScrollText, Star, UserPlus } from 'lucide-react'
import { Btn, Modal } from '../ui/Modal'
import { useGame } from '../../stores/game'
import type { GuestSummary } from '../../services/gameApi'
import { vi } from '../../i18n'

/** Modal giải thích vì sao cần tài khoản (hiện khi Guest chọn chức năng yêu cầu tài khoản). */
export function SignupModal() {
  const { closeOverlay, signupReason } = useGame()
  return (
    <Modal title="Cần tài khoản để tiếp tục" onClose={closeOverlay}
      footer={<div className="flex flex-wrap justify-end gap-2"><Btn kind="ghost" onClick={closeOverlay}>Để sau</Btn>
        <Link to="/dang-nhap?tiep=choi" className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10" data-testid="signup-login"><LogIn size={15} /> Đăng nhập</Link>
        <Link to="/dang-ky?tiep=choi" className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy hover:brightness-105" data-testid="signup-register"><UserPlus size={15} /> Đăng ký miễn phí</Link></div>}>
      <p className="text-white/85" data-testid="signup-reason">{signupReason ?? 'Tạo tài khoản để lưu hành trình của bạn.'}</p>
      <ul className="mt-3 space-y-1.5 text-sm text-white/70">
        <li>• Tiến độ, điểm kinh nghiệm, vật phẩm và thành tựu hiện có sẽ được chuyển sang tài khoản — không cộng trùng.</li>
        <li>• Được xếp hạng chính thức và đăng lời tri ân lên Tường tri ân.</li>
        <li>• Không cần thông tin cá nhân nào ngoài email và mật khẩu.</li>
      </ul>
    </Modal>
  )
}

/** Màn hình kết quả hành trình (cũng là màn hình "Kết thúc" của chế độ chơi thử). */
export function SummaryPanel({ summary, guest }: { summary: GuestSummary | null; guest: boolean }) {
  const { state, closeOverlay, requireAccount } = useGame()
  if (!state) return null
  const s = summary ?? { xp: state.stats.xp, questsClaimed: state.stats.questsClaimed, minigamesPassed: state.stats.minigamesPassed, items: state.stats.itemsCollected, achievements: state.achievements.filter((a) => a.unlocked).length }
  const unlocked = state.achievements.filter((a) => a.unlocked)
  const campaignQuests = state.quests.filter((q) => q.type === 'main' || q.type === 'side')
  const journeyComplete = campaignQuests.length > 0 && campaignQuests.every((q) => q.status === 'claimed')
  const stat = (Icon: typeof Star, label: string, value: number, id: string) => (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
      <Icon className="mx-auto text-gold" size={20} aria-hidden />
      <p className="mt-1 text-2xl font-extrabold tabular-nums" data-testid={id}>{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-white/60">{label}</p>
    </div>
  )
  return (
    <Modal title={journeyComplete ? 'Hành trình tri ân khép lại' : guest ? 'Kết quả chuyến chơi thử' : 'Kết quả hành trình'} onClose={closeOverlay} wide>
      <div data-testid="summary">
        {journeyComplete && (
          <section className="relative mb-5 overflow-hidden rounded-2xl border border-gold/35 bg-gradient-to-br from-[#392654] via-[#1c2440] to-[#101426] p-5 shadow-xl shadow-black/20 sm:p-7" data-testid="journey-ending">
            <div aria-hidden className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-gold/15 blur-3xl" />
            <div className="relative flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-gold/40 bg-gold/10 text-gold shadow-lg shadow-gold/10"><Award size={25} /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold">Một chặng đường đáng nhớ</p>
                <h3 className="mt-2 text-xl font-extrabold leading-snug text-white sm:text-2xl">Em đã hoàn thành hành trình tri thức và tri ân</h3>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">Từng nhiệm vụ em hoàn thành đều bắt đầu từ sự tò mò và lớn lên nhờ lòng kiên trì. Nhưng món quà đẹp nhất em mang theo là những điều thầy cô đã trao — kiến thức, niềm tin và cảm hứng để tiếp tục bước tới.</p>
                <p className="mt-3 text-sm font-semibold text-gold">Cảm ơn em đã viết nên hành trình này. Hãy tiếp tục lan tỏa lòng biết ơn trên con đường phía trước.</p>
              </div>
            </div>
          </section>
        )}
        <p className="mb-4 text-white/80">Cấp {state.level.level} · {state.displayName}. Mỗi hành trình tri thức đều có dấu ấn của người dẫn đường.</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stat(Star, 'Tổng điểm kinh nghiệm', s.xp, 'sum-xp')}
          {stat(ScrollText, 'Nhiệm vụ xong', s.questsClaimed, 'sum-quests')}
          {stat(Package, 'Vật phẩm', s.items, 'sum-items')}
          {stat(BookOpen, 'Trò chơi nhỏ đã vượt qua', s.minigamesPassed, 'sum-games')}
        </div>
        <h3 className="mb-2 mt-5 flex items-center gap-2 text-sm font-bold"><Award size={16} className="text-gold" /> Thành tựu đã đạt ({unlocked.length}/{state.achievements.length})</h3>
        {unlocked.length === 0 ? <p className="text-sm text-white/55">Chưa có thành tựu nào — hãy tiếp tục khám phá!</p> : (
          <ul className="flex flex-wrap gap-2" data-testid="sum-achievements">{unlocked.map((a) => <li key={a.achId} className="rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">{vi(a.name)}</li>)}</ul>
        )}
        {guest && (
          <div className="mt-5 rounded-xl border border-gold/50 bg-gradient-to-br from-purple to-navy p-4" data-testid="sum-invite">
            <p className="flex items-center gap-2 font-bold text-gold"><Gift size={17} /> Giữ lại hành trình của bạn</p>
            <p className="mt-1 text-sm text-white/80">Đăng ký để lưu toàn bộ tiến độ này, vào bảng xếp hạng và gửi lời tri ân lên Tường tri ân. Không đăng ký vẫn có thể tiếp tục chơi thử đến khi phiên hết hạn.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn onClick={() => requireAccount('Đăng ký để lưu hành trình và tham gia bảng xếp hạng.')}><UserPlus size={15} /> Đăng ký để lưu tiến độ</Btn>
              <Btn kind="ghost" onClick={closeOverlay}>Tiếp tục khám phá</Btn>
            </div>
          </div>
        )}
        {!guest && <div className="mt-5 flex justify-end"><Btn onClick={closeOverlay}>Tiếp tục khám phá</Btn></div>}
      </div>
    </Modal>
  )
}

export function ReaderPanel({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <Modal title={vi(title)} onClose={onClose} footer={<div className="flex justify-end"><Btn onClick={onClose} testId="reader-close">Đã đọc</Btn></div>}>
      <p className="whitespace-pre-line leading-relaxed text-white/90" data-testid="reader-text">{vi(text || 'Không có nội dung.')}</p>
    </Modal>
  )
}
