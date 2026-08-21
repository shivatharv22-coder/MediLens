import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DevFileMailer } from '@/services/mailer/dev-file-mailer';
import { extractResetCode, isResetMailFile } from '@/scripts/dev-reset-code.core';

/**
 * The development password-reset workflow, end to end but database-free.
 *
 * The mailer writes a reset message — now a 6-digit code — to `.dev-mail`, and
 * `npm run dev:reset-code` reads it back. That hand-off is what makes the
 * workflow usable, and it is exactly what breaks silently if the email body
 * changes. This pins the contract between the two.
 */

/** The reset email body, as `services/auth/password-reset.ts` builds it. */
function resetEmailBody(code: string, ttlMinutes = 10): string {
  return [
    'Someone asked to reset the password for your MediLens account.',
    '',
    'Enter this code to choose a new password:',
    '',
    `    ${code}`,
    '',
    `The code works once and expires in ${ttlMinutes} minutes.`,
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

describe('extractResetCode', () => {
  it('pulls the 6-digit code out of a real reset body', () => {
    expect(extractResetCode(resetEmailBody('042317'))).toBe('042317');
  });

  it('is not fooled by the "expires in N minutes" number', () => {
    // The only other digits in the body are the 2-digit TTL.
    expect(extractResetCode(resetEmailBody('654321', 10))).toBe('654321');
  });

  it('returns null when there is no six-digit run', () => {
    expect(extractResetCode('THIS MESSAGE WAS NOT EMAILED.\nNothing to see.')).toBeNull();
  });
});

describe('DevFileMailer to dev:reset-code hand-off', () => {
  it('writes a file the script recognises and can read a live code from', async () => {
    const code = '024680';
    const result = await new DevFileMailer().send({
      to: 'user@example.com',
      subject: 'Your MediLens password reset code',
      text: resetEmailBody(code),
      kind: 'password-reset',
    });

    const fileName = path.basename(result.devLocation!);
    expect(isResetMailFile(fileName)).toBe(true);

    const contents = await fs.readFile(path.join(workDir, result.devLocation!), 'utf8');
    expect(extractResetCode(contents)).toBe(code);
  });

  it('does not mistake a non-reset dev-mail file for a reset one', () => {
    expect(isResetMailFile('1700000000000-welcome-abcd1234.txt')).toBe(false);
    expect(isResetMailFile('1700000000000-password-reset-abcd1234.txt')).toBe(true);
    expect(isResetMailFile('notes.md')).toBe(false);
  });
});
