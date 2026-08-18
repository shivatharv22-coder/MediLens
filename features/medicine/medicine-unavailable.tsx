'use client';

import { ROUTES } from '@/config/app';
import { SafetyNotice } from '@/components/safety-notice';
import { ButtonLink } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/states';
import { useDict } from '@/lib/i18n/client';

/**
 * Shown when the medicine database cannot be reached.
 *
 * Deliberately does NOT fall back to the bundled demo dataset: substituting
 * unverified sample records for the real catalogue would present demo data as
 * medicine information, which docs/SAFETY.md forbids. Telling the user the
 * information is temporarily unavailable is the safe outcome.
 */
export function MedicineUnavailable() {
  const dict = useDict();

  return (
    <div className="space-y-4">
      <ErrorState
        title={dict.errors.databaseUnavailable}
        message={dict.errors.tryAgain}
        action={
          <ButtonLink href={ROUTES.search} variant="secondary" size="sm">
            {dict.home.searchCta}
          </ButtonLink>
        }
      />
      <SafetyNotice compact />
    </div>
  );
}
