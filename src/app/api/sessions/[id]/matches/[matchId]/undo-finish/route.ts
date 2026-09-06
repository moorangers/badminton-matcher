import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { MatchModel } from '@/lib/db/models/match';
import { SessionPlayerModel } from '@/lib/db/models/sessionPlayer';
import {
  findActiveMatchForPlayers,
  findActiveMatchForCourt,
  revertMatchFinishStats,
  serializeMatch,
} from '@/lib/db/services/matchLifecycle';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const { id, matchId } = await params;

  await connectToDatabase();

  const match = await MatchModel.findOne({ _id: matchId, sessionId: id });
  if (!match) {
    return NextResponse.json({ error: 'match not found' }, { status: 404 });
  }

  if (match.status !== 'done' || !match.statsCounted) {
    return NextResponse.json(
      { error: 'this match has nothing to undo' },
      { status: 400 },
    );
  }

  const allPlayerIds = [...match.teamA, ...match.teamB].map((playerId) =>
    playerId.toString(),
  );
  const conflictingMatch = await findActiveMatchForPlayers(
    id,
    allPlayerIds,
    matchId,
  );
  if (conflictingMatch) {
    return NextResponse.json(
      {
        error:
          'undo ไม่ได้ เพราะผู้เล่นบางคนถูกจัดลงแมตช์อื่นไปแล้วหลังจากจบแมตช์นี้',
      },
      { status: 409 },
    );
  }

  const courtAlreadyReused = await findActiveMatchForCourt(
    id,
    match.court,
    matchId,
  );
  if (courtAlreadyReused) {
    if (courtAlreadyReused.status !== 'ready') {
      // The auto-filled replacement match has actually been started (or,
      // shouldn't happen, already finished) — real gameplay may be in
      // progress, so it's not safe to silently discard it.
      return NextResponse.json(
        {
          error: `undo ไม่ได้ เพราะ Court ${match.court} มีแมตช์ใหม่เริ่มเล่นไปแล้วหลังจากจบแมตช์นี้`,
        },
        { status: 409 },
      );
    }

    // finishMatch() auto-fills the court with a fresh 'ready' match right
    // away — nobody has touched it yet (no score, not started), so it's
    // safe to discard it and send its players back to the resting pool,
    // then bring the undone match back onto the court.
    const reusedPlayerIds = [
      ...courtAlreadyReused.teamA,
      ...courtAlreadyReused.teamB,
    ].map((playerId) => playerId.toString());
    await SessionPlayerModel.updateMany(
      { _id: { $in: reusedPlayerIds } },
      { $set: { status: 'resting', queuedAt: new Date() } },
    );
    await courtAlreadyReused.deleteOne();
  }

  await revertMatchFinishStats(id, match);

  match.status = 'playing';
  match.finishedAt = undefined;
  match.statsCounted = false;
  await match.save();

  return NextResponse.json(serializeMatch(match));
}
