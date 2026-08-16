import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { ScanResultClient } from '@/features/scan/scan-result-client';

export const metadata: Metadata = { title: 'Identification result' };

export default async function ScanResultPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;
  return (
    <AppShell>
      <ScanResultClient scanId={scanId} />
    </AppShell>
  );
}
