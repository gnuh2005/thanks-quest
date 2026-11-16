import Phaser from 'phaser'
import { ensureIcons, ensureTileset } from '../systems/textures'

export const AREA_IDS = ['plaza', 'library', 'lab', 'garden', 'courtyard', 'hall'] as const
export const CHAR_KEYS = ['teacher_m', 'teacher_f', 'student_m', 'student_f'] as const

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload(): void {
    for (const id of AREA_IDS) this.load.tilemapTiledJSON(`map-${id}`, `/maps/${id}.json`)
    for (const key of CHAR_KEYS) {
      this.load.spritesheet(key, `/assets/characters/${key}.png`, { frameWidth: 128, frameHeight: 128 })
    }
    this.load.on('loaderror', (file: { key: string }) => {
      // Nếu file ảnh chưa có thì sẽ fallback về canvas sinh tự động
      console.warn('[game] dùng procedural cho:', file.key)
    })
  }

  create(): void {
    ensureTileset(this)
    ensureIcons(this)
    const init = this.registry.get('init') as { startArea: string }
    this.scene.start('World', { areaId: init.startArea || 'plaza', spawn: 'default' })
  }
}
