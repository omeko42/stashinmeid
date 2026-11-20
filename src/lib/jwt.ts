import { SignJWT, jwtVerify } from 'jose';

export interface SuperadminSessionPayload {
  sub: string;
  role: 'superadmin';
  impersonateUserId?: string;
  impersonateEmail?: string;
  impersonateClientName?: string;
}

function getSecretKey() {
  const secret = process.env.JWT_SECRET || process.env.SUPERADMIN_PASSWORD;
  if (!secret) {
    throw new Error('JWT_SECRET atau SUPERADMIN_PASSWORD belum diset.');
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
