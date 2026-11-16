import { Router } from 'express';
import { z } from 'zod';
import { owner, requirePlayer } from '../middleware/auth.js';
import { getContent } from '../services/content.js';
import {
  buildDialogue, claimQuest, collectPoi, completeQuest, enterArea, startQuest,
} from '../services/gameService.js';
import { areaLock, checkAchievements, getProgress } from '../services/progress.js';
import { notFound } from '../utils/errors.js';
import { asyncHandler, ok, parse } from '../utils/http.js';
import { respond, stateFor } from './shared.js';

export const gameRouter = Router();
gameRouter.use(requirePlayer);

const id = z.string().regex(/^[A-Za-z0-9_-]{1,60}$/);

gameRouter.get('/areas', asyncHandler(async (req, res) => {
  const [content, p] = await Promise.all([getContent(), getProgress(owner(req))]);
  ok(res, {
    areas: content.areas.map((a) => ({
      areaId: a.areaId, name: a.name, description: a.description, order: a.order, theme: a.theme,
      mapAsset: a.mapAsset, width: a.width, height: a.height, ...areaLock(a, p),
    })),
  });
}));

gameRouter.get('/areas/:id', asyncHandler(async (req, res) => {
  const areaId = parse(id, req.params.id);
  const [content, p] = await Promise.all([getContent(), getProgress(owner(req))]);
  const a = content.areas.find((x) => x.areaId === areaId);
  if (!a) throw notFound('Khu vực không tồn tại');
  const lock = areaLock(a, p);
  ok(res, {
    area: { areaId: a.areaId, name: a.name, description: a.description, theme: a.theme, mapAsset: a.mapAsset, ...lock },
    // Chỉ trả POI/NPC khi khu vực đã mở khóa.
    pois: lock.unlocked ? a.pois : [],
    npcs: lock.unlocked ? content.npcs.filter((n) => n.areaId === a.areaId) : [],
  });
}));

gameRouter.post('/areas/:id/enter', asyncHandler(async (req, res) => {
  await respond(req, res, await enterArea(owner(req), parse(id, req.params.id)));
}));

gameRouter.get('/npcs', asyncHandler(async (_req, res) => {
  const c = await getContent();
  ok(res, { npcs: c.npcs.map((n) => ({ npcId: n.npcId, name: n.name, areaId: n.areaId, role: n.role, description: n.description, sprite: n.sprite, x: n.x, y: n.y })) });
}));

gameRouter.post('/npcs/:id/talk', asyncHandler(async (req, res) => {
  const { lore } = parse(z.object({ lore: z.boolean().optional() }), req.body ?? {});
  const o = owner(req);
  const dialogue = await buildDialogue(o, parse(id, req.params.id), !!lore);
  // Trò chuyện có thể mở thành tựu (vd. First Step): kiểm tra ngay để người chơi nhận thông báo đúng lúc.
  ok(res, { dialogue, achievements: await checkAchievements(o) });
}));

gameRouter.post('/pois/:id/collect', asyncHandler(async (req, res) => {
  await respond(req, res, await collectPoi(owner(req), parse(id, req.params.id)));
}));

gameRouter.get('/quests', asyncHandler(async (req, res) => {
  ok(res, { quests: (await stateFor(req)).quests });
}));

gameRouter.post('/quests/:id/start', asyncHandler(async (req, res) => {
  await respond(req, res, await startQuest(owner(req), parse(id, req.params.id)));
}));
gameRouter.post('/quests/:id/complete', asyncHandler(async (req, res) => {
  await respond(req, res, await completeQuest(owner(req), parse(id, req.params.id)));
}));
gameRouter.post('/quests/:id/claim', asyncHandler(async (req, res) => {
  await respond(req, res, await claimQuest(owner(req), parse(id, req.params.id)));
}));
