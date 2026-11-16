import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { identify, owner, requirePlayer, requireUser } from '../middleware/auth.js';
import { GratitudeMessage, Report } from '../models/community.js';
import { User } from '../models/user.js';
import { generateGratitude } from '../services/ai.js';
import { checkAchievements, addFacts, grant } from '../services/progress.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { asyncHandler, ok, pageParams, parse } from '../utils/http.js';
import { limiter, respond, stateFor } from './shared.js';

export const gratitudeRouter = Router();

const text = (max: number) => z.string().trim().max(max).optional().default('');
const generateBody = z.object({
  recipient: text(60), memory: text(1200), learned: text(1200), thanks: text(1200), message: text(1200),
}).refine((v) => [v.memory, v.learned, v.thanks, v.message].some((s) => s.length > 0), {
  message: 'Hãy nhập ít nhất một nội dung bạn muốn gửi gắm',
});

const messageBody = z.object({
  title: z.string().trim().min(2, 'Tiêu đề tối thiểu 2 ký tự').max(80),
  body: z.string().trim().min(10, 'Lời cảm ơn tối thiểu 10 ký tự').max(1500),
  recipient: z.string().trim().max(60).optional().default(''),
  style: z.enum(['classic', 'sunrise', 'night', 'garden']).default('classic'),
  aiAssisted: z.boolean().optional().default(false),
  confirmPublic: z.literal(true, { message: 'Bạn cần xác nhận trước khi gửi công khai' }),
});

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Mã không hợp lệ');

/** Guest và Student đều được tạo bản xem trước. Chỉ Student mới đăng được. */
gratitudeRouter.post('/generate', limiter(60_000, 10), identify, requirePlayer, asyncHandler(async (req, res) => {
  const input = parse(generateBody, req.body);
  const result = await generateGratitude(input);
  const o = owner(req);
  await addFacts(o, ['gratitude:preview']);
  const g = await grant(o, 'gratitude:preview', { xp: 25 }, 'gratitude');
  const achievements = await checkAchievements(o);
  await respond(req, res, { generated: result, grant: g, achievements });
}));

gratitudeRouter.post('/', limiter(60_000, 10), identify, requireUser, asyncHandler(async (req, res) => {
  const b = parse(messageBody, req.body);
  const o = owner(req);
  const user = await User.findById(o.id).select('displayName disabled');
  if (!user || user.disabled) throw forbidden('Tài khoản không hợp lệ');
  const recent = await GratitudeMessage.countDocuments({ authorId: user._id, createdAt: { $gte: new Date(Date.now() - 3_600_000) } });
  if (recent >= 5) throw conflict('Bạn đã gửi quá nhiều lời cảm ơn trong 1 giờ qua', 'TOO_MANY');
  const msg = await GratitudeMessage.create({
    authorId: user._id, authorName: user.displayName, title: b.title, body: b.body,
    recipient: b.recipient, style: b.style, aiAssisted: b.aiAssisted, status: 'pending',
  });
  await addFacts(o, ['gratitude:posted']);
  const g = await grant(o, 'gratitude:posted', { xp: 40 }, 'gratitude');
  const achievements = await checkAchievements(o);
  await respond(req, res, { message: pub(msg, true), grant: g, achievements, note: 'Lời cảm ơn đang chờ kiểm duyệt trước khi hiển thị công khai' }, 201);
}));

function pub(m: any, includeStatus = false) {
  return {
    id: String(m._id), title: m.title, body: m.body, recipient: m.recipient, style: m.style,
    authorName: m.authorName, createdAt: m.createdAt, aiAssisted: m.aiAssisted,
    ...(includeStatus ? { status: m.status, moderationReason: m.moderation?.reason } : {}),
  };
}

