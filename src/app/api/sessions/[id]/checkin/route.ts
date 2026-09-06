import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { SessionModel } from '@/lib/db/models/session';
import {
  addPlayersToSession,
  findSessionPlayerByIdOrName,
  serializeSessionPlayer,
} from '@/lib/db/services/sessionPlayers';

/**
 * Public endpoint — no PIN required. This is what the QR code at the
 * court points to. Two cases:
 *  - name/id matches someone already 'registered' (signed up ahead of
 *    time) -> confirm they're actually here: move to 'checked_in'.
 *  - no match at all (walk-in who never pre-registered) -> create them
 *    directly as 'checked_in'.
 * Already checked-in/resting/playing players are returned as-is
 * (idempotent — scanning twice doesn't error).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const sessionPlayerId =
    typeof body?.sessionPlayerId === 'string' ? body.sessionPlayerId : undefined;
  const name = typeof body?.name === 'string' ? body.name.trim() : undefined;

  if (!sessionPlayerId && !name) {
    return NextResponse.json(
      { error: 'sessionPlayerId or name is required' },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const session = await SessionModel.findById(id);
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }
  if (session.status !== 'open') {
    return NextResponse.json({ error: 'session is closed' }, { status: 400 });
  }

  const existing = await findSessionPlayerByIdOrName(id, {
    sessionPlayerId,
    name,
  });

  if (existing) {
    if (existing.status === 'registered') {
      existing.status = 'checked_in';
      existing.checkedInAt = new Date();
      existing.queuedAt = new Date();
      await existing.save();
    }

    const populated = await existing.populate('playerId', 'name');
    return NextResponse.json(
      serializeSessionPlayer(
        populated as unknown as Parameters<typeof serializeSessionPlayer>[0],
      ),
    );
  }

  if (sessionPlayerId) {
    return NextResponse.json(
      { error: 'session player not found' },
      { status: 404 },
    );
  }

  const { accepted, duplicates, rejectedForCapacity } =
    await addPlayersToSession(id, [name!], 'checked_in');

  if (accepted.length === 0) {
    if (rejectedForCapacity > 0) {
      return NextResponse.json(
        { error: 'session player list is full' },
        { status: 400 },
      );
    }
    if (duplicates.length > 0) {
      return NextResponse.json(
        { error: 'ชื่อนี้เช็คอินไปแล้ว ลองรีเฟรชหน้า' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'check-in failed' },
      { status: 400 },
    );
  }

  return NextResponse.json(accepted[0], { status: 201 });
}
