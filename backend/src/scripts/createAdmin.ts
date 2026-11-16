import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../config/db.js';
import { User } from '../models/user.js';
import { ensureProgress } from '../services/progress.js';

/**
 * Tạo hoặc nâng quyền Admin một cách an toàn.
 *   ADMIN_EMAIL=ban@example.com ADMIN_PASSWORD='mat-khau-dai-it-nhat-12-ky-tu' npm run create-admin
 * Không có tài khoản/mật khẩu mặc định. Mật khẩu chỉ đọc từ biến môi trường, không ghi ra log.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Cần đặt ADMIN_EMAIL hợp lệ');
  if (!password || password.length < 12) throw new Error('ADMIN_PASSWORD bắt buộc và tối thiểu 12 ký tự');

  await connectDb();
  const hash = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ email });
  if (existing) {
    await User.updateOne({ _id: existing._id }, { $set: { role: 'admin', passwordHash: hash, disabled: false } });
    console.log(`✔ Đã nâng quyền Admin và đặt lại mật khẩu cho ${email}`);
  } else {
    const u = await User.create({ email, displayName: 'Quản trị viên', role: 'admin', passwordHash: hash });
    await ensureProgress({ kind: 'user', id: String(u._id), key: `user:${u._id}` });
    console.log(`✔ Đã tạo Admin ${email}`);
  }
  await disconnectDb();
}

main().catch((e) => { console.error('Không tạo được Admin:', e.message); process.exit(1); });
