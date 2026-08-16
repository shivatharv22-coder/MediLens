import 'server-only';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { DevFileMailer } from './dev-file-mailer';
import { ResendMailer } from './resend-mailer';
import type { DeliveryResult, MailMessage, Mailer } from './types';

/**
 * A mailer that sends nothing and says so.
 *
 * This is the default. It exists so that an installation with no email provider
 * behaves honestly: the password-reset endpoint reports `channel: 'none'` and
 * the UI tells the user plainly that no email was sent, rather than showing a
 * reassuring message that is false.
 */
class NullMailer implements Mailer {
  readonly name = 'none';
  readonly channel = 'none' as const;

  isConfigured(): boolean {
    return true;
  }

  async send(message: MailMessage): Promise<DeliveryResult> {
    logger.warn('No mail provider configured — message not sent', { kind: message.kind });
    return { channel: 'none' };
  }
}

let cached: Mailer | null = null;

export function getMailer(): Mailer {
  if (cached) return cached;

  switch (env.MAIL_PROVIDER) {
    case 'resend': {
      const resend = new ResendMailer();
      if (resend.isConfigured()) {
        cached = resend;
      } else {
        logger.warn('MAIL_PROVIDER=resend but credentials are missing — nothing will be sent');
        cached = new NullMailer();
      }
      break;
    }
    case 'dev':
      cached = new DevFileMailer();
      break;
    default:
      cached = new NullMailer();
  }

  return cached;
}

/** Test helper. */
export function __setMailer(mailer: Mailer | null) {
  cached = mailer;
}

export { DevFileMailer, NullMailer, ResendMailer };
export type { DeliveryChannel, DeliveryResult, MailMessage, Mailer } from './types';
