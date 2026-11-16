import mongoose from 'mongoose';
import { env } from './env.js';
import '../models/user.js';
import '../models/progress.js';
import '../models/content.js';
import '../models/community.js';

/** Đảm bảo mọi index (đặc biệt là unique/TTL) đã được tạo trước khi nhận request — các cơ chế chống trùng phụ thuộc vào chúng. */
export async function initModels(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

export async function connectDb(uri = env.MONGODB_URI): Promise<void> {
  if (!uri) throw new Error('MONGODB_URI chưa được cấu hình. Đặt trong backend/.env (xem .env.example).');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  await initModels();
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
