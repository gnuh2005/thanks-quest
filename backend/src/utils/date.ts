import { env } from '../config/env.js';

/** Ngày hiện tại (YYYY-MM-DD) theo múi giờ cấu hình, mặc định UTC+7. */
export function todayKey(now: number = Date.now()): string {
  return new Date(now + env.TZ_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);
}

export function startOfLocalDay(now: number = Date.now()): Date {
  const off = env.TZ_OFFSET_HOURS * 3_600_000;
  const local = now + off;
  return new Date(local - (local % 86_400_000) - off);
}

export function startOfLocalWeek(now: number = Date.now()): Date {
  const day = startOfLocalDay(now);
  const off = env.TZ_OFFSET_HOURS * 3_600_000;
  const dow = new Date(day.getTime() + off).getUTCDay(); // 0 = CN
  const sinceMonday = (dow + 6) % 7;
  return new Date(day.getTime() - sinceMonday * 86_400_000);
}
