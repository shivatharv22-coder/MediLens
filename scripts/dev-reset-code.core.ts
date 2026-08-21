/**
 * Pure helpers for `dev-reset-code.ts`, split out so the dev workflow can be
 * covered by a test.
 *
 * With `MAIL_PROVIDER=dev` the reset email — now carrying a 6-digit code rather
 * than a link — is written to a `.dev-mail` file, and `npm run dev:reset-code`
 * reads the code back out. Nothing else tests that hand-off, so these functions
 * are the part worth pinning; the file I/O stays in the runner.
 */

/** True for a dev-mail file that holds a password-reset message. */
export function isResetMailFile(fileName: string): boolean {
  return fileName.endsWith('.txt') && fileName.includes('password-reset');
}

/**
 * The 6-digit reset code inside a dev-mail message body, or null.
 *
 * Matches the first standalone six-digit run. The body sets the code on its own
 * line, and the only other number in it ("expires in 10 minutes") is two
 * digits, so a six-digit match is unambiguous.
 */
export function extractResetCode(contents: string): string | null {
  const match = contents.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}
