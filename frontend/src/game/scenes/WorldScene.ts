import Phaser from 'phaser'
import { EventBus, type InteractPayload, type MiniMapData, type MiniMapTile } from '../events/EventBus'
import {
  ensureNpcAssets, ensurePlayerAssets, poiIcon, TILE, TILESET_KEY, type Dir,
} from '../systems/textures'
import type { NpcInfo, PlayerState } from '../../types/api'
import { vi } from '../../i18n'

interface StartData { areaId: string; spawn?: string }
interface InitData { startArea: string; npcs: NpcInfo[]; state: PlayerState }

type TiledObj = Phaser.Types.Tilemaps.TiledObject
const prop = (o: TiledObj, name: string): any => (o.properties as { name: string; value: unknown }[] | undefined)?.find((p) => p.name === name)?.value

interface Target {
  kind: 'npc' | 'poi'
  id: string
  x: number
  y: number
  radius: number
  prompt: string
  payload: InteractPayload
  visible: () => boolean
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image
}

interface ParticlePetal {
  sprite: Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle
  vx: number
  vy: number
  rotSpeed: number
}

const SPEED_WALK = 110
const SPEED_RUN = 190
const FONT = 'Be Vietnam Pro, system-ui, sans-serif'
const AREA_ROUTES: Record<string, string[]> = {
  plaza: ['library', 'lab', 'garden', 'courtyard', 'hall'],
  library: ['plaza'], lab: ['plaza'], garden: ['plaza'], courtyard: ['plaza'], hall: ['plaza'],
}

export class WorldScene extends Phaser.Scene {
  private areaId = 'plaza'
  private spawnName = 'default'
  private player!: Phaser.Physics.Arcade.Sprite
  private questDirectionArrow?: Phaser.GameObjects.Text
  private sheet = ''
  private dir: Dir = 'down'
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private targets: Target[] = []
  private poiVisuals = new Map<string, { icon: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; type: string }>()
  private npcVisuals = new Map<string, { marker: Phaser.GameObjects.Image; questArrow: Phaser.GameObjects.Text; sprite: Phaser.Physics.Arcade.Sprite; sheet: string; baseScaleY: number }>()
  private current: Target | null = null
  private uiFrozen = false
  private transitioning = false
  private portalCooldownUntil = 0
  private actionUntil = 0
  private touch = { x: 0, y: 0, run: false }
  private unsubs: (() => void)[] = []
  private pState!: PlayerState
  private mapPx = { w: 0, h: 0 }
  private lastLookAt = 0
  private lastAvatarKey = ''

  // Visual Effects & Minimap
  private advancedFx = true
  private sunlightOverlay?: Phaser.GameObjects.Rectangle
  private petals: ParticlePetal[] = []
  private lastDustTime = 0
  private lastFootstepTime = 0
  private lastMinimapPosTime = 0
  private minimapData?: MiniMapData

  constructor() {
    super('World')
  }

  init(data: StartData): void {
    this.areaId = data.areaId
    this.spawnName = data.spawn ?? 'default'
    this.targets = []
    this.poiVisuals.clear()
    this.npcVisuals.clear()
    this.petals = []
    this.current = null
    this.transitioning = false
    this.actionUntil = 0
    this.unsubs = []

    try {
      this.advancedFx = localStorage.getItem('tq_advanced_fx') !== 'false'
    } catch {
      this.advancedFx = true
    }
  }

