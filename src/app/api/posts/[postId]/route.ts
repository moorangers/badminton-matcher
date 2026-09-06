import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';

import { connectToDatabase } from '@/lib/db/mongodb';
import { PostModel } from '@/lib/db/models/post';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  await connectToDatabase();

  const post = await PostModel.findById(postId);
  if (!post) {
    return NextResponse.json({ error: 'post not found' }, { status: 404 });
  }

  await post.deleteOne();

  // Best-effort cleanup — if Blob deletion fails (e.g. token not
  // configured in this environment), the post is still gone either way.
  if (post.photoUrls.length > 0) {
    await del(post.photoUrls).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
