import { useEffect, useState } from 'react'
import { ExternalLink, RotateCcw, Smartphone } from 'lucide-react'

// Phát hiện Facebook / Instagram / Zalo in-app browser
function isSocialBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /FBAN|FBAV|FB_IAB|Instagram|KAKAOTALK|MicroMessenger|Line\/|zalo/i.test(ua)
}

function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

function isPortrait(): boolean {
  if (typeof window === 'undefined') return false
  // screen.orientation is more reliable but may not exist in all browsers
  if (window.screen?.orientation?.type) {
    return window.screen.orientation.type.startsWith('portrait')
  }
  return window.matchMedia('(orientation: portrait)').matches
}

/** Mở URL hiện tại trong trình duyệt ngoài */
function openExternalBrowser() {
  const url = window.location.href
  const ua = navigator.userAgent || ''
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  const isAndroid = /Android/.test(ua)

  if (isIOS) {
    // iOS: thử mở Safari bằng scheme đặc biệt
    // Nếu thất bại, hướng dẫn copy link
    const safariUrl = url.replace(/^https?:\/\//, 'x-safari-https://')
    window.location.href = safariUrl
    // Nếu không hoạt động sau 500ms, copy clipboard và hướng dẫn
    setTimeout(() => {
      if (document.hasFocus()) {
        // Vẫn còn trong FB browser → copy link
        try {
          navigator.clipboard.writeText(url).then(() => {
            alert('Đã sao chép link!\nMở Safari hoặc Chrome, dán link vào thanh địa chỉ để chơi.')
          })
        } catch {
          alert(`Hãy sao chép link này và mở trong Safari:\n${url}`)
        }
      }
    }, 600)
  } else if (isAndroid) {
    // Android: intent URL để mở Chrome
    const intentUrl = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`
    window.location.href = intentUrl
    // Fallback: thử window.open
    setTimeout(() => {
      if (document.hasFocus()) {
        window.open(url, '_blank', 'noopener')
      }
    }, 400)
  } else {
    window.open(url, '_blank', 'noopener')
  }
}

function copyLink() {
  const url = window.location.href
  try {
    navigator.clipboard.writeText(url).then(() => {
      alert('Đã sao chép link! Dán vào Chrome hoặc Safari để chơi.')
    }).catch(() => {
      alert(`Sao chép link này:\n${url}`)
    })
  } catch {
    alert(`Sao chép link này:\n${url}`)
  }
}

export function OrientationGuard() {
  const [show, setShow] = useState(false)
  const [fbBrowser, setFbBrowser] = useState(false)

  useEffect(() => {
    const fb = isSocialBrowser()
    setFbBrowser(fb)

    const check = () => {
      const mobile = isMobile()
      const portrait = isPortrait()
      // Hiện overlay nếu: mobile VÀ đang portrait
      setShow(mobile && portrait)
    }

    check()

    // Lắng nghe thay đổi orientation
    const mq = window.matchMedia('(orientation: portrait)')
    const handler = () => check()
    mq.addEventListener('change', handler)

    // Thêm screen.orientation listener nếu có
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handler)
    }

    window.addEventListener('resize', handler)

    return () => {
      mq.removeEventListener('change', handler)
      window.screen?.orientation?.removeEventListener('change', handler)
      window.removeEventListener('resize', handler)
    }
  }, [])

  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-navy/97 p-6 text-center text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Yêu cầu xoay ngang màn hình"
      style={{ backdropFilter: 'blur(8px)' }}
    >
      {/* Icon điện thoại xoay */}
      <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-gold/60 bg-gold/10">
        <Smartphone size={40} className="text-gold animate-[spin_2s_ease-in-out_infinite_alternate]" />
        <RotateCcw
          size={22}
          className="absolute -right-2 -top-2 text-cyan"
          style={{ animation: 'spin 2s linear infinite' }}
        />
      </div>

      <div className="max-w-xs space-y-2">
        <h2 className="text-xl font-extrabold tracking-wide text-gold">Xoay ngang điện thoại</h2>
        <p className="text-sm leading-relaxed text-white/75">
          THANKS QUEST cần chế độ <strong className="text-white">màn hình ngang</strong> để hiển thị đúng.
          Hãy xoay điện thoại sang ngang để tiếp tục chơi.
        </p>
      </div>

      {/* Hiển thị thêm nếu đang dùng Facebook/Zalo browser */}
      {fbBrowser && (
        <div className="w-full max-w-xs rounded-2xl border border-amber-400/40 bg-amber-900/40 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
            ⚠️ Trình duyệt trong ứng dụng
          </p>
          <p className="text-sm text-white/80 leading-relaxed">
            Facebook / Zalo chặn chế độ màn hình ngang.
            Hãy mở link này trong <strong className="text-white">Chrome</strong> hoặc <strong className="text-white">Safari</strong> để chơi đầy đủ.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={openExternalBrowser}
              className="flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-navy shadow-lg active:scale-95"
            >
              <ExternalLink size={16} />
              Mở trong trình duyệt ngoài
            </button>
            <button
              onClick={copyLink}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 active:scale-95"
            >
              Sao chép link
            </button>
          </div>
        </div>
      )}

      {/* Nếu không phải FB browser nhưng vẫn portrait, chỉ hiện hướng dẫn xoay */}
      {!fbBrowser && (
        <p className="text-xs text-white/40">
          Nếu màn hình không tự xoay, hãy tắt khóa xoay trong cài đặt điện thoại.
        </p>
      )}
    </div>
  )
}
