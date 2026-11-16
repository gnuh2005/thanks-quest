const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── Pure Node PNG Encoder ──
function createPng(w, h, rgba) {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c >>> 0;
  }
  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  }
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const scanlines = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    scanlines[y * (w * 4 + 1)] = 0;
    rgba.copy(scanlines, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(scanlines, { level: 9 });
  return Buffer.concat([header, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── Software Canvas for RGBA Buffer ──
class SoftCanvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.buf = Buffer.alloc(w * h * 4, 0);
  }

  setPixel(x, y, r, g, b, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const idx = (y * this.w + x) * 4;
    if (a >= 255) {
      this.buf[idx] = r;
      this.buf[idx + 1] = g;
      this.buf[idx + 2] = b;
      this.buf[idx + 3] = 255;
    } else if (a > 0) {
      const alpha = a / 255;
      const inv = 1 - alpha;
      const curA = this.buf[idx + 3] / 255;
      const outA = alpha + curA * inv;
      if (outA > 0) {
        this.buf[idx] = Math.round((r * alpha + this.buf[idx] * curA * inv) / outA);
        this.buf[idx + 1] = Math.round((g * alpha + this.buf[idx + 1] * curA * inv) / outA);
        this.buf[idx + 2] = Math.round((b * alpha + this.buf[idx + 2] * curA * inv) / outA);
        this.buf[idx + 3] = Math.round(outA * 255);
      }
    }
  }

  hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  fillRect(x, y, w, h, col, a = 255) {
    const [r, g, b] = typeof col === 'string' ? this.hexToRgb(col) : col;
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w));
    const y1 = Math.min(this.h, Math.ceil(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        this.setPixel(px, py, r, g, b, a);
      }
    }
  }

  fillEllipse(cx, cy, rx, ry, col, a = 255) {
    const [r, g, b] = typeof col === 'string' ? this.hexToRgb(col) : col;
    const x0 = Math.max(0, Math.floor(cx - rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const x1 = Math.min(this.w, Math.ceil(cx + rx));
    const y1 = Math.min(this.h, Math.ceil(cy + ry));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d <= 1) {
          const edge = d > 0.85 ? Math.max(0, 1 - (d - 0.85) / 0.15) : 1;
          this.setPixel(px, py, r, g, b, Math.round(a * edge));
        }
      }
    }
  }

  fillCircle(cx, cy, rad, col, a = 255) {
    this.fillEllipse(cx, cy, rad, rad, col, a);
  }

  fillGradientEllipse(cx, cy, rx, ry, colCenter, colEdge, a = 255) {
    const [r0, g0, b0] = typeof colCenter === 'string' ? this.hexToRgb(colCenter) : colCenter;
    const [r1, g1, b1] = typeof colEdge === 'string' ? this.hexToRgb(colEdge) : colEdge;
    const x0 = Math.max(0, Math.floor(cx - rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const x1 = Math.min(this.w, Math.ceil(cx + rx));
    const y1 = Math.min(this.h, Math.ceil(cy + ry));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= 1) {
          const t = Math.min(1, Math.max(0, d));
          const r = Math.round(r0 * (1 - t) + r1 * t);
          const g = Math.round(g0 * (1 - t) + g1 * t);
          const b = Math.round(b0 * (1 - t) + b1 * t);
          const alpha = d > 0.9 ? a * (1 - (d - 0.9) / 0.1) : a;
          this.setPixel(px, py, r, g, b, Math.round(alpha));
        }
      }
    }
  }

  drawRimLight(cx, cy, rx, ry, col = '#ffffff', a = 90) {
    const [r, g, b] = typeof col === 'string' ? this.hexToRgb(col) : col;
    const x0 = Math.max(0, Math.floor(cx - rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const x1 = Math.min(this.w, Math.ceil(cx + rx));
    const y1 = Math.min(this.h, Math.ceil(cy)); // top half only
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= 0.75 && d <= 1.0) {
          const fade = 1 - Math.abs(d - 0.88) / 0.12;
          const topFactor = Math.max(0, -dy);
          this.setPixel(px, py, r, g, b, Math.round(a * fade * topFactor));
        }
      }
    }
  }
}

