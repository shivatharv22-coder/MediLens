'use client';

import { SUPPORTED_LANGUAGES } from '@/config/languages';
import { useLanguage } from '@/lib/i18n/client';
import { cn } from '@/utils/cn';
import { GlobeIcon } from '../ui/icons';

/** Compact language picker for the header. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, dict } = useLanguage();

  return (
    <div className={cn('relative flex items-center', className)}>
      <GlobeIcon className="pointer-events-none absolute left-2.5 size-4 text-ink-500" />
      <select
        aria-label={dict.a11y.languageSelector}
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="min-h-11 appearance-none rounded-xl border border-[var(--border)] bg-white py-2 pl-8 pr-3 text-sm font-medium text-ink-800"
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Full-size list used on the dedicated language page and in onboarding. */
export function LanguageList({ onPick }: { onPick?: (code: string) => void }) {
  const { locale, setLocale } = useLanguage();

  return (
    <ul className="space-y-2">
      {SUPPORTED_LANGUAGES.map((language) => {
        const active = language.code === locale;
        return (
          <li key={language.code}>
            <button
              type="button"
              aria-current={active ? 'true' : undefined}
              onClick={() => {
                setLocale(language.code);
                onPick?.(language.code);
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors',
                active
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-[var(--border)] bg-white hover:bg-ink-50',
              )}
            >
              <span>
                <span className="block text-base font-semibold text-ink-900">
                  {language.nativeName}
                </span>
                <span className="block text-sm text-ink-500">{language.englishName}</span>
              </span>
              {active && (
                <span className="rounded-full bg-brand-600 px-2.5 py-1 text-xs font-medium text-white">
                  ✓
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
