import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const partnerHistorySchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  pairKey: { type: String, required: true }, // sorted "playerAId_playerBId"
  timesPlayedTogether: { type: Number, required: true, default: 0 },
  lastPlayedAt: { type: Date },
});

partnerHistorySchema.index({ sessionId: 1, pairKey: 1 }, { unique: true });

export type PartnerHistoryDocument = InferSchemaType<
  typeof partnerHistorySchema
>;
export const PartnerHistoryModel =
  mongoose.models.PartnerHistory ??
  mongoose.model('PartnerHistory', partnerHistorySchema);
