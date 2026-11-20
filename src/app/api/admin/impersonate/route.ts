import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySuperadminToken, signSuperadminToken } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('stashinme_session')?.value;
  const session = await verifySuperadminToken(token);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, email, clientName } = await req.json();
  if (!userId || !email) {
    return NextResponse.json({ error: 'Target user tidak valid.' }, { status: 400 });
  }

  const newToken = await signSuperadminToken({
    sub: session.sub,
    role: 'superadmin',
    impersonateUserId: userId,
    impersonateEmail: email,
    impersonateClientName: clientName || 'Personal',
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set('stashinme_session', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE() {
  const cookieStore = await cookies();
  const token = cookieStore.get('stashinme_session')?.value;
  const session = await verifySuperadminToken(token);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const newToken = await signSuperadminToken({
    sub: session.sub,
    role: 'superadmin',
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set('stashinme_session', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
