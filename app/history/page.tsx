import type { Metadata } from 'next';
import { getRequestDictionary } from '@/lib/i18n/server';
import { AppShell } from '@/components/layout/app-shell';
import { HistoryClient } from '@/features/history/history-client';

/**
 * Resolved per request: the tab title is part of the UI, so it follows the
 * reader's language like everything else on the page.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getRequestDictionary();
  return { title: dict.history.title };
}

export default function HistoryPage() {
  return (
    <AppShell>
      <HistoryClient />
    </AppShell>
  );
}
