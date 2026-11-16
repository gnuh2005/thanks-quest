import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { levelFromXp } from '../domain/progression.js';
import { planTransfer, unionArrays, xpOf } from '../domain/merge.js';
import { findGuestFromRequest } from '../middleware/auth.js';
import { GameSession, GuestSession, PlayerProgress, RewardEvent } from '../models/progress.js';
import { User } from '../models/user.js';
import { randomId, randomToken, sha256 } from '../utils/crypto.js';
import { conflict, notFound, unauthorized } from '../utils/errors.js';
import { clearGuestCookie, setGuestCookie } from './tokens.js';
import { ensureProgress, getProgress, type Owner, type ProgressDoc } from './progress.js';

const STALE_CONVERSION_MS = 5 * 60_000;
export const guestOwner = (guestId: string): Owner => ({ kind: 'guest', id: guestId, key: `guest:${guestId}` });
const isDup = (e: unknown) => (e as { code?: number })?.code === 11000;

export async function startGuest(req: Request, res: Response) {
  const existing = await findGuestFromRequest(req);
  if (existing && existing.conversionStatus === 'none') {
    return { guestId: existing.guestId, expiresAt: existing.expiresAt, resumed: true };
  }
  const ttlMs = env.GUEST_TTL_HOURS * 3_600_000;
  const expiresAt = new Date(Date.now() + ttlMs);
  const guestId = randomId('g');
  const token = randomToken(32);
  await GuestSession.create({ guestId, tokenHash: sha256(token), expiresAt });
  await ensureProgress(guestOwner(guestId), expiresAt);
  setGuestCookie(res, token, ttlMs);
  return { guestId, expiresAt, resumed: false };
}

export async function endGuest(req: Request, res: Response): Promise<void> {
  const s = await findGuestFromRequest(req);
  if (s && s.conversionStatus === 'none') {
    const key = `guest:${s.guestId}`;
    await Promise.all([
      PlayerProgress.deleteOne({ ownerKey: key }),
      RewardEvent.deleteMany({ ownerKey: key }),
      GameSession.deleteMany({ ownerKey: key }),
      GuestSession.deleteOne({ _id: s._id }),
    ]);
  }
  clearGuestCookie(res);
}

export interface ConversionReport {
  transferredXp: number;
  transferredItems: number;
  skippedDuplicates: number;
}

/**
 * Chuyển tiến độ Guest sang tài khoản.
 *  - Nguyên tử: chỉ một request giành được trạng thái `converting`.
 *  - Idempotent: phần thưởng chuyển qua RewardEvent (unique ownerKey+sourceKey) nên chạy lại không cộng trùng.
 *  - An toàn khi lỗi: dữ liệu Guest chỉ bị xóa SAU khi chuyển xong; lỗi giữa chừng → trả trạng thái về `none`.
 */
