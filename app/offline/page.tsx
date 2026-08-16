'use client';

import { ROUTES } from '@/config/app';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { useDict } from '@/lib/i18n/client';

/**
 * Shown by the service worker when a navigation fails offline.
 *
 * It deliberately does not offer cached medicine information: MediLens does
 * not claim offline medicine data (§54).
 */
export default function OfflinePage() {
  const dict = useDict();

  return (
    <main className="container-page py-16">
      <EmptyState
        title={dict.errors.network}
        body={dict.home.safetyStatement}
        action={
          <ButtonLink href={ROUTES.home} variant="secondary">
            {dict.errors.tryAgain}
          </ButtonLink>
        }
      />
    </main>
  );
}
