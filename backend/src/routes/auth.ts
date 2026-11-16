import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { identify, requireUser } from '../middleware/auth.js';
import { User } from '../models/user.js';
import { clearSession, COOKIE, issueSession, revokeFamilyByToken, rotateRefresh } from '../services/tokens.js';
import { ensureProgress } from '../services/progress.js';
import { asyncHandler, ok, parse } from '../utils/http.js';
import { conflict, forbidden, unauthorized } from '../utils/errors.js';
import { limiter } from './shared.js';

export const authRouter = Router();
const authLimiter = limiter(15 * 60_000, 40);

const email = z.string().trim().toLowerCase().email('Email không hợp lệ').max(254);
const password = z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(72, 'Mật khẩu tối đa 72 ký tự');
const registerBody = z.object({ email, password, displayName: z.string().trim().min(2, 'Tên tối thiểu 2 ký tự').max(40, 'Tên tối đa 40 ký tự') });
const loginBody = z.object({ email, password: z.string().min(1).max(72) });

const BCRYPT_ROUNDS = 10;
let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  dummyHash ??= await bcrypt.hash('khong-phai-mat-khau-that', BCRYPT_ROUNDS);
  return dummyHash;
}

const publicUser = (u: { _id: unknown; email: string; displayName: string; role: string }) => ({
  id: String(u._id), email: u.email, displayName: u.displayName, role: u.role,
});

authRouter.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const body = parse(registerBody, req.body);
  if (await User.exists({ email: body.email })) throw conflict('Email này đã được đăng ký', 'EMAIL_TAKEN');
  const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
  let user;
  try {
    user = await User.create({ email: body.email, passwordHash, displayName: body.displayName, role: 'student' });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw conflict('Email này đã được đăng ký', 'EMAIL_TAKEN');
    throw e;
  }
  await ensureProgress({ kind: 'user', id: String(user._id), key: `user:${user._id}` });
  await issueSession(res, { id: String(user._id), role: user.role });
  ok(res, { user: publicUser(user) }, 201);
}));

authRouter.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const body = parse(loginBody, req.body);
  const user = await User.findOne({ email: body.email }).select('+passwordHash');
  const valid = await bcrypt.compare(body.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) throw unauthorized('Email hoặc mật khẩu không đúng', 'BAD_CREDENTIALS');
  if (user.disabled) throw forbidden('Tài khoản đã bị khóa', 'ACCOUNT_DISABLED');
  await issueSession(res, { id: String(user._id), role: user.role });
  ok(res, { user: publicUser(user) });
}));

authRouter.post('/refresh', authLimiter, asyncHandler(async (req, res) => {
  const presented = req.cookies?.[COOKIE.refresh] as string | undefined;
  if (!presented) throw unauthorized('Không có phiên đăng nhập', 'NO_REFRESH');
  try {
    const { userId, familyId } = await rotateRefresh(presented);
    const user = await User.findById(userId);
    if (!user || user.disabled) throw unauthorized('Tài khoản không hợp lệ');
    await issueSession(res, { id: String(user._id), role: user.role }, familyId);
    ok(res, { user: publicUser(user) });
  } catch (e) {
    clearSession(res);
    throw e;
  }
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  await revokeFamilyByToken(req.cookies?.[COOKIE.refresh] as string | undefined);
  clearSession(res);
  ok(res, { loggedOut: true });
}));

authRouter.get('/me', identify, asyncHandler(async (req, res) => {
  const p = req.principal;
  if (!p) throw unauthorized();
  if (p.kind === 'guest') return ok(res, { role: 'guest', guestId: p.guestId });
  const user = await User.findById(p.userId);
  if (!user || user.disabled) throw unauthorized('Tài khoản không hợp lệ');
  ok(res, { user: publicUser(user), role: user.role });
}));

export { requireUser };
