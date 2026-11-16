import { Schema, model } from 'mongoose';

const gratitudeSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authorName: { type: String, required: true, maxlength: 40 },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    body: { type: String, required: true, trim: true, maxlength: 1500 },
    recipient: { type: String, default: '', trim: true, maxlength: 60 },
    style: { type: String, enum: ['classic', 'sunrise', 'night', 'garden'], default: 'classic' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    moderation: { by: Schema.Types.ObjectId, at: Date, reason: { type: String, maxlength: 300 } },
    reportCount: { type: Number, default: 0 },
    aiAssisted: { type: Boolean, default: false },
    isSample: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);
gratitudeSchema.index({ status: 1, createdAt: -1 });

const reportSchema = new Schema(
  {
    messageId: { type: Schema.Types.ObjectId, ref: 'GratitudeMessage', required: true, index: true },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true, maxlength: 300 },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open', index: true },
    resolvedBy: Schema.Types.ObjectId,
    resolvedAt: Date,
  },
  { timestamps: true, versionKey: false },
);
reportSchema.index({ messageId: 1, reporterId: 1 }, { unique: true });

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

export const GratitudeMessage = model('GratitudeMessage', gratitudeSchema);
export const Report = model('Report', reportSchema);
export const Notification = model('Notification', notificationSchema);
