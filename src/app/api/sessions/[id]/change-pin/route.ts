import { NextResponse } from 'next/server';

import { hashPin, isValidPin, verifyPin } from '@/lib/auth/pin';
import { connectToDatabase } from '@/lib/db/mongodb';
import { SessionModel } from '@/lib/db/models/session';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const currentPin = body?.currentPin;
  const newPin = body?.newPin;

  if (typeof currentPin !== 'string' || typeof newPin !== 'string') {
    return NextResponse.json(
      { error: 'currentPin and newPin are required' },
      { status: 400 },
    );
  }
  if (!isValidPin(newPin)) {
    return NextResponse.json(
      { error: 'newPin must be 4-6 digits' },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const session = await SessionModel.findById(id);
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  const isMatch = await verifyPin(currentPin, session.adminPinHash);
  if (!isMatch) {
    return NextResponse.json({ error: 'PIN ปัจจุบันไม่ถูกต้อง' }, { status: 401 });
  }

  session.adminPinHash = await hashPin(newPin);
  await session.save();

  return NextResponse.json({ ok: true });
}
