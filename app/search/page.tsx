import type { Metadata } from 'next';
import { getRequestDictionary } from '@/lib/i18n/server';
import { Suspense } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { SkeletonLines } from '@/components/ui/states';
import { SearchClient } from '@/features/search/search-client';

/**
 * Resolved per request: the tab title is part of the UI, so it follows the
 * reader's language like everything else on the page.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getRequestDictionary();
  return { title: dict.search.title };
}

export default function SearchPage() {
  return (
    <AppShell>
      <Suspense fallback={<SkeletonLines count={5} />}>
        <SearchClient />
      </Suspense>
    </AppShell>
  );
}
