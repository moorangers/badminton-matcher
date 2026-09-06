import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { SessionModel } from '@/lib/db/models/session';
import { addPlayersToSession } from '@/lib/db/services/sessionPlayers';

/**
 * Public endpoint — no PIN required. Lets a player sign themselves up for
 * a session ahead of time ("ลงชื่อล่วงหน้า"). They still need to check in
 * at the court (POST .../checkin) before they're eligible for the
 * matching pool.
 */
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
  if (session.status !== 'open') {
    return NextResponse.json(
      { error: 'session is closed' },
      { status: 400 },
    );
  }

  const { accepted, duplicates, rejectedForCapacity } =
    await addPlayersToSession(id, rawNames, 'registered');

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
