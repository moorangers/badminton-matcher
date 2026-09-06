import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { MatchModel } from '@/lib/db/models/match';
import { serializeMatch } from '@/lib/db/services/matchLifecycle';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const { id, matchId } = await params;
  const body = await request.json().catch(() => null);
  const team = body?.team;
  const delta = body?.delta;

  if (team !== 'A' && team !== 'B') {
    return NextResponse.json(
      { error: 'team must be "A" or "B"' },
      { status: 400 },
    );
  }
  if (delta !== 1 && delta !== -1) {
    return NextResponse.json(
      { error: 'delta must be 1 or -1' },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const existing = await MatchModel.findOne({ _id: matchId, sessionId: id });
  if (!existing) {
    return NextResponse.json({ error: 'match not found' }, { status: 404 });
  }
  if (existing.status === 'done') {
    return NextResponse.json(
      { error: 'cannot score a match that is already done' },
      { status: 400 },
    );
  }

  // Atomic $inc instead of read-modify-write — rapid taps fire concurrent
  // requests, and "match.scoreA = match.scoreA + delta; save()" loses
  // updates when two requests read the same value before either saves.
  const field = team === 'A' ? 'scoreA' : 'scoreB';
  const filter: Record<string, unknown> = { _id: matchId, sessionId: id };
  if (delta === -1) {
    filter[field] = { $gt: 0 }; // never decrement below 0
  }

  const updated = await MatchModel.findOneAndUpdate(
    filter,
    { $inc: { [field]: delta } },
    { new: true },
  );

  // null only when delta === -1 and the score was already 0 — a no-op,
  // not an error, so just report the unchanged current state.
  return NextResponse.json(serializeMatch(updated ?? existing));
}
