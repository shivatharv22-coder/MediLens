import 'server-only';
import { env } from '@/config/env';
import { APP_NAME } from '@/config/app';
import { audit } from '@/lib/audit';
import { hashPassword, randomToken, sha256 } from '@/lib/crypto';
import { requireDb } from '@/lib/db';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getMailer } from '@/services/mailer';
import type { DeliveryChannel } from '@/services/mailer/types';

/**
 * Password reset.
 *
 * Security properties, all enforced here rather than by the caller:
 *
 *  - **Single use.** A token is marked `usedAt` inside the same transaction
 *    that changes the password, so a replay finds it spent.
 *  - **Expiring.** `PASSWORD_RESET_TTL_MINUTES`, 30 by default.
 *  - **Hashed at rest.** Only the SHA-256 is stored; the raw token exists only
 *    in the delivered message and the URL the user clicks.
 *  - **Not an account oracle.** `requestPasswordReset` returns the same shape
 *    whether or not the address is registered.
 *  - **Never logged.** No code path writes the raw token to a log, an error, or
 *    an API response.
 *  - **Sessions revoked.** A completed reset invalidates every existing
 *    session, so a thief who already had one is locked out.
 */

export interface ResetRequestOutcome {
  /** How the message was actually delivered. Never implies more than happened. */
  channel: DeliveryChannel;
  /** Set only for the development file mailer. Never contains the token. */
  devLocation?: string;
}

function buildResetUrl(token: string): string {
  const url = new URL('/auth/reset-password', env.APP_URL);
  url.searchParams.set('token', token);
  return url.toString();
}

function buildEmailBody(resetUrl: string, ttlMinutes: number): string {
  return [
    `Someone asked to reset the password for your ${APP_NAME} account.`,
    '',
    'Open this link to choose a new password:',
    resetUrl,
    '',
    `The link works once and expires in ${ttlMinutes} minutes.`,
    '',
    'If you did not ask for this, you can ignore this message — your password',
    'has not changed.',
  ].join('\n');
}

/**
 * Issue a reset token and hand it to the mailer.
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

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000);

  await db.$transaction([
    // Outstanding tokens are superseded: requesting a new link must invalidate
    // any older one that might be sitting in an inbox.
    db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt,
        requestIpHash: meta.ipHash ?? null,
      },
    }),
  ]);

  const delivery = await mailer.send({
    to: user.email,
    subject: `Reset your ${APP_NAME} password`,
    text: buildEmailBody(buildResetUrl(token), env.PASSWORD_RESET_TTL_MINUTES),
    kind: 'password-reset',
  });

  await audit({
    action: 'PASSWORD_RESET_REQUEST',
    actorId: user.id,
    actorEmail: user.email,
    entityType: 'User',
    entityId: user.id,
    // Records that a reset was requested and how it went out — never the token.
    metadata: { channel: delivery.channel },
    request: meta.request,
  });

  return { channel: delivery.channel, devLocation: delivery.devLocation };
}

/** Check a token without spending it, so the reset form can fail fast. */
export async function inspectResetToken(token: string): Promise<{ valid: boolean }> {
  if (!token || token.length < 16) return { valid: false };
  const db = requireDb();

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
    select: { expiresAt: true, usedAt: true, user: { select: { isActive: true, deletedAt: true } } },
  });

  const valid =
    !!record &&
    !record.usedAt &&
    record.expiresAt.getTime() > Date.now() &&
    record.user.isActive &&
    !record.user.deletedAt;

  return { valid };
}

/**
 * Redeem a token and set the new password.
 *
 * Throws `INVALID_RESET_TOKEN` for every failure mode — expired, already used,
 * unknown, or belonging to a disabled account — so the response cannot be used
 * to probe token state.
 */
export async function completePasswordReset(
  token: string,
  newPassword: string,
  meta: { request?: Request } = {},
): Promise<{ email: string }> {
  const db = requireDb();
  const tokenHash = sha256(token);

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { id: true, email: true, isActive: true, deletedAt: true } },
    },
  });

  if (
    !record ||
    record.usedAt ||
    record.expiresAt.getTime() <= Date.now() ||
    !record.user.isActive ||
    record.user.deletedAt
  ) {
    throw new AppError(ERROR_CODES.INVALID_RESET_TOKEN);
  }

  const passwordHash = await hashPassword(newPassword);

  await db.$transaction([
    // Spending the token, changing the password, dropping any sibling tokens
    // and revoking sessions all commit together or not at all.
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.passwordResetToken.deleteMany({ where: { userId: record.user.id, usedAt: null } }),
    db.user.update({ where: { id: record.user.id }, data: { passwordHash } }),
    db.session.updateMany({
      where: { userId: record.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await audit({
    action: 'PASSWORD_RESET_COMPLETE',
    actorId: record.user.id,
    actorEmail: record.user.email,
    entityType: 'User',
    entityId: record.user.id,
    request: meta.request,
  });

  logger.info('Password reset completed');
  return { email: record.user.email };
}

/** Housekeeping: drop tokens that are spent or long expired. */
export async function purgeResetTokens(): Promise<number> {
  const db = requireDb();
  const result = await db.passwordResetToken.deleteMany({
    where: { OR: [{ expiresAt: { lte: new Date() } }, { usedAt: { not: null } }] },
  });
  return result.count;
}
