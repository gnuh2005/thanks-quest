import { Router } from 'express';
import type { Model, PipelineStage } from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { identify, requireAdmin } from '../middleware/auth.js';
import { Achievement, GameArea, Item, MiniGame, Npc, Question, Quest } from '../models/content.js';
import { GratitudeMessage, Notification, Report } from '../models/community.js';
import { GameSession, GuestSession, PlayerProgress, RewardEvent } from '../models/progress.js';
import { RefreshToken, User } from '../models/user.js';
import { invalidateContent } from '../services/content.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { asyncHandler, ok, pageParams, parse } from '../utils/http.js';
import { limiter } from './shared.js';

export const adminRouter = Router();
adminRouter.use(limiter(60_000, 240), identify, requireAdmin);

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Mã không hợp lệ');
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ───────────────────────── Dashboard ─────────────────────────
adminRouter.get('/dashboard', asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(1, Math.floor(Number(req.query.days) || 14)));
  const since = new Date(Date.now() - days * 86_400_000);
  const tz = `${env.TZ_OFFSET_HOURS >= 0 ? '+' : '-'}${String(Math.abs(env.TZ_OFFSET_HOURS)).padStart(2, '0')}:00`;
  const daily = (field: string): PipelineStage[] => [
    { $match: { [field]: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: tz } }, n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ];

  const [users, activePlayers, questAgg, plays, playsPassed, gratitude, guestTotal, guestActive, guestConverted, reportsOpen, series] = await Promise.all([
    User.countDocuments({}),
    PlayerProgress.countDocuments({ kind: 'user', updatedAt: { $gte: since } }),
    PlayerProgress.aggregate([
      { $match: { kind: 'user' } },
      { $project: { n: { $size: { $ifNull: ['$claimedQuests', []] } } } },
      { $group: { _id: null, total: { $sum: '$n' } } },
    ]),
    GameSession.countDocuments({ status: { $in: ['submitted', 'expired'] }, createdAt: { $gte: since } }),
    GameSession.countDocuments({ status: 'submitted', 'result.passed': true, createdAt: { $gte: since } }),
    GratitudeMessage.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    GuestSession.countDocuments({ createdAt: { $gte: since } }),
    GuestSession.countDocuments({ expiresAt: { $gt: new Date() }, conversionStatus: 'none' }),
    GuestSession.countDocuments({ conversionStatus: 'converted', createdAt: { $gte: since } }),
    Report.countDocuments({ status: 'open' }),
    Promise.all([GameSession.aggregate(daily('createdAt')), GuestSession.aggregate(daily('createdAt')), User.aggregate(daily('createdAt'))]),
  ]);

  const g = Object.fromEntries((gratitude as { _id: string; n: number }[]).map((r) => [r._id, r.n]));
  ok(res, {
    rangeDays: days,
    totals: {
      users, activePlayers,
      questsCompleted: (questAgg as { total: number }[])[0]?.total ?? 0,
      minigamePlays: plays, minigamePasses: playsPassed,
      gratitude: { pending: g.pending ?? 0, approved: g.approved ?? 0, rejected: g.rejected ?? 0, total: (g.pending ?? 0) + (g.approved ?? 0) + (g.rejected ?? 0) },
      guestSessions: guestTotal, guestActive, guestConverted, reportsOpen,
    },
    series: { minigamePlays: series[0], guestSessions: series[1], newUsers: series[2] },
  });
}));

// ───────────────────────── Người dùng ─────────────────────────
adminRouter.get('/users', asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query as Record<string, unknown>, 100);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  const filter = q ? { $or: [{ email: new RegExp(`^${escapeRegex(q.toLowerCase())}`) }, { displayName: new RegExp(escapeRegex(q), 'i') }] } : {};
  const [rows, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const prog = await PlayerProgress.find({ ownerKey: { $in: rows.map((u) => `user:${u._id}`) } }).select('ownerKey xp level').lean();
  const pm = new Map(prog.map((p) => [p.ownerKey, p]));
  ok(res, {
    total, page, limit,
    items: rows.map((u) => ({
      id: String(u._id), email: u.email, displayName: u.displayName, role: u.role, disabled: !!u.disabled,
      isDemo: !!u.isDemo, createdAt: u.createdAt, xp: pm.get(`user:${u._id}`)?.xp ?? 0, level: pm.get(`user:${u._id}`)?.level ?? 1,
    })),
  });
}));

