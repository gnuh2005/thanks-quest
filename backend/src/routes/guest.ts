import { Router } from 'express';
import { z } from 'zod';
import { identify, owner, requireUser } from '../middleware/auth.js';
import { findGuestFromRequest } from '../middleware/auth.js';
import { convertGuest, endGuest, guestSummary, startGuest } from '../services/guestService.js';
import { setPosition, setProfile } from '../services/gameService.js';
import { asyncHandler, ok, parse } from '../utils/http.js';
import { unauthorized } from '../utils/errors.js';
import { limiter, respond, stateFor } from './shared.js';

export const guestRouter = Router();

async function requireGuest(req: Parameters<typeof findGuestFromRequest>[0]) {
  const s = await findGuestFromRequest(req);
  if (!s || s.conversionStatus === 'converted') throw unauthorized('Phiên chơi thử không hợp lệ hoặc đã hết hạn', 'NO_GUEST_SESSION');
  return s;
}

guestRouter.post('/start', limiter(60_000, 20), asyncHandler(async (req, res) => {
  const r = await startGuest(req, res);
  // Cookie vừa được đặt chưa có trong req; dựng trạng thái trực tiếp.
  req.principal = { kind: 'guest', guestId: r.guestId };
  ok(res, { guest: r, state: await stateFor(req) }, r.resumed ? 200 : 201);
}));

guestRouter.get('/session', asyncHandler(async (req, res) => {
  const s = await requireGuest(req);
  req.principal = { kind: 'guest', guestId: s.guestId };
  ok(res, {
    guest: { guestId: s.guestId, expiresAt: s.expiresAt },
    summary: await guestSummary(owner(req)),
    state: await stateFor(req),
  });
}));

// Chỉ nhận vị trí/khu vực/avatar. KHÔNG có XP, level hay vật phẩm — các giá trị này do server quyết định.
const progressBody = z.object({
  areaId: z.string().max(40).optional(),
  x: z.number().finite().min(0).max(10_000).optional(),
  y: z.number().finite().min(0).max(10_000).optional(),
  avatar: z.number().int().min(0).max(3).optional(),
  outfit: z.number().int().min(0).max(2).optional(),
}).strict();

guestRouter.post('/progress', asyncHandler(async (req, res) => {
  const s = await requireGuest(req);
  req.principal = { kind: 'guest', guestId: s.guestId };
  const b = parse(progressBody, req.body);
  const o = owner(req);
  await setPosition(o, b.areaId, b.x, b.y);
  await setProfile(o, { avatar: b.avatar, outfit: b.outfit });
  ok(res, { state: await stateFor(req) });
}));

// Phải đăng nhập/đăng ký trước (có access token), cookie khách xác định tiến độ cần chuyển.
guestRouter.post('/convert', limiter(60_000, 10), identify, requireUser, asyncHandler(async (req, res) => {
  const p = req.principal;
  if (!p || p.kind !== 'user') throw unauthorized();
  const report = await convertGuest(req, p.userId);
  await respond(req, res, { conversion: report });
}));

guestRouter.post('/end', asyncHandler(async (req, res) => {
  await endGuest(req, res);
  ok(res, { ended: true });
}));
