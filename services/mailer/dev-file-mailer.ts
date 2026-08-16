import 'server-only';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '@/lib/logger';
import type { DeliveryResult, MailMessage, Mailer } from './types';

/**
 * Development mailer: writes the message to a file instead of sending it.
 *
 * Why a file and not the console: a password-reset link must not appear in the
 * normal application log, which is shipped to log aggregators and is not
 * treated as secret. The log gets only the file name; the link lives in a
 * gitignored directory on the developer's own disk.
 *
 * Never selected when a real provider is configured, and `MAIL_PROVIDER=dev`
 * is documented as development-only.
 */
export class DevFileMailer implements Mailer {
  readonly name = 'dev-file';
  readonly channel = 'dev-file' as const;

  constructor(private readonly directory = '.dev-mail') {}

  isConfigured(): boolean {
    return true;
  }

  async send(message: MailMessage): Promise<DeliveryResult> {
    const dir = path.resolve(process.cwd(), this.directory);
    const fileName = `${Date.now()}-${message.kind}-${randomUUID().slice(0, 8)}.txt`;
    const file = path.join(dir, fileName);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      file,
      [
        'THIS MESSAGE WAS NOT EMAILED.',
        'It was written here by the development mailer (MAIL_PROVIDER=dev).',
        '',
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        '',
        message.text,
        '',
      ].join('\n'),
      { mode: 0o600 },
    );

    // Deliberately logs the location only — never the recipient or the body.
    logger.info('Development mailer wrote a message to disk', { file: fileName, kind: message.kind });

    return { channel: 'dev-file', devLocation: path.join(this.directory, fileName) };
  }
}
