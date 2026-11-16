import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { Achievement, GameArea, Item, MiniGame, Npc, Question, Quest } from '../models/content.js';
import { GratitudeMessage } from '../models/community.js';
import { User } from '../models/user.js';
import { ensureProgress } from '../services/progress.js';
import { invalidateContent } from '../services/content.js';
import { ACHIEVEMENTS, AREAS, ITEMS, MINIGAMES, NPCS, QUESTIONS, QUESTS, SAMPLE_GRATITUDE } from './data/content.js';

const upsertAll = async (model: any, key: string, docs: Record<string, any>[]) => {
  if (!docs.length) return;
  await model.bulkWrite(
    docs.map((d) => ({ updateOne: { filter: { [key]: d[key] }, update: { $set: { ...d, isSample: true, active: true } }, upsert: true } })),
  );
};

/** Nạp nội dung game (khu vực, NPC, nhiệm vụ…). Idempotent: chạy lại sẽ cập nhật theo mã định danh. */
export async function seedContent(): Promise<void> {
  await upsertAll(GameArea, 'areaId', AREAS as any);
  await upsertAll(Npc, 'npcId', NPCS as any);
  await upsertAll(Quest, 'questId', QUESTS as any);
  await upsertAll(Item, 'itemId', ITEMS as any);
  await upsertAll(Achievement, 'achId', ACHIEVEMENTS as any);
  await upsertAll(MiniGame, 'minigameId', MINIGAMES as any);
  await upsertAll(Question, 'qid', QUESTIONS as any);
  invalidateContent();
}

/** Tác giả "ngưng hoạt động" cho các lời tri ân mẫu — không thể đăng nhập. */
export async function seedSampleGratitude(): Promise<void> {
  if (await GratitudeMessage.exists({ isSample: true })) return;
  const author = await User.findOneAndUpdate(
    { email: 'mau.tri-an@thanksquest.invalid' },
    {
      $setOnInsert: {
        email: 'mau.tri-an@thanksquest.invalid', displayName: 'Người viết mẫu', role: 'student',
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 8), disabled: true, isDemo: true,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  await GratitudeMessage.insertMany(
    SAMPLE_GRATITUDE.map((m) => ({ ...m, authorId: author!._id, authorName: 'Người viết mẫu (dữ liệu mẫu)', status: 'approved', isSample: true })),
  );
}

/**
 * Tài khoản học sinh demo — chỉ tạo khi bạn cung cấp mật khẩu qua biến môi trường.
 * Không có mật khẩu mặc định. Không bao giờ tạo Admin ở đây.
 */
export async function seedDemoStudent(password: string | undefined): Promise<'created' | 'exists' | 'skipped'> {
  if (!password) return 'skipped';
  if (password.length < 8) throw new Error('SEED_DEMO_PASSWORD phải có ít nhất 8 ký tự');
  const email = 'demo@thanksquest.local';
  if (await User.exists({ email })) return 'exists';
  const u = await User.create({ email, displayName: 'Học sinh Demo', role: 'student', passwordHash: await bcrypt.hash(password, 10), isDemo: true });
  await ensureProgress({ kind: 'user', id: String(u._id), key: `user:${u._id}` });
  return 'created';
}

export async function seedIfEmpty(): Promise<boolean> {
  if ((await GameArea.countDocuments({})) > 0) return false;
  await seedContent();
  return true;
}