adminRouter.patch('/users/:id', asyncHandler(async (req, res) => {
  const id = parse(objectId, req.params.id);
  const b = parse(z.object({ disabled: z.boolean().optional(), role: z.enum(['student', 'admin']).optional() }).strict(), req.body);
  if (req.principal?.kind === 'user' && req.principal.userId === id) throw badRequest('Không thể tự thay đổi quyền hoặc khóa chính mình');
  const u = await User.findByIdAndUpdate(id, { $set: b }, { returnDocument: 'after' }).lean();
  if (!u) throw notFound('Không tìm thấy người dùng');
  if (b.disabled) await RefreshToken.updateMany({ userId: u._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
  ok(res, { user: { id: String(u._id), email: u.email, displayName: u.displayName, role: u.role, disabled: !!u.disabled } });
}));

// ───────────────────────── Bảng xếp hạng ─────────────────────────
adminRouter.post('/leaderboard/:userId/reset', asyncHandler(async (req, res) => {
  const userId = parse(objectId, req.params.userId);
  parse(z.object({ confirm: z.literal(true) }), req.body);
  const r = await PlayerProgress.updateOne({ ownerKey: `user:${userId}` }, { $set: { xp: 0, level: 1 } });
  if (r.matchedCount !== 1) throw notFound('Không tìm thấy tiến độ người chơi');
  await RewardEvent.deleteMany({ ownerKey: `user:${userId}`, kind: 'xp' });
  ok(res, { reset: true });
}));

// ───────────────────────── Kiểm duyệt tri ân ─────────────────────────
adminRouter.get('/gratitude', asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query as Record<string, unknown>, 100);
  const status = ['pending', 'approved', 'rejected'].includes(String(req.query.status)) ? String(req.query.status) : undefined;
  const filter: Record<string, unknown> = status ? { status } : {};
  const [items, total] = await Promise.all([
    GratitudeMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    GratitudeMessage.countDocuments(filter),
  ]);
  ok(res, { items: items.map((m: any) => ({ ...m, id: String(m._id) })), total, page, limit });
}));

adminRouter.patch('/gratitude/:id/moderate', asyncHandler(async (req, res) => {
  const id = parse(objectId, req.params.id);
  const b = parse(z.object({ action: z.enum(['approve', 'reject', 'delete']), reason: z.string().trim().max(300).optional() }), req.body);
  const adminId = req.principal!.kind === 'user' ? req.principal!.userId : undefined;
  const m = await GratitudeMessage.findById(id);
  if (!m) throw notFound('Không tìm thấy lời cảm ơn');
  if (b.action === 'delete') {
    await Promise.all([GratitudeMessage.deleteOne({ _id: id }), Report.updateMany({ messageId: id, status: 'open' }, { $set: { status: 'resolved', resolvedBy: adminId, resolvedAt: new Date() } })]);
    return ok(res, { deleted: true });
  }
  if (b.action === 'reject' && !b.reason) throw badRequest('Hãy nhập lý do từ chối');
  m.status = b.action === 'approve' ? 'approved' : 'rejected';
  m.moderation = { by: adminId as any, at: new Date(), reason: b.reason ?? '' } as any;
  if (b.action === 'approve') m.reportCount = 0;
  await m.save();
  await Notification.create({
    userId: m.authorId, type: `gratitude_${m.status}`,
    message: m.status === 'approved' ? `Lời cảm ơn "${m.title}" đã được duyệt và hiển thị trên tường tri ân.` : `Lời cảm ơn "${m.title}" chưa được duyệt${b.reason ? `: ${b.reason}` : '.'}`,
  });
  ok(res, { message: { id: String(m._id), status: m.status } });
}));

// ───────────────────────── Báo cáo ─────────────────────────
adminRouter.get('/reports', asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query as Record<string, unknown>, 100);
  const status = ['open', 'resolved', 'dismissed'].includes(String(req.query.status)) ? String(req.query.status) : undefined;
  const filter: Record<string, unknown> = status ? { status } : {};
  const [rows, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('messageId', 'title body authorName status').lean(),
    Report.countDocuments(filter),
  ]);
  ok(res, { items: rows.map((r: any) => ({ ...r, id: String(r._id) })), total, page, limit });
}));

