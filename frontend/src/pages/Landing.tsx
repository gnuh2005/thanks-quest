import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen, Code2, Flower2, Landmark, Heart, Compass, ScrollText, Gamepad2,
  Brain, Bug, Search, Sparkles, Menu, X, Play, LogIn,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { WorldPreview } from '../components/WorldPreview'
import { LeaderboardTable } from '../components/community/Leaderboard'
import { WallList } from '../components/community/Gratitude'
import { useSession } from '../stores/session'
import { vi } from '../i18n'

const NAV = [
  { href: '#gioi-thieu', label: 'Giới thiệu' },
  { href: '#the-gioi', label: 'Thế giới' },
  { href: '#mini-games', label: 'Trò chơi nhỏ' },
  { href: '#nhiem-vu', label: 'Nhiệm vụ' },
  { href: '#xep-hang', label: 'Xếp hạng' },
  { href: '#tri-an', label: 'Tri ân' },
]

const AREAS = [
  { icon: Compass, name: 'Knowledge Plaza', desc: 'Điểm xuất phát. Làm quen điều khiển và gặp Professor Guide.', color: 'text-electric' },
  { icon: BookOpen, name: 'Library of Wisdom', desc: 'Quiz kiến thức, ghép thẻ trí nhớ, thu thập mảnh tri thức.', color: 'text-cyan' },
  { icon: Code2, name: 'Technology Lab', desc: 'Tìm và sửa lỗi code cùng Coding Mentor.', color: 'text-electric' },
  { icon: Flower2, name: 'Creative Garden', desc: 'Săn vật phẩm ẩn và giải câu đố sáng tạo.', color: 'text-cyan' },
  { icon: Landmark, name: 'Memory Courtyard', desc: 'Đọc câu chuyện ký ức và khám phá vật phẩm đặc biệt.', color: 'text-electric' },
  { icon: Heart, name: 'Gratitude Hall', desc: 'Mở khóa sau hành trình để viết lời tri ân thầy cô.', color: 'text-gold' },
]

const GAMES = [
  { icon: Brain, name: 'Knowledge Quiz', desc: 'Trắc nghiệm có đếm giờ, giải thích đáp án.' },
  { icon: Gamepad2, name: 'Memory Matching', desc: 'Lật thẻ, tìm cặp, tính lượt và thời gian.' },
  { icon: Bug, name: 'Code Debugging', desc: 'Sửa lỗi cú pháp, điều kiện, vòng lặp.' },
  { icon: Search, name: 'Treasure Hunt', desc: 'Tìm vật phẩm ẩn, ghép mảnh, mở khóa phần thưởng.' },
]

const QUEST_TYPES = ['Main Quest', 'Side Quest', 'Daily Quest', 'Achievement', 'Special Event']

function Header() {
  const [open, setOpen] = useState(false)
  const { role, user } = useSession()
  const account = role === 'student' || role === 'admin'
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <a href="#top" aria-label="Hành trình tri ân — về đầu trang"><Logo light /></a>
        <nav className="hidden items-center gap-6 md:flex" aria-label="Điều hướng chính">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="whitespace-nowrap text-[15px] font-semibold text-white/85 transition hover:text-white">{vi(n.label)}</a>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {account ? (
            <>
              <span className="text-sm text-white/70">{user?.displayName}</span>
              <Link to="/choi" className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy transition hover:brightness-105">Vào game</Link>
            </>
          ) : (
            <>
              <Link to="/dang-nhap" className="inline-flex items-center gap-1.5 text-sm text-white/85 hover:text-white">
                <LogIn size={16} aria-hidden /> Đăng nhập
              </Link>
              <Link to="/choi-thu" className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy transition hover:brightness-105">
                Chơi thử ngay
              </Link>
            </>
          )}
        </div>
        <button
          className="grid h-10 w-10 place-items-center rounded-lg text-white md:hidden"
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="border-t border-white/10 bg-navy px-4 pb-4 md:hidden">
          <nav className="flex flex-col py-2" aria-label="Điều hướng di động">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="py-3 text-base font-semibold text-white/90">{vi(n.label)}</a>
            ))}
          </nav>
          <div className="flex gap-3">
            <Link to="/choi-thu" className="flex-1 rounded-lg bg-gold py-2.5 text-center text-sm font-semibold text-navy">Chơi thử ngay</Link>
            <Link to="/dang-nhap" className="flex-1 rounded-lg border border-white/25 py-2.5 text-center text-sm text-white">Đăng nhập</Link>
          </div>
        </div>
      )}
    </header>
  )
}