  create(): void {
    const init = this.registry.get('init') as InitData
    this.pState = this.registry.get('state') as PlayerState ?? init.state

    const map = this.make.tilemap({ key: `map-${this.areaId}` })
    const tileset = map.addTilesetImage('world', TILESET_KEY, TILE, TILE)!
    this.mapPx = { w: map.widthInPixels, h: map.heightInPixels }

    for (const [i, name] of ['Grass', 'Ground', 'Road', 'Buildings', 'Decoration'].entries()) {
      map.createLayer(name, tileset)?.setDepth(i)
    }
    const collision = map.createLayer('Collision', tileset)!
    collision.setCollisionByExclusion([-1, 0])
    collision.setVisible(false)

    this.physics.world.setBounds(0, 0, this.mapPx.w, this.mapPx.h)

    const objects = map.getObjectLayer('Objects')?.objects ?? []
    const spawn =
      objects.find((o) => o.type === 'spawn' && o.name === this.spawnName) ?? objects.find((o) => o.type === 'spawn' && o.name === 'default')
    const sx = spawn?.x ?? this.mapPx.w / 2
    const sy = spawn?.y ?? this.mapPx.h / 2

    // Người chơi (Chibi 128x128 scale 0.28 ≈ 36px, body collision 14x10)
    this.sheet = ensurePlayerAssets(this, this.pState.profile.avatar, this.pState.profile.outfit)
    this.lastAvatarKey = this.sheet
    this.player = this.physics.add.sprite(sx, sy, this.sheet, 0).setDepth(10)
    this.player.setScale(0.28)
    this.player.body!.setSize(50, 36).setOffset(39, 86)
    this.player.setCollideWorldBounds(true)
    this.player.play(`${this.sheet}:idle-down`)
    this.physics.add.collider(this.player, collision)
    this.questDirectionArrow = this.add.text(sx, sy + 19, '▲', {
      fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#facc15',
      stroke: '#713f12', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10.5).setResolution(3).setVisible(false)

    this.buildNpcs(objects, init.npcs)
    this.buildInteraction(map.getObjectLayer('Interaction')?.objects ?? [])
    this.buildMinimapData(map, collision, objects)

    // Code Visual Effects: Nắng ấm và sương nhẹ sân trường
    this.buildVisualEffects()

    // Camera
    const cam = this.cameras.main
    cam.setBounds(0, 0, this.mapPx.w, this.mapPx.h)
    cam.startFollow(this.player, true, 0.14, 0.14)
    cam.setRoundPixels(true)
    this.applyZoom()
    cam.fadeIn(280, 16, 20, 38)
    this.scale.on('resize', this.applyZoom, this)

    // Điều khiển
    const kb = this.input.keyboard!
    this.cursors = kb.createCursorKeys()
    this.keys = kb.addKeys('W,A,S,D,SHIFT,E,SPACE', false) as Record<string, Phaser.Input.Keyboard.Key>

    // Cầu nối React & EventBus
    this.unsubs.push(
      EventBus.on('state:update', (s) => this.applyState(s)),
      EventBus.on('ui:freeze', (f) => this.setUiFrozen(f)),
      EventBus.on('touch:move', (v) => { this.touch.x = v.x; this.touch.y = v.y }),
      EventBus.on('touch:run', (r) => { this.touch.run = r }),
      EventBus.on('touch:interact', () => this.tryInteract()),
      EventBus.on('player:action', (a) => this.playAction(a)),
      EventBus.on('fx:toggle', (enabled) => this.setAdvancedFx(enabled)),
    )

    const cleanup = () => {
      this.unsubs.forEach((u) => u())
      this.unsubs = []
      this.scale.off('resize', this.applyZoom, this)
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup)
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup)

    this.applyState(this.pState)
    EventBus.emit('area:ready', { areaId: this.areaId })
    EventBus.emit('prompt', null)

    // Phát BGM cho khu vực
    EventBus.emit('audio:bgm', this.areaId)

    if (new URLSearchParams(location.search).has('debug')) {
      ;(window as any).__TQ__ = {
        scene: this,
        info: () => ({
          area: this.areaId, x: Math.round(this.player.x), y: Math.round(this.player.y), dir: this.dir,
          camX: Math.round(cam.scrollX), camY: Math.round(cam.scrollY), zoom: cam.zoom, frozen: this.frozen,
          targets: this.targets.map((t) => ({ id: t.id, kind: t.kind, x: Math.round(t.x), y: Math.round(t.y) })),
          prompt: this.current?.prompt ?? null,
        }),
        teleport: (x: number, y: number) => this.player.setPosition(x, y),
      }
    }
  }

