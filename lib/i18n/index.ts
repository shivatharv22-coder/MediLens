import { DEFAULT_LANGUAGE, normaliseLanguage } from '@/config/languages';
import type { Dictionary } from './types';
import { en } from './dictionaries/en';
import { hi } from './dictionaries/hi';
import { mr } from './dictionaries/mr';

/**
 * Dictionaries are bundled rather than fetched: there are three of them, they
 * are small, and a missing dictionary at runtime would leave a blank UI.
 */
const DICTIONARIES: Record<string, Dictionary> = { en, hi, mr };

export function getDictionary(locale: string | undefined | null): Dictionary {
  return DICTIONARIES[normaliseLanguage(locale)] ?? DICTIONARIES[DEFAULT_LANGUAGE];
}

export type { Dictionary };
export { DEFAULT_LANGUAGE };
