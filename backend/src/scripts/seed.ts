import 'dotenv/config';
import { connectDb, disconnectDb } from '../config/db.js';
import { seedContent, seedDemoStudent, seedSampleGratitude } from '../seed/seed.js';

async function main() {
  await connectDb();
  await seedContent();
  console.log('✔ Đã nạp nội dung game (6 khu vực, 6 NPC, 24 nhiệm vụ, 4 mini game, 30 câu hỏi, 10 vật phẩm, 8 thành tựu).');
  if (process.argv.includes('--gratitude')) {
    await seedSampleGratitude();
    console.log('✔ Đã nạp lời tri ân mẫu (isSample = true).');
  }
  const demo = await seedDemoStudent(process.env.SEED_DEMO_PASSWORD);
  console.log(
    demo === 'created' ? '✔ Đã tạo tài khoản demo: demo@thanksquest.local (mật khẩu lấy từ SEED_DEMO_PASSWORD).'
      : demo === 'exists' ? '• Tài khoản demo đã tồn tại.' : '• Bỏ qua tài khoản demo (chưa đặt SEED_DEMO_PASSWORD).',
  );
  await disconnectDb();
}

main().catch((e) => { console.error('Seed thất bại:', e.message); process.exit(1); });
