import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const postSchema = new Schema(
  {
    // Which session was open when this was posted, if any — just for
    // reference, the feed itself is club-wide (not filtered by session).
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session' },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    photoUrls: { type: [String], required: true, default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

postSchema.index({ createdAt: -1 });

export type PostDocument = InferSchemaType<typeof postSchema>;
export const PostModel = mongoose.models.Post ?? mongoose.model('Post', postSchema);
