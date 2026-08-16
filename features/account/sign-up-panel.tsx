'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { PASSWORD_RULES, ROUTES } from '@/config/app';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/form';
import { PasswordInput } from '@/components/ui/password-input';
import { ApiError, apiFetch, translateError } from '@/hooks/use-api';
import { useDict } from '@/lib/i18n/client';
import { AuthShell, PasswordRequirements } from './auth-shell';

/**
 * Create an account.
 *
 * A dedicated page rather than a mode toggle, so a new user cannot accidentally
 * submit the sign-in form. Password rules are visible from the start and tick
 * off as they are met.
 */
export function SignUpPanel() {
  const dict = useDict();
  const rulesId = useId();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const allRulesMet = PASSWORD_RULES.every((rule) => rule.test(password));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorCode(null);
    setFieldErrors({});

    try {
      await apiFetch('/api/auth/sign-up', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        }),
      });
      // Sign-up signs the user in, so the whole tree must re-render.
      window.location.assign(ROUTES.profile);
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

  return (
    <AuthShell
      title={dict.auth.signUpTitle}
      description={dict.auth.signUpSubtitle}
      footer={
        <p>
          {dict.auth.haveAccountQuestion}{' '}
          <Link href={ROUTES.signIn} className="inline-flex min-h-11 items-center font-medium text-brand-700 underline underline-offset-2">
            {dict.auth.signInLink}
          </Link>
        </p>
      }
    >
      {errorCode && (
        <Alert tone="danger" className="mb-4" role="alert">
          {fieldErrors.email?.[0] ?? translateError(errorCode, dict)}
        </Alert>
      )}

      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label={dict.profile.displayName} error={fieldErrors.displayName?.[0]}>
          {(props) => (
            <TextInput
              {...props}
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
        </Field>

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
                aria-describedby={[props['aria-describedby'], rulesId].filter(Boolean).join(' ')}
                autoComplete="new-password"
                value={password}
                showLabel={dict.auth.showPassword}
                hideLabel={dict.auth.hidePassword}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <p className="mt-2 text-xs font-medium text-ink-700">{dict.auth.passwordRequirements}</p>
          <PasswordRequirements value={password} id={rulesId} />
        </div>

        <Button type="submit" fullWidth size="lg" disabled={busy || !email || !allRulesMet}>
          {busy ? dict.common.loading : dict.profile.createAccount}
        </Button>
      </form>
    </AuthShell>
  );
}
