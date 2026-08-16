import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { HistoryClient } from '@/features/history/history-client';

export const metadata: Metadata = { title: 'Medicine History' };

export default function HistoryPage() {
  return (
    <AppShell>
      <HistoryClient />
    </AppShell>
  );
}
