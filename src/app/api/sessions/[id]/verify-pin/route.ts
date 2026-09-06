import { NextResponse } from 'next/server';

import { verifyPin } from '@/lib/auth/pin';
import { connectToDatabase } from '@/lib/db/mongodb';
import { SessionModel } from '@/lib/db/models/session';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const pin = body?.pin;

  if (typeof pin !== 'string') {
    return NextResponse.json({ error: 'pin is required' }, { status: 400 });
  }

  await connectToDatabase();
  const session = await SessionModel.findById(id);
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  const isMatch = await verifyPin(pin, session.adminPinHash);
  if (!isMatch) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
