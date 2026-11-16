import { AVATAR_NAMES, previewDataUrl } from '../game/systems/textures'

// Minh họa thế giới 2D bằng SVG pixel-style (nguyên bản, không dùng tài nguyên ngoài).
// Đây là hình xem trước tĩnh; thế giới chơi thật do Phaser xử lý ở Phase 3.
const T = 24

const grass = '#2f8f5b'
const grassDark = '#276f49'
const path = '#d9b87c'

function Tree({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x + 9} y={y + 14} width="6" height="10" fill="#6b4a2b" />
      <rect x={x + 2} y={y + 2} width="20" height="16" rx="3" fill="#1f7a49" />
      <rect x={x + 6} y={y} width="12" height="6" fill="#2c9a5f" />
    </g>
  )
}

function Building({ x, y, w, h, roof, wall, label }: { x: number; y: number; w: number; h: number; roof: string; wall: string; label: string }) {
  const windowXs = [x + 10, x + w - 22]
  const doorX = x + w / 2 - 8
  const windowY = y + Math.min(26, h - 50)
  return (
    <g>
      {/* bóng đổ và bậc nền */}
      <rect x={x - 2} y={y + 17} width={w + 5} height={h - 7} rx="2" fill="#102c29" opacity="0.28" />
      <rect x={x - 3} y={y + h - 5} width={w + 6} height="6" fill="#d7c49b" />
      <rect x={x} y={y + h - 9} width={w} height="5" fill="#fff0ce" />

      {/* thân nhà và chân tường */}
      <rect x={x} y={y + 15} width={w} height={h - 24} fill={wall} />
      <rect x={x + 4} y={y + 19} width={w - 8} height={h - 28} fill="#fff" opacity="0.14" />
      <rect x={x} y={y + h - 14} width={w} height="5" fill={roof} opacity="0.85" />
      <rect x={x + 5} y={y + h - 9} width="3" height="3" fill="#fff" opacity="0.45" />
      <rect x={x + w - 8} y={y + h - 9} width="3" height="3" fill="#fff" opacity="0.45" />

      {/* mái nhiều lớp, có đường viền sáng và ngói */}
      <rect x={x - 6} y={y + 10} width={w + 12} height="8" fill="#172238" opacity="0.35" />
      <rect x={x - 5} y={y + 7} width={w + 10} height="9" fill={roof} />
      <rect x={x - 2} y={y + 2} width={w + 4} height="7" fill={roof} />
      <rect x={x + 2} y={y + 3} width={w - 4} height="2" fill="#fff" opacity="0.32" />
      {Array.from({ length: Math.floor(w / 18) }).map((_, i) => (
        <rect key={i} x={x + 5 + i * 18} y={y + 11} width="10" height="2" fill="#172238" opacity="0.2" />
      ))}
      <rect x={x - 7} y={y + 15} width={w + 14} height="4" fill="#fff" opacity="0.75" />
      <rect x={x - 7} y={y + 18} width={w + 14} height="2" fill="#172238" opacity="0.25" />

      {/* trụ mặt tiền */}
      <rect x={x + 4} y={y + 20} width="4" height={h - 36} fill="#fff" opacity="0.62" />
      <rect x={x + w - 8} y={y + 20} width="4" height={h - 36} fill="#172238" opacity="0.12" />

      {/* cửa sổ có khung, bậu và thanh chia ô */}
      {windowXs.map((wx) => (
        <g key={wx}>
          <rect x={wx - 2} y={windowY} width="17" height="18" fill="#253752" />
          <rect x={wx} y={windowY + 2} width="13" height="14" fill="#b9edff" />
          <rect x={wx + 1} y={windowY + 3} width="4" height="5" fill="#fff" opacity="0.65" />
          <rect x={wx + 6} y={windowY + 2} width="1.5" height="14" fill="#fff" opacity="0.8" />
          <rect x={wx} y={windowY + 9} width="13" height="1.5" fill="#fff" opacity="0.8" />
          <rect x={wx - 3} y={windowY + 17} width="19" height="3" fill="#fff0ce" />
        </g>
      ))}

      {/* cửa chính, ô kính và tay nắm */}
      <rect x={doorX - 2} y={y + h - 31} width="20" height="31" fill="#253752" />
      <rect x={doorX} y={y + h - 29} width="16" height="29" fill="#251b46" />
      <rect x={doorX + 2} y={y + h - 27} width="12" height="8" fill="#b9edff" opacity="0.9" />
      <rect x={doorX + 7} y={y + h - 27} width="2" height="8" fill="#fff" opacity="0.65" />
      <rect x={doorX + 2} y={y + h - 23} width="12" height="1.5" fill="#fff" opacity="0.65" />
      <rect x={doorX + 12} y={y + h - 14} width="2" height="2" fill="#f5c96a" />
      <rect x={doorX - 5} y={y + h - 2} width="26" height="3" fill="#fff0ce" />
      <text x={x + w / 2} y={y - 6} textAnchor="middle" fontSize="9" fontWeight="800" letterSpacing="0.35" fill="#fff" stroke="#172238" strokeWidth="1.2" paintOrder="stroke" fontFamily="'Be Vietnam Pro', system-ui, sans-serif">
        {label}
      </text>
    </g>
  )
}

