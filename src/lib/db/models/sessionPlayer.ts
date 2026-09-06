import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const sessionPlayerSchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  // อ้าง Player ถ้ามาจากลงทะเบียนล่วงหน้า / ใช้ guestName ถ้ามาจาก QR self check-in (Phase 2)
  playerId: { type: Schema.Types.ObjectId, ref: 'Player' },
  guestName: { type: String, trim: true },
  status: {
    type: String,
    enum: ['registered', 'checked_in', 'resting', 'playing'],
    required: true,
    default: 'registered',
  },
  registeredAt: { type: Date, required: true, default: () => new Date() },
  checkedInAt: { type: Date },
  matchesPlayedInSession: { type: Number, required: true, default: 0 },
  // เวลาที่ "เริ่มรอคิว" ล่าสุด — ใช้เป็น wait-time fairness tie-breaker
  // (reset ทุกครั้งที่ลงทะเบียน, จบแมตช์, หรือถูกเปลี่ยนตัวออก)
  queuedAt: { type: Date, required: true, default: () => new Date() },
});

sessionPlayerSchema.index({ sessionId: 1, status: 1 });

export type SessionPlayerDocument = InferSchemaType<typeof sessionPlayerSchema>;
export const SessionPlayerModel =
  mongoose.models.SessionPlayer ??
  mongoose.model('SessionPlayer', sessionPlayerSchema);
