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
 * WAJIB: JWT_SECRET harus diset sendiri di environment variable.
 * Jangan pernah memakai password sebagai kunci enkripsi token - kalau password
 * bocor, seluruh sesi superadmin bisa dipalsukan.
 */
function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      'JWT_SECRET belum diset. Set JWT_SECRET di environment variable (Vercel) sebelum deploy.'
    );
  }

  if (secret.length < 32) {
    throw new Error(
      'JWT_SECRET terlalu pendek. Minimal 32 karakter. Generate dengan: openssl rand -base64 48'
    );
  }

  return new TextEncoder().encode(secret);
}

export async function signSuperadminToken(payload: SuperadminSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecretKey());
}

export async function verifySuperadminToken(
  token: string | undefined
): Promise<SuperadminSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.role !== 'superadmin') return null;
    return payload as unknown as SuperadminSessionPayload;
  } catch {
    return null;
  }
}
