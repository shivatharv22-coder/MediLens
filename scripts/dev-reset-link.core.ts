/**
 * Pure helpers for `dev-reset-link.ts`, split out so the dev workflow can be
 * covered by a test.
 *
 * The script and the development mailer share an implicit contract: the mailer
 * writes a reset link into a `.dev-mail` file, and the script fishes it back
 * out. Nothing tested that contract, so a change to the email body or the link
 * shape could silently leave `npm run dev:reset-link` printing nothing. These
 * functions are the part worth pinning; the file I/O stays in the runner.
 */

/** True for a dev-mail file that holds a password-reset message. */
export function isResetMailFile(fileName: string): boolean {
  return fileName.endsWith('.txt') && fileName.includes('password-reset');
}

/**
 * The reset link inside a dev-mail message body, or null.
 *
 * Requires the `token` query parameter to be present, so a match is always a
 * *usable* link rather than a bare `/auth/reset-password` path that would send
 * the developer to an immediately-invalid form.
 */
export function extractResetLink(contents: string): string | null {
  const match = contents.match(
    /https?:\/\/\S*\/auth\/reset-password\?\S*\btoken=[A-Za-z0-9_-]+\S*/,
  );
  return match ? match[0] : null;
}

/** The raw token carried by a reset link, or null when it has none. */
export function extractResetToken(link: string): string | null {
  try {
    return new URL(link).searchParams.get('token');
  } catch {
    return null;
  }
}
