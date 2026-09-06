import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { PostModel } from '@/lib/db/models/post';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_PHOTOS_PER_POST = 6;

const serializePost = (post: {
  _id: { toString(): string };
  text: string;
  photoUrls: string[];
  createdAt?: Date;
}) => ({
  id: post._id.toString(),
  text: post.text,
  photoUrls: post.photoUrls,
  createdAt: post.createdAt ?? null,
});

/** Public — no PIN required. The webboard is meant to be visible to the
 * whole club, not just whoever has the current session's PIN. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Number(searchParams.get('limit')) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const cursor = searchParams.get('cursor');

  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (cursor) {
    query._id = { $lt: cursor };
  }

  const posts = await PostModel.find(query)
    .sort({ _id: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({
    posts: posts.map((post) => serializePost(post)),
    nextCursor:
      posts.length === limit ? posts[posts.length - 1]._id.toString() : null,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const photoUrls = Array.isArray(body?.photoUrls)
    ? body.photoUrls.filter((url: unknown): url is string => typeof url === 'string')
    : [];
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : undefined;

  if (!text && photoUrls.length === 0) {
    return NextResponse.json(
      { error: 'text or at least one photo is required' },
      { status: 400 },
    );
  }
  if (photoUrls.length > MAX_PHOTOS_PER_POST) {
    return NextResponse.json(
      { error: `at most ${MAX_PHOTOS_PER_POST} photos per post` },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const post = await PostModel.create({
    sessionId,
    text,
    photoUrls,
  });

  return NextResponse.json(serializePost(post), { status: 201 });
}
