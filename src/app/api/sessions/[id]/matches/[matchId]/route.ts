import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { MatchModel } from '@/lib/db/models/match';
import { applyMatchFinishStats } from '@/lib/db/services/matchLifecycle';

const VALID_STATUSES = ['ready', 'playing', 'done'];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const { id, matchId } = await params;
  const body = await request.json().catch(() => null);
  const nextStatus = body?.status;

  if (!VALID_STATUSES.includes(nextStatus)) {
    return NextResponse.json(
      { error: `status must be one of ${VALID_STATUSES.join(', ')}` },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const match = await MatchModel.findOne({ _id: matchId, sessionId: id });
  if (!match) {
    return NextResponse.json({ error: 'match not found' }, { status: 404 });
  }

  const wasAlreadyDone = match.status === 'done';

  if (nextStatus === 'playing' && match.status !== 'playing') {
    match.startedAt = new Date();
  }

  if (nextStatus === 'done' && !wasAlreadyDone) {
    match.finishedAt = new Date();

    if (match.status === 'playing') {
      await applyMatchFinishStats(id, match);
      match.statsCounted = true;
    }
  }

  match.status = nextStatus;
  await match.save();

  return NextResponse.json({
    id: match._id.toString(),
    court: match.court,
    mode: match.mode,
    teamA: match.teamA.map((playerId) => playerId.toString()),
    teamB: match.teamB.map((playerId) => playerId.toString()),
    status: match.status,
    startedAt: match.startedAt ?? null,
    finishedAt: match.finishedAt ?? null,
    statsCounted: match.statsCounted,
  });
}
