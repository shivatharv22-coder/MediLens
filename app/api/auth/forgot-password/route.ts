import { assertSameOrigin, clientIp, fail, guardRate, ok, parseJson } from '@/lib/api';
import { assertAuthEnabled } from '@/lib/auth';
import { hashIp } from '@/lib/crypto';
import { forgotPasswordSchema } from '@/lib/schemas';
import { env } from '@/config/env';
import { requestPasswordReset } from '@/services/auth/password-reset';

export const dynamic = 'force-dynamic';

/**
 * Start a password reset.
 *
 * Always answers 200 with the same shape, whether or not the address has an
 * account, so it cannot be used to discover who is registered. `channel` tells
 * the UI what actually happened — MediLens never claims an email was sent when
 * no provider is configured.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    assertAuthEnabled();
    // Deliberately tight: this endpoint sends mail and writes tokens.
    guardRate(req, 'auth:forgot-password', { limit: 5, windowSeconds: 900 });

    const body = await parseJson(req, forgotPasswordSchema);

    const outcome = await requestPasswordReset(body.email, {
      ipHash: hashIp(clientIp(req), env.SESSION_SECRET),
      request: req,
    });

    // Only the channel is returned. The dev mailer's file path is deliberately
    // NOT included: it is present for a real account and absent for an unknown
    // one, which would turn this endpoint into an account-existence oracle.
    // Developers read the code with `npm run dev:reset-code` instead.
    return ok({
      channel: outcome.channel,
      expiresInMinutes: env.PASSWORD_RESET_TTL_MINUTES,
    });
  } catch (e) {
    return fail(e, 'auth');
  }
}
