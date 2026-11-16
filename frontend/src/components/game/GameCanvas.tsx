import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import type { GameInit } from '../../game/createGame'

/**
 * Chủ của Phaser.Game. Chỉ tạo game MỘT lần (effect không phụ thuộc props), nên các lần render lại của React
 * không bao giờ khởi tạo lại thế giới. Phaser được nạp lười (dynamic import) để trang chủ nhẹ.
 */
export function GameCanvas({ init }: { init: GameInit }) {
  const host = useRef<HTMLDivElement>(null)
  const initRef = useRef(init)

  useEffect(() => {
    let cancelled = false
    let game: Phaser.Game | null = null
    import('../../game/createGame').then(({ createGame }) => {
      if (cancelled || !host.current) return
      game = createGame(host.current, initRef.current)
    })
    return () => {
      cancelled = true
      game?.destroy(true)
      game = null
    }
  }, [])

  return <div ref={host} className="absolute inset-0 touch-none" aria-label="Thế giới Hành trình tri ân" role="application" />
}
