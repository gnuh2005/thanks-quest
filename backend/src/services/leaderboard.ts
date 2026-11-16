import { levelFromXp } from '../domain/progression.js';
import { PlayerProgress, RewardEvent } from '../models/progress.js';
import { User } from '../models/user.js';

export interface LeaderRow {
  rank: number;
  userId: string;
  displayName: string;
  level: number;
  xp: number;
  questsClaimed: number;
  minigamesPassed: number;
  xpGained?: number;
}
export interface LeaderPage {
  rows: LeaderRow[];
  total: number;
  page: number;
  limit: number;
  period: 'all' | 'daily' | 'weekly';
}

async function names(ids: string[]): Promise<Map<string, string>> {
  const users = await User.find({ _id: { $in: ids }, disabled: { $ne: true } }).select('displayName').lean();
  return new Map(users.map((u) => [String(u._id), u.displayName]));
}

/** Bảng xếp hạng chính thức chỉ gồm tài khoản thật (kind = 'user'); Guest không bao giờ xuất hiện. */
export async function allTime(page: number, limit: number): Promise<LeaderPage> {
  const skip = (page - 1) * limit;
  const [agg] = await PlayerProgress.aggregate([
    { $match: { kind: 'user', xp: { $gt: 0 } } },
    { $sort: { xp: -1, updatedAt: 1 } },
    {
      $facet: {
        rows: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              ownerId: 1, xp: 1,
              questsClaimed: { $size: { $ifNull: ['$claimedQuests', []] } },
              minigamesPassed: { $size: { $ifNull: ['$passedMinigames', []] } },
            },
          },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ]);
  const rows = (agg?.rows ?? []) as { ownerId: string; xp: number; questsClaimed: number; minigamesPassed: number }[];
  const nameMap = await names(rows.map((r) => r.ownerId));
  return {
    period: 'all', page, limit, total: agg?.total?.[0]?.n ?? 0,
    rows: rows.map((r, i) => ({
      rank: skip + i + 1, userId: r.ownerId, displayName: nameMap.get(r.ownerId) ?? 'Người chơi',
      level: levelFromXp(r.xp), xp: r.xp, questsClaimed: r.questsClaimed, minigamesPassed: r.minigamesPassed,
    })),
  };
}

export async function periodBoard(since: Date, period: 'daily' | 'weekly', page: number, limit: number): Promise<LeaderPage> {
  const skip = (page - 1) * limit;
  const [agg] = await RewardEvent.aggregate([
    { $match: { kind: 'xp', ownerKey: { $regex: '^user:' }, createdAt: { $gte: since } } },
    { $group: { _id: '$ownerKey', gained: { $sum: '$amount' } } },
    { $sort: { gained: -1, _id: 1 } },
    { $facet: { rows: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'n' }] } },
  ]);
  const rows = (agg?.rows ?? []) as { _id: string; gained: number }[];
  const ids = rows.map((r) => r._id.slice(5));
  const [nameMap, progress] = await Promise.all([
    names(ids),
    PlayerProgress.find({ ownerKey: { $in: rows.map((r) => r._id) } })
      .select('ownerKey xp claimedQuests passedMinigames').lean(),
  ]);
  const pm = new Map(progress.map((p) => [p.ownerKey, p]));
  return {
    period, page, limit, total: agg?.total?.[0]?.n ?? 0,
    rows: rows.map((r, i) => {
      const p = pm.get(r._id);
      const id = r._id.slice(5);
      return {
        rank: skip + i + 1, userId: id, displayName: nameMap.get(id) ?? 'Người chơi',
        level: levelFromXp(p?.xp ?? 0), xp: p?.xp ?? 0, xpGained: r.gained,
        questsClaimed: new Set((p?.claimedQuests ?? []).filter((c) => !c.includes('@'))).size,
        minigamesPassed: new Set(p?.passedMinigames ?? []).size,
      };
    }),
  };
}

export async function myRank(userId: string): Promise<{ rank: number; xp: number } | null> {
  const me = await PlayerProgress.findOne({ ownerKey: `user:${userId}` }).select('xp').lean();
  if (!me || me.xp <= 0) return null;
  const ahead = await PlayerProgress.countDocuments({ kind: 'user', xp: { $gt: me.xp } });
  return { rank: ahead + 1, xp: me.xp };
}
