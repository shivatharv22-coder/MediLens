import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { env, isAuthConfigured } from '@/config/env';
import { requireDb } from './db';
import { randomToken, sha256 } from './crypto';
import { logger } from './logger';

/**
 * Session handling.
 *
 * The cookie carries a signed JWT whose only payload is the session id and the
 * raw token. The token's SHA-256 is what is stored in the database, so a
 * database leak alone cannot be replayed as a valid session.
 */

export const SESSION_COOKIE = 'medilens_session';
export const GUEST_COOKIE = 'medilens_guest';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.SESSION_SECRET);
}

async function signSessionCookie(sessionId: string, token: string, expiresAt: Date) {
  return new SignJWT({ sid: sessionId, tok: token })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('medilens')
    .setAudience('medilens-app')
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());
}

async function readSessionCookie(value: string): Promise<{ sid: string; tok: string } | null> {
  try {
    const { payload } = await jwtVerify(value, secretKey(), {
      issuer: 'medilens',
      audience: 'medilens-app',
    });
    if (typeof payload.sid !== 'string' || typeof payload.tok !== 'string') return null;
    return { sid: payload.sid, tok: payload.tok };
  } catch {
    return null;
  }
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ipHash?: string | null } = {},
): Promise<void> {
  const db = requireDb();
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + env.SESSION_MAX_AGE * 1000);

  const session = await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ipHash: meta.ipHash ?? null,
    },
  });

  const jwt = await signSessionCookie(session.id, token, expiresAt);
  const store = await cookies();
  store.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isAuthConfigured()) return null;

  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const parsed = await readSessionCookie(raw);
  if (!parsed) return null;

  try {
    const db = requireDb();
    const session = await db.session.findUnique({
      where: { id: parsed.sid },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() < Date.now() ||
      session.tokenHash !== sha256(parsed.tok) ||
      !session.user.isActive ||
      session.user.deletedAt
    ) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      role: session.user.role,
    };
  } catch (e) {
    // Treated as signed out. Logged with the driver's error code so a genuine
    // database problem is distinguishable from a stale or malformed cookie.
    logger.error('Session lookup failed', {
      error: (e as Error).name,
      prismaCode: (e as { code?: string }).code ?? null,
    });
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  if (!raw || !isAuthConfigured()) return;

  const parsed = await readSessionCookie(raw);
  if (!parsed) return;
  try {
    await requireDb().session.updateMany({
      where: { id: parsed.sid, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch (e) {
    logger.warn('Session revoke failed', { error: (e as Error).name });
  }
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await requireDb().session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * A stable, non-identifying key for guest devices so a guest can retrieve the
 * result of the scan they just uploaded. Not a credential and never used for
 * authorisation of anything but the guest's own transient scan rows.
 */
export async function getOrCreateGuestKey(): Promise<string> {
  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;

  const key = randomToken(16);
  store.set(GUEST_COOKIE, key, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return key;
}

export async function readGuestKey(): Promise<string | null> {
  const store = await cookies();
  return store.get(GUEST_COOKIE)?.value ?? null;
}
