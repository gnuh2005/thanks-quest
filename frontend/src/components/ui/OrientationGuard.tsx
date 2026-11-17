import { useEffect, useState } from 'react'
import { Check, ExternalLink, Maximize, RotateCcw, Smartphone, X } from 'lucide-react'

const TIP_KEY = 'tq_mobile_tip_dismissed'

// Facebook / Messenger / Instagram / Zalo / TikTok / Line... in-app browser
function isSocialBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|Zalo|TikTok|musical_ly|Bytedance|Line\/|KAKAOTALK|MicroMessenger/i.test(navigator.userAgent || '')
}

function isIOSDevice(): boolean {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent || '')
}

function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

// Dựa vào kích thước viewport thực tế, chính xác hơn screen.orientation trong webview
function isPortrait(): boolean {
  return typeof window !== 'undefined' && window.innerHeight > window.innerWidth
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback cho webview không có Clipboard API
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

/**
 * enabled = true  → chặn màn hình dọc + hiện mẹo (dùng khi đã vào cảnh game)
 * enabled = false → không can thiệp (đăng nhập, chọn nhân vật, v.v.)
 */
export function OrientationGuard({ enabled = true }: { enabled?: boolean }) {
  const [portrait, setPortrait] = useState(false)
  const [touch, setTouch] = useState(false)
  const [fbBrowser, setFbBrowser] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [tipOpen, setTipOpen] = useState(false)

  useEffect(() => {
    setFbBrowser(isSocialBrowser())
    const check = () => {
      setTouch(isTouchDevice())
      setPortrait(isPortrait())
    }
    check()

    const mq = window.matchMedia('(orientation: portrait)')
    mq.addEventListener('change', check)
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      mq.removeEventListener('change', check)
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  // Thông báo nhỏ khi vào game ở chế độ ngang (hiện 1 lần mỗi phiên)
  useEffect(() => {
    if (!enabled || !touch || portrait) {
      setTipOpen(false)
      return
    }
    let dismissed = false
    try {
      dismissed = sessionStorage.getItem(TIP_KEY) === '1'
    } catch {
      /* bỏ qua */
    }
    if (dismissed) return
    setTipOpen(true)
    // Trình duyệt thường: tự ẩn sau 12 giây. Facebook/Zalo: giữ đến khi người chơi đóng.
    if (!fbBrowser) {
      const id = setTimeout(() => {
        setTipOpen(false)
        try {
          sessionStorage.setItem(TIP_KEY, '1')
        } catch {
          /* bỏ qua */
        }
      }, 12000)
      return () => clearTimeout(id)
    }
  }, [enabled, touch, portrait, fbBrowser])

  const closeTip = () => {
    setTipOpen(false)
    try {
      sessionStorage.setItem(TIP_KEY, '1')
    } catch {
      /* bỏ qua */
    }
  }

  const handleCopy = async () => {
    const ok = await copyToClipboard(window.location.href)
    setCopied(ok)
    setCopyFailed(!ok)
    if (ok) setTimeout(() => setCopied(false), 3000)
  }

  const handleOpenExternal = () => {
    const ua = navigator.userAgent || ''
    const { host, pathname, search } = window.location
    if (/Android/.test(ua)) {
      // Intent mở Chrome; nếu máy không có Chrome sẽ tự về fallback URL
      const fallback = encodeURIComponent(window.location.href)
      window.location.href = `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`
    } else if (isIOSDevice()) {
      // iOS không có cách mở Safari ổn định từ in-app browser → sao chép link + hướng dẫn
      void handleCopy()
    } else {
      window.open(window.location.href, '_blank', 'noopener')
    }
  }

  const ios = isIOSDevice()

  // Chưa vào màn chơi → không can thiệp gì
  if (!enabled) return null

  /* ───────── 1. Đang cầm dọc → chặn toàn màn hình, yêu cầu xoay ngang ───────── */
  if (touch && portrait) {
    return (
      <div
        className="fixed inset-0 z-9999 overflow-y-auto bg-navy/97 text-white"
        role="dialog"
        aria-modal="true"
        aria-label="Yêu cầu xoay ngang màn hình"
        style={{ backdropFilter: 'blur(8px)' }}
      >
        <div className="flex min-h-full flex-col items-center justify-center gap-5 p-6 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-gold/60 bg-gold/10">
            <Smartphone size={40} className="animate-[spin_2s_ease-in-out_infinite_alternate] text-gold" />
            <RotateCcw size={22} className="absolute -right-2 -top-2 animate-spin text-cyan" />
          </div>

          <div className="max-w-xs space-y-2">
            <h2 className="text-xl font-extrabold tracking-wide text-gold">Xoay ngang điện thoại</h2>
            <p className="text-sm leading-relaxed text-white/75">
              THANKS QUEST cần <strong className="text-white">màn hình ngang</strong> để hiển thị đúng. Hãy xoay điện thoại sang ngang để tiếp tục chơi.
            </p>
          </div>

          {fbBrowser ? (
            <div className="w-full max-w-xs space-y-3 rounded-2xl border border-amber-400/40 bg-amber-900/40 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-300">⚠️ Trình duyệt trong ứng dụng</p>
              <p className="text-sm leading-relaxed text-white/80">
                Facebook / Zalo thường chặn xoay ngang. Hãy mở trang này bằng <strong className="text-white">Chrome</strong> hoặc <strong className="text-white">Safari</strong> để chơi đầy đủ.
              </p>
              <div className="flex flex-col gap-2">
                {!ios && (
                  <button onClick={handleOpenExternal} className="flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-navy shadow-lg active:scale-95">
                    <ExternalLink size={16} aria-hidden /> Mở trong trình duyệt ngoài
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm active:scale-95 ${ios ? 'bg-gold font-bold text-navy' : 'border border-white/20 text-white/80'}`}
                >
                  {copied ? (
                    <>
                      <Check size={16} aria-hidden /> Đã sao chép link
                    </>
                  ) : (
                    'Sao chép link'
                  )}
                </button>
                {copyFailed && <p className="break-all text-xs text-amber-200">Không sao chép được. Hãy chép tay: {window.location.href}</p>}
              </div>
              <p className="text-xs leading-relaxed text-white/55">
                {ios
                  ? 'Sau khi sao chép, mở Safari/Chrome và dán link vào thanh địa chỉ. Hoặc bấm nút ⋯ ở góc rồi chọn "Mở trong Safari".'
                  : 'Nếu nút không hoạt động, bấm nút ⋯ ở góc trên rồi chọn "Mở bằng trình duyệt".'}
              </p>
            </div>
          ) : (
            <p className="text-xs text-white/40">Nếu màn hình không tự xoay, hãy tắt khóa xoay trong cài đặt điện thoại.</p>
          )}
        </div>
      </div>
    )
  }

  /* ───────── 2. Đã xoay ngang → thông báo nhỏ ở đáy màn hình ───────── */
  if (touch && tipOpen) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-2 z-70 flex justify-center px-28">
        <div className="pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-xl border border-gold/50 bg-navy/90 p-2.5 text-white shadow-xl backdrop-blur" role="status">
          {fbBrowser ? <ExternalLink size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden /> : <Maximize size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden />}
          <div className="min-w-0 flex-1">
            {fbBrowser ? (
              <>
                <p className="text-xs leading-snug text-white/85">
                  Bạn đang chơi trong Facebook/Zalo. Hãy mở bằng <strong className="text-white">Chrome</strong> hoặc <strong className="text-white">Safari</strong> để xoay ngang và toàn màn hình mượt hơn.
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {!ios && (
                    <button onClick={handleOpenExternal} className="inline-flex items-center gap-1 rounded-md bg-gold px-2 py-1 text-[11px] font-bold text-navy active:scale-95">
                      Mở trình duyệt ngoài
                    </button>
                  )}
                  <button onClick={handleCopy} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] active:scale-95 ${ios ? 'bg-gold font-bold text-navy' : 'border border-white/25 text-white/80'}`}>
                    {copied ? 'Đã sao chép' : 'Sao chép link'}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs leading-snug text-white/85">
                {ios
                  ? 'Mẹo: bấm Chia sẻ → "Thêm vào Màn hình chính" để chơi toàn màn hình.'
                  : 'Mẹo: bấm nút ⛶ ở góc màn hình để chơi toàn màn hình.'}
              </p>
            )}
          </div>
          <button onClick={closeTip} aria-label="Đóng thông báo" className="shrink-0 text-white/50 hover:text-white">
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  return null
}