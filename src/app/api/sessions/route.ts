import { NextResponse } from 'next/server';

import { hashPin, isValidPin } from '@/lib/auth/pin';
import { connectToDatabase } from '@/lib/db/mongodb';
import { SessionModel } from '@/lib/db/models/session';
import {
  isValidActiveCourts,
  isValidTargetScore,
  serializeSession,
} from '@/lib/db/services/sessions';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const mode = body?.mode;
  const pin = body?.pin;
  const activeCourts = body?.activeCourts ?? [1];
  const targetScore = body?.targetScore ?? 21;

  if (mode !== 'singles' && mode !== 'doubles') {
    return NextResponse.json(
      { error: 'mode must be "singles" or "doubles"' },
      { status: 400 },
    );
  }

  if (typeof pin !== 'string' || !isValidPin(pin)) {
    return NextResponse.json(
      { error: 'pin must be 4-6 digits' },
      { status: 400 },
    );
  }

  if (!isValidActiveCourts(activeCourts)) {
    return NextResponse.json(
      { error: 'activeCourts must be a non-empty array of court numbers' },
      { status: 400 },
    );
  }

  if (!isValidTargetScore(targetScore)) {
    return NextResponse.json(
      { error: 'targetScore must be a whole number between 1 and 99' },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const adminPinHash = await hashPin(pin);
  const session = await SessionModel.create({
    mode,
    adminPinHash,
    activeCourts: Array.from(new Set(activeCourts)).sort((a, b) => a - b),
    targetScore,
  });

  return NextResponse.json(serializeSession(session), { status: 201 });
}

export async function GET() {
  await connectToDatabase();
  const sessions = await SessionModel.find({}, { adminPinHash: 0 })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return NextResponse.json(sessions.map((session) => serializeSession(session)));
}
