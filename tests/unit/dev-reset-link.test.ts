import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DevFileMailer } from '@/services/mailer/dev-file-mailer';
import {
  extractResetLink,
  extractResetToken,
  isResetMailFile,
} from '@/scripts/dev-reset-link.core';

/**
 * The development password-reset workflow, end to end but database-free.
 *
 * The mailer writes a reset message to `.dev-mail` and `npm run dev:reset-link`
 * reads it back. That hand-off is what makes the workflow usable, and it is
 * exactly what breaks silently if the email body or the link shape drifts. This
 * pins the contract between the two.
 */

/** The reset email body, byte-for-byte as `services/auth/password-reset.ts` builds it. */
function resetEmailBody(resetUrl: string, ttlMinutes = 30): string {
  return [
    'Someone asked to reset the password for your MediLens account.',
    '',
    'Open this link to choose a new password:',
    resetUrl,
    '',
    `The link works once and expires in ${ttlMinutes} minutes.`,
    '',
    'If you did not ask for this, you can ignore this message — your password',
    'has not changed.',
  ].join('\n');
}

let workDir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'medilens-reset-'));
  process.chdir(workDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(workDir, { recursive: true, force: true });
});

describe('extractResetLink', () => {
  it('pulls a usable link with its token out of a real reset body', () => {
    const url = 'http://localhost:3000/auth/reset-password?token=abc123DEF-456_ghi';
    const link = extractResetLink(resetEmailBody(url));
    expect(link).toBe(url);
    expect(extractResetToken(link!)).toBe('abc123DEF-456_ghi');
  });

  it('accepts an https link on a non-default host and port', () => {
    const url = 'https://medilens.example:8443/auth/reset-password?token=XYZ_tok-en';
    expect(extractResetLink(`prefix ${url} suffix`)).toBe(url);
  });

  it('returns null when the path is right but the token is missing', () => {
    // A tokenless link would only send the developer to an invalid form.
    const body = 'See http://localhost:3000/auth/reset-password to continue';
    expect(extractResetLink(body)).toBeNull();
  });

  it('returns null for a body with no reset link at all', () => {
    expect(extractResetLink('THIS MESSAGE WAS NOT EMAILED.\nNothing to see.')).toBeNull();
  });
});

describe('DevFileMailer to dev:reset-link hand-off', () => {
  it('writes a file the script recognises and can read a live link from', async () => {
    const url = 'http://localhost:3000/auth/reset-password?token=live-TOKEN_value-99';
    const mailer = new DevFileMailer();

    const result = await mailer.send({
      to: 'user@example.com',
      subject: 'Reset your MediLens password',
      text: resetEmailBody(url),
      kind: 'password-reset',
    });

    // The name filter the script uses must accept what the mailer produced.
    const fileName = path.basename(result.devLocation!);
    expect(isResetMailFile(fileName)).toBe(true);

    const contents = await fs.readFile(path.join(workDir, result.devLocation!), 'utf8');
    const link = extractResetLink(contents);
    expect(link).toBe(url);
    expect(extractResetToken(link!)).toBe('live-TOKEN_value-99');
  });

  it('does not mistake a non-reset dev-mail file for a reset one', () => {
    expect(isResetMailFile('1700000000000-welcome-abcd1234.txt')).toBe(false);
    expect(isResetMailFile('1700000000000-password-reset-abcd1234.txt')).toBe(true);
    expect(isResetMailFile('notes.md')).toBe(false);
  });
});
