import { Schema, model } from 'mongoose';

/** Phiên khách (token lưu dạng hash). TTL tự xóa khi hết hạn. */
const guestSessionSchema = new Schema(
  {
    guestId: { type: String, required: true, unique: true },
    tokenHash: { type: String, required: true, unique: true },
    conversionStatus: { type: String, enum: ['none', 'converting', 'converted'], default: 'none', index: true },
    convertedToUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    convertingSince: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);
guestSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Tiến độ người chơi — dùng chung cho User và Guest (khác nhau ở ownerKey/kind).
 * Gộp hồ sơ người chơi (avatar, khu vực hiện tại) và kho đồ vào cùng tài liệu để cập nhật nguyên tử.
 * XP/vật phẩm chỉ thay đổi thông qua RewardEvent (xem services/rewards.ts).
 */
const playerProgressSchema = new Schema(
  {
    ownerKey: { type: String, required: true, unique: true },
    kind: { type: String, enum: ['user', 'guest'], required: true },
    ownerId: { type: String, required: true },
    xp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    currentArea: { type: String, default: 'plaza' },
    lastPos: { x: Number, y: Number },
    profile: {
      avatar: { type: Number, default: 0, min: 0, max: 3 },
      outfit: { type: Number, default: 0, min: 0, max: 2 },
    },
    facts: { type: [String], default: [] },
    startedQuests: { type: [String], default: [] },
    claimedQuests: { type: [String], default: [] },
    passedMinigames: { type: [String], default: [] },
    inventory: { type: Schema.Types.Mixed, default: {} },
    collected: { type: Schema.Types.Mixed, default: {} },
    achievements: { type: [{ _id: false, id: String, at: Date }], default: [] },
    expiresAt: { type: Date },
  },
  { timestamps: true, versionKey: false, minimize: false },
);
playerProgressSchema.index({ kind: 1, xp: -1, updatedAt: 1 });
playerProgressSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Sổ cái phần thưởng. Khóa (ownerKey, sourceKey) là duy nhất → mỗi phần thưởng chỉ được ghi một lần,
 * kể cả khi request bị gửi lặp hoặc chạy song song.
 */
const rewardEventSchema = new Schema(
  {
    ownerKey: { type: String, required: true },
    sourceKey: { type: String, required: true },
    kind: { type: String, enum: ['xp', 'item', 'marker'], required: true },
    itemId: { type: String },
    amount: { type: Number, required: true },
    source: { type: String, default: 'misc' },
    expiresAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
rewardEventSchema.index({ ownerKey: 1, sourceKey: 1 }, { unique: true });
rewardEventSchema.index({ kind: 1, createdAt: 1 });
rewardEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** Một lượt chơi mini game. `payload` chỉ nằm ở server (đáp án, vị trí kho báu...). */
const gameSessionSchema = new Schema(
  {
    attemptId: { type: String, required: true, unique: true },
    ownerKey: { type: String, required: true },
    minigameId: { type: String, required: true },
    status: { type: String, enum: ['started', 'submitted', 'expired', 'abandoned'], default: 'started' },
    payload: { type: Schema.Types.Mixed, default: {} },
    startedAt: { type: Date, required: true },
    deadline: { type: Date, required: true },
    submittedAt: { type: Date },
    result: { type: Schema.Types.Mixed },
    expiresAt: { type: Date },
  },
  { timestamps: true, versionKey: false, minimize: false },
);
gameSessionSchema.index({ ownerKey: 1, startedAt: -1 });
gameSessionSchema.index({ minigameId: 1, createdAt: -1 });
gameSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GuestSession = model('GuestSession', guestSessionSchema);
export const PlayerProgress = model('PlayerProgress', playerProgressSchema);
export const RewardEvent = model('RewardEvent', rewardEventSchema);
export const GameSession = model('GameSession', gameSessionSchema);
