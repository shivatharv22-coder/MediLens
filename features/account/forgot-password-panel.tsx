'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/config/app';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/form';
import { MailIcon } from '@/components/ui/icons';
import { ApiError, apiFetch, translateError } from '@/hooks/use-api';
import { useDict } from '@/lib/i18n/client';
import { AuthShell } from './auth-shell';

interface ForgotResponse {
  channel: 'email' | 'dev-file' | 'none';
  expiresInMinutes: number;
}

/**
 * Request a password reset.
 *
 * The confirmation states exactly what happened. When no email provider is
 * configured it says so instead of showing a reassuring "check your inbox"
 * message that would be untrue.
 *
 * The response is identical whether or not the address has an account, so this
 * screen cannot be used to find out who is registered.
 */
export function ForgotPasswordPanel() {
  const dict = useDict();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ForgotResponse | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorCode(null);
    try {
      setResult(
        await apiFetch<ForgotResponse>('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        }),
      );
    } catch (e) {
      setErrorCode(e instanceof ApiError ? e.code : 'INTERNAL');
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const message =
      result.channel === 'email'
        ? dict.auth.resetSentEmail
        : result.channel === 'dev-file'
          ? dict.auth.resetSentDev
          : dict.auth.resetNotConfigured;

    return (
      <AuthShell title={dict.auth.resetRequestedTitle}>
        <Alert tone={result.channel === 'none' ? 'warning' : 'success'} role="status">
          <p>{message}</p>
          {result.channel !== 'none' && (
            <p className="mt-1.5 text-xs">{dict.auth.resetLinkExpiry}</p>
          )}
          {result.channel === 'dev-file' && (
            <p className="mt-2 font-mono text-xs">npm run dev:reset-link</p>
          )}
        </Alert>
        <Link
          href={ROUTES.signIn}
          className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-brand-700 underline underline-offset-2"
        >
          {dict.auth.backToSignIn}
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={dict.auth.forgotTitle}
      description={dict.auth.forgotSubtitle}
      footer={
        <Link href={ROUTES.signIn} className="inline-flex min-h-11 items-center font-medium text-brand-700 underline underline-offset-2">
          {dict.auth.backToSignIn}
        </Link>
      }
    >
      {errorCode && (
        <Alert tone="danger" className="mb-4" role="alert">
          {translateError(errorCode, dict)}
        </Alert>
      )}

      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label={dict.profile.email} required>
          {(props) => (
            <TextInput
              {...props}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>

        <Button type="submit" fullWidth size="lg" disabled={busy || !email}>
          <MailIcon className="size-5" />
          {busy ? dict.common.loading : dict.auth.sendResetLink}
        </Button>
      </form>
    </AuthShell>
  );
}
