import type { Metadata } from 'next';
import { getRequestDictionary } from '@/lib/i18n/server';
import { AppShell } from '@/components/layout/app-shell';
import { ScanClient } from '@/features/scan/scan-client';

/**
 * Resolved per request: the tab title is part of the UI, so it follows the
 * reader's language like everything else on the page.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getRequestDictionary();
  return { title: dict.scan.title };
}

export default function ScanPage() {
  return (
    <AppShell>
      <ScanClient />
    </AppShell>
  );
}
