import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/mongodb';
import { SessionModel } from '@/lib/db/models/session';
import {
  isValidActiveCourts,
  isValidTargetScore,
  serializeSession,
} from '@/lib/db/services/sessions';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await connectToDatabase();

  const session = await SessionModel.findById(id, { adminPinHash: 0 });
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  return NextResponse.json(serializeSession(session));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const mode = body?.mode;
  const activeCourts = body?.activeCourts;
  const status = body?.status;
  const targetScore = body?.targetScore;

  if (mode !== undefined && mode !== 'singles' && mode !== 'doubles') {
    return NextResponse.json(
      { error: 'mode must be "singles" or "doubles"' },
      { status: 400 },
    );
  }
  if (activeCourts !== undefined && !isValidActiveCourts(activeCourts)) {
    return NextResponse.json(
      { error: 'activeCourts must be a non-empty array of court numbers' },
      { status: 400 },
    );
  }
  if (status !== undefined && status !== 'open' && status !== 'closed') {
    return NextResponse.json(
      { error: 'status must be "open" or "closed"' },
      { status: 400 },
    );
  }
  if (targetScore !== undefined && !isValidTargetScore(targetScore)) {
    return NextResponse.json(
      { error: 'targetScore must be a whole number between 1 and 99' },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const session = await SessionModel.findById(id);
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  if (mode !== undefined) session.mode = mode;
  if (activeCourts !== undefined) {
    const courts: number[] = activeCourts;
    session.activeCourts = Array.from(new Set(courts)).sort((a, b) => a - b);
  }
  if (status !== undefined) session.status = status;
  if (targetScore !== undefined) session.targetScore = targetScore;

  await session.save();

  return NextResponse.json(serializeSession(session));
}