function Hero() {
  const nav = useNavigate()
  return (
    <section id="top" className="relative overflow-hidden bg-gradient-to-b from-navy to-purple text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan/40 px-3 py-1 text-xs text-cyan">
            <Sparkles size={14} aria-hidden /> LẬP TRÌNH TRI ÂN 2026 · Tri ân bằng công nghệ
          </p>
          <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
            Hành trình tri thức <br />
            <span className="text-gold">bắt đầu từ lòng biết ơn</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-white/75">
            Hóa thân thành một sinh viên, khám phá thế giới 2D, vượt thử thách, rồi gửi lời cảm ơn đến người dẫn đường của bạn.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => nav('/choi-thu')}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 font-bold text-navy shadow-lg transition hover:brightness-105"
            >
              <Play size={18} fill="currentColor" aria-hidden /> Chơi thử ngay
            </button>
            <Link to="/dang-nhap" className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 font-semibold transition hover:bg-white/10">
              <LogIn size={18} aria-hidden /> Đăng nhập
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/55">Không cần đăng ký để trải nghiệm.</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }}
          className="overflow-hidden rounded-2xl pixel-border"
        >
          <WorldPreview className="block h-auto w-full" />
        </motion.div>
      </div>
    </section>
  )
}

function SectionTitle({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="mb-10 max-w-2xl">
      <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-electric">{kicker}</p>
      <h2 className="mt-3 text-3xl font-extrabold text-navy">{title}</h2>
      {sub && <p className="mt-3 text-ink/70">{sub}</p>}
    </div>
  )
}

