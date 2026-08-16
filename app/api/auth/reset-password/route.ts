import { assertSameOrigin, fail, guardRate, ok, parseJson, searchParamsOf, validate } from '@/lib/api';
import { assertAuthEnabled } from '@/lib/auth';
import { inspectResetTokenSchema, resetPasswordSchema } from '@/lib/schemas';
import { completePasswordReset, inspectResetToken } from '@/services/auth/password-reset';

export const dynamic = 'force-dynamic';

/**
 * Check whether a reset link is still usable, so the form can show a clear
 * message instead of failing only after the user has typed a new password.
 *
 * Returns a bare boolean — never the token, its expiry, or the account it
 * belongs to.
 */
export async function GET(req: Request) {
  try {
    assertAuthEnabled();
    guardRate(req, 'auth:reset-inspect', { limit: 30, windowSeconds: 300 });

    const { token } = validate(inspectResetTokenSchema, searchParamsOf(req));
    const { valid } = await inspectResetToken(token);

    return ok({ valid });
  } catch (e) {
    return fail(e, 'auth');
  }
}

/** Redeem a reset token and set the new password. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    assertAuthEnabled();
    guardRate(req, 'auth:reset-password', { limit: 10, windowSeconds: 900 });

    const body = await parseJson(req, resetPasswordSchema);
    await completePasswordReset(body.token, body.password, { request: req });

    // No session is created here on purpose: the user re-authenticates with the
    // new password, which also confirms they know it.
    return ok({ reset: true });
  } catch (e) {
    return fail(e, 'auth');
  }
}
