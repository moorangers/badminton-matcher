import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { MatchModel } from '@/lib/db/models/match';
import { SessionPlayerModel } from '@/lib/db/models/sessionPlayer';
import {
  findActiveMatchForPlayers,
  serializeMatch,
} from '@/lib/db/services/matchLifecycle';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const { id, matchId } = await params;
  const body = await request.json().catch(() => null);
  const outSessionPlayerId = body?.outSessionPlayerId;
  const inSessionPlayerId = body?.inSessionPlayerId;

  if (
    typeof outSessionPlayerId !== 'string' ||
    typeof inSessionPlayerId !== 'string'
  ) {
    return NextResponse.json(
      { error: 'outSessionPlayerId and inSessionPlayerId are required' },
      { status: 400 },
    );
  }
  if (outSessionPlayerId === inSessionPlayerId) {
    return NextResponse.json(
      { error: 'outSessionPlayerId and inSessionPlayerId must differ' },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const match = await MatchModel.findOne({ _id: matchId, sessionId: id });
  if (!match) {
    return NextResponse.json({ error: 'match not found' }, { status: 404 });
  }
  if (match.status === 'done') {
    return NextResponse.json(
      { error: 'match is already done' },
      { status: 400 },
    );
  }

  const isInTeamA = match.teamA.some(
    (playerId) => playerId.toString() === outSessionPlayerId,
  );
  const isInTeamB = match.teamB.some(
    (playerId) => playerId.toString() === outSessionPlayerId,
  );
  if (!isInTeamA && !isInTeamB) {
    return NextResponse.json(
      { error: 'outSessionPlayerId is not in this match' },
      { status: 400 },
    );
  }

  const inPlayer = await SessionPlayerModel.findOne({
    _id: inSessionPlayerId,
    sessionId: id,
  });
  if (!inPlayer) {
    return NextResponse.json(
      { error: 'inSessionPlayerId does not belong to this session' },
      { status: 400 },
    );
  }

  const busyMatch = await findActiveMatchForPlayers(
    id,
    [inSessionPlayerId],
    matchId,
  );
  if (busyMatch) {
    return NextResponse.json(
      { error: 'inSessionPlayerId is already in another active match' },
      { status: 409 },
    );
  }

  const swap = (team: typeof match.teamA) =>
    team.map((playerId) =>
      playerId.toString() === outSessionPlayerId
        ? inPlayer._id
        : playerId,
    );

  match.teamA = swap(match.teamA);
  match.teamB = swap(match.teamB);
  await match.save();

  await SessionPlayerModel.updateOne(
    { _id: outSessionPlayerId },
    { $set: { status: 'resting', queuedAt: new Date() } },
  );
  await SessionPlayerModel.updateOne(
    { _id: inSessionPlayerId },
    { $set: { status: 'playing' } },
  );

  return NextResponse.json(serializeMatch(match));
}
