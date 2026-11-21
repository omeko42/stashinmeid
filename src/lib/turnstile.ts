import { NextResponse } from 'next/server';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifikasi token Cloudflare Turnstile di sisi server.
 *
 * Token dari browser TIDAK bisa dipercaya - bisa dipalsukan. Jadi
 * server yang menukarnya dengan Cloudflare untuk memastikan token itu
 * memang asli dan belum dipakai.
 *
 * Kalau env belum diset (mis. development), fungsi ini return
 * `{ ok: true, skipped: true }` supaya app tetap bisa dipakai tanpa
 * captcha. Di production, `TURNSTILE_SECRET_KEY` WAJIB ada - kalau tidak,
 * return `{ ok: false }` supaya tidak ada celah bypass.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string | null
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

  // Kalau widget tidak dikonfigurasi sama sekali, tidak ada captcha yang
  // perlu diverifikasi.
  if (!secret && !siteKey) {
    return { ok: true, skipped: true };
  }

  if (!secret) {
    return {
      ok: false,
      error: 'TURNSTILE_SECRET_KEY belum diset di environment variable.',
    };
  }

  if (!token) {
    return { ok: false, error: 'Captcha belum diselesaikan.' };
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });

    if (!res.ok) {
      return { ok: false, error: 'Verifikasi captcha gagal.' };
    }

    const data = (await res.json()) as {
      success?: boolean;
      'error-codes'?: string[];
    };

    if (!data.success) {
      return {
        ok: false,
        error:
          data['error-codes']?.[0] === 'timeout-or-duplicate'
            ? 'Captcha kedaluwarsa. Coba lagi.'
            : 'Verifikasi captcha gagal.',
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Tidak bisa menghubungi server captcha.' };
  }
}

/**
 * Ambil IP request dari header. Dipakai sebagai bukti tambahan ke
 * Cloudflare (remoteip).
 */
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || null;
  }
  return req.headers.get('x-real-ip');
}

/**
 * Helper untuk route yang butuh captcha. Balokir dengan 403 kalau captcha
 * gagal.
 */
export async function requireTurnstile(
  req: Request
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  let token: string | null = null;
  try {
    const body = await req.clone().json();
    token = typeof body?.captchaToken === 'string' ? body.captchaToken : null;
  } catch {
    token = null;
  }

  const result = await verifyTurnstile(token, clientIp(req));

  if (!result.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: result.error || 'Verifikasi captcha gagal.' },
        { status: 403 }
      ),
    };
  }

  return { ok: true };
}
