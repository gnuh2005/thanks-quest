import Phaser from 'phaser'

export const TILE = 32
export const TILESET_KEY = 'world-tiles'
export const CELL = 128
export const COLS = 8
export const ROWS = 8

export type Dir = 'down' | 'left' | 'right' | 'up'
export const DIRS: Dir[] = ['down', 'left', 'right', 'up']

export const CHAR_KEYS = ['teacher_m', 'teacher_f', 'student_m', 'student_f'] as const
export type CharKey = typeof CHAR_KEYS[number]

export interface Look {
  skin: string
  hair: string
  shirt: string
  pants: string
  glasses?: boolean
  bun?: boolean
}

export const AVATAR_NAMES = ['Thầy giáo', 'Cô giáo', 'Học sinh nam', 'Học sinh nữ']
export const AVATAR_DESCRIPTIONS = [
  '~40 tuổi, kính cận trí tuệ, áo sơ mi xanh nhạt, quần tối màu, tay cầm sách tri thức.',
  '~30 tuổi, áo dài pastel thướt tha, tóc búi gọn quý phái, nụ cười hiền hậu ấm áp.',
  'Áo sơ mi trắng tinh khôi, quần xanh navy, ba lô năng động, khăn quàng đỏ tung bay.',
  'Áo trắng học trò, váy xếp ly xanh navy, hai bím tóc xinh xắn, ba lô nhỏ gọn gàng.',
]

export const AVATARS: { skin: string; hair: string }[] = [
  { skin: '#ffedd5', hair: '#3f2212' },
  { skin: '#fff1f2', hair: '#1c1917' },
  { skin: '#fef3c7', hair: '#171717' },
  { skin: '#fdf2f8', hair: '#292524' },
]

export const OUTFITS = ['#3b82f6', '#f59e0b', '#06b6d4']
export const OUTFIT_NAMES = ['Phong cách 1', 'Phong cách 2', 'Phong cách 3']

export const NPC_LOOKS: Look[] = [
  { skin: '#ffedd5', hair: '#94a3b8', shirt: '#475569', pants: '#1e293b', glasses: true }, // Giáo sư
  { skin: '#fce7f3', hair: '#78350f', shirt: '#059669', pants: '#064e3b', bun: true },     // Cô giáo khoa học
  { skin: '#ffedd5', hair: '#1e293b', shirt: '#0284c7', pants: '#0c4a6e' },                // Thủ thư
  { skin: '#fef3c7', hair: '#ea580c', shirt: '#d97706', pants: '#78350f', bun: true },     // Hướng dẫn viên IT
  { skin: '#ffedd5', hair: '#64748b', shirt: '#7c3aed', pants: '#4c1d95', glasses: true }, // Thầy giáo lịch sử
  { skin: '#fce7f3', hair: '#d97706', shirt: '#e11d48', pants: '#881337' },                // Thầy cô nghệ thuật
]

type Ctx = CanvasRenderingContext2D

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const el = document.createElement('canvas')
  el.width = w
  el.height = h
  const ctx = el.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  return [el, ctx]
}

