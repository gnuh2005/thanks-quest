import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { owner } from '../middleware/auth.js';
import { User } from '../models/user.js';
import { buildState, type Owner } from '../services/progress.js';
import type { ActionOutcome } from '../services/gameService.js';
import { ok } from '../utils/http.js';

export const limiter = (windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit: env.NODE_ENV === 'test' ? 10_000 : limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau' } },
  });

export async function displayNameOf(req: Request): Promise<string> {
  const p = req.principal;
  if (!p || p.kind === 'guest') return 'Khách';
  const u = await User.findById(p.userId).select('displayName').lean();
  return u?.displayName ?? 'Người chơi';
}

export async function stateFor(req: Request) {
  return buildState(owner(req) as Owner, await displayNameOf(req));
}

/** Trả về kết quả hành động kèm trạng thái người chơi mới nhất (nguồn sự thật duy nhất cho client). */
export async function respond(req: Request, res: Response, outcome: unknown, status = 200): Promise<void> {
  ok(res, { outcome, state: await stateFor(req) }, status);
}

export type { ActionOutcome };
