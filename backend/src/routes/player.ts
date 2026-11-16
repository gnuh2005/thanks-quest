import { Router } from 'express';
import { z } from 'zod';
import { owner, requirePlayer } from '../middleware/auth.js';
import { setPosition, setProfile, useItem } from '../services/gameService.js';
import { asyncHandler, ok, parse } from '../utils/http.js';
import { respond, stateFor } from './shared.js';

export const playerRouter = Router();
playerRouter.use(requirePlayer);

playerRouter.get('/state', asyncHandler(async (req, res) => ok(res, { state: await stateFor(req) })));
playerRouter.get('/profile', asyncHandler(async (req, res) => {
  const s = await stateFor(req);
  ok(res, { kind: s.kind, displayName: s.displayName, profile: s.profile, level: s.level, currentArea: s.currentArea });
}));
playerRouter.get('/progress', asyncHandler(async (req, res) => {
  const s = await stateFor(req);
  ok(res, { level: s.level, quests: s.quests, areas: s.areas, achievements: s.achievements, stats: s.stats });
}));
playerRouter.get('/inventory', asyncHandler(async (req, res) => ok(res, { inventory: (await stateFor(req)).inventory })));

const profileBody = z.object({
  avatar: z.number().int().min(0).max(3).optional(),
  outfit: z.number().int().min(0).max(2).optional(),
  areaId: z.string().max(40).optional(),
  x: z.number().finite().min(0).max(10_000).optional(),
  y: z.number().finite().min(0).max(10_000).optional(),
}).strict();

playerRouter.patch('/profile', asyncHandler(async (req, res) => {
  const b = parse(profileBody, req.body);
  const o = owner(req);
  await setProfile(o, b);
  if (b.areaId || (b.x !== undefined && b.y !== undefined)) await setPosition(o, b.areaId, b.x, b.y);
  ok(res, { state: await stateFor(req) });
}));

playerRouter.post('/inventory/use', asyncHandler(async (req, res) => {
  const { itemId } = parse(z.object({ itemId: z.string().regex(/^[a-z0-9_]+$/).max(60) }), req.body);
  await respond(req, res, await useItem(owner(req), itemId));
}));
