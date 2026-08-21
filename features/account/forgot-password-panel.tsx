'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { PASSWORD_RULES, ROUTES } from '@/config/app';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/form';
import { MailIcon } from '@/components/ui/icons';
import { PasswordInput } from '@/components/ui/password-input';
import { ApiError, apiFetch, translateError } from '@/hooks/use-api';
import { useDict } from '@/lib/i18n/client';
import { AuthShell, PasswordRequirements } from './auth-shell';

type Channel = 'email' | 'dev-file' | 'none';
type Stage = 'request' | 'code' | 'password' | 'done';

interface ForgotResponse {
  channel: Channel;
  expiresInMinutes: number;
}

/**
 * Password reset by a 6-digit code, as a four-step flow on one screen.
 *
 *   request  -> enter the account email; a code is emailed
 *   code     -> enter the 6-digit code; it is verified server-side
 *   password -> choose a new password
 *   done     -> confirmation
 *
 * There is no reset link and no token in the URL. The email is kept in state
 * and re-sent with the code at both the verify and the final step, because a
 * bare 6-digit code identifies no account on its own. The code is never placed
 * in a query string, so it stays out of logs and browser history.
 *
 * The request step's response is identical whether or not the address has an
 * account, so this screen cannot be used to find out who is registered.
 */
export function ForgotPasswordPanel() {
  const dict = useDict();
  const rulesId = useId();

  const [stage, setStage] = useState<Stage>('request');
  const [channel, setChannel] = useState<Channel>('none');

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const allRulesMet = PASSWORD_RULES.every((rule) => rule.test(password));
  const matches = password.length > 0 && password === confirmPassword;

  /** Step 1: ask for a code. Moves to the code step for any real response. */
  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorCode(null);
    try {
      const result = await apiFetch<ForgotResponse>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setChannel(result.channel);
      setCode('');
      setCodeError(false);
      setStage('code');
    } catch (err) {
      setErrorCode(err instanceof ApiError ? err.code : 'INTERNAL');
    } finally {
      setBusy(false);
    }
  };

  /** Step 2: verify the code without spending it, so the form fails fast. */
  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorCode(null);
    setCodeError(false);
    try {
      const result = await apiFetch<{ valid: boolean }>('/api/auth/reset-password/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      if (result.valid) {
        setStage('password');
      } else {
        setCodeError(true);
      }
    } catch (err) {
      setErrorCode(err instanceof ApiError ? err.code : 'INTERNAL');
    } finally {
      setBusy(false);
    }
  };

  /** Step 3: redeem the code and set the new password. */
  const setNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorCode(null);
    setFieldErrors({});
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, password, confirmPassword }),
      });
      setStage('done');
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.details ?? {});
        // The code was spent or expired between verifying and submitting: send
        // the user back to re-enter a fresh one rather than the password.
        if (err.code === 'INVALID_RESET_TOKEN') {
          setCodeError(true);
          setStage('code');
        } else {
          setErrorCode(err.code);
        }
      } else {
        setErrorCode('INTERNAL');
      }
    } finally {
      setBusy(false);
    }
  };

  // ---- done ----------------------------------------------------------------
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

  // ---- password ------------------------------------------------------------
  if (stage === 'password') {
    return (
      <AuthShell title={dict.auth.resetTitle} description={dict.auth.resetSubtitle}>
        {errorCode && (
          <Alert tone="danger" className="mb-4" role="alert">
            {translateError(errorCode, dict)}
          </Alert>
        )}

        <form className="space-y-4" onSubmit={setNewPassword} noValidate>
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

  // ---- code ----------------------------------------------------------------
  if (stage === 'code') {
    const sentMessage =
      channel === 'email'
        ? dict.auth.resetSentEmail
        : channel === 'dev-file'
          ? dict.auth.resetSentDev
          : dict.auth.resetNotConfigured;

    return (
      <AuthShell title={dict.auth.resetRequestedTitle} description={dict.auth.codeHelp}>
        <Alert tone={channel === 'none' ? 'warning' : 'success'} role="status" className="mb-4">
          <p>{sentMessage}</p>
          {channel !== 'none' && <p className="mt-1.5 text-xs">{dict.auth.resetLinkExpiry}</p>}
          {channel === 'dev-file' && (
            <p className="mt-2 font-mono text-xs">{dict.auth.devResetCommand}</p>
          )}
        </Alert>

        {errorCode && (
          <Alert tone="danger" className="mb-4" role="alert">
            {translateError(errorCode, dict)}
          </Alert>
        )}

        <form className="space-y-4" onSubmit={verifyCode} noValidate>
          <Field
            label={dict.auth.codeLabel}
            required
            error={codeError ? dict.auth.codeInvalid : undefined}
          >
            {(props) => (
              <TextInput
                {...props}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={6}
                value={code}
                onChange={(e) => {
                  // Keep only digits, so a pasted "042 317" or "code: 042317"
                  // still lands as six clean digits.
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setCodeError(false);
                }}
              />
            )}
          </Field>

          <Button type="submit" fullWidth size="lg" disabled={busy || code.length !== 6}>
            {busy ? dict.common.loading : dict.auth.verifyCode}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setStage('request')}
          className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-brand-700 underline underline-offset-2"
        >
          {dict.auth.resendCode}
        </button>
      </AuthShell>
    );
  }

  // ---- request -------------------------------------------------------------
  return (
    <AuthShell
      title={dict.auth.forgotTitle}
      description={dict.auth.forgotSubtitle}
      footer={
        <Link
          href={ROUTES.signIn}
          className="inline-flex min-h-11 items-center font-medium text-brand-700 underline underline-offset-2"
        >
          {dict.auth.backToSignIn}
        </Link>
      }
    >
      {errorCode && (
        <Alert tone="danger" className="mb-4" role="alert">
          {translateError(errorCode, dict)}
        </Alert>
      )}

      <form className="space-y-4" onSubmit={requestCode} noValidate>
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
