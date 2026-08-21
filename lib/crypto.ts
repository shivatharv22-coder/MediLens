import 'server-only';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/** Opaque, URL-safe random token. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Uniform numeric one-time code, e.g. "042317".
 *
 * `randomInt` is cryptographically secure and unbiased across the range, and
 * the pad keeps leading zeros so every value in 000000–999999 is equally
 * likely — a code is a full six digits, never a shorter number.
 */
export function randomNumericCode(digits = 6): string {
  return randomInt(0, 10 ** digits)
    .toString()
    .padStart(digits, '0');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * One-way hash of an IP address for rate limiting and audit logs.
 * Salted with the session secret so the values are not reversible via a
 * rainbow table of the IPv4 space.
 */
export function hashIp(ip: string | null | undefined, salt: string): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
