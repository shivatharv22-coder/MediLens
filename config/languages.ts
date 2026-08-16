/**
 * Supported languages.
 *
 * Adding a language means: add an entry here, add a dictionary in
 * `lib/i18n/dictionaries/`, and add a row to `supported_languages`. Nothing
 * else in the application hard-codes a language.
 */

export interface LanguageDefinition {
  code: string;
  englishName: string;
  nativeName: string;
  /** BCP-47 tag handed to the speech synthesiser. */
  speechLocale: string;
  isRtl: boolean;
  sortOrder: number;
}

export const SUPPORTED_LANGUAGES: LanguageDefinition[] = [
  { code: 'en', englishName: 'English', nativeName: 'English', speechLocale: 'en-IN', isRtl: false, sortOrder: 0 },
  { code: 'hi', englishName: 'Hindi', nativeName: 'हिन्दी', speechLocale: 'hi-IN', isRtl: false, sortOrder: 1 },
  { code: 'mr', englishName: 'Marathi', nativeName: 'मराठी', speechLocale: 'mr-IN', isRtl: false, sortOrder: 2 },
];

export const LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);
export const DEFAULT_LANGUAGE = 'en';
export const LANGUAGE_COOKIE = 'medilens_lang';

export type Locale = (typeof LANGUAGE_CODES)[number];

export function isSupportedLanguage(code: string | undefined | null): boolean {
  return !!code && LANGUAGE_CODES.includes(code);
}

export function normaliseLanguage(code: string | undefined | null): string {
  if (!code) return DEFAULT_LANGUAGE;
  const base = code.split('-')[0].toLowerCase();
  return isSupportedLanguage(base) ? base : DEFAULT_LANGUAGE;
}

export function getLanguage(code: string): LanguageDefinition {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code) ?? SUPPORTED_LANGUAGES[0];
}
