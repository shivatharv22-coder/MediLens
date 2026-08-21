import { assertSameOrigin, fail, guardRate, ok, parseJson } from '@/lib/api';
import { assertAuthEnabled } from '@/lib/auth';
import { verifyResetCodeSchema } from '@/lib/schemas';
import { verifyResetCode } from '@/services/auth/password-reset';

export const dynamic = 'force-dynamic';

/**
 * Check whether a (email, code) pair is a live reset code, so the form can move
 * to the new-password step instead of failing only after the user has typed a
 * new password.
 *
 * Returns a bare boolean — never the code, its expiry, or the account it
 * belongs to. A wrong code and an unknown address answer identically.
 *
 * POST, not GET: the code and email are secrets and must not land in a URL,
 * request log, or browser history.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    assertAuthEnabled();
    // Tight, because a 6-digit code is guessable at scale: this bounds attempts.
    guardRate(req, 'auth:reset-verify', { limit: 10, windowSeconds: 600 });

    const body = await parseJson(req, verifyResetCodeSchema);
    const { valid } = await verifyResetCode(body.email, body.code);

    return ok({ valid });
  } catch (e) {
    return fail(e, 'auth');
  }
}
