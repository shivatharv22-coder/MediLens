import 'server-only';
import { env } from '@/config/env';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { DeliveryResult, MailMessage, Mailer } from './types';

/**
 * Resend transactional email.
 *
 * REQUIRES CREDENTIALS: MAIL_PROVIDER=resend, RESEND_API_KEY and MAIL_FROM.
 *
 * Implemented against the plain HTTP API rather than an SDK so it adds no
 * dependency. Swapping in SES, Postmark or SMTP means writing one more class
 * against `Mailer` and adding it to the factory.
 */
export class ResendMailer implements Mailer {
  readonly name = 'resend';
  readonly channel = 'email' as const;

  isConfigured(): boolean {
    return env.RESEND_API_KEY.trim().length > 0 && env.MAIL_FROM.trim().length > 0;
  }

  async send(message: MailMessage): Promise<DeliveryResult> {
    if (!this.isConfigured()) {
      throw new AppError(ERROR_CODES.FEATURE_DISABLED, {
        logContext: { provider: this.name, reason: 'RESEND_API_KEY or MAIL_FROM is empty' },
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
          from: env.MAIL_FROM,
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
