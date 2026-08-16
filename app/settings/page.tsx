import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { SettingsClient } from '@/features/settings/settings-client';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsClient />
    </AppShell>
  );
}
