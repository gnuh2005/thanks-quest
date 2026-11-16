import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { WorldScene } from './scenes/WorldScene'
import type { NpcInfo, PlayerState } from '../types/api'

export interface GameInit {
  startArea: string
  npcs: NpcInfo[]
  state: PlayerState
}

/** Tạo đúng một thể hiện Phaser.Game. Được gọi một lần bởi <GameCanvas/> (lazy-load). */
export function createGame(parent: HTMLElement, init: GameInit): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#101426',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    disableContextMenu: true,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    input: { keyboard: { target: window }, touch: { capture: true } },
    fps: { target: 60, smoothStep: true },
    scene: [BootScene, WorldScene],
    callbacks: {
      // Đặt dữ liệu khởi tạo TRƯỚC khi scene đầu tiên chạy
      preBoot: (g) => {
        g.registry.set('init', init)
        g.registry.set('state', init.state)
      },
    },
  })
  return game
}
