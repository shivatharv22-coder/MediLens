import type { Metadata } from 'next';
import { isAuthConfigured } from '@/config/env';
import { AppShell } from '@/components/layout/app-shell';
import { getSessionUser } from '@/lib/session';
import { ProfileClient } from '@/features/account/profile-client';

export const metadata: Metadata = { title: 'Profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getSessionUser();
  return (
    <AppShell>
      <ProfileClient user={user} authEnabled={isAuthConfigured()} />
    </AppShell>
  );
}