const rect = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// ───────────────────────── 13 Tileset Drawers ─────────────────────────
const tileDrawers: ((c: Ctx) => void)[] = [
  // 1. Grass - Rich lush green, subtle grass blades, wild flowers
  (c) => {
    rect(c, '#3ea662', 0, 0, 32, 32)
    const g = c.createLinearGradient(0, 0, 0, 32)
    g.addColorStop(0, 'rgba(100, 215, 130, 0.25)')
    g.addColorStop(1, 'rgba(25, 95, 45, 0.25)')
    c.fillStyle = g
    c.fillRect(0, 0, 32, 32)

    const r = rng(11)
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(r() * 30)
      const y = Math.floor(r() * 30)
      rect(c, '#54be78', x, y, 1, 3)
      rect(c, '#2d7c49', x + 1, y + 1, 1, 2)
    }
    // Tiny daisy
    rect(c, '#ffffff', 8, 12, 2, 2)
    rect(c, '#fef08a', 9, 13, 1, 1)
    rect(c, '#ffffff', 24, 20, 2, 2)
  },

  // 2. Path - Warm cobblestone/sandstone with bevel and mortar
  (c) => {
    rect(c, '#dcbc82', 0, 0, 32, 32)
    const g = c.createLinearGradient(0, 0, 32, 32)
    g.addColorStop(0, 'rgba(255, 245, 215, 0.35)')
    g.addColorStop(1, 'rgba(160, 115, 60, 0.25)')
    c.fillStyle = g
    c.fillRect(0, 0, 32, 32)

    // Mortar lines & stone pavers
    c.fillStyle = '#bfa068'
    c.fillRect(0, 15, 32, 1)
    c.fillRect(16, 0, 1, 15)
    c.fillRect(8, 16, 1, 16)
    c.fillRect(24, 16, 1, 16)

    // Paver highlights
    c.fillStyle = '#f5e4be'
    c.fillRect(1, 1, 14, 1)
    c.fillRect(17, 1, 14, 1)
    c.fillRect(1, 17, 6, 1)
    c.fillRect(9, 17, 14, 1)
  },

  // 3. Floor - Polished indoor marble tiles with sheen
  (c) => {
    rect(c, '#dbe4f4', 0, 0, 32, 32)
    rect(c, '#c5d3ea', 0, 15, 32, 1)
    rect(c, '#c5d3ea', 15, 0, 1, 32)
    // Sheen reflection
    const g = c.createLinearGradient(0, 0, 32, 32)
    g.addColorStop(0.3, 'rgba(255, 255, 255, 0.45)')
    g.addColorStop(0.5, 'rgba(255, 255, 255, 0)')
    c.fillStyle = g
    c.fillRect(0, 0, 32, 32)
    // Subtle diamond inlay
    c.fillStyle = '#e8effa'
    c.fillRect(6, 6, 4, 4)
    c.fillRect(22, 22, 4, 4)
  },

  // 4. Water - Crystalline blue pond with light caustics
  (c) => {
    rect(c, '#2b6cb0', 0, 0, 32, 32)
    const g = c.createLinearGradient(0, 0, 0, 32)
    g.addColorStop(0, '#3182ce')
    g.addColorStop(1, '#1a4971')
    c.fillStyle = g
    c.fillRect(0, 0, 32, 32)

    // Light ripples
    c.fillStyle = 'rgba(190, 227, 248, 0.6)'
    c.fillRect(3, 7, 9, 2)
    c.fillRect(18, 13, 11, 2)
    c.fillRect(8, 22, 8, 2)
    c.fillRect(22, 27, 7, 2)

    // Lily pad
    c.fillStyle = '#38a169'
    c.beginPath()
    c.arc(7, 18, 4, 0, Math.PI * 1.8)
    c.fill()
    c.fillStyle = '#f687b3'
    c.fillRect(6, 17, 2, 2)
  },

  // 5. Wall - Terracotta campus brick architecture with white trim
  (c) => {
    rect(c, '#b91c1c', 0, 0, 32, 32)
    // Brick mortar
    c.fillStyle = '#7f1d1d'
    for (let y = 6; y < 32; y += 6) {
      c.fillRect(0, y, 32, 1)
      const off = (y / 6) % 2 ? 8 : 0
      for (let x = off; x < 32; x += 16) c.fillRect(x, y + 1, 1, 5)
    }
    // White decorative roof trim
    rect(c, '#f8fafc', 0, 0, 32, 4)
    rect(c, '#94a3b8', 0, 4, 32, 2)
  },

  // 6. Tree - Majestic blooming red phoenix tree (Cây phượng vĩ)
  (c) => {
    // Tree trunk with shading
    rect(c, '#78350f', 12, 18, 8, 14)
    rect(c, '#451a03', 17, 18, 3, 14)
    rect(c, '#92400e', 13, 18, 2, 14)

    // Lush green canopy
    c.fillStyle = '#166534'
    c.beginPath(); c.arc(16, 12, 13, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#15803d'
    c.beginPath(); c.arc(16, 10, 11, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#22c55e'
    c.beginPath(); c.arc(14, 8, 8, 0, Math.PI * 2); c.fill()

    // Blooming red phoenix blossoms (Hoa phượng đỏ)
    c.fillStyle = '#ef4444'
    for (const [px, py] of [[10, 6], [18, 5], [14, 11], [8, 13], [22, 11], [19, 15]]) {
      c.fillRect(px, py, 3, 3)
      rect(c, '#fef08a', px + 1, py + 1, 1, 1)
    }
  },

  // 7. Shelf - Rich mahogany library bookcase
  (c) => {
    rect(c, '#451a03', 0, 0, 32, 32)
    for (const y of [2, 12, 22]) {
      rect(c, '#78350f', 1, y + 8, 30, 2)
      let x = 3
      const cols = ['#2563eb', '#f59e0b', '#dc2626', '#06b6d4', '#8b5cf6', '#10b981']
      for (let i = 0; x < 28; i++) {
        const w = 3 + (i % 2)
        rect(c, cols[i % cols.length]!, x, y + 1, w, 7)
        rect(c, '#fef08a', x + 1, y + 2, 1, 3) // Gold spine lettering
        x += w + 1
      }
    }
  },

  // 8. Desk - Tech lab workstation with glowing screen
  (c) => {
    rect(c, '#64748b', 0, 14, 32, 18)
    rect(c, '#334155', 0, 28, 32, 4)
    // Monitor
    rect(c, '#0f172a', 6, 2, 20, 13)
    rect(c, '#06b6d4', 8, 4, 16, 9)
    // Screen contents
    rect(c, '#cffafe', 10, 6, 8, 1)
    rect(c, '#cffafe', 10, 9, 12, 1)
    // Stand & Keyboard
    rect(c, '#94a3b8', 14, 15, 4, 3)
    rect(c, '#1e293b', 8, 19, 16, 4)
  },

  // 9. Flower - Vibrant campus flowerbed
  (c) => {
    rect(c, '#14532d', 0, 0, 32, 32)
    rect(c, '#166534', 2, 2, 28, 28)
    const blooms: [number, number, string][] = [
      [6, 8, '#f43f5e'], [16, 6, '#fbbf24'], [24, 10, '#ec4899'],
      [10, 18, '#38bdf8'], [20, 20, '#f43f5e'], [13, 25, '#fbbf24'],
    ]
    for (const [x, y, col] of blooms) {
      c.fillStyle = col
      c.beginPath(); c.arc(x + 2, y + 2, 3, 0, Math.PI * 2); c.fill()
      rect(c, '#ffffff', x + 1, y + 1, 2, 2)
    }
  },

  // 10. Statue / Fountain - Stone fountain with bubbling spray
  (c) => {
    rect(c, '#94a3b8', 3, 20, 26, 11)
    rect(c, '#cbd5e1', 5, 18, 22, 3)
    // Center column & basin
    rect(c, '#64748b', 12, 6, 8, 13)
    rect(c, '#e2e8f0', 8, 6, 16, 4)
    // Water in basin
    rect(c, '#38bdf8', 6, 21, 20, 4)
    // Water droplets
    c.fillStyle = '#bae6fd'
    c.fillRect(15, 1, 2, 4)
    c.fillRect(12, 3, 2, 2)
    c.fillRect(18, 3, 2, 2)
  },

  // 11. Hedge - Sculpted ornamental bush
  (c) => {
    rect(c, '#14532d', 0, 0, 32, 32)
    const g = c.createLinearGradient(0, 0, 0, 32)
    g.addColorStop(0, '#22c55e')
    g.addColorStop(0.3, '#16a34a')
    g.addColorStop(1, '#14532d')
    c.fillStyle = g
    c.fillRect(0, 0, 32, 32)

    // Leaf tufts
    const r = rng(77)
    for (let i = 0; i < 18; i++) {
      rect(c, '#4ade80', Math.floor(r() * 28), Math.floor(r() * 26), 3, 3)
    }
    rect(c, '#86efac', 0, 0, 32, 2)
  },

  // 12. Rug - Ceremonial crimson carpet with gold border
  (c) => {
    rect(c, '#991b1b', 0, 0, 32, 32)
    // Gold borders
    rect(c, '#f59e0b', 0, 0, 2, 32)
    rect(c, '#f59e0b', 30, 0, 2, 32)
    rect(c, '#f59e0b', 0, 0, 32, 2)
    rect(c, '#f59e0b', 0, 30, 32, 2)

    // Inner emblem
    rect(c, '#b91c1c', 6, 6, 20, 20)
    c.fillStyle = '#fbbf24'
    c.fillRect(13, 13, 6, 6)
  },

  // 13. Door - Arched campus portal with brass handles
  (c) => {
    rect(c, '#451a03', 2, 0, 28, 32)
    rect(c, '#78350f', 5, 3, 22, 29)
    // Glass panes with light
    rect(c, '#60a5fa', 8, 6, 7, 14)
    rect(c, '#60a5fa', 17, 6, 7, 14)
    rect(c, '#bfdbfe', 9, 8, 2, 8)
    rect(c, '#bfdbfe', 18, 8, 2, 8)
    // Brass handles
    rect(c, '#f59e0b', 14, 18, 2, 3)
    rect(c, '#fef08a', 14, 18, 1, 1)
  },
]

export function ensureTileset(scene: Phaser.Scene): void {
  if (scene.textures.exists(TILESET_KEY)) return
  const [el, ctx] = canvas(TILE * tileDrawers.length, TILE)
  tileDrawers.forEach((draw, i) => {
    ctx.save()
    ctx.translate(i * TILE, 0)
    draw(ctx)
    ctx.restore()
  })
  scene.textures.addCanvas(TILESET_KEY, el)
}

// ───────────────────────── 128×128 Chibi Procedural Drawer ─────────────────────────
type Pose = 'stand' | 'interact' | 'collect' | 'celebrate'

function drawChibiCanvas(c: Ctx, charKey: CharKey, dir: Dir, step: number, pose: Pose, breathe = 0) {
  const cx = 64
  const bob = pose === 'celebrate' ? (step % 2 ? -6 : -2) : (step % 2 ? -2 : 0) + breathe
  const isUp = dir === 'up'
  const isLeft = dir === 'left'
  const isRight = dir === 'right'
  const isSide = isLeft || isRight
  const sideMul = isLeft ? -1 : 1

  // 1. Soft radial drop shadow under feet
  const gShadow = c.createRadialGradient(cx, 116, 4, cx, 116, 26)
  gShadow.addColorStop(0, 'rgba(15, 23, 42, 0.45)')
  gShadow.addColorStop(1, 'rgba(15, 23, 42, 0)')
  c.fillStyle = gShadow
  c.beginPath()
  c.ellipse(cx, 116, 26, 8, 0, 0, Math.PI * 2)
  c.fill()

  // 2. Legs / Shoes
  const legY = 94 + bob
  const legSwing = pose === 'stand' ? (step === 1 ? 4 : step === 3 ? -4 : 0) : 0

  if (charKey === 'teacher_m') {
    rect(c, '#1e293b', cx - 14, legY, 11, 20 - legSwing)
    rect(c, '#1e293b', cx + 3, legY, 11, 20 + legSwing)
    // Leather oxford shoes
    rect(c, '#0f172a', cx - 14, 112 - legSwing, 12, 5)
    rect(c, '#0f172a', cx + 2, 112 + legSwing, 12, 5)
    rect(c, '#334155', cx - 14, 112 - legSwing, 12, 1)
  } else if (charKey === 'teacher_f') {
    // Silk white pants
    rect(c, '#f8fafc', cx - 12, legY, 9, 18 - legSwing)
    rect(c, '#f8fafc', cx + 3, legY, 9, 18 + legSwing)
    // Pastel slippers
    rect(c, '#f472b6', cx - 11, 112 - legSwing, 9, 4)
    rect(c, '#f472b6', cx + 2, 112 + legSwing, 9, 4)
    // Flowing Áo dài panel
    const gPanel = c.createLinearGradient(cx, legY, cx, legY + 22)
    gPanel.addColorStop(0, '#fbcfe8')
    gPanel.addColorStop(1, '#f472b6')
    c.fillStyle = gPanel
    c.beginPath()
    c.ellipse(cx, legY + 8, 18, 14, 0, 0, Math.PI * 2)
    c.fill()
  } else if (charKey === 'student_m') {
    rect(c, '#1e3a8a', cx - 13, legY, 10, 19 - legSwing)
    rect(c, '#1e3a8a', cx + 3, legY, 10, 19 + legSwing)
    // White/Navy sneakers
    rect(c, '#f8fafc', cx - 13, 111 - legSwing, 11, 5)
    rect(c, '#f8fafc', cx + 2, 111 + legSwing, 11, 5)
    rect(c, '#1e3a8a', cx - 13, 113 - legSwing, 11, 2)
    rect(c, '#1e3a8a', cx + 2, 113 + legSwing, 11, 2)
  } else {
    // Skirt + socks
    const gSkirt = c.createLinearGradient(cx, legY, cx, legY + 12)
    gSkirt.addColorStop(0, '#1e3a8a')
    gSkirt.addColorStop(1, '#0f172a')
    c.fillStyle = gSkirt
    c.beginPath(); c.ellipse(cx, legY + 3, 20, 10, 0, 0, Math.PI * 2); c.fill()
    rect(c, '#fce7f3', cx - 11, legY + 8, 8, 12 - legSwing)
    rect(c, '#fce7f3', cx + 3, legY + 8, 8, 12 + legSwing)
    rect(c, '#0f172a', cx - 11, 112 - legSwing, 9, 4)
    rect(c, '#0f172a', cx + 2, 112 + legSwing, 9, 4)
  }

  // 3. Torso / Shirt
  const bodyY = 66 + bob
  if (charKey === 'teacher_m') {
    const gShirt = c.createLinearGradient(cx, bodyY, cx, bodyY + 24)
    gShirt.addColorStop(0, '#dbeafe')
    gShirt.addColorStop(1, '#93c5fd')
    c.fillStyle = gShirt
    c.beginPath(); c.ellipse(cx, bodyY + 12, 19, 16, 0, 0, Math.PI * 2); c.fill()
    if (!isUp) {
      rect(c, '#1e3a8a', cx - 3, bodyY + 4, 6, 16)
      rect(c, '#172554', cx - 4, bodyY + 3, 8, 4)
    }
  } else if (charKey === 'teacher_f') {
    const gBodice = c.createLinearGradient(cx, bodyY, cx, bodyY + 24)
    gBodice.addColorStop(0, '#fce7f3')
    gBodice.addColorStop(1, '#f472b6')
    c.fillStyle = gBodice
    c.beginPath(); c.ellipse(cx, bodyY + 12, 17, 15, 0, 0, Math.PI * 2); c.fill()
    if (!isUp) {
      rect(c, '#db2777', cx - 4, bodyY + 2, 8, 3)
    }
  } else if (charKey === 'student_m') {
    rect(c, '#ffffff', cx - 17, bodyY, 34, 24)
    if (!isUp) {
      // Red scarf (Khăn quàng đỏ)
      c.fillStyle = '#dc2626'
      c.beginPath(); c.ellipse(cx, bodyY + 7, 8, 8, 0, 0, Math.PI * 2); c.fill()
      rect(c, '#b91c1c', cx - 3, bodyY + 6, 6, 14)
    }
  } else {
    rect(c, '#ffffff', cx - 16, bodyY, 32, 23)
    if (!isUp) {
      rect(c, '#2563eb', cx - 6, bodyY + 6, 12, 4)
      rect(c, '#1d4ed8', cx - 2, bodyY + 6, 4, 10)
    }
  }

  // 4. Arms & Items
  const armSwing = pose === 'stand' ? (step === 1 ? 5 : step === 3 ? -5 : 0) : 0
  if (pose === 'celebrate') {
    c.fillStyle = '#fdba74'
    c.beginPath(); c.ellipse(cx - 20, bodyY + 2, 5, 14, -0.3, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.ellipse(cx + 20, bodyY + 2, 5, 14, 0.3, 0, Math.PI * 2); c.fill()
  } else if (charKey === 'teacher_m') {
    rect(c, '#93c5fd', cx - 18, bodyY + 12 + armSwing, 6, 14)
    rect(c, '#93c5fd', cx + 13, bodyY + 10 - armSwing, 6, 14)
    // Book in left hand
    rect(c, '#991b1b', cx + 12, bodyY + 10 - armSwing, 12, 16)
    rect(c, '#fef08a', cx + 14, bodyY + 12 - armSwing, 9, 12)
  } else {
    c.fillStyle = '#fed7aa'
    c.beginPath(); c.ellipse(cx - 18, bodyY + 12 + armSwing, 4, 12, 0, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.ellipse(cx + 18, bodyY + 12 - armSwing, 4, 12, 0, 0, Math.PI * 2); c.fill()
  }

  // 5. Backpack (students)
  if (charKey === 'student_m' || charKey === 'student_f') {
    const bpCol = charKey === 'student_m' ? '#d97706' : '#ec4899'
    if (isUp) {
      c.fillStyle = bpCol
      c.beginPath(); c.ellipse(cx, bodyY + 12, 16, 14, 0, 0, Math.PI * 2); c.fill()
      rect(c, '#ffffff', cx - 8, bodyY + 14, 16, 8)
    } else if (isSide) {
      c.fillStyle = bpCol
      c.beginPath(); c.ellipse(cx - sideMul * 14, bodyY + 12, 8, 13, 0, 0, Math.PI * 2); c.fill()
    }
  }

  // 6. Chibi Head & Skin
  const headY = 40 + bob
  const gHead = c.createRadialGradient(cx, headY, 6, cx, headY, 26)
  gHead.addColorStop(0, '#ffedd5')
  gHead.addColorStop(1, '#fed7aa')
  c.fillStyle = gHead
  c.beginPath(); c.ellipse(cx, headY, 26, 24, 0, 0, Math.PI * 2); c.fill()

  // Rosy cheeks
  if (!isUp) {
    c.fillStyle = 'rgba(251, 113, 133, 0.45)'
    c.beginPath(); c.arc(cx - 16, headY + 8, 5, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.arc(cx + 16, headY + 8, 5, 0, Math.PI * 2); c.fill()
  }

  // 7. Expressive Chibi Eyes
  if (!isUp) {
    const eyeY = headY + 3
    const eyeSpacing = isSide ? (isLeft ? -10 : 10) : 12
    const drawEye = (ex: number) => {
      // Iris
      const gIris = c.createLinearGradient(ex, eyeY - 6, ex, eyeY + 6)
      gIris.addColorStop(0, '#1e3a8a')
      gIris.addColorStop(1, '#0f172a')
      c.fillStyle = gIris
      c.beginPath(); c.ellipse(ex, eyeY, 6, 8, 0, 0, Math.PI * 2); c.fill()
      // Highlights
      c.fillStyle = '#ffffff'
      c.beginPath(); c.arc(ex + 2, eyeY - 2, 2.2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(ex - 2, eyeY + 3, 1.2, 0, Math.PI * 2); c.fill()
    }

    if (!isSide || isLeft) drawEye(cx - eyeSpacing)
    if (!isSide || isRight) drawEye(cx + eyeSpacing)

    // Gentle smile
    c.fillStyle = '#e11d48'
    c.beginPath(); c.arc(cx + (isSide ? sideMul * 2 : 0), headY + 14, 3, 0, Math.PI); c.fill()
  }

  // 8. Hair & Accessories
  if (charKey === 'teacher_m') {
    c.fillStyle = '#3f2212'
    c.beginPath(); c.ellipse(cx, headY - 10, 27, 16, 0, 0, Math.PI * 2); c.fill()
    rect(c, '#3f2212', cx - 26, headY - 14, 52, 10)
    // Glasses
    if (!isUp) {
      c.strokeStyle = '#94a3b8'
      c.lineWidth = 1.5
      c.strokeRect(cx - 18, headY - 2, 12, 10)
      c.strokeRect(cx + 6, headY - 2, 12, 10)
      rect(c, '#94a3b8', cx - 6, headY + 3, 12, 1)
    }
  } else if (charKey === 'teacher_f') {
    c.fillStyle = '#1c1917'
    c.beginPath(); c.ellipse(cx, headY - 10, 28, 16, 0, 0, Math.PI * 2); c.fill()
    // Chignon Bun
    c.beginPath(); c.ellipse(cx, headY - 24, 14, 11, 0, 0, Math.PI * 2); c.fill()
    // Jade Hairpin
    rect(c, '#10b981', cx - 12, headY - 25, 24, 3)
    c.fillStyle = '#34d399'
    c.beginPath(); c.arc(cx + 12, headY - 24, 4, 0, Math.PI * 2); c.fill()
  } else if (charKey === 'student_m') {
    c.fillStyle = '#171717'
    c.beginPath(); c.ellipse(cx, headY - 11, 28, 17, 0, 0, Math.PI * 2); c.fill()
    if (!isUp) {
      rect(c, '#171717', cx - 20, headY - 12, 10, 10)
      rect(c, '#171717', cx - 8, headY - 10, 12, 12)
      rect(c, '#171717', cx + 6, headY - 11, 14, 11)
    }
  } else {
    // Twin pigtails with ribbons
    c.fillStyle = '#292524'
    c.beginPath(); c.ellipse(cx, headY - 10, 28, 16, 0, 0, Math.PI * 2); c.fill()
    const braidY = headY + 8
    c.beginPath(); c.ellipse(cx - 26, braidY, 7, 18, 0, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.ellipse(cx + 26, braidY, 7, 18, 0, 0, Math.PI * 2); c.fill()
    // Pink ribbons
    c.fillStyle = '#f472b6'
    c.beginPath(); c.arc(cx - 24, braidY - 8, 4, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.arc(cx + 24, braidY - 8, 4, 0, Math.PI * 2); c.fill()
  }
}

const cellOf = (row: number, col: number) => row * COLS + col

/** Tạo spritesheet 1024×1024 (8×8 ô 128×128): hàng 0-3 đi bộ, 4 tương tác, 5 nhặt, 6 ăn mừng, 7 đứng yên. */
export function ensureCharacterSheet(scene: Phaser.Scene, key: string, charKey: CharKey): void {
  if (scene.textures.exists(key)) return
  const [el, ctx] = canvas(CELL * COLS, CELL * ROWS)
  const at = (row: number, col: number, fn: () => void) => {
    ctx.save()
    ctx.translate(col * CELL, row * CELL)
    ctx.beginPath()
    ctx.rect(0, 0, CELL, CELL)
    ctx.clip()
    fn()
    ctx.restore()
  }
  DIRS.forEach((d, r) => {
    for (let s = 0; s < 4; s++) at(r, s, () => drawChibiCanvas(ctx, charKey, d, s, 'stand'))
    at(7, r * 2, () => drawChibiCanvas(ctx, charKey, d, 0, 'stand', 0))
    at(7, r * 2 + 1, () => drawChibiCanvas(ctx, charKey, d, 0, 'stand', 2))
  })
  for (let s = 0; s < 4; s++) {
    at(4, s, () => drawChibiCanvas(ctx, charKey, 'down', s, 'interact'))
    at(5, s, () => drawChibiCanvas(ctx, charKey, 'down', s, 'collect'))
    at(6, s, () => drawChibiCanvas(ctx, charKey, 'down', s, 'celebrate'))
  }
  const tex = scene.textures.addCanvas(key, el)!
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) tex.add(cellOf(r, c), 0, c * CELL, r * CELL, CELL, CELL)
}

export function ensureAnims(scene: Phaser.Scene, key: string): void {
  if (scene.anims.exists(`${key}:walk-down`)) return
  const f = (row: number, cols: number[]) => cols.map((c) => ({ key, frame: cellOf(row, c) }))
  DIRS.forEach((d, r) => {
    scene.anims.create({ key: `${key}:walk-${d}`, frames: f(r, [0, 1, 2, 3]), frameRate: 8, repeat: -1 })
    scene.anims.create({ key: `${key}:run-${d}`, frames: f(r, [0, 1, 2, 3]), frameRate: 14, repeat: -1 })
    scene.anims.create({ key: `${key}:idle-${d}`, frames: f(7, [r * 2, r * 2 + 1]), frameRate: 2, repeat: -1 })
  })
  scene.anims.create({ key: `${key}:interact`, frames: f(4, [0, 1, 2, 3]), frameRate: 10 })
  scene.anims.create({ key: `${key}:collect`, frames: f(5, [0, 1, 2, 3]), frameRate: 8 })
  scene.anims.create({ key: `${key}:celebrate`, frames: f(6, [0, 1, 2, 3, 0, 1, 2, 3]), frameRate: 8 })
}

export const playerKey = (avatar: number, outfit: number) => `player_${avatar}_${outfit}`
export const npcKey = (sprite: number) => `npc_${sprite % NPC_LOOKS.length}`

export function ensurePlayerAssets(scene: Phaser.Scene, avatar: number, outfit: number): string {
  const charKey = CHAR_KEYS[avatar % CHAR_KEYS.length]!
  const key = playerKey(avatar, outfit)

  // Nếu file ảnh thật trong /assets/characters/{charKey}.png đã được BootScene nạp thành công
  if (scene.textures.exists(charKey)) {
    ensureAnims(scene, charKey)
    return charKey
  }

  // Fallback: Tạo canvas procedural 128×128
  ensureCharacterSheet(scene, key, charKey)
  ensureAnims(scene, key)
  return key
}

export function ensureNpcAssets(scene: Phaser.Scene, sprite: number): string {
  const key = npcKey(sprite)
  // Dùng 1 trong 4 thân hình chibi tương ứng cho NPC
  const charKey = CHAR_KEYS[sprite % CHAR_KEYS.length]!
  ensureCharacterSheet(scene, key, charKey)
  ensureAnims(scene, key)
  return key
}

/** Ảnh xem trước nhân vật cho màn hình chọn nhân vật (dùng trong React, không cần Phaser). */
export function previewDataUrl(avatar: number, _outfit: number): string {
  const charKey = CHAR_KEYS[avatar % CHAR_KEYS.length]!
  const [el, ctx] = canvas(CELL, CELL)
  drawChibiCanvas(ctx, charKey, 'down', 0, 'stand')
  return el.toDataURL()
}

// ───────────────────────── Biểu tượng POI & Markers ─────────────────────────
const ICONS: Record<string, (c: Ctx) => void> = {
  'icon-item': (c) => {
    rect(c, '#101426', 6, 2, 12, 20)
    rect(c, '#f5c96a', 8, 4, 8, 16)
    rect(c, '#fff0c2', 9, 5, 3, 6)
    rect(c, '#101426', 2, 8, 20, 8)
    rect(c, '#f5c96a', 4, 10, 16, 4)
  },
  'icon-story': (c) => {
    rect(c, '#101426', 3, 3, 18, 18)
    rect(c, '#f3e6c4', 5, 5, 14, 14)
    for (const y of [8, 11, 14]) rect(c, '#8a6b4a', 7, y, 10, 1)
  },
  'icon-game': (c) => {
    rect(c, '#101426', 2, 6, 20, 14)
    rect(c, '#36d6e8', 4, 8, 16, 10)
    rect(c, '#101426', 6, 12, 6, 2)
    rect(c, '#101426', 8, 10, 2, 6)
    rect(c, '#f5c96a', 15, 11, 3, 3)
  },
  'icon-heart': (c) => {
    rect(c, '#101426', 3, 5, 18, 14)
    rect(c, '#ff5d8f', 5, 7, 5, 5)
    rect(c, '#ff5d8f', 14, 7, 5, 5)
    rect(c, '#ff5d8f', 5, 10, 14, 4)
    rect(c, '#ff5d8f', 8, 14, 8, 3)
    rect(c, '#ff5d8f', 10, 17, 4, 2)
  },
  'icon-wall': (c) => {
    rect(c, '#101426', 2, 3, 20, 18)
    rect(c, '#f5c96a', 4, 5, 16, 14)
    rect(c, '#fff3d4', 6, 7, 5, 4)
    rect(c, '#fff3d4', 13, 7, 5, 4)
    rect(c, '#fff3d4', 6, 13, 12, 4)
  },
  'icon-sign': (c) => {
    rect(c, '#101426', 3, 3, 18, 12)
    rect(c, '#b88a55', 5, 5, 14, 8)
    rect(c, '#6b4a2b', 11, 15, 3, 7)
  },
  'mark-new': (c) => {
    rect(c, '#101426', 8, 0, 8, 18)
    rect(c, '#f5c96a', 10, 2, 4, 9)
    rect(c, '#f5c96a', 10, 13, 4, 3)
  },
  'mark-done': (c) => {
    rect(c, '#101426', 3, 3, 18, 18)
    rect(c, '#36d6e8', 5, 5, 14, 14)
    rect(c, '#101426', 8, 11, 3, 3)
    rect(c, '#101426', 11, 13, 3, 3)
    rect(c, '#101426', 14, 8, 3, 6)
  },
  'mark-wait': (c) => {
    rect(c, '#101426', 3, 8, 18, 8)
    rect(c, '#9aa3bd', 5, 10, 14, 4)
  },
}

export function ensureIcons(scene: Phaser.Scene): void {
  for (const [key, draw] of Object.entries(ICONS)) {
    if (scene.textures.exists(key)) continue
    const [el, ctx] = canvas(24, 24)
    draw(ctx)
    scene.textures.addCanvas(key, el)
  }
  if (!scene.textures.exists('glow')) {
    const [el, ctx] = canvas(64, 64)
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30)
    g.addColorStop(0, 'rgba(245,201,106,0.85)')
    g.addColorStop(1, 'rgba(245,201,106,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    scene.textures.addCanvas('glow', el)
  }
}

export const poiIcon = (type: string): string =>
  ({ item: 'icon-item', story: 'icon-story', minigame: 'icon-game', gratitude: 'icon-heart', wall: 'icon-wall', sign: 'icon-sign' }[type] ?? 'icon-item')
