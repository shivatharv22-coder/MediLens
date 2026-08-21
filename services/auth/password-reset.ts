import 'server-only';
import { env } from '@/config/env';
import { APP_NAME } from '@/config/app';
import { audit } from '@/lib/audit';
import { hashPassword, randomNumericCode, sha256 } from '@/lib/crypto';
import { requireDb } from '@/lib/db';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getMailer } from '@/services/mailer';
import type { DeliveryChannel } from '@/services/mailer/types';

/**
 * Password reset by a 6-digit one-time code (OTP).
 *
 * The code is emailed to the account holder; they type it back into the reset
 * form. Security properties, all enforced here rather than by the caller:
 *
 *  - **Single use.** A code is marked `usedAt` inside the same transaction
 *    that changes the password, so a replay finds it spent.
 *  - **Expiring.** `PASSWORD_RESET_TTL_MINUTES`, 10 by default. Short on
 *    purpose: a 6-digit code has only a million possibilities, so a narrow
 *    window is a large part of what keeps it unguessable.
 *  - **Hashed at rest.** Only `sha256(userId:code)` is stored — never the code.
 *    Scoping the hash by user both keeps the value unique (two accounts may pick
 *    the same six digits) and means a code can only ever be tried against the
 *    one account it was issued for.
 *  - **Account-scoped.** A bare 6-digit code identifies no one, so every check
 *    is resolved through the email first. Verifying and completing therefore
 *    take (email, code), and both fail identically for a wrong code and an
 *    unknown address.
 *  - **Not an account oracle.** `requestPasswordReset` returns the same shape
 *    whether or not the address is registered, and verify/complete answer the
 *    same way for a missing account as for a wrong code.
 *  - **Never logged.** No code path writes the raw code to a log, an error, or
 *    an API response.
 *  - **Sessions revoked.** A completed reset invalidates every existing
 *    session, so a thief who already had one is locked out.
 *
 * Brute force is bounded by the short expiry, single use, the fact that
 * requesting a new code invalidates the old one, and the endpoint rate limits
 * on the verify and complete routes. A multi-instance deployment that needs a
 * hard per-code attempt cap should add an `attempts` counter to the token row
 * and a shared-store rate limiter; the in-memory limiter here is per instance.
 */

export interface ResetRequestOutcome {
  /** How the message was actually delivered. Never implies more than happened. */
  channel: DeliveryChannel;
  /** Set only for the development file mailer. Never contains the code. */
  devLocation?: string;
}

/** Digits in a reset code. Kept here so the generator and the docs agree. */
const CODE_DIGITS = 6;

/**
 * How a code is hashed for storage and lookup: SHA-256 of `${userId}:${code}`.
 *
 * The user scope is load-bearing, not decorative — see the class comment.
 */
function codeHash(userId: string, code: string): string {
  return sha256(`${userId}:${code}`);
}

function buildEmailBody(code: string, ttlMinutes: number): string {
  return [
    `Someone asked to reset the password for your ${APP_NAME} account.`,
    '',
    'Enter this code to choose a new password:',
    '',
    `    ${code}`,
    '',
    `The code works once and expires in ${ttlMinutes} minutes.`,
    '',
    'If you did not ask for this, you can ignore this message — your password',
    'has not changed.',
  ].join('\n');
}

/**
 * Issue a reset code and hand it to the mailer.
 *
 * Always resolves. An unknown address still returns a channel so the caller can
 * render an identical message either way.
 */
export async function requestPasswordReset(
  email: string,
  meta: { ipHash?: string | null; request?: Request } = {},
): Promise<ResetRequestOutcome> {
  const db = requireDb();
  const mailer = getMailer();

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, isActive: true, deletedAt: true },
  });

  // No account, or a disabled one: do the same amount of visible work and
  // report the same channel, so this endpoint cannot enumerate accounts.
  if (!user || !user.isActive || user.deletedAt) {
    logger.info('Password reset requested for an address with no active account');
    return { channel: mailer.channel === 'none' ? 'none' : mailer.channel };
  }

  const code = randomNumericCode(CODE_DIGITS);
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000);

  await db.$transaction([
    // Outstanding codes are superseded: requesting a new code must invalidate
    // any older one that might be sitting in an inbox.
    db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: codeHash(user.id, code),
        expiresAt,
        requestIpHash: meta.ipHash ?? null,
      },
    }),
  ]);

  const delivery = await mailer.send({
    to: user.email,
    subject: `Your ${APP_NAME} password reset code`,
    text: buildEmailBody(code, env.PASSWORD_RESET_TTL_MINUTES),
    kind: 'password-reset',
  });

  await audit({
    action: 'PASSWORD_RESET_REQUEST',
    actorId: user.id,
    actorEmail: user.email,
    entityType: 'User',
    entityId: user.id,
    // Records that a reset was requested and how it went out — never the code.
    metadata: { channel: delivery.channel },
    request: meta.request,
  });

  return { channel: delivery.channel, devLocation: delivery.devLocation };
}

/**
 * Look up a live, unspent code for an account without redeeming it.
 *
 * Returns the token row id so the caller can spend exactly that row, or null for
 * every failure mode — unknown address, wrong code, expired, used, or disabled
 * account — so nothing distinguishes them.
 */
async function findLiveCode(
  db: ReturnType<typeof requireDb>,
  email: string,
  code: string,
): Promise<{ id: string; userId: string; email: string } | null> {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, isActive: true, deletedAt: true },
  });
  if (!user || !user.isActive || user.deletedAt) return null;

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: codeHash(user.id, code) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (
    !record ||
    record.userId !== user.id ||
    record.usedAt ||
    record.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  return { id: record.id, userId: user.id, email: user.email };
}

/** Check an (email, code) pair without spending it, so the form can fail fast. */
export async function verifyResetCode(email: string, code: string): Promise<{ valid: boolean }> {
  const db = requireDb();
  const live = await findLiveCode(db, email, code);
  return { valid: !!live };
}

/**
 * Redeem a code and set the new password.
 *
 * Throws `INVALID_RESET_TOKEN` for every failure mode — expired, already used,
 * wrong, unknown, or belonging to a disabled account — so the response cannot
 * be used to probe code or account state.
 */
export async function completePasswordReset(
  email: string,
  code: string,
  newPassword: string,
  meta: { request?: Request } = {},
): Promise<{ email: string }> {
  const db = requireDb();
  const live = await findLiveCode(db, email, code);
  if (!live) throw new AppError(ERROR_CODES.INVALID_RESET_TOKEN);

  const passwordHash = await hashPassword(newPassword);

  await db.$transaction([
    // Spending the code, changing the password, dropping any sibling codes and
    // revoking sessions all commit together or not at all.
    db.passwordResetToken.update({ where: { id: live.id }, data: { usedAt: new Date() } }),
    db.passwordResetToken.deleteMany({ where: { userId: live.userId, usedAt: null } }),
    db.user.update({ where: { id: live.userId }, data: { passwordHash } }),
    db.session.updateMany({
      where: { userId: live.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await audit({
    action: 'PASSWORD_RESET_COMPLETE',
    actorId: live.userId,
    actorEmail: live.email,
    entityType: 'User',
    entityId: live.userId,
    request: meta.request,
  });

  logger.info('Password reset completed');
  return { email: live.email };
}

/** Housekeeping: drop codes that are spent or long expired. */
export async function purgeResetTokens(): Promise<number> {
  const db = requireDb();
  const result = await db.passwordResetToken.deleteMany({
    where: { OR: [{ expiresAt: { lte: new Date() } }, { usedAt: { not: null } }] },
  });
  return result.count;
}
