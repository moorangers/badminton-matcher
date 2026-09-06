import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { SessionModel } from '@/lib/db/models/session';
import { PlayerModel } from '@/lib/db/models/player';
import { SessionPlayerModel } from '@/lib/db/models/sessionPlayer';

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const serializeSessionPlayer = (sessionPlayer: {
  _id: { toString(): string };
  guestName?: string | null;
  playerId?: { _id: { toString(): string }; name: string } | null;
  status: string;
  registeredAt: Date;
  checkedInAt?: Date | null;
  matchesPlayedInSession: number;
  queuedAt: Date;
}) => ({
  id: sessionPlayer._id.toString(),
  playerId: sessionPlayer.playerId?._id.toString() ?? null,
  name: sessionPlayer.guestName ?? sessionPlayer.playerId?.name ?? '',
  status: sessionPlayer.status,
  registeredAt: sessionPlayer.registeredAt,
  checkedInAt: sessionPlayer.checkedInAt ?? null,
  matchesPlayedInSession: sessionPlayer.matchesPlayedInSession,
  queuedAt: sessionPlayer.queuedAt,
});

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

  const incoming = rawNames
    .map((name: unknown) => (typeof name === 'string' ? name.trim() : ''))
    .filter(Boolean);
  if (incoming.length === 0) {
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

  const existingSessionPlayers = await SessionPlayerModel.find({
    sessionId: id,
  }).populate('playerId', 'name');
  const existingNames = new Set(
    existingSessionPlayers.map((sessionPlayer) =>
      (
        sessionPlayer.guestName ??
        (sessionPlayer.playerId as unknown as { name: string } | null)?.name ??
        ''
      ).toLowerCase(),
    ),
  );

  const accepted: ReturnType<typeof serializeSessionPlayer>[] = [];
  const duplicates: string[] = [];

  for (const name of incoming) {
    const key = name.toLowerCase();
    if (existingNames.has(key)) {
      duplicates.push(name);
      continue;
    }
    existingNames.add(key);

    let player = await PlayerModel.findOne({
      name: new RegExp(`^${escapeRegExp(name)}$`, 'i'),
    });
    if (!player) {
      player = await PlayerModel.create({ name });
    }

    const sessionPlayer = await SessionPlayerModel.create({
      sessionId: id,
      playerId: player._id,
    });

    accepted.push(
      serializeSessionPlayer({
        _id: sessionPlayer._id,
        playerId: { _id: player._id, name: player.name },
        status: sessionPlayer.status,
        registeredAt: sessionPlayer.registeredAt,
        checkedInAt: sessionPlayer.checkedInAt,
        matchesPlayedInSession: sessionPlayer.matchesPlayedInSession,
        queuedAt: sessionPlayer.queuedAt,
      }),
    );
  }

  return NextResponse.json({ accepted, duplicates }, { status: 201 });
}
