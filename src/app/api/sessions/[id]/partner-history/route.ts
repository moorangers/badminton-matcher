import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { PartnerHistoryModel } from '@/lib/db/models/partnerHistory';
import { SessionPlayerModel } from '@/lib/db/models/sessionPlayer';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await connectToDatabase();

  const history = await PartnerHistoryModel.find({ sessionId: id })
    .sort({ timesPlayedTogether: -1 })
    .lean();

  if (history.length === 0) {
    return NextResponse.json([]);
  }

  const sessionPlayerIds = Array.from(
    new Set(history.flatMap((entry) => entry.pairKey.split('_'))),
  );
  const sessionPlayers = await SessionPlayerModel.find({
    _id: { $in: sessionPlayerIds },
  })
    .populate('playerId', 'name')
    .lean();

  const nameById = new Map(
    sessionPlayers.map((sessionPlayer) => {
      const populatedPlayer = sessionPlayer.playerId as unknown as
        | { name: string }
        | null
        | undefined;
      const name = sessionPlayer.guestName ?? populatedPlayer?.name ?? '';
      return [sessionPlayer._id.toString(), name];
    }),
  );

  return NextResponse.json(
    history.map((entry) => {
      const [playerIdA, playerIdB] = entry.pairKey.split('_');
      return {
        pairKey: entry.pairKey,
        players: [
          nameById.get(playerIdA) ?? playerIdA,
          nameById.get(playerIdB) ?? playerIdB,
        ],
        timesPlayedTogether: entry.timesPlayedTogether,
        lastPlayedAt: entry.lastPlayedAt ?? null,
      };
    }),
  );
}
