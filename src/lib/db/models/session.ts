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
    // ค่า default สำหรับแมตช์ที่ "จะสร้างใหม่" — แมตช์ที่สร้างไปแล้วเก็บ targetScore
    // ของตัวเองแยกไว้ (เหมือน mode) เปลี่ยนตรงนี้จะไม่กระทบเกมที่กำลังเล่นอยู่
    targetScore: { type: Number, required: true, default: 21, min: 1, max: 99 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type SessionDocument = InferSchemaType<typeof sessionSchema>;
export const SessionModel =
  mongoose.models.Session ?? mongoose.model('Session', sessionSchema);
