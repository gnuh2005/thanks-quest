import { Router } from 'express';
import { identify } from '../middleware/auth.js';
import { allTime, myRank, periodBoard } from '../services/leaderboard.js';
import { startOfLocalDay, startOfLocalWeek } from '../utils/date.js';
import { asyncHandler, ok, pageParams } from '../utils/http.js';

export const leaderboardRouter = Router();
leaderboardRouter.use(identify);

// Dữ liệu công khai: chỉ gồm tài khoản chính thức, không bao giờ có Guest.
leaderboardRouter.get('/', asyncHandler(async (req, res) => {
  const { page, limit } = pageParams(req.query as Record<string, unknown>, 50);
  const board = await allTime(page, limit);
  const p = req.principal;
  ok(res, { ...board, me: p?.kind === 'user' ? await myRank(p.userId) : null, guest: p?.kind === 'guest' });
}));

leaderboardRouter.get('/daily', asyncHandler(async (req, res) => {
  const { page, limit } = pageParams(req.query as Record<string, unknown>, 50);
  ok(res, await periodBoard(startOfLocalDay(), 'daily', page, limit));
}));

leaderboardRouter.get('/weekly', asyncHandler(async (req, res) => {
  const { page, limit } = pageParams(req.query as Record<string, unknown>, 50);
  ok(res, await periodBoard(startOfLocalWeek(), 'weekly', page, limit));
}));
