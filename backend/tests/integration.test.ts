/**
 * Test tích hợp với MongoDB thật. Tự động BỎ QUA nếu không khởi động được MongoDB
 * (đặt TEST_MONGODB_URI=mongodb://localhost:27017/thanksquest_test hoặc cho phép tải mongodb-memory-server).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { GameSession, GuestSession, PlayerProgress, RewardEvent } from '../src/models/progress.js';
import { GratitudeMessage } from '../src/models/community.js';
import { User } from '../src/models/user.js';
import { seedContent } from '../src/seed/seed.js';
import { invalidateContent } from '../src/services/content.js';
import { levelFromXp } from '../src/domain/progression.js';
import bcrypt from 'bcryptjs';
import { resetDb, startTestDb } from './helpers/db.js';

const db = await startTestDb();
if (!db.ok) console.warn(`\n⚠ Bỏ qua test tích hợp: không có MongoDB (${db.reason})\n`);

const app = createApp();
const PASSWORD = 'matkhau-thu-nghiem-1';
const agent = () => request.agent(app);
type Agent = ReturnType<typeof agent>;

async function startGuest(a: Agent) {
  const r = await a.post('/api/guest/start');
  expect(r.status).toBeLessThan(300);
  return r.body.data;
}
async function register(a: Agent, email = `u${Math.random().toString(36).slice(2, 8)}@test.local`, name = 'Người Chơi') {
  const r = await a.post('/api/auth/register').send({ email, password: PASSWORD, displayName: name });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return { email, id: r.body.data.user.id as string };
}
async function makeAdmin(email = 'admin@test.local') {
  const u = await User.create({ email, displayName: 'Admin', role: 'admin', passwordHash: await bcrypt.hash(PASSWORD, 4) });
  const a = agent();
  const r = await a.post('/api/auth/login').send({ email, password: PASSWORD });
  expect(r.status).toBe(200);
  return { a, id: String(u._id) };
}
const stateOf = async (a: Agent) => (await a.get('/api/player/state')).body.data.state;
const quest = (st: any, id: string) => st.quests.find((q: any) => q.questId === id);

/** Trả lời đúng bài quiz bằng cách đọc đáp án từ DB (chỉ test mới được làm vậy). */
async function correctQuiz(attemptId: string) {
  const s = await GameSession.findOne({ attemptId }).lean();
  return (s!.payload as any).items.map((it: any) => ({ qid: it.qid, choice: it.order.indexOf(it.answerIndex) }));
}