export async function convertGuest(req: Request, userId: string): Promise<ConversionReport> {
  const gs = await findGuestFromRequest(req);
  if (!gs) throw unauthorized('Không tìm thấy phiên chơi thử hợp lệ', 'NO_GUEST_SESSION');
  const user = await User.findById(userId).select('_id disabled');
  if (!user || user.disabled) throw unauthorized('Tài khoản không hợp lệ');

  const claimed = await GuestSession.findOneAndUpdate(
    {
      _id: gs._id,
      $or: [
        { conversionStatus: 'none' },
        { conversionStatus: 'converting', convertingSince: { $lt: new Date(Date.now() - STALE_CONVERSION_MS) } },
      ],
    },
    { $set: { conversionStatus: 'converting', convertingSince: new Date() } },
    { returnDocument: 'after' },
  );
  if (!claimed) {
    throw conflict(
      gs.conversionStatus === 'converted' ? 'Tiến độ đã được chuyển trước đó' : 'Đang chuyển tiến độ, vui lòng chờ',
      gs.conversionStatus === 'converted' ? 'ALREADY_CONVERTED' : 'CONVERSION_IN_PROGRESS',
    );
  }

  const gKey = `guest:${gs.guestId}`;
  const uOwner: Owner = { kind: 'user', id: userId, key: `user:${userId}` };
  try {
    const gp = (await PlayerProgress.findOne({ ownerKey: gKey }).lean()) as unknown as ProgressDoc | null;
    if (!gp) throw notFound('Tiến độ chơi thử không còn tồn tại', 'GUEST_GONE');
    const up = await ensureProgress(uOwner);

    const events = await RewardEvent.find({ ownerKey: gKey }).lean();
    const existing = await RewardEvent.find({ ownerKey: uOwner.key, sourceKey: { $in: events.map((e) => e.sourceKey) } }).select('sourceKey').lean();
    const plan = planTransfer(
      events.map((e) => ({ sourceKey: e.sourceKey, kind: e.kind, itemId: e.itemId ?? undefined, amount: e.amount, source: e.source })),
      new Set(existing.map((e) => e.sourceKey)),
    );

    let appliedXp = 0;
    let appliedItems = 0;
    for (const ev of plan) {
      try {
        await RewardEvent.create({ ownerKey: uOwner.key, sourceKey: ev.sourceKey, kind: ev.kind, itemId: ev.itemId, amount: ev.amount, source: ev.source ?? 'guest' });
      } catch (e) {
        if (isDup(e)) continue; // chạy song song/chạy lại: bỏ qua
        throw e;
      }
      if (ev.kind === 'xp') {
        await PlayerProgress.updateOne({ ownerKey: uOwner.key }, { $inc: { xp: ev.amount } });
        appliedXp += ev.amount;
      } else if (ev.kind === 'item' && ev.itemId) {
        await PlayerProgress.updateOne(
          { ownerKey: uOwner.key },
          { $inc: { [`inventory.${ev.itemId}`]: ev.amount, [`collected.${ev.itemId}`]: ev.amount } },
        );
        appliedItems += ev.amount;
      }
    }

    await PlayerProgress.updateOne(
      { ownerKey: uOwner.key },
      {
        $addToSet: {
          facts: { $each: unionArrays(gp.facts) },
          startedQuests: { $each: unionArrays(gp.startedQuests) },
          claimedQuests: { $each: unionArrays(gp.claimedQuests) },
          passedMinigames: { $each: unionArrays(gp.passedMinigames) },
        },
      },
    );
    for (const a of gp.achievements ?? []) {
      await PlayerProgress.updateOne({ ownerKey: uOwner.key, 'achievements.id': { $ne: a.id } }, { $push: { achievements: a } });
    }
    // Hồ sơ người chơi mới (chưa có XP) kế thừa avatar đã chọn khi chơi thử.
    if (up.xp === 0 && (up.claimedQuests?.length ?? 0) === 0) {
      await PlayerProgress.updateOne({ ownerKey: uOwner.key }, { $set: { profile: gp.profile } });
    }
    const after = await PlayerProgress.findOne({ ownerKey: uOwner.key }).select('xp').lean();
    await PlayerProgress.updateOne({ ownerKey: uOwner.key }, { $set: { level: levelFromXp(after?.xp ?? 0) } });

    await GuestSession.updateOne({ _id: gs._id }, { $set: { conversionStatus: 'converted', convertedToUserId: user._id } });
    await Promise.all([
      PlayerProgress.deleteOne({ ownerKey: gKey }),
      RewardEvent.deleteMany({ ownerKey: gKey }),
    ]);
    void xpOf; // (xpOf dùng trong test/báo cáo; giữ import để rõ nghĩa quy tắc)
    return { transferredXp: appliedXp, transferredItems: appliedItems, skippedDuplicates: events.length - plan.length };
  } catch (e) {
    await GuestSession.updateOne({ _id: gs._id, conversionStatus: 'converting' }, { $set: { conversionStatus: 'none' }, $unset: { convertingSince: '' } });
    throw e;
  }
}

export async function guestSummary(owner: Owner) {
  const p = await getProgress(owner);
  return {
    xp: p.xp,
    questsClaimed: new Set(p.claimedQuests.filter((c) => !c.includes('@'))).size,
    minigamesPassed: new Set(p.passedMinigames).size,
    items: Object.values((p.collected ?? {}) as Record<string, number>).reduce((a, b) => a + (Number(b) || 0), 0),
    achievements: (p.achievements ?? []).length,
    expiresAt: p.expiresAt,
  };
}