// ── Chibi Character Renderer (128×128) ──
function drawChibi(cv, charType, dir, step, pose, breathe = 0) {
  const cx = 64;
  const bob = pose === 'celebrate' ? (step % 2 ? -6 : -2) : (step % 2 ? -2 : 0) + breathe;
  const isUp = dir === 'up';
  const isLeft = dir === 'left';
  const isRight = dir === 'right';
  const isSide = isLeft || isRight;
  const sideMul = isLeft ? -1 : 1;

  // 1. Soft radial shadow under feet
  cv.fillGradientEllipse(cx, 116, 28, 9, [15, 23, 42], [15, 23, 42], 120);

  // 2. Legs / Shoes
  const legY = 94 + bob;
  const legSwing = pose === 'stand' ? (step === 1 ? 4 : step === 3 ? -4 : 0) : 0;

  if (charType === 'teacher_m') {
    // Thầy giáo: Dark navy trousers, leather shoes
    cv.fillRect(cx - 14, legY, 11, 20 - legSwing, '#1e293b');
    cv.fillRect(cx + 3, legY, 11, 20 + legSwing, '#1e293b');
    // Shoes
    cv.fillEllipse(cx - 9, 114 - legSwing, 8, 5, '#0f172a');
    cv.fillEllipse(cx + 8, 114 + legSwing, 8, 5, '#0f172a');
  } else if (charType === 'teacher_f') {
    // Cô giáo: Áo dài flowing down, gentle white silk pants
    cv.fillRect(cx - 12, legY, 9, 18 - legSwing, '#f8fafc');
    cv.fillRect(cx + 3, legY, 9, 18 + legSwing, '#f8fafc');
    // Pastel shoes
    cv.fillEllipse(cx - 8, 114 - legSwing, 7, 4, '#f472b6');
    cv.fillEllipse(cx + 7, 114 + legSwing, 7, 4, '#f472b6');
    // Flowing Áo dài panel
    cv.fillGradientEllipse(cx, legY + 8, 18, 14, '#fbcfe8', '#f472b6');
  } else if (charType === 'student_m') {
    // Học sinh nam: Navy trousers, white sneakers
    cv.fillRect(cx - 13, legY, 10, 19 - legSwing, '#1e3a8a');
    cv.fillRect(cx + 3, legY, 10, 19 + legSwing, '#1e3a8a');
    // White/Navy sneakers
    cv.fillEllipse(cx - 8, 113 - legSwing, 8, 5, '#f8fafc');
    cv.fillEllipse(cx + 8, 113 + legSwing, 8, 5, '#f8fafc');
    cv.fillRect(cx - 11, 115 - legSwing, 7, 2, '#1e3a8a');
    cv.fillRect(cx + 5, 115 + legSwing, 7, 2, '#1e3a8a');
  } else {
    // Học sinh nữ: Pleated navy skirt, black Mary Janes
    // Skirt
    cv.fillGradientEllipse(cx, legY + 3, 20, 10, '#1e3a8a', '#172554');
    cv.fillRect(cx - 11, legY + 8, 8, 12 - legSwing, '#fce7f3');
    cv.fillRect(cx + 3, legY + 8, 8, 12 + legSwing, '#fce7f3');
    // Black shoes
    cv.fillEllipse(cx - 7, 114 - legSwing, 6, 4, '#0f172a');
    cv.fillEllipse(cx + 7, 114 + legSwing, 6, 4, '#0f172a');
  }

  // 3. Torso / Shirt
  const bodyY = 66 + bob;
  if (charType === 'teacher_m') {
    // Light blue shirt with collar
    cv.fillGradientEllipse(cx, bodyY + 12, 19, 17, '#bfdbfe', '#60a5fa');
    cv.drawRimLight(cx, bodyY + 12, 19, 17, '#ffffff', 80);
    // Neck tie
    if (!isUp) {
      cv.fillRect(cx - 3, bodyY + 5, 6, 16, '#1e3a8a');
      cv.fillCircle(cx, bodyY + 4, 3, '#172554');
    }
  } else if (charType === 'teacher_f') {
    // Pastel Áo Dài bodice
    cv.fillGradientEllipse(cx, bodyY + 12, 17, 16, '#fce7f3', '#f472b6');
    cv.drawRimLight(cx, bodyY + 12, 17, 16, '#ffffff', 90);
    if (!isUp) {
      // Mandarin collar
      cv.fillCircle(cx, bodyY + 2, 4, '#ec4899');
    }
  } else if (charType === 'student_m') {
    // Crisp white shirt + Red scarf
    cv.fillGradientEllipse(cx, bodyY + 12, 18, 16, '#ffffff', '#e2e8f0');
    cv.drawRimLight(cx, bodyY + 12, 18, 16, '#ffffff', 70);
    if (!isUp) {
      // Khăn quàng đỏ (Red scarf)
      cv.fillPolygon = (pts, col) => {}; // fallback
      cv.fillEllipse(cx - 2, bodyY + 8, 7, 9, '#dc2626');
      cv.fillRect(cx - 4, bodyY + 6, 8, 14, '#ef4444');
      cv.fillCircle(cx, bodyY + 6, 4, '#b91c1c');
    }
  } else {
    // Học sinh nữ: White shirt + ribbon
    cv.fillGradientEllipse(cx, bodyY + 12, 17, 15, '#ffffff', '#e2e8f0');
    cv.drawRimLight(cx, bodyY + 12, 17, 15, '#ffffff', 70);
    if (!isUp) {
      cv.fillCircle(cx, bodyY + 6, 4, '#3b82f6');
      cv.fillRect(cx - 6, bodyY + 7, 12, 4, '#1d4ed8');
    }
  }

  // 4. Arms & Items
  const armSwing = pose === 'stand' ? (step === 1 ? 5 : step === 3 ? -5 : 0) : 0;
  if (pose === 'celebrate') {
    // Both arms up
    cv.fillEllipse(cx - 20, bodyY + 2, 6, 15, '#fdba74');
    cv.fillEllipse(cx + 20, bodyY + 2, 6, 15, '#fdba74');
  } else if (charType === 'teacher_m') {
    // Holding book in left hand
    cv.fillEllipse(cx - 18, bodyY + 14 + armSwing, 5, 12, '#93c5fd');
    cv.fillEllipse(cx + 17, bodyY + 12 - armSwing, 5, 12, '#93c5fd');
    // Leather book
    cv.fillRect(cx + 14, bodyY + 12 - armSwing, 12, 16, '#991b1b');
    cv.fillRect(cx + 16, bodyY + 14 - armSwing, 9, 12, '#fef08a');
  } else {
    // Normal swinging arms
    cv.fillEllipse(cx - 18, bodyY + 14 + armSwing, 5, 12, '#fed7aa');
    cv.fillEllipse(cx + 18, bodyY + 14 - armSwing, 5, 12, '#fed7aa');
  }

  // 5. Backpack (for students)
  if (charType === 'student_m' || charType === 'student_f') {
    const bpCol = charType === 'student_m' ? '#d97706' : '#ec4899';
    if (isUp) {
      cv.fillGradientEllipse(cx, bodyY + 12, 16, 14, bpCol, '#92400e');
      cv.fillRect(cx - 8, bodyY + 14, 16, 8, '#ffffff', 180);
    } else if (isSide) {
      const bpx = cx - sideMul * 14;
      cv.fillGradientEllipse(bpx, bodyY + 12, 8, 13, bpCol, '#92400e');
    }
  }

  // 6. Chibi Head (Cute, expressive, large proportion)
  const headY = 40 + bob;
  // Face / Skin
  cv.fillGradientEllipse(cx, headY, 26, 24, '#ffedd5', '#fed7aa');
  cv.drawRimLight(cx, headY, 26, 24, '#ffffff', 95);

  // Rosy cheeks
  if (!isUp) {
    cv.fillCircle(cx - 16, headY + 8, 5, '#fda4af', 130);
    cv.fillCircle(cx + 16, headY + 8, 5, '#fda4af', 130);
  }

  // 7. Eyes (Sparkling expressive chibi eyes)
  if (!isUp) {
    const eyeY = headY + 3;
    const eyeSpacing = isSide ? (isLeft ? -10 : 10) : 12;
    const eyeR = 6;

    if (!isSide || isLeft) {
      const ex = cx - eyeSpacing;
      // Eye socket / Iris
      cv.fillGradientEllipse(ex, eyeY, eyeR, eyeR + 2, '#1e3a8a', '#0f172a');
      // Highlight shine 1 (large top)
      cv.fillCircle(ex + 2, eyeY - 2, 2.2, '#ffffff');
      // Highlight shine 2 (small bottom)
      cv.fillCircle(ex - 2, eyeY + 3, 1.2, '#ffffff');
    }
    if (!isSide || isRight) {
      const ex = cx + eyeSpacing;
      cv.fillGradientEllipse(ex, eyeY, eyeR, eyeR + 2, '#1e3a8a', '#0f172a');
      cv.fillCircle(ex + 2, eyeY - 2, 2.2, '#ffffff');
      cv.fillCircle(ex - 2, eyeY + 3, 1.2, '#ffffff');
    }

    // Gentle smile
    cv.fillEllipse(cx + (isSide ? sideMul * 2 : 0), headY + 14, 4, 2, '#e11d48');
  }

  // 8. Hair & Glasses
  if (charType === 'teacher_m') {
    // Short neat brown hair with side part
    const hairCol = '#3f2212';
    cv.fillGradientEllipse(cx, headY - 10, 27, 16, '#5c3317', hairCol);
    cv.fillRect(cx - 26, headY - 14, 52, 10, hairCol);
    if (isSide) {
      cv.fillRect(cx + sideMul * 10, headY - 12, 16, 18, hairCol);
    }
    cv.drawRimLight(cx, headY - 10, 27, 16, '#fcd34d', 80);

    // Glasses
    if (!isUp) {
      const eyeY = headY + 3;
      cv.fillCircle(cx - 12, eyeY, 8, '#e2e8f0', 70);
      cv.fillCircle(cx + 12, eyeY, 8, '#e2e8f0', 70);
      cv.fillRect(cx - 6, eyeY - 1, 12, 2, '#94a3b8');
      // Rim highlight
      cv.fillCircle(cx - 10, eyeY - 3, 2, '#ffffff', 180);
      cv.fillCircle(cx + 14, eyeY - 3, 2, '#ffffff', 180);
    }
  } else if (charType === 'teacher_f') {
    // Elegant dark hair with graceful high bun
    const hairCol = '#1c1917';
    cv.fillGradientEllipse(cx, headY - 10, 28, 16, '#292524', hairCol);
    // Chignon Bun
    cv.fillGradientEllipse(cx, headY - 24, 14, 11, '#44403c', hairCol);
    // Jade Hairpin
    cv.fillRect(cx - 12, headY - 25, 24, 3, '#10b981');
    cv.fillCircle(cx + 12, headY - 24, 4, '#34d399');
    // Side bangs
    if (!isUp) {
      cv.fillEllipse(cx - 22, headY, 6, 14, hairCol);
      cv.fillEllipse(cx + 22, headY, 6, 14, hairCol);
    }
    cv.drawRimLight(cx, headY - 12, 28, 16, '#fbcfe8', 85);
  } else if (charType === 'student_m') {
    // Sporty youthful black fringe
    const hairCol = '#171717';
    cv.fillGradientEllipse(cx, headY - 11, 28, 17, '#404040', hairCol);
    if (!isUp) {
      // Dynamic fringe tufts
      cv.fillRect(cx - 20, headY - 12, 10, 10, hairCol);
      cv.fillRect(cx - 8, headY - 10, 12, 12, hairCol);
      cv.fillRect(cx + 6, headY - 11, 14, 11, hairCol);
    }
    cv.drawRimLight(cx, headY - 11, 28, 17, '#93c5fd', 80);
  } else {
    // Học sinh nữ: Twin braided pigtails with bows
    const hairCol = '#292524';
    cv.fillGradientEllipse(cx, headY - 10, 28, 16, '#44403c', hairCol);
    // Bangs
    if (!isUp) {
      cv.fillEllipse(cx, headY - 10, 22, 6, hairCol);
    }
    // Twin pigtails
    const braidY = headY + 8;
    cv.fillGradientEllipse(cx - 26, braidY, 7, 18, '#44403c', hairCol);
    cv.fillGradientEllipse(cx + 26, braidY, 7, 18, '#44403c', hairCol);
    // Pink ribbons
    cv.fillCircle(cx - 24, braidY - 8, 4, '#f472b6');
    cv.fillCircle(cx + 24, braidY - 8, 4, '#f472b6');
    cv.drawRimLight(cx, headY - 10, 28, 16, '#fbcfe8', 85);
  }
}

