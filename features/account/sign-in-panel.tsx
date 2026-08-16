'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/config/app';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/form';
import { PasswordInput } from '@/components/ui/password-input';
import { ApiError, apiFetch, translateError } from '@/hooks/use-api';
import { useDict } from '@/lib/i18n/client';
import { AuthShell } from './auth-shell';

/**
 * Sign in.
 *
 * This replaced a combined sign-in / sign-up form whose mode defaulted to
 * "sign in" behind a small toggle link — the reason new users were told
 * "Email or password is incorrect" when they were actually trying to register.
 * Creating an account is now a clearly separated page, and the failure message
 * points at that possibility.
 */
export function SignInPanel({ redirectTo = ROUTES.profile }: { redirectTo?: string }) {
  const dict = useDict();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorCode(null);
    setFieldErrors({});

    try {
      await apiFetch('/api/auth/sign-in', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      // A full navigation, not router.refresh(): the session changed, so the
      // whole server tree has to re-render with the new cookie.
      window.location.assign(redirectTo);
    } catch (e) {
      if (e instanceof ApiError) {
        setErrorCode(e.code);
        setFieldErrors(e.details ?? {});
      } else {
        setErrorCode('INTERNAL');
      }
      setBusy(false);
    }
  };

  const credentialsRejected = errorCode === 'UNAUTHORIZED';

  return (
    <AuthShell
      title={dict.profile.title}
      description={dict.auth.signInSubtitle}
      footer={
        <p>
          {dict.auth.noAccountQuestion}{' '}
          <Link href={ROUTES.signUp} className="inline-flex min-h-11 items-center font-medium text-brand-700 underline underline-offset-2">
            {dict.auth.createAccountLink}
          </Link>
        </p>
      }
    >
      {errorCode && (
        <Alert tone="danger" className="mb-4" role="alert">
          <p>{credentialsRejected ? dict.auth.invalidCredentials : translateError(errorCode, dict)}</p>
          {credentialsRejected && (
            <p className="mt-1.5 text-xs">
              {dict.auth.invalidCredentialsHint}{' '}
              <Link href={ROUTES.signUp} className="font-medium underline underline-offset-2">
                {dict.auth.createAccountLink}
              </Link>
            </p>
          )}
        </Alert>
      )}

      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label={dict.profile.email} required error={fieldErrors.email?.[0]}>
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

        <div>
          <Field label={dict.profile.password} required error={fieldErrors.password?.[0]}>
            {(props) => (
              <PasswordInput
                {...props}
                autoComplete="current-password"
                value={password}
                showLabel={dict.auth.showPassword}
                hideLabel={dict.auth.hidePassword}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <div className="mt-1 flex justify-end">
            {/* inline-flex + min-h-11 keeps the 44px touch target without
                turning the link into a full-width block. */}
            <Link
              href={ROUTES.forgotPassword}
              className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-brand-700 underline underline-offset-2"
            >
              {dict.auth.forgotPassword}
            </Link>
          </div>
        </div>

        <Button type="submit" fullWidth size="lg" disabled={busy || !email || !password}>
          {busy ? dict.common.loading : dict.profile.signIn}
        </Button>
      </form>
    </AuthShell>
  );
}
