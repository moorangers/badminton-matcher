import { NextResponse } from 'next/server';

import { hashPin, isValidPin } from '@/lib/auth/pin';
import { connectToDatabase } from '@/lib/db/mongodb';
import { SessionModel } from '@/lib/db/models/session';

const MAX_COURT_NUMBER = 20;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const mode = body?.mode;
  const pin = body?.pin;
  const activeCourts = body?.activeCourts ?? [1];

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

  const isValidCourts =
    Array.isArray(activeCourts) &&
    activeCourts.length > 0 &&
    activeCourts.every(
      (court) =>
        typeof court === 'number' && court >= 1 && court <= MAX_COURT_NUMBER,
    );
  if (!isValidCourts) {
    return NextResponse.json(
      {
        error: `activeCourts must be a non-empty array of numbers between 1 and ${MAX_COURT_NUMBER}`,
      },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const adminPinHash = await hashPin(pin);
  const session = await SessionModel.create({
    mode,
    adminPinHash,
    activeCourts: Array.from(new Set(activeCourts)).sort((a, b) => a - b),
  });

  return NextResponse.json(
    {
      id: session._id.toString(),
      mode: session.mode,
      status: session.status,
      activeCourts: session.activeCourts,
      createdAt: session.createdAt,
    },
    { status: 201 },
  );
}

export async function GET() {
  await connectToDatabase();
  const sessions = await SessionModel.find({}, { adminPinHash: 0 })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return NextResponse.json(
    sessions.map((session) => ({
      id: session._id.toString(),
      mode: session.mode,
      status: session.status,
      activeCourts: session.activeCourts,
      createdAt: session.createdAt,
    })),
  );
}
