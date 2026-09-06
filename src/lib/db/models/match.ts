import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const matchSchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  court: { type: Number, required: true },
  mode: { type: String, enum: ['singles', 'doubles'], required: true },
  teamA: [{ type: Schema.Types.ObjectId, ref: 'SessionPlayer', required: true }],
  teamB: [{ type: Schema.Types.ObjectId, ref: 'SessionPlayer', required: true }],
  status: {
    type: String,
    enum: ['ready', 'playing', 'done'],
    required: true,
    default: 'ready',
  },
  startedAt: { type: Date },
  finishedAt: { type: Date },
  // true ถ้า transition ไป 'done' ครั้งนี้ได้ bump matchesPlayedInSession/partnerHistory ไปแล้ว
  // (ต่างจาก close-court ที่จบแมตช์ status 'ready' โดยไม่นับสถิติ) — ใช้ตอน undo-finish
  statsCounted: { type: Boolean, required: true, default: false },
  // คะแนนเกมปัจจุบัน (นับแต้มเดียว ไม่ track หลายเกมต่อแมตช์ — ดู ADR-013)
  scoreA: { type: Number, required: true, default: 0, min: 0 },
  scoreB: { type: Number, required: true, default: 0, min: 0 },
});

matchSchema.index({ sessionId: 1, status: 1 });
matchSchema.index({ sessionId: 1, court: 1 });

export type MatchDocument = InferSchemaType<typeof matchSchema>;
export const MatchModel =
  mongoose.models.Match ?? mongoose.model('Match', matchSchema);
