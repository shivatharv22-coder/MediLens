'use client';

import Link from 'next/link';
import { ROUTES } from '@/config/app';
import { useDict } from '@/lib/i18n/client';
import { ShieldIcon } from './ui/icons';

/**
 * The standing educational-use notice.
 *
 * Required on every medicine information page (§7). Deliberately calm: a
 * neutral surface and a shield rather than a red warning, because this is a
 * scope statement, not a hazard.
 */
export function SafetyNotice({ compact = false }: { compact?: boolean }) {
  const dict = useDict();

  return (
    <div
      className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3.5"
      role="note"
    >
      <ShieldIcon className="size-5 shrink-0 text-brand-600" />
      <div className="text-sm leading-relaxed text-ink-700">
        <p>{dict.medicine.safetyNotice}</p>
        {!compact && (
          <Link
            href={ROUTES.disclaimer}
            className="mt-1 inline-block font-medium text-brand-700 underline underline-offset-2"
          >
            {dict.legal.readDisclaimer}
          </Link>
        )}
      </div>
    </div>
  );
}
