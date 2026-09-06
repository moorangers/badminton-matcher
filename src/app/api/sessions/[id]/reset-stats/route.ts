import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { SessionModel } from '@/lib/db/models/session';
import { SessionPlayerModel } from '@/lib/db/models/sessionPlayer';
import { MatchModel } from '@/lib/db/models/match';
import { PartnerHistoryModel } from '@/lib/db/models/partnerHistory';

/**
 * "รีเซ็ตสถิติ": start the session over with the same roster — clears all
 * matches and partner history, and zeroes each player's match count/queue
 * time. This is intentionally NOT the same as the old client-only
 * "clearAll" (which deleted the whole local dataset) — with shared,
 * durable session data, deleting the session itself would affect any other
 * device looking at it, so that is a separate, more deliberate action.
 *
 * Does NOT touch check-in status — anyone already 'checked_in'/'resting'
 * stays eligible for matching immediately (only 'playing' gets bumped to
 * 'checked_in' since their match was just deleted); previously this reset
 * everyone to 'registered', silently kicking the whole room out of the
 * matching pool until they re-checked in (see decision-log ADR-016).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await connectToDatabase();

  const session = await SessionModel.findById(id);
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  const now = new Date();
  await MatchModel.deleteMany({ sessionId: id });
  await PartnerHistoryModel.deleteMany({ sessionId: id });
  await SessionPlayerModel.updateMany(
    { sessionId: id, status: 'playing' },
    { $set: { status: 'checked_in' } },
  );
  await SessionPlayerModel.updateMany(
    { sessionId: id },
    { $set: { matchesPlayedInSession: 0, queuedAt: now } },
  );

  return NextResponse.json({ ok: true });
}
