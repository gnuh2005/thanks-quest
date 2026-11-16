import jwt from 'jsonwebtoken';
import type { CookieOptions, Response } from 'express';
import { env } from '../config/env.js';
import { RefreshToken } from '../models/user.js';
import { randomToken, sha256, uuid } from '../utils/crypto.js';
import { unauthorized } from '../utils/errors.js';

export const COOKIE = { access: 'tq_at', refresh: 'tq_rt', guest: 'tq_guest' } as const;
const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_MS = 14 * 24 * 3_600_000;

export interface AccessClaims {
  sub: string;
  role: 'student' | 'admin';
  typ: 'access';
}

export function signAccess(userId: string, role: 'student' | 'admin'): string {
  const claims: AccessClaims = { sub: userId, role, typ: 'access' };
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: ACCESS_TTL_SEC });
}

export function verifyAccess(token: string): AccessClaims | null {
  try {
    const p = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as AccessClaims;
    return p.typ === 'access' && typeof p.sub === 'string' ? p : null;
  } catch {
    return null;
  }
}

function baseCookie(maxAgeMs: number, path = '/'): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.COOKIE_CROSS_SITE ? 'none' : 'lax',
    maxAge: maxAgeMs,
    path,
  };
}

export function setGuestCookie(res: Response, token: string, maxAgeMs: number): void {
  res.cookie(COOKIE.guest, token, baseCookie(maxAgeMs));
}
export function clearGuestCookie(res: Response): void {
  res.clearCookie(COOKIE.guest, { ...baseCookie(0), maxAge: undefined });
}

export async function issueSession(
  res: Response,
  user: { id: string; role: 'student' | 'admin' },
  familyId: string = uuid(),
): Promise<void> {
  const refresh = randomToken(48);
  await RefreshToken.create({
    userId: user.id,
    tokenHash: sha256(refresh),
    familyId,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  res.cookie(COOKIE.access, signAccess(user.id, user.role), baseCookie(ACCESS_TTL_SEC * 1000));
  res.cookie(COOKIE.refresh, refresh, baseCookie(REFRESH_TTL_MS, '/api/auth'));
}

export function clearSession(res: Response): void {
  const clear = { ...baseCookie(0), maxAge: undefined };
  res.clearCookie(COOKIE.access, clear);
  res.clearCookie(COOKIE.refresh, { ...clear, path: '/api/auth' });
}

/** Xoay vòng refresh token. Dùng lại token đã thu hồi → thu hồi cả "gia đình" token (nghi bị đánh cắp). */
export async function rotateRefresh(presented: string): Promise<{ userId: string; familyId: string }> {
  const hash = sha256(presented);
  const doc = await RefreshToken.findOne({ tokenHash: hash });
  if (!doc) throw unauthorized('Phiên đăng nhập không hợp lệ', 'INVALID_REFRESH');
  if (doc.revokedAt) {
    await RefreshToken.updateMany({ familyId: doc.familyId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    throw unauthorized('Phiên đăng nhập đã bị thu hồi', 'REFRESH_REUSED');
  }
  if (doc.expiresAt.getTime() < Date.now()) throw unauthorized('Phiên đăng nhập đã hết hạn', 'REFRESH_EXPIRED');

  // Đánh dấu thu hồi một cách nguyên tử để hai request song song không cùng xoay vòng được.
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: doc._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
  if (!claimed) throw unauthorized('Phiên đăng nhập không hợp lệ', 'INVALID_REFRESH');
  return { userId: String(doc.userId), familyId: doc.familyId };
}

export async function revokeFamilyByToken(presented: string | undefined): Promise<void> {
  if (!presented) return;
  const doc = await RefreshToken.findOne({ tokenHash: sha256(presented) });
  if (doc) {
    await RefreshToken.updateMany({ familyId: doc.familyId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
  }
}
