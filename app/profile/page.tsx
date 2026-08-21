import type { Metadata } from 'next';
import { getRequestDictionary } from '@/lib/i18n/server';
import { isAuthConfigured } from '@/config/env';
import { AppShell } from '@/components/layout/app-shell';
import { getSessionUser } from '@/lib/session';
import { ProfileClient } from '@/features/account/profile-client';

/**
 * Resolved per request: the tab title is part of the UI, so it follows the
 * reader's language like everything else on the page.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getRequestDictionary();
  return { title: dict.profile.title };
}
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getSessionUser();
  return (
    <AppShell>
      <ProfileClient user={user} authEnabled={isAuthConfigured()} />
    </AppShell>
  );
}
