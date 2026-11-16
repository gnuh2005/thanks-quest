import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler, originGuard } from './middleware/error.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { gameRouter } from './routes/game.js';
import { gratitudeRouter } from './routes/gratitude.js';
import { guestRouter } from './routes/guest.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { minigameRouter } from './routes/minigames.js';
import { playerRouter } from './routes/player.js';
import { identify } from './middleware/auth.js';
import { limiter } from './routes/shared.js';

export function createApp() {
  const app = express();
  if (env.isProd) app.set('trust proxy', 1); // sau proxy của Render/VPS: lấy đúng IP cho rate limit
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', limiter(60_000, 600));
  app.use('/api', originGuard);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, data: { service: 'thanks-quest-api', status: 'up', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' } });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/guest', guestRouter);
  app.use('/api/player', identify, playerRouter);
  app.use('/api/game', identify, gameRouter);
  app.use('/api/minigames', identify, minigameRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/gratitude', gratitudeRouter);
  app.use('/api/admin', adminRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