/** Công khai: chỉ nội dung đã được duyệt. `?mine=true` trả tất cả bài của chính người dùng. */
gratitudeRouter.get('/', identify, asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query as Record<string, unknown>, 30);
  if (req.query.mine === 'true') {
    const p = req.principal;
    if (!p || p.kind !== 'user') throw forbidden('Cần tài khoản để xem lời cảm ơn của bạn', 'ACCOUNT_REQUIRED');
    const filter = { authorId: new mongoose.Types.ObjectId(p.userId) };
    const [rows, total] = await Promise.all([
      GratitudeMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      GratitudeMessage.countDocuments(filter),
    ]);
    return ok(res, { items: rows.map((m) => pub(m, true)), total, page, limit });
  }
  const filter = { status: 'approved' as const };
  const [rows, total] = await Promise.all([
    GratitudeMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    GratitudeMessage.countDocuments(filter),
  ]);
  ok(res, { items: rows.map((m) => pub(m)), total, page, limit });
}));

gratitudeRouter.get('/:id', identify, asyncHandler(async (req, res) => {
  const id = parse(objectId, req.params.id);
  const m = await GratitudeMessage.findById(id).lean();
  if (!m) throw notFound('Không tìm thấy lời cảm ơn');
  const p = req.principal;
  const isOwner = p?.kind === 'user' && String(m.authorId) === p.userId;
  let isAdmin = false;
  if (p?.kind === 'user' && p.role === 'admin') isAdmin = !!(await User.exists({ _id: p.userId, role: 'admin', disabled: { $ne: true } }));
  if (m.status !== 'approved' && !isOwner && !isAdmin) throw notFound('Không tìm thấy lời cảm ơn');
  ok(res, { message: pub(m, isOwner || isAdmin) });
}));

/** Sửa nội dung → quay lại trạng thái chờ duyệt để không lách kiểm duyệt. */
gratitudeRouter.patch('/:id', identify, requireUser, asyncHandler(async (req, res) => {
  const id = parse(objectId, req.params.id);
  const b = parse(messageBody.partial().omit({ confirmPublic: true, aiAssisted: true }).strict(), req.body);
  if (Object.keys(b).length === 0) throw badRequest('Không có nội dung cần sửa');
  const p = req.principal!;
  if (p.kind !== 'user') throw forbidden();
  const m = await GratitudeMessage.findOneAndUpdate(
    { _id: id, authorId: p.userId },
    { $set: { ...b, status: 'pending' }, $unset: { moderation: '' } },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!m) throw notFound('Không tìm thấy lời cảm ơn của bạn');
  ok(res, { message: pub(m, true) });
}));

gratitudeRouter.delete('/:id', identify, requireUser, asyncHandler(async (req, res) => {
  const id = parse(objectId, req.params.id);
  const p = req.principal!;
  if (p.kind !== 'user') throw forbidden();
  const r = await GratitudeMessage.deleteOne({ _id: id, authorId: p.userId });
  if (r.deletedCount !== 1) throw notFound('Không tìm thấy lời cảm ơn của bạn');
  ok(res, { deleted: true });
}));

gratitudeRouter.post('/:id/report', limiter(60_000, 10), identify, requireUser, asyncHandler(async (req, res) => {
  const id = parse(objectId, req.params.id);
  const { reason } = parse(z.object({ reason: z.string().trim().min(3, 'Hãy nêu lý do').max(300) }), req.body);
  const p = req.principal!;
  if (p.kind !== 'user') throw forbidden();
  const m = await GratitudeMessage.findOne({ _id: id, status: 'approved' }).select('authorId');
  if (!m) throw notFound('Không tìm thấy lời cảm ơn');
  if (String(m.authorId) === p.userId) throw badRequest('Không thể tự báo cáo nội dung của mình');
  try {
    await Report.create({ messageId: m._id, reporterId: p.userId, reason });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw conflict('Bạn đã báo cáo nội dung này rồi', 'ALREADY_REPORTED');
    throw e;
  }
  const updated = await GratitudeMessage.findByIdAndUpdate(m._id, { $inc: { reportCount: 1 } }, { returnDocument: 'after' }).select('reportCount');
  // Đủ 3 báo cáo độc lập → tạm gỡ khỏi tường và chờ quản trị viên xem xét lại.
  if ((updated?.reportCount ?? 0) >= 3) await GratitudeMessage.updateOne({ _id: m._id, status: 'approved' }, { $set: { status: 'pending' } });
  ok(res, { reported: true });
}));

export { stateFor };
