'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PASSWORD_RULES, ROUTES } from '@/config/app';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field } from '@/components/ui/form';
import { PasswordInput } from '@/components/ui/password-input';
import { LoadingState } from '@/components/ui/states';
import { ApiError, apiFetch, translateError } from '@/hooks/use-api';
import { useDict } from '@/lib/i18n/client';
import { AuthShell, PasswordRequirements } from './auth-shell';

type Stage = 'checking' | 'invalid' | 'form' | 'done';

/**
 * Choose a new password from a reset link.
 *
 * The token is validated before the form is shown, so an expired link fails
 * immediately rather than after the user has typed a new password twice. The
 * token is read from the query string and never rendered, logged, or echoed.
 */
export function ResetPasswordPanel() {
  const dict = useDict();
  const params = useSearchParams();
  const rulesId = useId();
  const token = params.get('token') ?? '';

  const [stage, setStage] = useState<Stage>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!token) {
        if (!cancelled) setStage('invalid');
        return;
      }
      try {
        const result = await apiFetch<{ valid: boolean }>(
          `/api/auth/reset-password?token=${encodeURIComponent(token)}`,
        );
        if (!cancelled) setStage(result.valid ? 'form' : 'invalid');
      } catch {
        if (!cancelled) setStage('invalid');
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const allRulesMet = PASSWORD_RULES.every((rule) => rule.test(password));
  const matches = password.length > 0 && password === confirmPassword;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorCode(null);
    setFieldErrors({});

    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      setStage('done');
    } catch (e) {
      if (e instanceof ApiError) {
        setErrorCode(e.code);
        setFieldErrors(e.details ?? {});
        // A rejected token cannot be retried on this screen.
        if (e.code === 'INVALID_RESET_TOKEN') setStage('invalid');
      } else {
        setErrorCode('INTERNAL');
      }
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'checking') {
    return (
      <AuthShell title={dict.auth.resetTitle}>
        <LoadingState message={dict.auth.checkingLink} regionLabel={dict.a11y.loadingRegion} />
      </AuthShell>
    );
  }

  if (stage === 'invalid') {
    return (
      <AuthShell title={dict.auth.resetInvalidTitle}>
        <Alert tone="danger" role="alert">
          {dict.auth.resetInvalidBody}
        </Alert>
        <ButtonLink href={ROUTES.forgotPassword} fullWidth className="mt-4">
          {dict.auth.sendResetLink}
        </ButtonLink>
        <Link
          href={ROUTES.signIn}
          className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-brand-700 underline underline-offset-2"
        >
          {dict.auth.backToSignIn}
        </Link>
      </AuthShell>
    );
  }

  if (stage === 'done') {
    return (
      <AuthShell title={dict.auth.resetDoneTitle}>
        <Alert tone="success" role="status">
          {dict.auth.resetDoneBody}
        </Alert>
        <ButtonLink href={ROUTES.signIn} fullWidth size="lg" className="mt-4">
          {dict.profile.signIn}
        </ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={dict.auth.resetTitle} description={dict.auth.resetSubtitle}>
      {errorCode && (
        <Alert tone="danger" className="mb-4" role="alert">
          {translateError(errorCode, dict)}
        </Alert>
      )}

      <form className="space-y-4" onSubmit={submit} noValidate>
        <div>
          <Field label={dict.auth.newPassword} required error={fieldErrors.password?.[0]}>
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

        <Field
          label={dict.auth.confirmPassword}
          required
          error={
            fieldErrors.confirmPassword?.[0] ??
            (confirmPassword && !matches ? dict.auth.passwordMismatch : undefined)
          }
        >
          {(props) => (
            <PasswordInput
              {...props}
              autoComplete="new-password"
              value={confirmPassword}
              showLabel={dict.auth.showPassword}
              hideLabel={dict.auth.hidePassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          )}
        </Field>

        <Button type="submit" fullWidth size="lg" disabled={busy || !allRulesMet || !matches}>
          {busy ? dict.common.loading : dict.auth.setNewPassword}
        </Button>
      </form>
    </AuthShell>
  );
}