describe.skipIf(!db.ok)('tích hợp (MongoDB)', () => {
  beforeAll(async () => { await resetDb(); await seedContent(); });
  afterAll(async () => { await db.stop(); });
  beforeEach(() => invalidateContent());

  describe('xác thực', () => {
    it('đăng ký → đăng nhập → /me → đăng xuất', async () => {
      const a = agent();
      const { email } = await register(a);
      expect((await a.get('/api/auth/me')).body.data.user.email).toBe(email);
      expect((await a.post('/api/auth/logout')).status).toBe(200);
      expect((await a.get('/api/auth/me')).status).toBe(401);
      const b = agent();
      expect((await b.post('/api/auth/login').send({ email, password: PASSWORD })).status).toBe(200);
      expect((await b.post('/api/auth/login').send({ email, password: 'sai-mat-khau-1' })).status).toBe(401);
    });
    it('email trùng → 409; mật khẩu được băm, không lưu plaintext', async () => {
      const email = 'trung@test.local';
      await register(agent(), email);
      const r = await agent().post('/api/auth/register').send({ email, password: PASSWORD, displayName: 'Khác' });
      expect(r.status).toBe(409);
      const u = await User.findOne({ email }).select('+passwordHash').lean();
      expect(u!.passwordHash).not.toContain(PASSWORD);
      expect(u!.passwordHash.startsWith('$2')).toBe(true);
    });
    it('refresh xoay vòng token; dùng lại token cũ bị từ chối và thu hồi cả chuỗi', async () => {
      const a = agent();
      await register(a);
      const jar = (r: request.Response) => (r.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('tq_rt='))!.split(';')[0]!;
      const login = await agent().post('/api/auth/login').send({ email: (await User.findOne().lean())!.email, password: PASSWORD });
      const oldRt = jar(login);
      const r1 = await request(app).post('/api/auth/refresh').set('Cookie', oldRt);
      expect(r1.status).toBe(200);
      const newRt = jar(r1);
      expect(newRt).not.toBe(oldRt);
      expect((await request(app).post('/api/auth/refresh').set('Cookie', oldRt)).status).toBe(401); // tái sử dụng
      expect((await request(app).post('/api/auth/refresh').set('Cookie', newRt)).status).toBe(401); // cả chuỗi bị thu hồi
    });
    it('tài khoản bị khóa không đăng nhập được', async () => {
      const a = agent();
      const { email, id } = await register(a);
      await User.updateOne({ _id: id }, { disabled: true });
      expect((await agent().post('/api/auth/login').send({ email, password: PASSWORD })).status).toBe(403);
    });
  });

  describe('Guest Mode', () => {
    it('tạo phiên, lưu token dạng hash, cookie HttpOnly, tải lại vẫn còn tiến độ', async () => {
      const a = agent();
      const r = await a.post('/api/guest/start');
      expect(r.status).toBe(201);
      const cookie = (r.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('tq_guest='))!;
      expect(cookie).toMatch(/HttpOnly/i);
      const token = cookie.split(';')[0]!.split('=')[1]!;
      const doc = await GuestSession.findOne({ guestId: r.body.data.guest.guestId }).lean();
      expect(doc!.tokenHash).not.toBe(token);
      expect(doc!.expiresAt.getTime()).toBeGreaterThan(Date.now());
      const s = await a.get('/api/guest/session');
      expect(s.status).toBe(200);
      expect(s.body.data.state.kind).toBe('guest');
      const again = await a.post('/api/guest/start'); // tiếp tục phiên cũ
      expect(again.body.data.guest.guestId).toBe(r.body.data.guest.guestId);
    });
    it('Guest không vào admin, không đăng công khai, không vào bảng xếp hạng', async () => {
      const a = agent();
      await startGuest(a);
      expect((await a.get('/api/admin/dashboard')).status).toBe(403);
      const g = await a.post('/api/gratitude').send({ title: 'Cảm ơn', body: 'Cảm ơn thầy cô rất nhiều', confirmPublic: true });
      expect(g.status).toBe(403);
      expect(g.body.error.code).toBe('ACCOUNT_REQUIRED');
      const lb = await a.get('/api/leaderboard');
      expect(lb.body.data.rows.every((r: any) => !String(r.userId).startsWith('g_'))).toBe(true);
    });
    it('client không thể tự gửi XP/level/vật phẩm', async () => {
      const a = agent();
      await startGuest(a);
      const r = await a.post('/api/guest/progress').send({ xp: 99999, level: 30, areaId: 'plaza' });
      expect(r.status).toBe(400); // schema strict
      expect((await stateOf(a)).level.xp).toBe(0);
    });
    it('phiên hết hạn bị từ chối', async () => {
      const a = agent();
      const { guest } = await startGuest(a);
      await GuestSession.updateOne({ guestId: guest.guestId }, { expiresAt: new Date(Date.now() - 1000) });
      expect((await a.get('/api/guest/session')).status).toBe(401);
      expect((await a.get('/api/player/state')).status).toBe(401);
    });
    it('kết thúc phiên xóa dữ liệu khách', async () => {
      const a = agent();
      const { guest } = await startGuest(a);
      await a.post('/api/guest/end');
      expect(await GuestSession.exists({ guestId: guest.guestId })).toBeNull();
      expect(await PlayerProgress.exists({ ownerKey: `guest:${guest.guestId}` })).toBeNull();
    });
  });

  describe('nhiệm vụ & phần thưởng (chống nhận trùng)', () => {
    it('luồng đầy đủ: nói chuyện → nhận → thu thập → hoàn thành → nhận thưởng đúng một lần', async () => {
      const a = agent();
      await startGuest(a);
      const d = await a.post('/api/game/npcs/professor/talk').send({});
      expect(d.body.data.dialogue.choices.some((c: any) => c.action === 'accept')).toBe(true);
      expect(quest(await stateOf(a), 'main_01').status).toBe('available');
      await a.post('/api/game/quests/main_01/start');
      expect(quest(await stateOf(a), 'main_01').status).toBe('in_progress');
      expect((await a.post('/api/game/quests/main_01/claim')).status).toBe(409); // chưa xong
      await a.post('/api/game/pois/plaza_board/collect');
      expect(quest(await stateOf(a), 'main_01').status).toBe('completed');
      const c1 = await a.post('/api/game/quests/main_01/claim');
      expect(c1.status).toBe(200);
      expect(c1.body.data.outcome.grant.xp).toBe(30);
      expect((await a.post('/api/game/quests/main_01/claim')).status).toBe(409);
      const st = await stateOf(a);
      expect(quest(st, 'main_01').status).toBe('claimed');
      expect(st.level.xp).toBe(5 + 30 + 10); // POI(5) + thưởng quest(30) + thành tựu First Step(10)
    });
    it('gọi nhận thưởng song song nhiều lần chỉ cộng một lần', async () => {
      const a = agent();
      const { guest } = await startGuest(a);
      const ownerKey = `guest:${guest.guestId}`;
      await a.post('/api/game/npcs/professor/talk').send({});
      await a.post('/api/game/quests/main_01/start');
      await a.post('/api/game/pois/plaza_board/collect');
      const before = (await stateOf(a)).level.xp;
      const rs = await Promise.all(Array.from({ length: 8 }, () => a.post('/api/game/quests/main_01/claim')));
      expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
      const after = await stateOf(a);
      // Đúng một sự kiện thưởng cho CHÍNH người chơi này, và XP chỉ tăng đúng 30 (không cộng nhiều lần).
      const events = await RewardEvent.find({ ownerKey, sourceKey: 'quest:main_01:xp' }).lean();
      expect(events).toHaveLength(1);
      expect(events[0]!.amount).toBe(30);
      expect(after.level.xp - before).toBe(30);
    });
    it('thu thập POI hai lần không nhận thêm', async () => {
      const a = agent();
      await startGuest(a);
      const r1 = await a.post('/api/game/pois/plaza_notes/collect');
      const xp1 = r1.body.data.state.level.xp;
      const r2 = await a.post('/api/game/pois/plaza_notes/collect');
      expect(r2.body.data.state.level.xp).toBe(xp1);
      expect(r2.body.data.state.inventory.find((i: any) => i.itemId === 'study_notes').qty).toBe(1);
    });
    it('khu vực bị khóa không vào được; POI trong khu khóa không thu thập được', async () => {
      const a = agent();
      await startGuest(a);
      const r = await a.post('/api/game/areas/hall/enter');
      expect(r.status).toBe(403);
      expect((await a.post('/api/game/pois/hall_card/collect')).status).toBe(403);
      expect((await a.post('/api/game/quests/main_03/start')).status).toBe(403); // chưa mở khóa
    });
    it('nhiệm vụ cần tài khoản bị khóa với Guest', async () => {
      const a = agent();
      await startGuest(a);
      const q = quest(await stateOf(a), 'main_10');
      expect(q.status).toBe('locked');
    });
    it('dùng vật phẩm: trừ số lượng và cộng XP đúng một lần mỗi vật phẩm', async () => {
      const a = agent();
      await startGuest(a);
      await a.post('/api/game/pois/plaza_notes/collect');
      const xp = (await stateOf(a)).level.xp;
      const u = await a.post('/api/player/inventory/use').send({ itemId: 'study_notes' });
      expect(u.status).toBe(200);
      expect(u.body.data.state.level.xp).toBe(xp + 15);
      expect((await a.post('/api/player/inventory/use').send({ itemId: 'study_notes' })).status).toBe(409);
    });
  });

  describe('mini game', () => {
    async function unlockLibraryQuiz(a: Agent) { /* thư viện mở sẵn, quiz không cần nhiệm vụ */ void a; }

    it('Quiz: đề không lộ đáp án; nộp sai không thưởng; nộp lại bị chặn', async () => {
      const a = agent();
      await startGuest(a);
      await unlockLibraryQuiz(a);
      const s = await a.post('/api/minigames/quiz/start');
      expect(s.status).toBe(201);
      const att = s.body.data.attempt;
      expect(JSON.stringify(att)).not.toMatch(/answerIndex|explanation/);
      expect(att.questions).toHaveLength(5);
      const wrong = att.questions.map((q: any) => ({ qid: q.qid, choice: 99 }));
      const r = await a.post('/api/minigames/quiz/submit').send({ attemptId: att.attemptId, answer: { answers: wrong } });
      expect(r.status).toBe(200);
      expect(r.body.data.outcome.passed).toBe(false);
      expect(r.body.data.state.level.xp).toBe(0);
      const again = await a.post('/api/minigames/quiz/submit').send({ attemptId: att.attemptId, answer: { answers: wrong } });
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('ALREADY_SUBMITTED');
    });
    it('Quiz: nộp đúng được thưởng lần đầu; nộp trùng song song chỉ tính một lần', async () => {
      const a = agent();
      await startGuest(a);
      const att = (await a.post('/api/minigames/quiz/start')).body.data.attempt;
      const answers = await correctQuiz(att.attemptId);
      const rs = await Promise.all(Array.from({ length: 5 }, () => a.post('/api/minigames/quiz/submit').send({ attemptId: att.attemptId, answer: { answers } })));
      expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
      const ok = rs.find((r) => r.status === 200)!;
      expect(ok.body.data.outcome.passed).toBe(true);
      expect((await stateOf(a)).level.xp).toBeGreaterThanOrEqual(60);
      expect(await RewardEvent.countDocuments({ sourceKey: 'mg:quiz:first:xp', ownerKey: /^guest:/ })).toBeGreaterThanOrEqual(1);
    });
    it('Quiz: không nộp được lượt của người khác', async () => {
      const a = agent(), b = agent();
      await startGuest(a); await startGuest(b);
      const att = (await a.post('/api/minigames/quiz/start')).body.data.attempt;
      const r = await b.post('/api/minigames/quiz/submit').send({ attemptId: att.attemptId, answer: { answers: [] } });
      expect(r.status).toBe(404);
    });
    it('Quiz: quá hạn bị từ chối', async () => {
      const a = agent();
      await startGuest(a);
      const att = (await a.post('/api/minigames/quiz/start')).body.data.attempt;
      await GameSession.updateOne({ attemptId: att.attemptId }, { deadline: new Date(Date.now() - 1000) });
      const r = await a.post('/api/minigames/quiz/submit').send({ attemptId: att.attemptId, answer: { answers: await correctQuiz(att.attemptId) } });
      expect(r.body.data.outcome.passed).toBe(false);
      expect((await stateOf(a)).level.xp).toBe(0);
    });
    it('Memory: chơi đúng được ghi nhận; chuỗi lật gian lận bị từ chối', async () => {
      const a = agent();
      await startGuest(a);
      const att = (await a.post('/api/minigames/memory/start')).body.data.attempt;
      const deck: string[] = att.deck;
      const pos = new Map<string, number[]>();
      deck.forEach((s, i) => pos.set(s, [...(pos.get(s) ?? []), i]));
      const flips = [...pos.values()].flat();
      await GameSession.updateOne({ attemptId: att.attemptId }, { startedAt: new Date(Date.now() - 60_000) }); // đảm bảo không "nhanh phi thực tế"
      const bad = await a.post('/api/minigames/memory/submit').send({ attemptId: att.attemptId, answer: { flips: [0, 0] } });
      expect(bad.body.data.outcome.passed).toBe(false); // lượt này đã tiêu thụ
      const att2 = (await a.post('/api/minigames/memory/start')).body.data.attempt;
      const pos2 = new Map<string, number[]>();
      (att2.deck as string[]).forEach((s, i) => pos2.set(s, [...(pos2.get(s) ?? []), i]));
      await GameSession.updateOne({ attemptId: att2.attemptId }, { startedAt: new Date(Date.now() - 60_000) });
      const good = await a.post('/api/minigames/memory/submit').send({ attemptId: att2.attemptId, answer: { flips: [...pos2.values()].flat() } });
      expect(good.body.data.outcome.passed).toBe(true);
      expect(good.body.data.outcome.result.stars).toBe(3);
      void flips;
    });
    it('Debug: sửa đúng qua, mã thực thi không bao giờ chạy; payload không lộ đáp án', async () => {
      const a = agent();
      await startGuest(a);
      const att = (await a.post('/api/minigames/debug/start')).body.data.attempt;
      expect(JSON.stringify(att)).not.toMatch(/mustMatch|accepted|solution/);
      const { Question } = await import('../src/models/content.js');
      const answers = [];
      for (const c of att.challenges) {
        const q = await Question.findOne({ qid: c.qid }).lean();
        answers.push({ qid: c.qid, code: q!.accepted[0] });
      }
      const r = await a.post('/api/minigames/debug/submit').send({ attemptId: att.attemptId, answer: { answers } });
      expect(r.body.data.outcome.passed).toBe(true);
      expect(r.body.data.outcome.result.passedCount).toBe(3);
      const att2 = (await a.post('/api/minigames/debug/start')).body.data.attempt;
      const evil = att2.challenges.map((c: any) => ({ qid: c.qid, code: 'process.exit(1); require("child_process").exec("rm -rf /")' }));
      const r2 = await a.post('/api/minigames/debug/submit').send({ attemptId: att2.attemptId, answer: { answers: evil } });
      expect(r2.status).toBe(200);
      expect(r2.body.data.outcome.passed).toBe(false);
    });
    it('Treasure: server giữ vị trí kho báu; đào trùng/ngoài lưới bị từ chối', async () => {
      const a = agent();
      await startGuest(a);
      const att = (await a.post('/api/minigames/treasure/start')).body.data.attempt;
      expect(att.treasures).toBe(3);
      expect(JSON.stringify(att)).not.toMatch(/"x":|positions/);
      const d1 = await a.post('/api/minigames/treasure/dig').send({ attemptId: att.attemptId, x: 0, y: 0 });
      expect(d1.status).toBe(200);
      expect(['found', 'hot', 'warm', 'cold']).toContain(d1.body.data.dig.heat);
      expect((await a.post('/api/minigames/treasure/dig').send({ attemptId: att.attemptId, x: 0, y: 0 })).status).toBe(400);
      expect((await a.post('/api/minigames/treasure/dig').send({ attemptId: att.attemptId, x: 99, y: 0 })).status).toBe(400);
      // Đào kho báu thật (đọc từ DB) để thắng.
      const s = await GameSession.findOne({ attemptId: att.attemptId }).lean();
      for (const t of (s!.payload as any).treasures) {
        if (t.x === 0 && t.y === 0) continue;
        await a.post('/api/minigames/treasure/dig').send({ attemptId: att.attemptId, x: t.x, y: t.y });
      }
      const r = await a.post('/api/minigames/treasure/submit').send({ attemptId: att.attemptId, answer: {} });
      expect(r.body.data.outcome.passed).toBe(true);
    });
    it('phần thưởng lặp lại giới hạn mỗi ngày', async () => {
      const a = agent();
      await startGuest(a);
      const xpAfter: number[] = [];
      for (let i = 0; i < 6; i++) {
        const att = (await a.post('/api/minigames/quiz/start')).body.data.attempt;
        const r = await a.post('/api/minigames/quiz/submit').send({ attemptId: att.attemptId, answer: { answers: await correctQuiz(att.attemptId) } });
        xpAfter.push(r.body.data.state.level.xp);
      }
      const gains = xpAfter.map((x, i) => x - (xpAfter[i - 1] ?? 0));
      expect(gains[0]).toBeGreaterThan(gains[1]!); // lần đầu thưởng lớn
      expect(gains.slice(4).every((g) => g <= 25 + 30)).toBe(true);
      expect(gains[5]).toBeLessThanOrEqual(gains[1]!); // đã hết suất lặp trong ngày
    });
  });

  describe('chuyển Guest → tài khoản', () => {
    async function playBit(a: Agent) {
      await a.post('/api/game/pois/plaza_notes/collect');
      const att = (await a.post('/api/minigames/quiz/start')).body.data.attempt;
      await a.post('/api/minigames/quiz/submit').send({ attemptId: att.attemptId, answer: { answers: await correctQuiz(att.attemptId) } });
      return stateOf(a);
    }
    it('chuyển XP/vật phẩm/nhiệm vụ; không chuyển lần hai; guest bị đánh dấu converted', async () => {
      const a = agent();
      const { guest } = await startGuest(a);
      const before = await playBit(a);
      const { id } = await register(a);
      const r = await a.post('/api/guest/convert');
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.data.outcome.conversion.transferredXp).toBe(before.level.xp);
      const st = r.body.data.state;
      expect(st.kind).toBe('user');
      expect(st.level.xp).toBe(before.level.xp);
      expect(st.inventory.find((i: any) => i.itemId === 'study_notes').qty).toBe(1);
      expect(st.passedMinigames).toContain('quiz');
      expect((await GuestSession.findOne({ guestId: guest.guestId }).lean())!.conversionStatus).toBe('converted');
      const again = await a.post('/api/guest/convert');
      expect(again.status).toBe(409);
      expect((await stateOf(a)).level.xp).toBe(before.level.xp); // không cộng trùng
      expect(await PlayerProgress.exists({ ownerKey: `guest:${guest.guestId}` })).toBeNull();
      expect(String(id).length).toBe(24);
    });
    it('chuyển song song chỉ thành công một lần', async () => {
      const a = agent();
      await startGuest(a);
      const before = await playBit(a);
      await register(a);
      const rs = await Promise.all([a.post('/api/guest/convert'), a.post('/api/guest/convert'), a.post('/api/guest/convert')]);
      expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
      expect((await stateOf(a)).level.xp).toBe(before.level.xp);
    });
    it('tài khoản đã có tiến độ: không ghi đè, phần trùng không cộng hai lần', async () => {
      // Tài khoản đã nhận thưởng quiz lần đầu và POI plaza_notes.
      const u = agent();
      const { email } = await register(u);
      await playBit(u);
      const existingXp = (await stateOf(u)).level.xp;
      await u.post('/api/auth/logout');
      // Khách chơi giống hệt rồi đăng nhập tài khoản đó.
      const a = agent();
      await startGuest(a);
      await playBit(a);
      await a.post('/api/auth/login').send({ email, password: PASSWORD });
      const r = await a.post('/api/guest/convert');
      expect(r.status).toBe(200);
      expect(r.body.data.outcome.conversion.skippedDuplicates).toBeGreaterThan(0);
      const st = await stateOf(a);
      expect(st.level.xp).toBeGreaterThanOrEqual(existingXp); // không bao giờ mất tiến độ cũ
      expect(st.level.xp).toBeLessThan(existingXp * 2); // phần trùng không bị cộng đôi
      expect(st.inventory.find((i: any) => i.itemId === 'study_notes').qty).toBe(1);
    });
    it('chưa đăng nhập hoặc không có phiên khách → từ chối, không mất dữ liệu', async () => {
      const a = agent();
      const { guest } = await startGuest(a);
      await playBit(a);
      expect((await a.post('/api/guest/convert')).status).toBe(403); // chưa có tài khoản
      expect(await PlayerProgress.exists({ ownerKey: `guest:${guest.guestId}` })).toBeTruthy();
      const b = agent();
      await register(b);
      expect((await b.post('/api/guest/convert')).status).toBe(401); // không có cookie khách
    });
    it('Guest không lên bảng xếp hạng nhưng tài khoản sau khi chuyển thì có', async () => {
      const a = agent();
      const totalBefore = (await a.get('/api/leaderboard?limit=50')).body.data.total as number;
      const { guest } = await startGuest(a);
      await playBit(a);
      const during = (await a.get('/api/leaderboard?limit=50')).body.data;
      // Chơi thử có XP nhưng bảng xếp hạng không đổi và không chứa Guest.
      expect(during.total).toBe(totalBefore);
      expect(during.rows.some((r: any) => String(r.userId).includes(guest.guestId) || String(r.userId).startsWith('g_'))).toBe(false);
      await register(a, undefined, 'Nguyễn Văn Thử');
      expect((await a.post('/api/guest/convert')).status).toBe(200);
      const lb = await a.get('/api/leaderboard?limit=50');
      expect(lb.body.data.total).toBe(totalBefore + 1);
      expect(lb.body.data.rows.some((r: any) => r.displayName === 'Nguyễn Văn Thử')).toBe(true);
      expect(lb.body.data.me.rank).toBeGreaterThanOrEqual(1);
    });
  });

  describe('XP, cấp độ, thành tựu, bảng xếp hạng', () => {
    it('cấp độ tăng đúng theo XP và thành tựu chỉ nhận một lần', async () => {
      const a = agent();
      await startGuest(a);
      await a.post('/api/game/npcs/professor/talk').send({});
      const st = await stateOf(a);
      expect(st.achievements.find((x: any) => x.achId === 'first_step').unlocked).toBe(true);
      await a.post('/api/game/pois/plaza_board/collect');
      const st2 = await stateOf(a);
      expect(st2.level.level).toBe(levelFromXp(st2.level.xp));
      expect(st2.achievements.filter((x: any) => x.unlocked)).toHaveLength(1);
    });
    it('Guest bị giới hạn XP tối đa trong phiên', async () => {
      const a = agent();
      const { guest } = await startGuest(a);
      await PlayerProgress.updateOne({ ownerKey: `guest:${guest.guestId}` }, { xp: 795 });
      const r = await a.post('/api/game/pois/plaza_notes/collect');
      expect(r.body.data.state.level.xp).toBeLessThanOrEqual(800);
    });
    it('bảng xếp hạng: sắp xếp theo XP, phân trang, daily/weekly', async () => {
      for (const [name, xp] of [['A', 300], ['B', 100], ['C', 200]] as const) {
        const a = agent();
        const { id } = await register(a, undefined, `Xếp hạng ${name}`);
        await PlayerProgress.updateOne({ ownerKey: `user:${id}` }, { xp });
        await RewardEvent.create({ ownerKey: `user:${id}`, sourceKey: `test:${name}`, kind: 'xp', amount: xp });
      }
      const r = await request(app).get('/api/leaderboard?limit=2');
      const names = r.body.data.rows.map((x: any) => x.displayName);
      expect(names[0]).toBe('Xếp hạng A');
      expect(r.body.data.rows).toHaveLength(2);
      expect(r.body.data.total).toBeGreaterThanOrEqual(3);
      const p2 = await request(app).get('/api/leaderboard?limit=2&page=2');
      expect(p2.body.data.rows[0].rank).toBe(3);
      const d = await request(app).get('/api/leaderboard/daily');
      expect(d.body.data.rows[0].xpGained).toBeGreaterThan(0);
      expect((await request(app).get('/api/leaderboard/weekly')).status).toBe(200);
    });
  });

  describe('Gratitude, kiểm duyệt, báo cáo', () => {
    it('AI Gratitude (chế độ mẫu khi chưa có API key) chỉ dùng nội dung người dùng nhập', async () => {
      const a = agent();
      await startGuest(a);
      const r = await a.post('/api/gratitude/generate').send({ recipient: 'cô Lan', thanks: 'đã kiên nhẫn giảng bài cho em' });
      expect(r.status).toBe(200);
      const g = r.body.data.outcome.generated;
      expect(['template', 'gemini', 'groq']).toContain(g.source);
      expect(g.versions.formal).toContain('cô Lan');
      expect((await a.post('/api/gratitude/generate').send({})).status).toBe(400);
    });
    it('đăng bài → Pending, không hiện công khai → admin duyệt → hiện → báo cáo → xử lý', async () => {
      const author = agent();
      await register(author, undefined, 'Tác Giả');
      const post = await author.post('/api/gratitude').send({ title: 'Cảm ơn cô', body: 'Em cảm ơn cô đã dạy em rất nhiều điều.', confirmPublic: true });
      expect(post.status).toBe(201);
      const id = post.body.data.outcome.message.id;
      expect(post.body.data.outcome.message.status).toBe('pending');
      expect((await request(app).get('/api/gratitude')).body.data.items).toHaveLength(0);
      expect((await request(app).get(`/api/gratitude/${id}`)).status).toBe(404); // chưa duyệt → ẩn
      expect((await author.get(`/api/gratitude/${id}`)).status).toBe(200); // tác giả vẫn xem được

      const student = agent();
      await register(student);
      expect((await student.patch(`/api/admin/gratitude/${id}/moderate`).send({ action: 'approve' })).status).toBe(403);

      const { a: admin } = await makeAdmin();
      expect((await admin.patch(`/api/admin/gratitude/${id}/moderate`).send({ action: 'reject' })).status).toBe(400); // cần lý do
      expect((await admin.patch(`/api/admin/gratitude/${id}/moderate`).send({ action: 'approve' })).status).toBe(200);
      const pub = await request(app).get('/api/gratitude');
      expect(pub.body.data.items).toHaveLength(1);
      expect(pub.body.data.items[0].authorName).toBe('Tác Giả');

      const rep = await student.post(`/api/gratitude/${id}/report`).send({ reason: 'Nội dung không phù hợp' });
      expect(rep.status).toBe(200);
      expect((await student.post(`/api/gratitude/${id}/report`).send({ reason: 'Nội dung không phù hợp' })).status).toBe(409);
      expect((await author.post(`/api/gratitude/${id}/report`).send({ reason: 'tự báo cáo' })).status).toBe(400);
      const reports = await admin.get('/api/admin/reports?status=open');
      expect(reports.body.data.total).toBe(1);
      const rid = reports.body.data.items[0].id;
      expect((await admin.patch(`/api/admin/reports/${rid}`).send({ action: 'resolve', rejectMessage: true })).status).toBe(200);
      expect((await admin.patch(`/api/admin/reports/${rid}`).send({ action: 'dismiss' })).status).toBe(409);
      expect((await request(app).get('/api/gratitude')).body.data.items).toHaveLength(0);
    });
    it('sửa bài đã duyệt đưa về Pending; thiếu xác nhận công khai bị từ chối', async () => {
      const a = agent();
      await register(a);
      expect((await a.post('/api/gratitude').send({ title: 'Cảm ơn', body: 'Cảm ơn thầy cô rất nhiều ạ.' })).status).toBe(400);
      const p = await a.post('/api/gratitude').send({ title: 'Cảm ơn', body: 'Cảm ơn thầy cô rất nhiều ạ.', confirmPublic: true });
      const id = p.body.data.outcome.message.id;
      await GratitudeMessage.updateOne({ _id: id }, { status: 'approved' });
      const e = await a.patch(`/api/gratitude/${id}`).send({ body: 'Nội dung đã được chỉnh sửa lại.' });
      expect(e.body.data.message.status).toBe('pending');
    });
  });

  describe('Admin', () => {
    it('dashboard trả số liệu thật; học sinh bị 403', async () => {
      const { a: admin } = await makeAdmin('admin2@test.local');
      const d = await admin.get('/api/admin/dashboard');
      expect(d.status).toBe(200);
      expect(d.body.data.totals.users).toBeGreaterThan(0);
      expect(d.body.data.totals.guestSessions).toBeGreaterThan(0);
      const s = agent();
      await register(s);
      expect((await s.get('/api/admin/dashboard')).status).toBe(403);
    });
    it('quản lý nhiệm vụ: tạo/sửa/xóa và nội dung có hiệu lực ngay', async () => {
      const { a: admin } = await makeAdmin('admin3@test.local');
      const created = await admin.post('/api/admin/quests').send({
        questId: 'qa_test', type: 'side', title: 'Test', npcId: 'professor', areaId: 'plaza',
        objectives: [{ id: 'o1', kind: 'poi', ref: 'plaza_notes', label: 'x' }], reward: { xp: 1 },
      });
      expect(created.status).toBe(201);
      const g = agent();
      await startGuest(g);
      expect(quest(await stateOf(g), 'qa_test')).toBeTruthy();
      expect((await admin.patch('/api/admin/quests/qa_test').send({ title: 'Đã sửa' })).body.data.item.title).toBe('Đã sửa');
      expect((await admin.delete('/api/admin/quests/qa_test')).status).toBe(200);
      invalidateContent();
      expect(quest(await stateOf(g), 'qa_test')).toBeUndefined();
    });
    it('admin không tự khóa/đổi quyền chính mình; khóa người dùng thu hồi phiên', async () => {
      const { a: admin, id } = await makeAdmin('admin4@test.local');
      expect((await admin.patch(`/api/admin/users/${id}`).send({ disabled: true })).status).toBe(400);
      const s = agent();
      const { id: sid } = await register(s);
      expect((await admin.patch(`/api/admin/users/${sid}`).send({ disabled: true })).status).toBe(200);
      expect((await agent().post('/api/auth/login').send({ email: (await User.findById(sid).lean())!.email, password: PASSWORD })).status).toBe(403);
    });
    it('không cho đưa trường nguy hiểm vào nội dung (prototype pollution / _id)', async () => {
      const { a: admin } = await makeAdmin('admin5@test.local');
      const r = await admin.post('/api/admin/items').send({ itemId: 'evil_item', name: 'x', category: 'book', __proto__: { polluted: true }, _id: '000000000000000000000000' });
      expect(r.status).toBe(201);
      expect(({} as any).polluted).toBeUndefined();
      expect(r.body.data.item._id).not.toBe('000000000000000000000000');
    });
  });
});
