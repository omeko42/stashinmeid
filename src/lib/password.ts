import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** Format: "<salt-hex>:<hash-hex>". */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** Verify a scrypt password hash. Returns false for any malformed hash. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash, ...extra] = stored.split(':');
  if (!salt || !hash || extra.length > 0 || !/^[a-f0-9]+$/i.test(salt) || !/^[a-f0-9]+$/i.test(hash)) {
    return false;
  }

  const expected = Buffer.from(hash, 'hex');
  if (expected.length === 0 || expected.toString('hex') !== hash.toLowerCase()) return false;

  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

/** Constant-time string comparison for legacy plain-text credentials. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Hash a one-time reset token. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
