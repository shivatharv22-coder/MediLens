'use client';

import { useState } from 'react';
import { ROUTES } from '@/config/app';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/form';
import { ApiError, apiFetch } from '@/hooks/use-api';

/**
 * Admin sign-in.
 *
 * Uses the same credential endpoint as the main app; the redirect target is the
 * only difference. Authorisation is decided by the role on the session, not by
 * which form was used.
 */
export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ user: { role: string } }>('/api/auth/sign-in', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (result.user.role !== 'ADMIN' && result.user.role !== 'SUPER_ADMIN') {
        setError('This account does not have administrator access.');
        await apiFetch('/api/auth/sign-out', { method: 'POST' }).catch(() => undefined);
        return;
      }
      // A full navigation, not router.push(): the privilege level just changed,
      // so the whole server tree must re-render with the new session cookie and
      // any client state from the signed-out view must be discarded.
      window.location.assign(ROUTES.admin);
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'RATE_LIMITED'
          ? 'Too many attempts. Please wait a few minutes.'
          : 'Email or password is incorrect.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page grid min-h-dvh place-items-center py-10">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold text-ink-900">MediLens Admin</h1>
        <p className="mt-1 text-sm text-ink-600">Sign in with an administrator account.</p>

        {error && (
          <Alert tone="danger" className="mt-4" role="alert">
            {error}
          </Alert>
        )}

        <form className="mt-4 space-y-3" onSubmit={submit}>
          <Field label="Email" required>
            {(props) => (
              <TextInput
                {...props}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <Field label="Password" required>
            {(props) => (
              <TextInput
                {...props}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" fullWidth disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
