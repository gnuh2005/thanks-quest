import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { badRequest } from './errors.js';

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ ok: true, data });
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    const where = first?.path?.length ? ` (${first.path.join('.')})` : '';
    throw badRequest(`Dữ liệu không hợp lệ: ${first?.message ?? 'sai định dạng'}${where}`, 'VALIDATION');
  }
  return r.data;
}

export function pageParams(q: Record<string, unknown>, maxLimit = 50) {
  const page = Math.max(1, Math.floor(Number(q.page) || 1));
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(q.limit) || 20)));
  return { page, limit, skip: (page - 1) * limit };
}
