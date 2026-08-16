import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/app';
import { isAuthConfigured } from '@/config/env';
import { AppShell } from '@/components/layout/app-shell';
import { Alert } from '@/components/ui/alert';
import { getSessionUser } from '@/lib/session';
import { SignUpPanel } from '@/features/account/sign-up-panel';

export const metadata: Metadata = { title: 'Create your account' };
export const dynamic = 'force-dynamic';

export default async function SignUpPage() {
  if (!isAuthConfigured()) {
    return (
      <AppShell>
        <Alert tone="info">Accounts are not enabled on this installation.</Alert>
      </AppShell>
    );
  }

  // Already signed in: there is nothing to create.
  if (await getSessionUser()) redirect(ROUTES.profile);

  return (
    <AppShell>
      <SignUpPanel />
    </AppShell>
  );
}
