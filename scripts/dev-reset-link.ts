/**
 * Print the most recent development password-reset link.
 *
 * Only useful with MAIL_PROVIDER=dev, which writes reset messages to
 * `.dev-mail/` instead of emailing them. This script just reads the newest file
 * so you do not have to hunt for it.
 *
 * Usage: npm run dev:reset-link
 *
 * The directory is gitignored and the files are written 0600. Never run this
 * against a production installation, and never paste its output anywhere.
 */
import fs from 'node:fs';
import path from 'node:path';
import { extractResetLink, isResetMailFile } from './dev-reset-link.core';

const dir = path.resolve(process.cwd(), '.dev-mail');

if (!fs.existsSync(dir)) {
  console.error(
    'No .dev-mail directory.\n' +
      'Set MAIL_PROVIDER=dev in .env.local and request a password reset first.',
  );
  process.exit(1);
}

const files = fs
  .readdirSync(dir)
  .filter(isResetMailFile)
  .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

if (!files.length) {
  console.error('No password-reset messages in .dev-mail yet.');
  process.exit(1);
}

const newest = path.join(dir, files[0].f);
const contents = fs.readFileSync(newest, 'utf8');

console.log(`--- ${files[0].f} ---`);
console.log(contents);

const link = extractResetLink(contents);
if (link) {
  console.log('Open this link to continue the reset:');
  console.log(link);
} else {
  // The message exists but carries no usable link — surface that rather than
  // exiting silently, so a broken email body is obvious instead of mysterious.
  console.error('This message contained no usable reset link.');
  process.exit(1);
}
