import { assertSameOrigin, clientIp, fail, guardRate, ok, parseJson } from '@/lib/api';
import { assertAuthEnabled } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { hashIp, verifyPassword } from '@/lib/crypto';
import { requireDb } from '@/lib/db';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { signInSchema } from '@/lib/schemas';
import { createSession } from '@/lib/session';
import { env } from '@/config/env';

export const dynamic = 'force-dynamic';

/** Password sign-in. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    assertAuthEnabled();
    // Tight limit: this is the endpoint an attacker would spray.
    guardRate(req, 'auth:sign-in', { limit: 8, windowSeconds: 300 });

    const body = await parseJson(req, signInSchema);
    const db = requireDb();

    const user = await db.user.findUnique({ where: { email: body.email } });

    // Always run a hash comparison so a missing account and a wrong password
    // take the same time.
    const placeholder = '$2b$12$0000000000000000000000000000000000000000000000000000';
    const valid = await verifyPassword(body.password, user?.passwordHash ?? placeholder);

    if (!user || !valid || !user.isActive || user.deletedAt) {
      await audit({
        action: 'LOGIN_FAILED',
        actorEmail: body.email,
        entityType: 'User',
        metadata: { reason: !user ? 'unknown-account' : !valid ? 'bad-password' : 'inactive' },
        request: req,
      });
      throw new AppError(ERROR_CODES.UNAUTHORIZED, {
        details: { _: ['Email or password is incorrect.'] },
      });
    }

    await createSession(user.id, {
      userAgent: req.headers.get('user-agent'),
      ipHash: hashIp(clientIp(req), env.SESSION_SECRET),
    });
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    await audit({
      action: 'LOGIN',
      actorId: user.id,
      actorEmail: user.email,
      entityType: 'User',
      entityId: user.id,
      request: req,
    });

    return ok({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (e) {
    return fail(e, 'auth');
  }
}
