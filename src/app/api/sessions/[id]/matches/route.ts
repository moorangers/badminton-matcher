import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { SessionModel } from '@/lib/db/models/session';
import { SessionPlayerModel } from '@/lib/db/models/sessionPlayer';
import { MatchModel } from '@/lib/db/models/match';
import { findActiveMatchForPlayers } from '@/lib/db/services/matchLifecycle';

const PLAYERS_PER_TEAM: Record<'singles' | 'doubles', number> = {
  singles: 1,
  doubles: 2,
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  await connectToDatabase();

  const query: Record<string, unknown> = { sessionId: id };
  if (status) {
    query.status = status;
  }

  const matches = await MatchModel.find(query).sort({ court: 1 }).lean();

  return NextResponse.json(
    matches.map((match) => ({
      id: match._id.toString(),
      court: match.court,
      mode: match.mode,
      teamA: match.teamA.map((playerId) => playerId.toString()),
      teamB: match.teamB.map((playerId) => playerId.toString()),
      status: match.status,
      startedAt: match.startedAt ?? null,
      finishedAt: match.finishedAt ?? null,
      statsCounted: match.statsCounted,
    })),
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const court = body?.court;
  const mode = body?.mode;
  const teamAIds = Array.isArray(body?.teamAIds) ? body.teamAIds : null;
  const teamBIds = Array.isArray(body?.teamBIds) ? body.teamBIds : null;

  if (typeof court !== 'number' || court < 1) {
    return NextResponse.json(
      { error: 'court must be a positive number' },
      { status: 400 },
    );
  }
  if (mode !== 'singles' && mode !== 'doubles') {
    return NextResponse.json(
      { error: 'mode must be "singles" or "doubles"' },
      { status: 400 },
    );
  }
  const requiredPerTeam = PLAYERS_PER_TEAM[mode as 'singles' | 'doubles'];
  if (
    !teamAIds ||
    !teamBIds ||
    teamAIds.length !== requiredPerTeam ||
    teamBIds.length !== requiredPerTeam
  ) {
    return NextResponse.json(
      { error: `each team needs exactly ${requiredPerTeam} player(s) for ${mode}` },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const session = await SessionModel.findById(id);
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  const allPlayerIds: string[] = [...teamAIds, ...teamBIds];
  const uniquePlayerIds = new Set(allPlayerIds);
  if (uniquePlayerIds.size !== allPlayerIds.length) {
    return NextResponse.json(
      { error: 'a player cannot appear twice in the same match' },
      { status: 400 },
    );
  }

  const matchingSessionPlayers = await SessionPlayerModel.find({
    _id: { $in: allPlayerIds },
    sessionId: id,
  });
  if (matchingSessionPlayers.length !== allPlayerIds.length) {
    return NextResponse.json(
      { error: 'one or more players do not belong to this session' },
      { status: 400 },
    );
  }
  const notCheckedIn = matchingSessionPlayers.some(
    (sessionPlayer) => sessionPlayer.status === 'registered',
  );
  if (notCheckedIn) {
    return NextResponse.json(
      {
        error:
          'one or more players have not checked in yet — they signed up but have not confirmed being at the court',
      },
      { status: 400 },
    );
  }

  const busyMatch = await findActiveMatchForPlayers(id, allPlayerIds);
  if (busyMatch) {
    return NextResponse.json(
      { error: 'one or more players are already in an active match' },
      { status: 409 },
    );
  }

  const courtInUse = await MatchModel.findOne({
    sessionId: id,
    court,
    status: { $ne: 'done' },
  });
  if (courtInUse) {
    return NextResponse.json(
      { error: `court ${court} already has an active match` },
      { status: 409 },
    );
  }

  const match = await MatchModel.create({
    sessionId: id,
    court,
    mode,
    teamA: teamAIds,
    teamB: teamBIds,
  });

  await SessionPlayerModel.updateMany(
    { _id: { $in: allPlayerIds } },
    { $set: { status: 'playing' } },
  );

  return NextResponse.json(
    {
      id: match._id.toString(),
      court: match.court,
      mode: match.mode,
      teamA: match.teamA.map((playerId) => playerId.toString()),
      teamB: match.teamB.map((playerId) => playerId.toString()),
      status: match.status,
      statsCounted: match.statsCounted,
    },
    { status: 201 },
  );
}
