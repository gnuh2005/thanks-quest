import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react'
import { EventBus, type MiniMapData, type MiniMapPos, type MiniMapTile } from '../../game/events/EventBus'
import { useGame, selectBlocking } from '../../stores/game'
import { vi } from '../../i18n'

const STORAGE_COLLAPSED_KEY = 'tq_minimap_collapsed'

export function Minimap() {
  const { openOverlay } = useGame()
  const blocking = useGame(selectBlocking)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const terrainCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const [mapData, setMapData] = useState<MiniMapData | null>(null)
  const [pos, setPos] = useState<MiniMapPos | null>(null)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_COLLAPSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Lưu trạng thái thu gọn
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_COLLAPSED_KEY, String(next))
      } catch {}
      return next
    })
  }

  // Lắng nghe sự kiện từ EventBus
  useEffect(() => {
    const unsubMap = EventBus.on('minimap:map', (data) => {
      setMapData(data)
    })
    const unsubPos = EventBus.on('minimap:pos', (newPos) => {
      setPos(newPos)
    })
    return () => {
      unsubMap()
      unsubPos()
    }
  }, [])

  // Vẽ sẵn địa hình tĩnh ra offscreen canvas khi đổi bản đồ
  useEffect(() => {
    if (!mapData) return

    const { cols, rows, grid } = mapData
    const offscreen = document.createElement('canvas')
    offscreen.width = cols
    offscreen.height = rows
    const ctx = offscreen.getContext('2d')
    if (!ctx) return

    const tileColors: Record<MiniMapTile, string> = {
      grass: '#2e7d32',
      path: '#d4a373',
      floor: '#475569',
      water: '#1d4ed8',
      solid: '#0f172a',
    }

    const imgData = ctx.createImageData(cols, rows)
    const data = imgData.data

    for (let i = 0; i < grid.length; i++) {
      const hex = tileColors[grid[i]!] || '#2e7d32'
      const n = parseInt(hex.replace('#', ''), 16)
      const r = (n >> 16) & 255
      const g = (n >> 8) & 255
      const b = n & 255
      data[i * 4] = r
      data[i * 4 + 1] = g
      data[i * 4 + 2] = b
      data[i * 4 + 3] = 255
    }

    ctx.putImageData(imgData, 0, 0)
    terrainCanvasRef.current = offscreen
  }, [mapData])

  // Vẽ frame trực tiếp lên canvas khi có cập nhật vị trí
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !mapData || collapsed) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { mapPx, portals, npcs, pois } = mapData
    const w = canvas.width
    const h = canvas.height

    // Tỉ lệ scale
    const scaleX = w / mapPx.w
    const scaleY = h / mapPx.h

    // 1. Xóa và vẽ địa hình tĩnh
    ctx.clearRect(0, 0, w, h)
    if (terrainCanvasRef.current) {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(terrainCanvasRef.current, 0, 0, w, h)
    }

    // 2. Vẽ cổng chuyển khu (Portals)
    for (const p of portals) {
      const px = p.x * scaleX
      const py = p.y * scaleY
      const pw = Math.max(3, p.w * scaleX)
      const ph = Math.max(3, p.h * scaleY)

      if (p.locked) {
        ctx.fillStyle = 'rgba(100, 116, 139, 0.7)'
        ctx.fillRect(px, py, pw, ph)
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 1
        ctx.strokeRect(px, py, pw, ph)
      } else {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.65)'
        ctx.fillRect(px, py, pw, ph)
        ctx.strokeStyle = '#4ade80'
        ctx.lineWidth = 1
        ctx.strokeRect(px, py, pw, ph)
      }
    }

    // 3. Vẽ POI (Vật phẩm, mini game, câu chuyện)
    const collected = pos?.collectedPois ?? []
    for (const poi of pois) {
      if (poi.type === 'item' && (collected.includes(poi.id) || poi.collected)) continue
      const px = poi.x * scaleX
      const py = poi.y * scaleY

      ctx.fillStyle = '#06b6d4'
      ctx.beginPath()
      ctx.arc(px, py, 2.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#cffafe'
      ctx.lineWidth = 0.8
      ctx.stroke()
    }

    // 4. Vẽ NPC (chấm vàng)
    for (const npc of npcs) {
      const nx = npc.x * scaleX
      const ny = npc.y * scaleY

      ctx.fillStyle = '#eab308'
      ctx.beginPath()
      ctx.arc(nx, ny, 2.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fef08a'
      ctx.lineWidth = 0.8
      ctx.stroke()

      // Dấu "!" nếu có nhiệm vụ
      if (npc.hasQuest) {
        ctx.fillStyle = '#ef4444'
        ctx.fillRect(nx - 1, ny - 6, 2, 3)
        ctx.fillRect(nx - 1, ny - 2, 2, 1.2)
      }
    }

    // 5. Vẽ Người chơi (chấm sáng nhấp nháy có mũi tên)
    if (pos) {
      const plX = pos.x * scaleX
      const plY = pos.y * scaleY

      // Vòng hào quang nhấp nháy
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)'
      ctx.beginPath()
      ctx.arc(plX, plY, 5, 0, Math.PI * 2)
      ctx.fill()

      // Chấm người chơi
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(plX, plY, 2.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#0284c7'
      ctx.lineWidth = 1
      ctx.stroke()

      // Mũi tên hướng đi
      ctx.fillStyle = '#f59e0b'
      ctx.beginPath()
      const d = pos.dir
      const off = 4.5
      if (d === 'up') {
        ctx.moveTo(plX, plY - off)
        ctx.lineTo(plX - 2, plY - 2)
        ctx.lineTo(plX + 2, plY - 2)
      } else if (d === 'down') {
        ctx.moveTo(plX, plY + off)
        ctx.lineTo(plX - 2, plY + 2)
        ctx.lineTo(plX + 2, plY + 2)
      } else if (d === 'left') {
        ctx.moveTo(plX - off, plY)
        ctx.lineTo(plX - 2, plY - 2)
        ctx.lineTo(plX - 2, plY + 2)
      } else {
        ctx.moveTo(plX + off, plY)
        ctx.lineTo(plX + 2, plY - 2)
        ctx.lineTo(plX + 2, plY + 2)
      }
      ctx.fill()
    }
  }, [mapData, pos, collapsed])

  // Ẩn mini map khi đang mở hội thoại / mini game / modal
  if (blocking || !mapData) return null

  const areaName = vi(mapData.areaName || 'Khuôn viên')

  return (
    <div
      className="pointer-events-auto flex flex-col rounded-xl border border-white/15 bg-navy/85 shadow-lg backdrop-blur transition-all select-none w-28 sm:w-36 overflow-hidden"
      data-testid="minimap-container"
    >
      {/* Tiêu đề Mini Map & Nút Thu Gọn */}
      <div className="flex items-center justify-between border-b border-white/10 px-2 py-1 bg-navy/90 text-white">
        <span className="flex items-center gap-1 truncate text-[11px] font-bold text-gold" title={areaName}>
          <MapPin size={11} className="shrink-0 text-cyan" />
          <span className="truncate">{areaName}</span>
        </span>
        <button
          onClick={toggleCollapsed}
          className="text-white/60 hover:text-white p-0.5"
          aria-label={collapsed ? 'Mở rộng bản đồ nhỏ' : 'Thu gọn bản đồ nhỏ'}
          aria-expanded={!collapsed}
          data-testid="btn-minimap-toggle"
        >
          {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
      </div>

      {/* Nội dung Canvas bản đồ nhỏ */}
      {!collapsed && (
        <div
          className="relative cursor-pointer group bg-black/40"
          onClick={() => openOverlay('map')}
          title="Bấm để mở Bản đồ chi tiết (phím M)"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openOverlay('map')
            }
          }}
          data-testid="minimap-clickable"
        >
          <canvas
            ref={canvasRef}
            width={144}
            height={96}
            className="w-full h-auto block"
            aria-label={`Bản đồ nhỏ khu ${areaName}`}
          />
          <div className="absolute inset-0 bg-cyan/0 group-hover:bg-cyan/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span className="rounded bg-navy/80 px-1.5 py-0.5 text-[9px] font-bold text-cyan shadow">Mở bản đồ (M)</span>
          </div>
        </div>
      )}
    </div>
  )
}
