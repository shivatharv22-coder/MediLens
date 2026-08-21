import { assertSameOrigin, fail, guardRate, ok, parseJson } from '@/lib/api';
import { assertAuthEnabled } from '@/lib/auth';
import { resetPasswordSchema } from '@/lib/schemas';
import { completePasswordReset } from '@/services/auth/password-reset';

export const dynamic = 'force-dynamic';

/** Redeem a reset code and set the new password. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    assertAuthEnabled();
    guardRate(req, 'auth:reset-password', { limit: 10, windowSeconds: 900 });

    const body = await parseJson(req, resetPasswordSchema);
    await completePasswordReset(body.email, body.code, body.password, { request: req });

    // No session is created here on purpose: the user re-authenticates with the
    // new password, which also confirms they know it.
    return ok({ reset: true });
  } catch (e) {
    return fail(e, 'auth');
  }
}
