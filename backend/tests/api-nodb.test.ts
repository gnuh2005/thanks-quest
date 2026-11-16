/**
 * Các kiểm tra HTTP chạy được mà KHÔNG cần MongoDB: validation, xác thực/phân quyền ở tầng middleware,
 * định dạng lỗi, bảo mật header. (Các luồng ghi DB nằm trong tests/integration.test.ts.)
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';

mongoose.set('bufferTimeoutMS', 1500); // không có DB: lỗi nhanh thay vì treo 10 giây

const app = createApp();

describe('hạ tầng', () => {
  it('health và 404 theo format thống nhất', async () => {
    const h = await request(app).get('/api/health');
    expect(h.status).toBe(200);
    expect(h.body).toMatchObject({ ok: true, data: { status: 'up' } });
    const n = await request(app).get('/api/khong-ton-tai');
    expect(n.status).toBe(404);
    expect(n.body.error.code).toBe('NOT_FOUND');
  });
  it('có header bảo mật của Helmet và không lộ X-Powered-By', async () => {
    const r = await request(app).get('/api/health');
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });
  it('JSON hỏng trả 400 chứ không phải 500', async () => {
    const r = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('BAD_JSON');
  });
  it('chặn request ghi từ origin lạ (CSRF)', async () => {
    const r = await request(app).post('/api/auth/logout').set('Origin', 'https://evil.example');
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('BAD_ORIGIN');
  });
});

describe('validation đầu vào (trước khi chạm DB)', () => {
  it('đăng ký: email sai, mật khẩu ngắn, tên ngắn', async () => {
    for (const body of [
      { email: 'khong-phai-email', password: 'matkhau123', displayName: 'An' },
      { email: 'a@b.co', password: '123', displayName: 'An' },
      { email: 'a@b.co', password: 'matkhau123', displayName: 'A' },
      {},
    ]) {
      const r = await request(app).post('/api/auth/register').send(body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.body.error.code).toBe('VALIDATION');
    }
  });
  it('đăng nhập: thiếu trường', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'a@b.co' });
    expect(r.status).toBe(400);
  });
  it('mật khẩu quá dài (>72 byte của bcrypt) bị từ chối', async () => {
    const r = await request(app).post('/api/auth/register').send({ email: 'a@b.co', password: 'x'.repeat(73), displayName: 'An Binh' });
    expect(r.status).toBe(400);
  });
});

describe('phân quyền ở backend (không chỉ ẩn nút ở frontend)', () => {
  it('chưa có phiên: các API game/người chơi trả 401', async () => {
    for (const [method, url] of [
      ['get', '/api/player/state'], ['get', '/api/game/areas'], ['post', '/api/game/quests/main_01/claim'],
      ['get', '/api/minigames'], ['post', '/api/minigames/quiz/start'], ['post', '/api/gratitude/generate'],
    ] as const) {
      const r = await (request(app) as any)[method](url).send({});
      expect(r.status, `${method} ${url}`).toBe(401);
    }
  });
  it('chưa đăng nhập: không đăng được lời tri ân, không vào được admin', async () => {
    expect((await request(app).post('/api/gratitude').send({})).status).toBe(401);
    for (const url of ['/api/admin/dashboard', '/api/admin/users', '/api/admin/quests', '/api/admin/gratitude']) {
      expect((await request(app).get(url)).status, url).toBe(401);
    }
    expect((await request(app).patch('/api/admin/gratitude/aaaaaaaaaaaaaaaaaaaaaaaa/moderate').send({ action: 'approve' })).status).toBe(401);
  });
  it('token giả không được chấp nhận', async () => {
    const r = await request(app).get('/api/admin/dashboard').set('Authorization', 'Bearer abc.def.ghi');
    expect(r.status).toBe(401);
    const c = await request(app).get('/api/player/state').set('Cookie', 'tq_guest=khong-ton-tai');
    // Cookie khách giả → cần tra DB; chấp nhận 401 (DB có) — không được trả 200.
    expect([401, 500, 503]).toContain(c.status);
  }, 15_000);
  it('tạo đăng ký mà không có mật khẩu admin mặc định: script từ chối khi thiếu biến môi trường', async () => {
    const { execFileSync } = await import('node:child_process');
    let failed = false;
    try {
      const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      execFileSync(npxCmd, ['tsx', 'src/scripts/createAdmin.ts'], {
        env: {
          PATH: process.env.PATH ?? '',
          HOME: process.env.HOME ?? '',
          SystemRoot: process.env.SystemRoot ?? '',
          USERPROFILE: process.env.USERPROFILE ?? '',
        },
        stdio: 'pipe',
        shell: process.platform === 'win32',
        timeout: 30_000,
      });
    } catch (e) {
      failed = true;
      expect(String((e as { stderr?: Buffer }).stderr)).toContain('ADMIN_EMAIL');
    }
    expect(failed).toBe(true);
  }, 40_000);
});
