import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { GuestSession } from '../models/progress.js';
import { User } from '../models/user.js';
import { COOKIE, verifyAccess } from '../services/tokens.js';
import { sha256 } from '../utils/crypto.js';
import { forbidden, unauthorized } from '../utils/errors.js';

export type Principal =
  | { kind: 'user'; userId: string; role: 'student' | 'admin' }
  | { kind: 'guest'; guestId: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}

function bearer(req: Request): string | undefined {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : undefined;
}

export async function findGuestFromRequest(req: Request) {
  const token = req.cookies?.[COOKIE.guest] as string | undefined;
  if (!token || typeof token !== 'string') return null;
  const s = await GuestSession.findOne({ tokenHash: sha256(token) });
  if (!s || s.expiresAt.getTime() < Date.now()) return null;
  return s;
}

/** Nhận diện người dùng (nếu có). Tài khoản thật được ưu tiên hơn phiên khách. */
export const identify: RequestHandler = async (req, _res, next) => {
  try {
    const token = bearer(req) ?? (req.cookies?.[COOKIE.access] as string | undefined);
    const claims = token ? verifyAccess(token) : null;
    if (claims) {
      req.principal = { kind: 'user', userId: claims.sub, role: claims.role };
      return next();
    }
    const guest = await findGuestFromRequest(req);
    if (guest && guest.conversionStatus !== 'converted') {
      req.principal = { kind: 'guest', guestId: guest.guestId };
    }
    next();
  } catch (e) {
    next(e);
  }
};

/** Cho phép cả Guest lẫn Student/Admin. */
export const requirePlayer: RequestHandler = (req, _res, next) => {
  if (!req.principal) return next(unauthorized('Cần đăng nhập hoặc bắt đầu chơi thử', 'NO_SESSION'));
  next();
};

/** Chỉ tài khoản chính thức. Guest nhận mã ACCOUNT_REQUIRED để giao diện hiện modal đăng ký. */
export const requireUser: RequestHandler = (req, _res, next) => {
  const p = req.principal;
  if (!p) return next(unauthorized());
  if (p.kind !== 'user') return next(forbidden('Chức năng này cần tài khoản chính thức', 'ACCOUNT_REQUIRED'));
  next();
};

/** Quyền admin luôn được xác minh lại từ DB, không chỉ tin vào token. */
export const requireAdmin: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const p = req.principal;
    if (!p) return next(unauthorized());
    if (p.kind !== 'user') return next(forbidden('Khách không có quyền quản trị', 'ADMIN_ONLY'));
    const u = await User.findById(p.userId).select('role disabled');
    if (!u || u.disabled || u.role !== 'admin') return next(forbidden('Chỉ quản trị viên', 'ADMIN_ONLY'));
    next();
  } catch (e) {
    next(e);
  }
};

export function owner(req: Request): { kind: 'user' | 'guest'; id: string; key: string } {
  const p = req.principal;
  if (!p) throw unauthorized();
  const id = p.kind === 'user' ? p.userId : p.guestId;
  return { kind: p.kind, id, key: `${p.kind}:${id}` };
}
