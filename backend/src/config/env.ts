import 'dotenv/config';
import crypto from 'node:crypto';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GUEST_TTL_HOURS: z.coerce.number().positive().default(24),
  GUEST_XP_CAP: z.coerce.number().int().positive().default(800),
  COOKIE_CROSS_SITE: bool,
  AUTO_SEED: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  TZ_OFFSET_HOURS: z.coerce.number().default(7),
});

const parsed = schema.parse(process.env);
const isProd = parsed.NODE_ENV === 'production';

function secret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const v = parsed[name];
  if (v && v.length >= 32) return v;
  if (isProd) throw new Error(`${name} bắt buộc (>= 32 ký tự) ở môi trường production`);
  if (parsed.NODE_ENV === 'development') {
    console.warn(`[env] ${name} chưa đặt — dùng khóa ngẫu nhiên tạm thời (token mất hiệu lực khi khởi động lại).`);
  }
  return crypto.randomBytes(48).toString('hex');
}

if (isProd && !parsed.MONGODB_URI) throw new Error('MONGODB_URI bắt buộc ở môi trường production');

export const env = {
  ...parsed,
  isProd,
  JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET'),
  corsOrigins: parsed.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  aiProvider: (parsed.GEMINI_API_KEY ? 'gemini' : parsed.GROQ_API_KEY ? 'groq' : 'template') as 'gemini' | 'groq' | 'template',
};
