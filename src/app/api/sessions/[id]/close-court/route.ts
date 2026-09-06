import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { SessionModel } from '@/lib/db/models/session';
import { MatchModel } from '@/lib/db/models/match';
import { applyMatchFinishStats } from '@/lib/db/services/matchLifecycle';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const court = body?.court;

  if (typeof court !== 'number' || court < 1) {
    return NextResponse.json(
      { error: 'court must be a positive number' },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const session = await SessionModel.findById(id);
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  const activeMatch = await MatchModel.findOne({
    sessionId: id,
    court,
    status: { $ne: 'done' },
  });

  if (activeMatch) {
    if (activeMatch.status === 'playing') {
      await applyMatchFinishStats(id, activeMatch);
      activeMatch.statsCounted = true;
    }
    activeMatch.status = 'done';
    activeMatch.finishedAt = new Date();
    await activeMatch.save();
  }

  session.activeCourts = session.activeCourts.filter(
    (activeCourt) => activeCourt !== court,
  );
  await session.save();

  return NextResponse.json({
    session: {
      id: session._id.toString(),
      mode: session.mode,
      status: session.status,
      activeCourts: session.activeCourts,
    },
    closedMatchId: activeMatch ? activeMatch._id.toString() : null,
  });
}
