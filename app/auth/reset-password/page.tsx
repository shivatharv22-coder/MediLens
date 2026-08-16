import type { Metadata } from 'next';
import { Suspense } from 'react';
import { isAuthConfigured } from '@/config/env';
import { AppShell } from '@/components/layout/app-shell';
import { Alert } from '@/components/ui/alert';
import { SkeletonLines } from '@/components/ui/states';
import { ResetPasswordPanel } from '@/features/account/reset-password-panel';

export const metadata: Metadata = {
  title: 'Choose a new password',
  // A reset link must never be followed by a crawler or preview fetcher.
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  if (!isAuthConfigured()) {
    return (
      <AppShell>
        <Alert tone="info">Accounts are not enabled on this installation.</Alert>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Suspense fallback={<SkeletonLines count={4} />}>
        <ResetPasswordPanel />
      </Suspense>
    </AppShell>
  );
}
