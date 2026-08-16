import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { SkeletonLines } from '@/components/ui/states';
import { SearchClient } from '@/features/search/search-client';

export const metadata: Metadata = { title: 'Search Medicine' };

export default function SearchPage() {
  return (
    <AppShell>
      <Suspense fallback={<SkeletonLines count={5} />}>
        <SearchClient />
      </Suspense>
    </AppShell>
  );
}
