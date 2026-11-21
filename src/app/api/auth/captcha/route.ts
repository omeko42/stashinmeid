import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, clientIp, rateLimitHeaders } from '@/lib/rateLimit';
import { verifyTurnstile } from '@/lib/turnstile';

/**
 * Verifikasi captcha Cloudflare Turnstile.
 *
 * Dipakai untuk jalur login yang TIDAK lewat Supabase Auth (login
 * superadmin), sehingga token tidak bisa diverifikasi oleh GoTrue.
 *
 * Untuk login dan signup Supabase biasa, token dikirim langsung ke
 * Supabase lewat `options.captchaToken` - GoTrue yang memverifikasinya.
 * Dua jalur ini tidak bentrok karena user hanya melewati salah satu.
 *
 * Rate limit: 20 percobaan per 10 menit per IP. Verifikasi captcha yang
 * gagal berulang tetap harus dibatasi, kalau tidak bot bisa memakai
 * endpoint ini sebagai oracle.
 */
const VERIFY_LIMIT = 20;
const VERIFY_WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limit = checkRateLimit(
    `turnstile:${ip}`,
    VERIFY_LIMIT,
    VERIFY_WINDOW_MS
  );

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Terlalu banyak percobaan verifikasi. Coba lagi dalam ${limit.retryAfterSeconds} detik.`,
      },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  let token: string | null = null;
  try {
    const body = await req.json();
    token = typeof body?.token === 'string' ? body.token : null;
  } catch {
    token = null;
  }

  const result = await verifyTurnstile(token, ip);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || 'Verifikasi captcha gagal.' },
      { status: 403, headers: rateLimitHeaders(limit) }
    );
  }

  return NextResponse.json({ ok: true, skipped: result.skipped ?? false });
}