  private get frozen(): boolean {
    return this.uiFrozen || this.transitioning
  }

  private setUiFrozen(f: boolean): void {
    this.uiFrozen = f
    if (!this.player?.body) return
    if (f) {
      this.player.setVelocity(0, 0)
      this.touch.x = 0
      this.touch.y = 0
      this.playIdle()
    }
  }

  private applyZoom(): void {
    const w = this.scale.width
    const z = Phaser.Math.Clamp(Math.round((w / 560) * 4) / 4, 1, 2.5)
    this.cameras.main.setZoom(z)
  }

  // ───────────── NPC ─────────────
  private buildNpcs(objects: TiledObj[], npcs: NpcInfo[]): void {
    for (const o of objects.filter((x) => x.type === 'npc')) {
      const info = npcs.find((n) => n.npcId === o.name)
      const sheet = ensureNpcAssets(this, info?.sprite ?? 0)
      const x = o.x ?? 0
      const y = o.y ?? 0

      // Bóng đổ dưới chân NPC
      this.add.ellipse(x, y + 15, 22, 7, 0x0f172a, 0.35).setDepth(8)

      const sprite = this.physics.add.sprite(x, y, sheet, 0).setDepth(9)
      sprite.setScale(0.28)
      sprite.setImmovable(true)
      sprite.body!.setSize(50, 36).setOffset(39, 86)
      sprite.play(`${sheet}:idle-down`)
      this.physics.add.collider(this.player, sprite)

      this.add.text(x, y - 24, vi(info?.name ?? o.name), {
        fontFamily: FONT, fontSize: '9px', color: '#ffffff', stroke: '#101426', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(30).setResolution(3)

      const marker = this.add.image(x, y - 38, 'mark-wait').setDepth(31).setVisible(false)
      this.tweens.add({ targets: marker, y: y - 42, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      const questArrow = this.add.text(x, y - 54, '▼', {
        fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#facc15',
        stroke: '#713f12', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(32).setResolution(3).setVisible(false)
      this.tweens.add({ targets: questArrow, y: y - 59, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      this.npcVisuals.set(o.name, { marker, questArrow, sprite, sheet, baseScaleY: 0.28 })
      sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.clickTarget(o.name))

      this.targets.push({
        kind: 'npc', id: o.name, x, y, radius: 52, sprite,
        prompt: `Trò chuyện với ${vi(info?.name ?? 'nhân vật')}`,
        payload: { kind: 'npc', id: o.name, label: vi(info?.name ?? 'nhân vật') },
        visible: () => true,
      })
    }
  }

  // ───────────── POI + Cổng ─────────────
  private buildInteraction(objects: TiledObj[]): void {
    for (const o of objects) {
      if (o.type === 'portal') this.buildPortal(o)
      else if (o.type === 'poi') this.buildPoi(o)
    }
  }

  private buildPoi(o: TiledObj): void {
    const type = String(prop(o, 'poiType') ?? 'item') as InteractPayload['poiType'] & string
    const label = String(prop(o, 'label') ?? '')
    const x = o.x ?? 0
    const y = o.y ?? 0

    // Vòng sáng hào quang
    const glow = this.add.image(x, y, 'glow').setDepth(6).setScale(0.7).setAlpha(0.8)
    const icon = this.add.image(x, y - 4, poiIcon(type)).setDepth(8)
    this.tweens.add({ targets: icon, y: y - 8, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    this.tweens.add({ targets: glow, alpha: 0.35, scale: 0.55, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' })

    icon.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.clickTarget(o.name))
    this.poiVisuals.set(o.name, { icon, glow, type })

    const verb = { item: 'Nhặt', story: 'Đọc', sign: 'Đọc', minigame: 'Chơi', gratitude: 'Dùng', wall: 'Xem' }[type] ?? 'Tương tác'
    this.targets.push({
      kind: 'poi', id: o.name, x, y, radius: 44, sprite: icon,
      prompt: `${verb} ${vi(label)}`,
      payload: {
        kind: 'poi', id: o.name, poiType: type, label: vi(label), ref: String(prop(o, 'ref') ?? ''),
        itemId: String(prop(o, 'itemId') ?? ''), text: String(prop(o, 'text') ?? ''),
      },
      visible: () => !(type === 'item' && this.isCollected(o.name)),
    })
  }

  private buildPortal(o: TiledObj): void {
    const w = o.width ?? TILE
    const h = o.height ?? TILE
    const cx = (o.x ?? 0) + w / 2
    const cy = (o.y ?? 0) + h / 2
    const zone = this.add.zone(cx, cy, w, h)
    this.physics.add.existing(zone, true)
    this.physics.add.overlap(this.player, zone, () => this.onPortal(String(prop(o, 'to')), String(prop(o, 'spawn')), String(prop(o, 'label') ?? ''), cx, cy))

    const ix = Math.sign(this.mapPx.w / 2 - cx)
    const iy = Math.sign(this.mapPx.h / 2 - cy)
    const horizontal = w < h
    const lx = horizontal ? cx + ix * 46 : cx
    const ly = horizontal ? cy : cy + iy * 22
    this.add.text(lx, ly, `→ ${vi(String(prop(o, 'label') ?? ''))}`, {
      fontFamily: FONT, fontSize: '9px', color: '#f5c96a', stroke: '#101426', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30).setResolution(3)
  }

  private onPortal(to: string, spawn: string, label: string, cx: number, cy: number): void {
    if (this.frozen || this.time.now < this.portalCooldownUntil) return
    this.transitioning = true
    this.player.setVelocity(0, 0)
    this.playIdle()

    EventBus.emit('portal:request', {
      to, spawn, label,
      resolve: (ok) => {
        if (!this.scene.isActive()) return
        if (ok) {
          EventBus.emit('audio:playSfx', 'portal')
          this.cameras.main.fadeOut(260, 16, 20, 38)
          this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('World', { areaId: to, spawn }))
        } else {
          const dx = this.player.x - cx
          const dy = this.player.y - cy
          const len = Math.hypot(dx, dy) || 1
          this.player.setPosition(this.player.x + (dx / len) * 56, this.player.y + (dy / len) * 56)
          this.portalCooldownUntil = this.time.now + 1500
          this.transitioning = false
        }
      },
    })
  }

  // ───────────── Visual Effects bằng Code ─────────────
  private buildVisualEffects(): void {
    // Ánh sáng ấm vàng dịu nhẹ (nắng sân trường)
    this.sunlightOverlay = this.add.rectangle(0, 0, this.mapPx.w, this.mapPx.h, 0xfef08a, 0.06)
      .setOrigin(0).setDepth(25).setBlendMode(Phaser.BlendModes.SCREEN)

    if (!this.advancedFx) {
      this.sunlightOverlay.setVisible(false)
      return
    }

    const count = 18
    const isPlazaOrCourtyard = this.areaId === 'plaza' || this.areaId === 'courtyard'
    const isGarden = this.areaId === 'garden'

    for (let i = 0; i < count; i++) {
      const px = Math.random() * this.mapPx.w
      const py = Math.random() * this.mapPx.h
      let sprite: Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle

      if (isPlazaOrCourtyard) {
        sprite = this.add.arc(px, py, 2.5, 0, 360, false, 0xef4444, 0.75).setDepth(22)
      } else if (isGarden) {
        sprite = this.add.rectangle(px, py, 4, 2, 0x4ade80, 0.7).setDepth(22)
      } else {
        sprite = this.add.arc(px, py, 1.5, 0, 360, false, 0xbfdbfe, 0.55).setDepth(22)
      }

      this.petals.push({
        sprite,
        vx: (Math.random() - 0.4) * 0.8,
        vy: 0.6 + Math.random() * 0.7,
        rotSpeed: (Math.random() - 0.5) * 0.05,
      })
    }
  }

  public setAdvancedFx(enabled: boolean): void {
    this.advancedFx = enabled
    try {
      localStorage.setItem('tq_advanced_fx', String(enabled))
    } catch {}
    if (this.sunlightOverlay) this.sunlightOverlay.setVisible(enabled)
    this.petals.forEach((p) => p.sprite.setVisible(enabled))
  }

  private spawnDust(x: number, y: number): void {
    if (!this.advancedFx) return
    const d = this.add.circle(x + (Math.random() - 0.5) * 6, y + 14, 3, 0xfde68a, 0.5).setDepth(8)
    this.tweens.add({
      targets: d,
      scale: 0.2,
      alpha: 0,
      duration: 350,
      ease: 'Quad.easeOut',
      onComplete: () => d.destroy(),
    })
  }

  // ───────────── Trích xuất Dữ liệu Minimap ─────────────
  private buildMinimapData(map: Phaser.Tilemaps.Tilemap, collision: any, objects: TiledObj[]): void {
    const cols = map.width
    const rows = map.height
    const grid: MiniMapTile[] = []

    const roadLayer = map.getLayer('Road')?.tilemapLayer
    const groundLayer = map.getLayer('Ground')?.tilemapLayer

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const colTile = collision.getTileAt(c, r)
        if (colTile && colTile.index > 0) {
          grid.push('solid')
        } else {
          const roadTile = roadLayer?.getTileAt(c, r)
          const groundTile = groundLayer?.getTileAt(c, r)
          if (roadTile && roadTile.index > 0) {
            grid.push('path')
          } else if (groundTile && groundTile.index > 0) {
            grid.push(groundTile.index === 4 ? 'water' : 'floor')
          } else {
            grid.push('grass')
          }
        }
      }
    }

    const portals = objects.filter((o) => o.type === 'portal').map((o) => {
      const to = String(prop(o, 'to'))
      const isLocked = !this.pState.areas.find((a) => a.areaId === to)?.unlocked
      return {
        id: o.name,
        to,
        label: String(prop(o, 'label') ?? to),
        x: o.x ?? 0,
        y: o.y ?? 0,
        w: o.width ?? TILE,
        h: o.height ?? TILE,
        locked: isLocked,
      }
    })

    const npcs = objects.filter((o) => o.type === 'npc').map((o) => {
      const hasQuest = this.pState.quests.some((q) => q.npcId === o.name && (q.status === 'completed' || q.status === 'available'))
      return {
        id: o.name,
        name: o.name,
        x: o.x ?? 0,
        y: o.y ?? 0,
        hasQuest,
      }
    })

    const pois = objects.filter((o) => o.type === 'poi').map((o) => ({
      id: o.name,
      label: String(prop(o, 'label') ?? ''),
      type: String(prop(o, 'poiType') ?? 'item'),
      x: o.x ?? 0,
      y: o.y ?? 0,
      collected: this.isCollected(o.name),
    }))

    const areaName = this.pState.areas.find((a) => a.areaId === this.areaId)?.name ?? this.areaId

    this.minimapData = {
      areaId: this.areaId,
      areaName,
      cols,
      rows,
      mapPx: this.mapPx,
      grid,
      portals,
      npcs,
      pois,
    }

    EventBus.emit('minimap:map', this.minimapData)
  }

  // ───────────── Trạng thái ─────────────
  private isCollected(poiId: string): boolean {
    return this.pState.collectedPois.includes(poiId)
  }

  private applyState(s: PlayerState): void {
    this.pState = s
    this.registry.set('state', s)

    const key = ensurePlayerAssets(this, s.profile.avatar, s.profile.outfit)
    if (key !== this.lastAvatarKey && this.player) {
      this.lastAvatarKey = key
      this.sheet = key
      this.player.setTexture(key, 0)
      this.player.setScale(0.28)
      this.player.body!.setSize(50, 36).setOffset(39, 86)
      this.playIdle()
    }

    for (const [id, v] of this.poiVisuals) {
      const collected = this.isCollected(id)
      if (v.type === 'item' && collected && v.icon.visible) {
        this.tweens.add({
          targets: [v.icon, v.glow], alpha: 0, y: '-=14', duration: 260,
          onComplete: () => { v.icon.setVisible(false); v.glow.setVisible(false); v.icon.disableInteractive() },
        })
      } else if ((v.type === 'story' || v.type === 'sign') && collected) {
        v.icon.setAlpha(0.55)
        v.glow.setVisible(false)
      }
    }

    for (const [npcId, v] of this.npcVisuals) {
      const qs = s.quests.filter((q) => q.npcId === npcId)
      const ready = qs.some((q) => q.status === 'completed')
      const avail = qs.some((q) => q.status === 'available')
      const doing = qs.some((q) => q.status === 'in_progress')
      v.questArrow.setVisible(qs.some((q) => ['available', 'in_progress', 'completed'].includes(q.status)))
      if (ready) v.marker.setTexture('mark-done').setVisible(true)
      else if (avail) v.marker.setTexture('mark-new').setVisible(true)
      else if (doing) v.marker.setTexture('mark-wait').setVisible(true)
      else v.marker.setVisible(false)
    }
  }

  // ───────────── Vòng lặp cập nhật (Update Loop) ─────────────
  update(time: number): void {
    if (!this.player?.body) return

    // Cập nhật các hạt lá/hoa rơi
    if (this.advancedFx && this.petals.length > 0) {
      for (const p of this.petals) {
        p.sprite.x += p.vx
        p.sprite.y += p.vy
        p.sprite.rotation += p.rotSpeed
        if (p.sprite.y > this.mapPx.h) {
          p.sprite.y = 0
          p.sprite.x = Math.random() * this.mapPx.w
        }
      }
    }

    // NPC idle breathing (thở nhẹ nhàng)
    let nIdx = 0
    for (const v of this.npcVisuals.values()) {
      nIdx++
      const breathe = Math.sin(time * 0.0035 + nIdx) * 0.008
      v.sprite.setScale(0.28, v.baseScaleY + breathe)
    }

    if (this.frozen) {
      this.player.setVelocity(0, 0)
      this.updateTarget()
      return
    }

    const k = this.keys
    const c = this.cursors
    let vx = (k.D!.isDown || c.right.isDown ? 1 : 0) - (k.A!.isDown || c.left.isDown ? 1 : 0)
    let vy = (k.S!.isDown || c.down.isDown ? 1 : 0) - (k.W!.isDown || c.up.isDown ? 1 : 0)
    if (vx !== 0 || vy !== 0) {
      const l = Math.hypot(vx, vy)
      vx /= l
      vy /= l
    } else if (Math.hypot(this.touch.x, this.touch.y) > 0.15) {
      vx = this.touch.x
      vy = this.touch.y
    }
    const moving = vx !== 0 || vy !== 0
    const run = k.SHIFT!.isDown || this.touch.run
    const speed = run ? SPEED_RUN : SPEED_WALK
    this.player.setVelocity(vx * speed, vy * speed)

    if (moving) {
      this.actionUntil = 0
      this.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down'
      this.player.anims.play(`${this.sheet}:${run ? 'run' : 'walk'}-${this.dir}`, true)

      // SFX bước chân
      if (time - this.lastFootstepTime > (run ? 240 : 340)) {
        this.lastFootstepTime = time
        EventBus.emit('audio:playSfx', 'footstep')
      }

      // Hạt bụi khi chạy
      if (run && time - this.lastDustTime > 160) {
        this.lastDustTime = time
        this.spawnDust(this.player.x, this.player.y)
      }
    } else if (time > this.actionUntil) {
      this.playIdle()
    }
    this.player.setDepth(10)
    this.updateQuestDirectionArrow()

    if (Phaser.Input.Keyboard.JustDown(k.E!) || Phaser.Input.Keyboard.JustDown(k.SPACE!)) this.tryInteract()
    this.updateTarget()
    this.updateNpcGaze(time)

    // Phát vị trí cho Mini Map (giới hạn ~8 lần/giây để mượt mà và tối ưu hiệu năng)
    if (time - this.lastMinimapPosTime > 125) {
      this.lastMinimapPosTime = time
      EventBus.emit('minimap:pos', {
        x: this.player.x,
        y: this.player.y,
        dir: this.dir,
        collectedPois: this.pState.collectedPois,
      })
    }
  }

  private playIdle(): void {
    this.player.anims.play(`${this.sheet}:idle-${this.dir}`, true)
  }

  private updateQuestDirectionArrow(): void {
    const arrow = this.questDirectionArrow
    if (!arrow || !this.player) return

    const activeQuests = this.pState.quests
      .filter((q) => ['in_progress', 'available', 'completed'].includes(q.status))
      .sort((a, b) => Number(b.status === 'in_progress') - Number(a.status === 'in_progress') || a.order - b.order)
    const quest = activeQuests[0]
    if (!quest) {
      arrow.setVisible(false)
      return
    }

    let targetPoint: { x: number; y: number } | undefined
    if (quest.areaId === this.areaId) {
      const npc = this.targets.find((target) => target.kind === 'npc' && target.id === quest.npcId)
      targetPoint = npc ? { x: npc.x, y: npc.y } : undefined
    } else {
      const route = this.findAreaRoute(this.areaId, quest.areaId)
      const nextArea = route?.[1]
      const portal = nextArea && this.minimapData?.portals.find((item) => item.to === nextArea)
      if (portal) targetPoint = { x: portal.x + portal.w / 2, y: portal.y + portal.h / 2 }
    }

    if (!targetPoint) {
      arrow.setVisible(false)
      return
    }
    arrow.setPosition(this.player.x, this.player.y + 19)
    arrow.setRotation(Phaser.Math.Angle.Between(this.player.x, this.player.y, targetPoint.x, targetPoint.y) + Math.PI / 2)
    arrow.setVisible(true)
  }

  private findAreaRoute(from: string, to: string): string[] | undefined {
    const queue: string[][] = [[from]]
    const visited = new Set([from])
    while (queue.length) {
      const route = queue.shift()!
      const current = route[route.length - 1]!
      if (current === to) return route
      for (const next of AREA_ROUTES[current] ?? []) {
        if (visited.has(next)) continue
        visited.add(next)
        queue.push([...route, next])
      }
    }
    return undefined
  }

  private playAction(a: 'collect' | 'celebrate' | 'interact'): void {
    this.player.setVelocity(0, 0)
    this.player.anims.play(`${this.sheet}:${a}`, true)
    this.actionUntil = this.time.now + (a === 'celebrate' ? 1100 : 450)
  }

  private updateTarget(): void {
    let best: Target | null = null
    let bestD = Infinity
    for (const t of this.targets) {
      if (!t.visible()) continue
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y)
      if (d <= t.radius && d < bestD) {
        best = t
        bestD = d
      }
    }
    if (best?.id !== this.current?.id || best?.kind !== this.current?.kind) {
      this.current = best
      EventBus.emit('prompt', best ? { text: best.prompt } : null)
    }
  }

  private updateNpcGaze(time: number): void {
    if (time - this.lastLookAt < 250) return
    this.lastLookAt = time
    for (const v of this.npcVisuals.values()) {
      const dx = this.player.x - v.sprite.x
      const dy = this.player.y - v.sprite.y
      const near = Math.hypot(dx, dy) < 110
      const d: Dir = near ? (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down') : 'down'
      v.sprite.anims.play(`${v.sheet}:idle-${d}`, true)
    }
  }

  private face(tx: number, ty: number): void {
    const dx = tx - this.player.x
    const dy = ty - this.player.y
    this.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'
  }

  private tryInteract(): void {
    if (this.frozen || !this.current) return
    const t = this.current
    this.face(t.x, t.y)
    this.playAction('interact')
    EventBus.emit('interact', t.payload)
  }

  private clickTarget(id: string): void {
    if (this.frozen) return
    const t = this.targets.find((x) => x.id === id && x.visible())
    if (!t) return
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y) <= t.radius * 1.8) {
      this.current = t
      this.tryInteract()
    } else {
      EventBus.emit('game:error', { message: 'Hãy đến gần hơn để tương tác.' })
    }
  }
}
