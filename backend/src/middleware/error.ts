import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Endpoint không tồn tại' } });
};

/** Chặn request thay đổi dữ liệu đến từ origin lạ khi dùng cookie (phòng CSRF). */
export const originGuard: RequestHandler = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin || env.corsOrigins.includes(origin)) return next();
  res.status(403).json({ ok: false, error: { code: 'BAD_ORIGIN', message: 'Nguồn truy cập không được phép' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const send = (status: number, code: string, message: string) =>
    res.status(status).json({ ok: false, error: { code, message } });

  if (err instanceof AppError) return send(err.status, err.code, err.message);
  if (err instanceof ZodError) return send(400, 'VALIDATION', err.issues[0]?.message ?? 'Dữ liệu không hợp lệ');
  if (err instanceof mongoose.Error.ValidationError) return send(400, 'VALIDATION', 'Dữ liệu không hợp lệ');
  if (err instanceof mongoose.Error.CastError) return send(400, 'VALIDATION', 'Giá trị không hợp lệ');
  if ((err as { code?: number })?.code === 11000) return send(409, 'DUPLICATE', 'Dữ liệu đã tồn tại');
  if ((err as { type?: string })?.type === 'entity.parse.failed') return send(400, 'BAD_JSON', 'JSON không hợp lệ');
  if ((err as { type?: string })?.type === 'entity.too.large') return send(413, 'TOO_LARGE', 'Dữ liệu quá lớn');

  console.error('[error]', err);
  send(500, 'INTERNAL', 'Lỗi máy chủ');
};
