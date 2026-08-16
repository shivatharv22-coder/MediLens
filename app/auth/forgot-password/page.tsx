import type { Metadata } from 'next';
import { isAuthConfigured } from '@/config/env';
import { AppShell } from '@/components/layout/app-shell';
import { Alert } from '@/components/ui/alert';
import { ForgotPasswordPanel } from '@/features/account/forgot-password-panel';

export const metadata: Metadata = { title: 'Reset your password' };
export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  if (!isAuthConfigured()) {
    return (
      <AppShell>
        <Alert tone="info">Accounts are not enabled on this installation.</Alert>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ForgotPasswordPanel />
    </AppShell>
  );
}
