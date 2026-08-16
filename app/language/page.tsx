'use client';

import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/app';
import { AppShell } from '@/components/layout/app-shell';
import { LanguageList } from '@/components/layout/language-switcher';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { useDict } from '@/lib/i18n/client';

export default function LanguagePage() {
  const dict = useDict();
  const router = useRouter();

  return (
    <AppShell>
      <PageHeader title={dict.settings.language} description={dict.settings.languageHelp} />
      <Card>
        <LanguageList onPick={() => router.push(ROUTES.home)} />
      </Card>
    </AppShell>
  );
}
