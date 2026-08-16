import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { PrescriptionClient } from '@/features/prescription/prescription-client';

export const metadata: Metadata = { title: 'Scan Prescription' };

export default function PrescriptionPage() {
  return (
    <AppShell>
      <PrescriptionClient />
    </AppShell>
  );
}
