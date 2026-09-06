import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { SessionPlayerModel } from '@/lib/db/models/sessionPlayer';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; sessionPlayerId: string }> },
) {
  const { id, sessionPlayerId } = await params;
  await connectToDatabase();

  const sessionPlayer = await SessionPlayerModel.findOne({
    _id: sessionPlayerId,
    sessionId: id,
  });
  if (!sessionPlayer) {
    return NextResponse.json(
      { error: 'session player not found' },
      { status: 404 },
    );
  }

  if (sessionPlayer.status === 'playing') {
    return NextResponse.json(
      { error: 'player is currently in an active match — substitute first' },
      { status: 409 },
    );
  }

  await sessionPlayer.deleteOne();

  return NextResponse.json({ ok: true });
}
