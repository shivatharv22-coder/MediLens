'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  getLanguage,
  normaliseLanguage,
} from '@/config/languages';
import { getDictionary, type Dictionary } from './index';

interface LanguageContextValue {
  locale: string;
  dict: Dictionary;
  speechLocale: string;
  setLocale: (next: string) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: string;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState(() => normaliseLanguage(initialLocale));

  const setLocale = useCallback((next: string) => {
    const normalised = normaliseLanguage(next);
    setLocaleState(normalised);
    // One year, lax: the language choice is a preference, not a credential.
    document.cookie = `${LANGUAGE_COOKIE}=${normalised}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = normalised;
    // Persist server-side too when the user has an account; failure is silent
    // because the cookie already carries the choice.
    void fetch('/api/preferences', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ languageCode: normalised }),
    }).catch(() => undefined);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      dict: getDictionary(locale),
      speechLocale: getLanguage(locale).speechLocale,
      setLocale,
    }),
    [locale, setLocale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // A component rendered outside the provider still needs usable strings.
    return {
      locale: DEFAULT_LANGUAGE,
      dict: getDictionary(DEFAULT_LANGUAGE),
      speechLocale: getLanguage(DEFAULT_LANGUAGE).speechLocale,
      setLocale: () => undefined,
    };
  }
  return ctx;
}

/** Shorthand for components that only need the dictionary. */
export function useDict(): Dictionary {
  return useLanguage().dict;
}
