import { Schema, model } from 'mongoose';

const opts = { timestamps: true, versionKey: false, minimize: false } as const;
const mixed = Schema.Types.Mixed;

export const GameArea = model(
  'GameArea',
  new Schema(
    {
      areaId: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      description: { type: String, default: '' },
      order: { type: Number, default: 0 },
      theme: { type: String, default: '' },
      mapAsset: { type: String, required: true },
      width: Number,
      height: Number,
      unlock: { type: mixed, default: {} }, // { minLevel?, claimedQuests?, accountOnly? }
      pois: { type: mixed, default: [] }, // [{ poiId, type, ref, x, y, label, text, itemId, xp }] — x/y theo hệ tọa độ pixel của thế giới game
      active: { type: Boolean, default: true },
      isSample: { type: Boolean, default: false },
    },
    opts,
  ),
);

export const Npc = model(
  'Npc',
  new Schema(
    {
      npcId: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      areaId: { type: String, required: true, index: true },
      role: { type: String, default: '' },
      description: { type: String, default: '' },
      sprite: { type: Number, default: 0 },
      x: Number,
      y: Number,
      idle: { type: [String], default: [] },
      lore: { type: [String], default: [] },
      active: { type: Boolean, default: true },
      isSample: { type: Boolean, default: false },
    },
    opts,
  ),
);

export const Quest = model(
  'Quest',
  new Schema(
    {
      questId: { type: String, required: true, unique: true },
      type: { type: String, enum: ['main', 'side', 'daily', 'achievement', 'event'], required: true },
      title: { type: String, required: true },
      description: { type: String, default: '' },
      npcId: { type: String, required: true },
      areaId: { type: String, required: true },
      order: { type: Number, default: 0 },
      requires: { type: mixed, default: {} }, // { quests?: string[], level?: number, account?: boolean }
      objectives: { type: [mixed], default: [] },
      reward: { type: mixed, default: { xp: 0, items: [] } },
      dialogue: { type: mixed, default: { offer: [], progress: [], complete: [] } },
      active: { type: Boolean, default: true },
      isSample: { type: Boolean, default: false },
    },
    opts,
  ),
);

export const MiniGame = model(
  'MiniGame',
  new Schema(
    {
      minigameId: { type: String, required: true, unique: true },
      type: { type: String, enum: ['quiz', 'memory', 'debug', 'treasure'], required: true },
      name: { type: String, required: true },
      description: { type: String, default: '' },
      instructions: { type: [String], default: [] },
      areaId: { type: String, default: '' },
      config: { type: mixed, default: {} },
      active: { type: Boolean, default: true },
      isSample: { type: Boolean, default: false },
    },
    opts,
  ),
);

export const Question = model(
  'Question',
  new Schema(
    {
      qid: { type: String, required: true, unique: true },
      kind: { type: String, enum: ['mcq', 'debug'], default: 'mcq', index: true },
      category: { type: String, default: 'general', index: true },
      text: { type: String, required: true },
      choices: { type: [String], default: [] },
      answerIndex: { type: Number, min: 0 },
      explanation: { type: String, default: '' },
      // Chỉ dùng cho kind = 'debug' — đáp án được kiểm tra bằng quy tắc khai báo, KHÔNG thực thi mã.
      language: { type: String, default: '' },
      buggyCode: { type: String, default: '' },
      hint: { type: String, default: '' },
      accepted: { type: [String], default: [] },
      mustMatch: { type: [String], default: [] },
      mustNotMatch: { type: [String], default: [] },
      active: { type: Boolean, default: true },
      isSample: { type: Boolean, default: false },
    },
    opts,
  ),
);

export const Item = model(
  'Item',
  new Schema(
    {
      itemId: { type: String, required: true, unique: true, match: /^[a-z0-9_]+$/ },
      name: { type: String, required: true },
      category: {
        type: String,
        enum: ['book', 'knowledge', 'memory', 'tech', 'collectible', 'event'],
        required: true,
      },
      description: { type: String, default: '' },
      icon: { type: String, default: 'package' },
      usable: { type: Boolean, default: false },
      useXp: { type: Number, default: 0 },
      active: { type: Boolean, default: true },
      isSample: { type: Boolean, default: false },
    },
    opts,
  ),
);

export const Achievement = model(
  'Achievement',
  new Schema(
    {
      achId: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      description: { type: String, default: '' },
      icon: { type: String, default: 'award' },
      condition: { type: mixed, required: true }, // { kind, value }
      rewardXp: { type: Number, default: 0 },
      active: { type: Boolean, default: true },
      isSample: { type: Boolean, default: false },
    },
    opts,
  ),
);
