import 'server-only';
import { env } from '@/config/env';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { DeliveryResult, MailMessage, Mailer } from './types';

/**
 * Resend's shared sandbox sender.
 *
 * It works with only an API key -- no domain to verify -- which is what makes
 * `MAIL_PROVIDER=resend` usable on a fresh deployment. Resend only delivers
 * from this address to the account owner's own verified email, so it is right
 * for getting reset mail flowing; point `MAIL_FROM` at a verified domain to
 * reach arbitrary recipients.
 */
const RESEND_DEFAULT_FROM = 'onboarding@resend.dev';

/**
 * Resend transactional email.
 *
 * REQUIRES: MAIL_PROVIDER=resend and RESEND_API_KEY. `MAIL_FROM` is optional --
 * without it the message is sent from Resend's sandbox sender
 * (`onboarding@resend.dev`), which needs no domain verification.
 *
 * Implemented against the plain HTTP API rather than an SDK so it adds no
 * dependency. Swapping in SES, Postmark or SMTP means writing one more class
 * against `Mailer` and adding it to the factory.
 */
export class ResendMailer implements Mailer {
  readonly name = 'resend';
  readonly channel = 'email' as const;

  /** The API key is the only hard requirement; the from address has a default. */
  isConfigured(): boolean {
    return env.RESEND_API_KEY.trim().length > 0;
  }

  /** Configured `MAIL_FROM`, or the sandbox sender when none is set. */
  private fromAddress(): string {
    return env.MAIL_FROM.trim() || RESEND_DEFAULT_FROM;
  }

  async send(message: MailMessage): Promise<DeliveryResult> {
    if (!this.isConfigured()) {
      throw new AppError(ERROR_CODES.FEATURE_DISABLED, {
        logContext: { provider: this.name, reason: 'RESEND_API_KEY is empty' },
      });
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: this.fromAddress(),
          to: [message.to],
          subject: message.subject,
          text: message.text,
          tags: [{ name: 'kind', value: message.kind }],
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) throw new Error(`Resend responded ${response.status}`);

      // The response body echoes the message id; nothing from it is logged,
      // because the body of a reset email is secret.
      return { channel: 'email' };
    } catch (e) {
      logger.error('Email delivery failed', { provider: this.name, error: (e as Error).name });
      throw new AppError(ERROR_CODES.EMAIL_FAILED, { cause: e });
    }
  }
}
