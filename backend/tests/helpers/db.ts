import mongoose from 'mongoose';
import { initModels } from '../../src/config/db.js';

export interface TestDb {
  ok: boolean;
  reason?: string;
  stop: () => Promise<void>;
}

/**
 * Khởi động MongoDB cho test tích hợp:
 *  - Nếu đặt TEST_MONGODB_URI → dùng DB đó (sẽ bị xóa sạch sau test — CHỈ dùng DB test riêng!).
 *  - Nếu không → thử mongodb-memory-server (cần tải binary lần đầu, cần mạng).
 *  - Nếu cả hai đều không được → ok=false và các test tích hợp tự bỏ qua (không giả vờ là đã chạy).
 */
export async function startTestDb(): Promise<TestDb> {
  const explicit = process.env.TEST_MONGODB_URI;
  try {
    if (explicit) {
      if (!/test/i.test(explicit)) throw new Error('TEST_MONGODB_URI phải chứa "test" trong tên DB để tránh xóa nhầm dữ liệu thật');
      await mongoose.connect(explicit, { serverSelectionTimeoutMS: 8000 });
      await mongoose.connection.dropDatabase();
      await initModels();
      return { ok: true, stop: async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } };
    }
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const server = await Promise.race([
      MongoMemoryServer.create(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Quá thời gian khởi động mongodb-memory-server')), 60_000)),
    ]);
    await mongoose.connect(server.getUri('thanksquest_test'), { serverSelectionTimeoutMS: 8000 });
    await initModels();
    return { ok: true, stop: async () => { await mongoose.disconnect(); await server.stop(); } };
  } catch (e) {
    return { ok: false, reason: (e as Error).message.slice(0, 200), stop: async () => {} };
  }
}

export async function resetDb(): Promise<void> {
  const cols = await mongoose.connection.db!.collections();
  await Promise.all(cols.map((c) => c.deleteMany({})));
}
