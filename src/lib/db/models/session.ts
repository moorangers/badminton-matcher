import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const sessionSchema = new Schema(
  {
    mode: { type: String, enum: ['singles', 'doubles'], required: true },
    status: {
      type: String,
      enum: ['open', 'closed'],
      required: true,
      default: 'open',
    },
    adminPinHash: { type: String, required: true },
    // คอร์ดที่ยังเปิดใช้งานสำหรับรอบถัดไป — แก้ผ่าน "ปรับรอบถัดไป" หรือ "ปิดคอร์ด"
    activeCourts: { type: [Number], required: true, default: [1] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type SessionDocument = InferSchemaType<typeof sessionSchema>;
export const SessionModel =
  mongoose.models.Session ?? mongoose.model('Session', sessionSchema);
