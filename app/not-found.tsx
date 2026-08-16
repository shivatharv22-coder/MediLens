'use client';

import { ROUTES } from '@/config/app';
import { AppShell } from '@/components/layout/app-shell';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { useDict } from '@/lib/i18n/client';

export default function NotFound() {
  const dict = useDict();
  return (
    <AppShell>
      <EmptyState
        title={dict.errors.notFound}
        action={
          <ButtonLink href={ROUTES.home} variant="secondary">
            {dict.nav.home}
          </ButtonLink>
        }
      />
    </AppShell>
  );
}
