import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const playerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    totalMatchesPlayed: { type: Number, required: true, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type PlayerDocument = InferSchemaType<typeof playerSchema>;
export const PlayerModel =
  mongoose.models.Player ?? mongoose.model('Player', playerSchema);
