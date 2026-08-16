import { cookies, headers } from 'next/headers';
import { LANGUAGE_COOKIE, normaliseLanguage } from '@/config/languages';
import { getDictionary, type Dictionary } from './index';

/**
 * Resolve the request language on the server.
 * Cookie wins; otherwise fall back to the first supported Accept-Language tag.
 */
export async function getRequestLocale(): Promise<string> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LANGUAGE_COOKIE)?.value;
  if (fromCookie) return normaliseLanguage(fromCookie);

  const headerStore = await headers();
  const accept = headerStore.get('accept-language') ?? '';
  for (const part of accept.split(',')) {
    const tag = part.split(';')[0]?.trim();
    if (!tag) continue;
    const normalised = normaliseLanguage(tag);
    // normaliseLanguage falls back to `en`; only accept an actual match.
    if (tag.toLowerCase().startsWith(normalised) && normalised !== 'en') return normalised;
    if (normalised === 'en' && tag.toLowerCase().startsWith('en')) return 'en';
  }
  return 'en';
}

export async function getRequestDictionary(): Promise<{ locale: string; dict: Dictionary }> {
  const locale = await getRequestLocale();
  return { locale, dict: getDictionary(locale) };
}
