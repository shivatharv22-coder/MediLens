import { assertSameOrigin, clientIp, fail, guardRate, ok, parseJson } from '@/lib/api';
import { assertAuthEnabled } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { hashIp, hashPassword } from '@/lib/crypto';
import { requireDb } from '@/lib/db';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { signUpSchema } from '@/lib/schemas';
import { createSession } from '@/lib/session';
import { env } from '@/config/env';

export const dynamic = 'force-dynamic';

/** Create an account. Optional — scanning and search work without one. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    assertAuthEnabled();
    guardRate(req, 'auth:sign-up', { limit: 5, windowSeconds: 900 });

    const body = await parseJson(req, signUpSchema);
    const db = requireDb();

    const existing = await db.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (existing) {
      // Deliberately the same shape as a validation error so the endpoint is
      // not a reliable account-existence oracle.
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
        details: { email: ['This email cannot be used to register.'] },
      });
    }

    const user = await db.user.create({
      data: {
        email: body.email,
        passwordHash: await hashPassword(body.password),
        displayName: body.displayName ?? null,
        role: 'USER',
        preferences: { create: {} },
      },
      select: { id: true, email: true, displayName: true, role: true },
    });

    await createSession(user.id, {
      userAgent: req.headers.get('user-agent'),
      ipHash: hashIp(clientIp(req), env.SESSION_SECRET),
    });

    await audit({
      action: 'LOGIN',
      actorId: user.id,
      actorEmail: user.email,
      entityType: 'User',
      entityId: user.id,
      metadata: { via: 'sign-up' },
      request: req,
    });

    return ok({ user });
  } catch (e) {
    return fail(e, 'auth');
  }
}
