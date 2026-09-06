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
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type SessionDocument = InferSchemaType<typeof sessionSchema>;
export const SessionModel =
  mongoose.models.Session ?? mongoose.model('Session', sessionSchema);