// ── Build Spritesheets for 4 Characters ──
const CHARS = ['teacher_m', 'teacher_f', 'student_m', 'student_f'];
const DIRS = ['down', 'left', 'right', 'up'];
const CELL = 128;
const COLS = 8;
const ROWS = 8;

const outDir = path.join('frontend', 'public', 'assets', 'characters');
fs.mkdirSync(outDir, { recursive: true });

for (const charType of CHARS) {
  const sheetCv = new SoftCanvas(CELL * COLS, CELL * ROWS);

  // Row 0-3: walk
  DIRS.forEach((dir, r) => {
    for (let s = 0; s < 4; s++) {
      const tileCv = new SoftCanvas(CELL, CELL);
      drawChibi(tileCv, charType, dir, s, 'stand');
      // copy tileCv to sheetCv
      copySub(tileCv, sheetCv, s * CELL, r * CELL);
    }
    // Idle frames on row 7
    const idleCv0 = new SoftCanvas(CELL, CELL);
    drawChibi(idleCv0, charType, dir, 0, 'stand', 0);
    copySub(idleCv0, sheetCv, (r * 2) * CELL, 7 * CELL);

    const idleCv1 = new SoftCanvas(CELL, CELL);
    drawChibi(idleCv1, charType, dir, 0, 'stand', 2); // subtle breathing bob
    copySub(idleCv1, sheetCv, (r * 2 + 1) * CELL, 7 * CELL);
  });

  // Row 4: interact, Row 5: collect, Row 6: celebrate
  for (let s = 0; s < 4; s++) {
    const interCv = new SoftCanvas(CELL, CELL);
    drawChibi(interCv, charType, 'down', s, 'interact');
    copySub(interCv, sheetCv, s * CELL, 4 * CELL);

    const colCv = new SoftCanvas(CELL, CELL);
    drawChibi(colCv, charType, 'down', s, 'collect');
    copySub(colCv, sheetCv, s * CELL, 5 * CELL);

    const celCv = new SoftCanvas(CELL, CELL);
    drawChibi(celCv, charType, 'down', s, 'celebrate');
    copySub(celCv, sheetCv, s * CELL, 6 * CELL);
  }

  // Encode PNG
  const pngBuf = createPng(CELL * COLS, CELL * ROWS, sheetCv.buf);
  fs.writeFileSync(path.join(outDir, `${charType}.png`), pngBuf);

  // Generate Phaser TexturePacker JSON Atlas
  const atlas = {
    frames: {},
    meta: {
      app: 'ThanksQuest Character Generator',
      version: '1.0',
      image: `${charType}.png`,
      format: 'RGBA8888',
      size: { w: CELL * COLS, h: CELL * ROWS },
      scale: 1,
    },
  };

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const frameIdx = r * COLS + c;
      atlas.frames[frameIdx] = {
        frame: { x: c * CELL, y: r * CELL, w: CELL, h: CELL },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: CELL, h: CELL },
        sourceSize: { w: CELL, h: CELL },
      };
    }
  }

  fs.writeFileSync(path.join(outDir, `${charType}.json`), JSON.stringify(atlas, null, 2));
  console.log(`✔ Generated ${charType}.png & ${charType}.json (${(pngBuf.length / 1024).toFixed(1)} KB)`);
}

function copySub(src, dst, dstX, dstY) {
  for (let y = 0; y < src.h; y++) {
    const srcRow = y * src.w * 4;
    const dstRow = ((dstY + y) * dst.w + dstX) * 4;
    src.buf.copy(dst.buf, dstRow, srcRow, srcRow + src.w * 4);
  }
}
