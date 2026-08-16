import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { ScanClient } from '@/features/scan/scan-client';

export const metadata: Metadata = { title: 'Scan Medicine' };

export default function ScanPage() {
  return (
    <AppShell>
      <ScanClient />
    </AppShell>
  );
}