export function WorldPreview({ className = '' }: { className?: string }) {
  const characters = [0, 1, 2, 3].map((avatar) => ({ avatar, image: previewDataUrl(avatar, 0) }))
  const characterSpots = [
    { x: 76, y: 116, ring: '#4f8cff' },
    { x: 362, y: 116, ring: '#36d6e8' },
    { x: 76, y: 220, ring: '#f5c96a' },
    { x: 288, y: 220, ring: '#e879a8' },
  ]
  return (
    <svg
      viewBox={`0 0 ${T * 20} ${T * 12}`}
      className={className}
      role="img"
      aria-label="Xem trước thế giới 2D của Hành trình tri ân: quảng trường, thư viện, phòng thí nghiệm công nghệ và hội trường tri ân"
      shapeRendering="crispEdges"
    >
      <rect width="100%" height="100%" fill={grass} />
      {Array.from({ length: 60 }).map((_, i) => (
        <rect key={i} x={(i * 53) % 470} y={(i * 97) % 280} width="6" height="4" fill={grassDark} />
      ))}
      <rect x="0" y={T * 7} width={T * 20} height={T * 2} fill={path} />
      <rect x={T * 9} y="0" width={T * 2} height={T * 12} fill={path} />
      <Building x={T * 1.5} y={T * 1.6} w={T * 4} h={T * 3.6} roof="#4f8cff" wall="#e9eefc" label="THƯ VIỆN" />
      <Building x={T * 13.5} y={T * 1.6} w={T * 4} h={T * 3.6} roof="#36d6e8" wall="#dff7fa" label="PHÒNG CÔNG NGHỆ" />
      <Building x={T * 13.5} y={T * 9} w={T * 4.5} h={T * 3} roof="#f5c96a" wall="#fff3d4" label="TRI ÂN" />
      <circle cx={T * 10} cy={T * 8} r={T * 1.4} fill="#4f8cff" opacity="0.35" />
      <circle cx={T * 10} cy={T * 8} r={T * 0.7} fill="#36d6e8" />
      <Tree x={T * 6.5} y={T * 2} />
      <Tree x={T * 7.2} y={T * 4.5} />
      <Tree x={T * 2} y={T * 9.5} />
      <Tree x={T * 4} y={T * 10} />
      {characters.map(({ avatar, image }, index) => {
        const spot = characterSpots[index]!
        return (
          <g key={avatar}>
            <ellipse cx={spot.x + 18} cy={spot.y + 36} rx="18" ry="5" fill="#101426" opacity="0.3" />
            <circle cx={spot.x + 18} cy={spot.y + 18} r="20" fill="#101426" opacity="0.22" />
            <circle cx={spot.x + 18} cy={spot.y + 18} r="19" fill="none" stroke={spot.ring} strokeWidth="1.5" opacity="0.9" />
            <image href={image} x={spot.x} y={spot.y} width="36" height="36" aria-label={AVATAR_NAMES[avatar]} imageRendering="pixelated" />
          </g>
        )
      })}
    </svg>
  )
}
