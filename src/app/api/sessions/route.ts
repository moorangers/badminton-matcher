import { NextResponse } from 'next/server';

import { hashPin, isValidPin } from '@/lib/auth/pin';
import { connectToDatabase } from '@/lib/db/mongodb';
import { SessionModel } from '@/lib/db/models/session';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const mode = body?.mode;
  const pin = body?.pin;

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

  await connectToDatabase();
  const adminPinHash = await hashPin(pin);
  const session = await SessionModel.create({ mode, adminPinHash });

  return NextResponse.json(
    {
      id: session._id.toString(),
      mode: session.mode,
      status: session.status,
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
      createdAt: session.createdAt,
    })),
  );
}