function Intro() {
  return (
    <section id="gioi-thieu" className="mx-auto max-w-6xl px-4 py-20">
      <SectionTitle
        kicker="Giới thiệu"
        title="Một trò chơi để nhớ về người dẫn đường"
        sub="Mỗi hành trình tri thức đều có dấu ấn của người dẫn đường. Hành trình tri ân kết hợp phiêu lưu, kiến thức, lập trình và sáng tạo lời tri ân dành cho thầy cô."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Khám phá', 'Di chuyển trong thế giới 2D, trò chuyện với nhân vật, nhận nhiệm vụ.'],
          ['Thử thách', 'Bốn mini game thật: quiz, ghép thẻ, sửa lỗi code, săn kho báu.'],
          ['Tri ân', 'Trí tuệ nhân tạo hỗ trợ viết lời cảm ơn từ chính kỷ niệm của bạn, bạn luôn là người quyết định.'],
        ].map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-navy/10 bg-white p-6">
            <h3 className="font-bold text-navy">{t}</h3>
            <p className="mt-2 text-sm text-ink/70">{d}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function World() {
  return (
    <section id="the-gioi" className="bg-navy py-20 text-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 max-w-2xl">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-cyan">Thế giới game</p>
          <h2 className="mt-3 text-3xl font-extrabold">Sáu khu vực, mỗi nơi một câu chuyện</h2>
          <p className="mt-3 text-white/65">Không gian giả tưởng lấy cảm hứng từ đời sống đại học, được thiết kế riêng cho Hành trình tri ân.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AREAS.map((a, i) => (
            <motion.article
              key={a.name}
              initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <a.icon className={a.color} size={26} aria-hidden />
              <h3 className="mt-3 font-bold">{vi(a.name)}</h3>
              <p className="mt-1.5 text-sm text-white/65">{vi(a.desc)}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

function MiniGames() {
  return (
    <section id="mini-games" className="mx-auto max-w-6xl px-4 py-20">
      <SectionTitle kicker="Trò chơi nhỏ" title="Bốn thử thách có logic thật" sub="Kết quả được máy chủ chấm điểm, không thể tự sửa điểm từ trình duyệt." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GAMES.map((g) => (
          <div key={g.name} className="rounded-2xl border border-navy/10 bg-white p-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-electric/10 text-electric"><g.icon size={22} aria-hidden /></span>
            <h3 className="mt-4 font-bold text-navy">{vi(g.name)}</h3>
            <p className="mt-1.5 text-sm text-ink/70">{vi(g.desc)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Quests() {
  return (
    <section id="nhiem-vu" className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle kicker="Nhiệm vụ" title="Nhật ký hành trình" sub="Theo dõi mục tiêu, tiến độ và phần thưởng. Mỗi phần thưởng chỉ nhận được một lần." />
        <div className="flex flex-wrap items-center gap-3">
          <ScrollText className="text-electric" aria-hidden />
          {QUEST_TYPES.map((q) => (
            <span key={q} className="rounded-full border border-electric/30 bg-electric/5 px-4 py-1.5 text-sm font-medium text-navy">{vi(q)}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

function Leaderboard() {
  return (
    <section id="xep-hang" className="mx-auto max-w-6xl px-4 py-20">
      <SectionTitle kicker="Bảng xếp hạng" title="Vinh danh người chơi" sub="Chỉ tài khoản chính thức mới được xếp hạng. Người chơi thử có thể đăng ký để lưu hành trình." />
      <LeaderboardTable limit={5} compact />
      <Link to="/xep-hang" className="mt-4 inline-block text-sm font-semibold text-electric hover:underline">Xem toàn bộ bảng xếp hạng →</Link>
    </section>
  )
}

function Gratitude() {
  return (
    <section id="tri-an" className="bg-gradient-to-b from-purple to-navy py-20 text-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8 max-w-2xl">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-gold">Tường tri ân</p>
          <h2 className="mt-3 text-3xl font-extrabold">Những lời cảm ơn được lan tỏa</h2>
          <p className="mt-3 text-white/65">Mọi thông điệp đều được kiểm duyệt trước khi hiển thị công khai.</p>
        </div>
        <WallList canReport={false} pageSize={3} />
        <Link to="/tuong-tri-an" className="mt-6 inline-block text-sm font-semibold text-gold hover:underline">Xem toàn bộ tường tri ân →</Link>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 text-center">
      <h2 className="text-3xl font-extrabold text-navy">Sẵn sàng bắt đầu hành trình?</h2>
      <p className="mx-auto mt-3 max-w-xl text-ink/70">Chỉ mất 3–5 phút để thử. Đăng ký sau để lưu tiến độ và lên bảng xếp hạng.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/choi-thu" className="rounded-xl bg-navy px-7 py-3 font-bold text-white transition hover:bg-purple">Chơi thử ngay</Link>
        <Link to="/dang-ky" className="rounded-xl border border-navy/25 px-7 py-3 font-semibold text-navy transition hover:bg-navy/5">Đăng ký tài khoản</Link>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-navy py-10 text-white/70">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 md:flex-row md:items-center">
        <Logo light />
        <p className="max-w-md text-sm">Sản phẩm dự thi LẬP TRÌNH TRI ÂN 2026 — “Sáng tạo không giới hạn – Tri ân bằng công nghệ.” Nhân vật và thế giới trong trò chơi là hư cấu.</p>
      </div>
    </footer>
  )
}

export default function Landing() {
  return (
    <>
      <a href="#noi-dung" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-gold focus:p-2">Bỏ qua điều hướng</a>
      <Header />
      <main id="noi-dung">
        <Hero />
        <Intro />
        <World />
        <MiniGames />
        <Quests />
        <Leaderboard />
        <Gratitude />
        <CTA />
      </main>
      <Footer />
    </>
  )
}