adminRouter.patch('/reports/:id', asyncHandler(async (req, res) => {
  const id = parse(objectId, req.params.id);
  const b = parse(z.object({ action: z.enum(['resolve', 'dismiss']), rejectMessage: z.boolean().optional() }), req.body);
  const r = await Report.findOneAndUpdate(
    { _id: id, status: 'open' },
    { $set: { status: b.action === 'resolve' ? 'resolved' : 'dismissed', resolvedBy: req.principal!.kind === 'user' ? req.principal!.userId : undefined, resolvedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!r) throw conflict('Báo cáo không tồn tại hoặc đã được xử lý', 'ALREADY_HANDLED');
  if (b.action === 'resolve' && b.rejectMessage) {
    await GratitudeMessage.updateOne({ _id: r.messageId }, { $set: { status: 'rejected', 'moderation.reason': 'Bị báo cáo và quản trị viên đã gỡ', 'moderation.at': new Date() } });
  }
  ok(res, { report: { id: String(r._id), status: r.status } });
}));

// ───────────────────────── Cài đặt hệ thống (chỉ đọc, không lộ bí mật) ─────────────────────────
adminRouter.get('/settings', asyncHandler(async (_req, res) => {
  ok(res, {
    aiProvider: env.aiProvider, guestTtlHours: env.GUEST_TTL_HOURS, guestXpCap: env.GUEST_XP_CAP,
    environment: env.NODE_ENV, corsOrigins: env.corsOrigins, timezoneOffsetHours: env.TZ_OFFSET_HOURS,
  });
}));

// ───────────────────────── CRUD nội dung game ─────────────────────────
interface Coll { model: Model<any>; idField: string; searchFields: string[] }
const COLLECTIONS: Record<string, Coll> = {
  quests: { model: Quest, idField: 'questId', searchFields: ['questId', 'title'] },
  npcs: { model: Npc, idField: 'npcId', searchFields: ['npcId', 'name'] },
  areas: { model: GameArea, idField: 'areaId', searchFields: ['areaId', 'name'] },
  minigames: { model: MiniGame, idField: 'minigameId', searchFields: ['minigameId', 'name'] },
  questions: { model: Question, idField: 'qid', searchFields: ['qid', 'text'] },
  items: { model: Item, idField: 'itemId', searchFields: ['itemId', 'name'] },
  achievements: { model: Achievement, idField: 'achId', searchFields: ['achId', 'name'] },
};
const FORBIDDEN_KEYS = ['_id', 'createdAt', 'updatedAt', 'isSample', '__proto__', 'constructor', 'prototype'];
const body = z.record(z.string(), z.unknown());

function clean(input: Record<string, unknown>): Record<string, unknown> {
  const out = { ...input };
  for (const k of FORBIDDEN_KEYS) delete out[k];
  return out;
}

adminRouter.get('/:coll', asyncHandler(async (req, res, next) => {
  const c = COLLECTIONS[String(req.params.coll)];
  if (!c) return next();
  const { page, limit, skip } = pageParams(req.query as Record<string, unknown>, 100);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  const filter = q ? { $or: c.searchFields.map((f) => ({ [f]: new RegExp(escapeRegex(q), 'i') })) } : {};
  const [items, total] = await Promise.all([
    c.model.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
    c.model.countDocuments(filter),
  ]);
  ok(res, { items, total, page, limit });
}));

adminRouter.post('/:coll', asyncHandler(async (req, res, next) => {
  const c = COLLECTIONS[String(req.params.coll)];
  if (!c) return next();
  const data = clean(parse(body, req.body));
  if (typeof data[c.idField] !== 'string' || !/^[A-Za-z0-9_-]{2,60}$/.test(data[c.idField] as string)) {
    throw badRequest(`Trường ${c.idField} bắt buộc (2-60 ký tự chữ, số, _ hoặc -)`);
  }
  const doc = await c.model.create(data);
  invalidateContent();
  ok(res, { item: doc.toObject() }, 201);
}));

adminRouter.patch('/:coll/:id', asyncHandler(async (req, res, next) => {
  const c = COLLECTIONS[String(req.params.coll)];
  if (!c) return next();
  const data = clean(parse(body, req.body));
  delete data[c.idField]; // không đổi mã định danh
  const doc = await c.model.findOneAndUpdate({ [c.idField]: String(req.params.id) }, { $set: data }, { returnDocument: 'after', runValidators: true }).lean();
  if (!doc) throw notFound('Không tìm thấy mục cần sửa');
  invalidateContent();
  ok(res, { item: doc });
}));

adminRouter.delete('/:coll/:id', asyncHandler(async (req, res, next) => {
  const c = COLLECTIONS[String(req.params.coll)];
  if (!c) return next();
  const r = await c.model.deleteOne({ [c.idField]: String(req.params.id) });
  if (r.deletedCount !== 1) throw notFound('Không tìm thấy mục cần xóa');
  invalidateContent();
  ok(res, { deleted: true });
}));
