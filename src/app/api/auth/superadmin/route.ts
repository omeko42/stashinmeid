import { NextRequest, NextResponse } from 'next/server';
import { signSuperadminToken } from '@/lib/jwt';
import { verifyPassword, safeEqual } from '@/lib/password';
import { checkRateLimit, clientIp, rateLimitHeaders } from '@/lib/rateLimit';

// Batas percobaan login: 10x per 15 menit per IP.
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limit = checkRateLimit(`login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Terlalu banyak percobaan login. Coba lagi dalam ${limit.retryAfterSeconds} detik.`,
      },
      {
        status: 429,
        headers: rateLimitHeaders(limit),
      }
    );
  }

  try {
    const { username, password } = await req.json();

    const envUser = process.env.SUPERADMIN_USERNAME;
    const envPass = process.env.SUPERADMIN_PASSWORD;
    const envHash = process.env.SUPERADMIN_PASSWORD_HASH;

    if (!envUser || (!envHash && !envPass)) {
      return NextResponse.json(
        { error: 'Superadmin belum dikonfigurasi di Environment Variables.' },
        { status: 400 }
      );
    }

    const usernameOk = safeEqual(String(username ?? ''), envUser);

    // Dua jalur kompatibilitas:
    // 1. SUPERADMIN_PASSWORD_HASH - password sudah di-hash (disarankan)
    // 2. SUPERADMIN_PASSWORD     - password polos,compare langsung (mode lama)
    //
    // Format hash: "<salt-hex>:<hash-hex>", hasil dari `npm run hash-password -- "password"`
    let passwordOk = false;

    if (envHash) {
      passwordOk = verifyPassword(String(password ?? ''), envHash);
    } else {
      passwordOk = safeEqual(String(password ?? ''), envPass ?? '');
    }

    if (usernameOk && passwordOk) {
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
