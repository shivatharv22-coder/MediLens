'use client';

import { ROUTES } from '@/config/app';
import { AppShell } from '@/components/layout/app-shell';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { useDict } from '@/lib/i18n/client';

export default function MedicineNotFound() {
  const dict = useDict();
  return (
    <AppShell>
      <EmptyState
        title={dict.medicine.notFoundTitle}
        body={dict.medicine.notFoundBody}
        action={
          <ButtonLink href={ROUTES.search} variant="secondary">
            {dict.home.searchCta}
          </ButtonLink>
        }
      />
    </AppShell>
  );
}
