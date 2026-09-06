import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { SessionModel } from '@/lib/db/models/session';
import { PlayerModel } from '@/lib/db/models/player';
import { SessionPlayerModel } from '@/lib/db/models/sessionPlayer';

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
    sessionPlayers.map((sessionPlayer) => {
      const populatedPlayer = sessionPlayer.playerId as unknown as
        | { name: string }
        | null
        | undefined;

      return {
        id: sessionPlayer._id.toString(),
        name: sessionPlayer.guestName ?? populatedPlayer?.name ?? '',
        status: sessionPlayer.status,
        registeredAt: sessionPlayer.registeredAt,
        checkedInAt: sessionPlayer.checkedInAt ?? null,
        matchesPlayedInSession: sessionPlayer.matchesPlayedInSession,
      };
    }),
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  await connectToDatabase();

  const session = await SessionModel.findById(id);
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  let player = await PlayerModel.findOne({
    name: new RegExp(`^${escapeRegExp(name)}$`, 'i'),
  });
  if (!player) {
    player = await PlayerModel.create({ name });
  }

  const duplicate = await SessionPlayerModel.findOne({
    sessionId: id,
    playerId: player._id,
  });
  if (duplicate) {
    return NextResponse.json(
      { error: `${player.name} อยู่ใน session นี้แล้ว` },
      { status: 409 },
    );
  }

  const sessionPlayer = await SessionPlayerModel.create({
    sessionId: id,
    playerId: player._id,
  });

  return NextResponse.json(
    {
      id: sessionPlayer._id.toString(),
      name: player.name,
      status: sessionPlayer.status,
      registeredAt: sessionPlayer.registeredAt,
    },
    { status: 201 },
  );
}
