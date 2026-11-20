import { SignJWT, jwtVerify } from 'jose';

export interface SuperadminSessionPayload {
  sub: string;
  role: 'superadmin';
  impersonateUserId?: string;
  impersonateEmail?: string;
  impersonateClientName?: string;
}

/**
 * Kunci tanda tangan token.
 *
 * Jika JWT_SECRET >= 32 karakter tersedia, pakai langsung.
 * Jika tidak, turunkan kunci 32-byte secara deterministik dari env secret
 * yang sudah ada agar login tetap berjalan tanpa konfigurasi ekstra.
 */
async function getSecretKey(): Promise<Uint8Array> {
  const jwtSecret = process.env.JWT_SECRET?.trim();

  if (jwtSecret && jwtSecret.length >= 32) {
    return new TextEncoder().encode(jwtSecret);
  }

  const seed =
    jwtSecret ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPERADMIN_PASSWORD_HASH?.trim() ||
    process.env.SUPERADMIN_PASSWORD?.trim();

  if (!seed) {
    throw new Error(
      'Secret signing key belum tersedia. Set JWT_SECRET, SUPABASE_SERVICE_ROLE_KEY, atau SUPERADMIN_PASSWORD.'
    );
  }

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`stashinmeid-superadmin-jwt-v1:${seed}`)
  );
  return new Uint8Array(digest);
}

export async function signSuperadminToken(payload: SuperadminSessionPayload): Promise<string> {
  const key = await getSecretKey();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

export async function verifySuperadminToken(
  token: string | undefined
): Promise<SuperadminSessionPayload | null> {
  if (!token) return null;
  try {
    const key = await getSecretKey();
    const { payload } = await jwtVerify(token, key);
    if (payload.role !== 'superadmin') return null;
    return payload as unknown as SuperadminSessionPayload;
  } catch {
    return null;
  }
}
