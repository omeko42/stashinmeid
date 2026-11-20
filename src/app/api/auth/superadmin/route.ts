import { NextRequest, NextResponse } from 'next/server';
import { signSuperadminToken } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    const envUser = process.env.SUPERADMIN_USERNAME;
    const envPass = process.env.SUPERADMIN_PASSWORD;

    if (!envUser || !envPass) {
      return NextResponse.json(
        { error: 'Superadmin belum dikonfigurasi di Environment Variables.' },
        { status: 400 }
      );
    }

    if (username === envUser && password === envPass) {
      const token = await signSuperadminToken({
        sub: envUser,
        role: 'superadmin',
      });

      const res = NextResponse.json({ ok: true });
      res.cookies.set('stashinme_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      return res;
    }

    return NextResponse.json(
      { error: 'Username atau password superadmin salah.' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('stashinme_session');
  return res;
}
