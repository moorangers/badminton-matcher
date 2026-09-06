import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { PlayerModel } from '@/lib/db/models/player';

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  await connectToDatabase();

  const player = await PlayerModel.findById(playerId);
  if (!player) {
    return NextResponse.json({ error: 'player not found' }, { status: 404 });
  }

  const duplicate = await PlayerModel.findOne({
    _id: { $ne: playerId },
    name: new RegExp(`^${escapeRegExp(name)}$`, 'i'),
  });
  if (duplicate) {
    return NextResponse.json(
      { error: `มีผู้เล่นชื่อ "${name}" อยู่แล้ว` },
      { status: 409 },
    );
  }

  player.name = name;
  await player.save();

  return NextResponse.json({ id: player._id.toString(), name: player.name });
}
