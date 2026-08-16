import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DevFileMailer } from '@/services/mailer/dev-file-mailer';
import { NullMailer } from '@/services/mailer';

let workDir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'medilens-mail-'));
  process.chdir(workDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(workDir, { recursive: true, force: true });
});

describe('DevFileMailer', () => {
  it('writes the message to a file instead of sending it', async () => {
    const mailer = new DevFileMailer();
    const result = await mailer.send({
      to: 'user@example.com',
      subject: 'Reset your password',
      text: 'https://example.com/auth/reset-password?token=SECRET_TOKEN_VALUE',
      kind: 'password-reset',
    });

    expect(result.channel).toBe('dev-file');
    expect(result.devLocation).toBeTruthy();

    const contents = await fs.readFile(path.join(workDir, result.devLocation!), 'utf8');
    expect(contents).toContain('THIS MESSAGE WAS NOT EMAILED');
    expect(contents).toContain('user@example.com');
    expect(contents).toContain('SECRET_TOKEN_VALUE');
  });

  it('reports a location, never the token itself', async () => {
    const mailer = new DevFileMailer();
    const result = await mailer.send({
      to: 'user@example.com',
      subject: 'Reset',
      text: 'token=SECRET_TOKEN_VALUE',
      kind: 'password-reset',
    });

    // The API returns devLocation to the browser, so it must be a path only.
    expect(result.devLocation).not.toContain('SECRET_TOKEN_VALUE');
    expect(result.devLocation).toMatch(/^\.dev-mail[\\/]/);
  });

  it('keeps each message in its own file', async () => {
    const mailer = new DevFileMailer();
    const a = await mailer.send({ to: 'a@example.com', subject: 's', text: 'a', kind: 'password-reset' });
    const b = await mailer.send({ to: 'b@example.com', subject: 's', text: 'b', kind: 'password-reset' });
    expect(a.devLocation).not.toBe(b.devLocation);
  });
});

describe('NullMailer', () => {
  it('reports that nothing was sent', async () => {
    const result = await new NullMailer().send({
      to: 'user@example.com',
      subject: 'Reset',
      text: 'body',
      kind: 'password-reset',
    });

    // The UI keys off this to avoid claiming an email was delivered.
    expect(result.channel).toBe('none');
    expect(result.devLocation).toBeUndefined();
  });
});
