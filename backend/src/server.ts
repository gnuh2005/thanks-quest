import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { seedIfEmpty } from './seed/seed.js';

async function main() {
  await connectDb();
  if (env.AUTO_SEED && (await seedIfEmpty())) console.log('[seed] Cơ sở dữ liệu trống — đã nạp nội dung game mặc định.');
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`THANKS QUEST API: http://localhost:${env.PORT}  (AI: ${env.aiProvider})`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((e) => {
  console.error('Không khởi động được máy chủ:', e.message);
  process.exit(1);
});
