import { Router } from 'express';
import { z } from 'zod';
import { owner, requirePlayer } from '../middleware/auth.js';
import { getContent } from '../services/content.js';
import {
  listMiniGames, minigameHistory, publicDef, startMinigame, submitMinigame, treasureDig,
} from '../services/minigameService.js';
import { notFound } from '../utils/errors.js';
import { asyncHandler, ok, parse } from '../utils/http.js';
import { limiter, respond } from './shared.js';

export const minigameRouter = Router();
minigameRouter.use(requirePlayer);

const id = z.string().regex(/^[A-Za-z0-9_-]{1,60}$/);
const attempt = z.string().uuid();

minigameRouter.get('/', asyncHandler(async (_req, res) => ok(res, { minigames: await listMiniGames() })));

// Phải đứng trước '/:id'
minigameRouter.get('/history', asyncHandler(async (req, res) => {
  ok(res, { history: await minigameHistory(owner(req)) });
}));

minigameRouter.get('/:id', asyncHandler(async (req, res) => {
  const c = await getContent();
  const d = c.minigames.find((m) => m.minigameId === parse(id, req.params.id));
  if (!d) throw notFound('Mini game không tồn tại');
  ok(res, { minigame: publicDef(d) });
}));

minigameRouter.post('/:id/start', limiter(60_000, 40), asyncHandler(async (req, res) => {
  ok(res, { attempt: await startMinigame(owner(req), parse(id, req.params.id)) }, 201);
}));

minigameRouter.post('/:id/dig', limiter(60_000, 120), asyncHandler(async (req, res) => {
  const b = parse(z.object({ attemptId: attempt, x: z.number().int(), y: z.number().int() }), req.body);
  ok(res, { dig: await treasureDig(owner(req), b.attemptId, b.x, b.y) });
}));

minigameRouter.post('/:id/submit', limiter(60_000, 40), asyncHandler(async (req, res) => {
  const b = parse(z.object({ attemptId: attempt, answer: z.unknown().optional() }), req.body);
  await respond(req, res, await submitMinigame(owner(req), parse(id, req.params.id), b.attemptId, b.answer ?? {}));
}));
