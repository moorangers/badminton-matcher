import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { SessionModel } from '@/lib/db/models/session';
import { SessionPlayerModel } from '@/lib/db/models/sessionPlayer';
import {
  addPlayersToSession,
  serializeSessionPlayer,
} from '@/lib/db/services/sessionPlayers';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await connectToDatabase();

  const sessionPlayers = await SessionPlayerModel.find({ sessionId: id })
    .populate('playerId', 'name')
    .sort({ registeredAt: 1 })
    .lean();

  return NextResponse.json(
    sessionPlayers.map((sessionPlayer) =>
      serializeSessionPlayer(
        sessionPlayer as Parameters<typeof serializeSessionPlayer>[0],
      ),
    ),
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const rawNames = Array.isArray(body?.names) ? body.names : null;

  if (!rawNames) {
    return NextResponse.json(
      { error: 'names must be a non-empty array of strings' },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const session = await SessionModel.findById(id);
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  // Added via the admin dashboard, in person at the court — treat as
  // already checked in (no separate confirm-you're-here step needed).
  const { accepted, duplicates, rejectedForCapacity } =
    await addPlayersToSession(id, rawNames, 'checked_in');

  if (accepted.length === 0 && rejectedForCapacity > 0 && duplicates.length === 0) {
    return NextResponse.json(
      { error: 'session player list is full' },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { accepted, duplicates, rejectedForCapacity },
    { status: 201 },
  );
}
