'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/config/app';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardHeading, DataRow } from '@/components/ui/card';
import { Field, TextInput } from '@/components/ui/form';
import { apiFetch, translateError } from '@/hooks/use-api';
import { useDict } from '@/lib/i18n/client';
import type { SessionUser } from '@/lib/session';
import { SignInPanel } from './sign-in-panel';

export function ProfileClient({
  user,
  authEnabled,
}: {
  user: SessionUser | null;
  authEnabled: boolean;
}) {
  const dict = useDict();
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);

  if (!authEnabled) {
    return (
      <div className="space-y-5">
        <PageHeader title={dict.profile.title} />
        <Alert tone="info">{dict.profile.authUnavailable}</Alert>
        <Card>
          <CardHeading>{dict.settings.title}</CardHeading>
          <p className="text-sm text-ink-600">{dict.profile.guestBody}</p>
          <ButtonLink href={ROUTES.settings} variant="secondary" className="mt-3">
            {dict.settings.title}
          </ButtonLink>
        </Card>
      </div>
    );
  }

  // Signed out: the Profile screen *is* the sign-in screen.
  if (!user) return <SignInPanel />;

  const signOut = async () => {
    await apiFetch('/api/auth/sign-out', { method: 'POST' }).catch(() => undefined);
    // Full navigation: the session changed, so every server component that read
    // it has to render again. router.refresh() alone left the signed-in view on
    // screen.
    window.location.assign(ROUTES.home);
  };

  const deleteAccount = async () => {
    setErrorCode(null);
    try {
      await apiFetch('/api/auth/account', {
        method: 'DELETE',
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      window.location.assign(ROUTES.home);
    } catch (e) {
      setErrorCode((e as { code?: string }).code ?? 'INTERNAL');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title={dict.profile.title} />

      <Card>
        <CardHeading>{dict.profile.accountSettings}</CardHeading>
        <dl>
          <DataRow label={dict.profile.email} value={user.email} />
          {user.displayName && <DataRow label={dict.profile.displayName} value={user.displayName} />}
          <DataRow label="Role" value={user.role} />
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void signOut()}>
            {dict.profile.signOut}
          </Button>
          <ButtonLink href={ROUTES.settings} variant="ghost" size="sm">
            {dict.settings.title}
          </ButtonLink>
          {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
            <ButtonLink href={ROUTES.admin} variant="ghost" size="sm">
              {dict.nav.admin}
            </ButtonLink>
          )}
        </div>
      </Card>

      <Card>
        <CardHeading>{dict.profile.deleteAccount}</CardHeading>
        <p className="text-sm text-ink-600">{dict.profile.deleteAccountBody}</p>

        {errorCode && (
          <Alert tone="danger" className="mt-3" role="alert">
            {translateError(errorCode, dict)}
          </Alert>
        )}

        {deleting ? (
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void deleteAccount();
            }}
          >
            <Field label={dict.profile.deleteAccountConfirm}>
              {(props) => (
                <TextInput
                  {...props}
                  value={confirmText}
                  autoComplete="off"
                  onChange={(e) => setConfirmText(e.target.value)}
                />
              )}
            </Field>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setDeleting(false)}>
                {dict.common.cancel}
              </Button>
              <Button type="submit" variant="danger" size="sm" disabled={confirmText !== 'DELETE'}>
                {dict.profile.deleteAccount}
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => setDeleting(true)}>
            {dict.profile.deleteAccount}
          </Button>
        )}
      </Card>

      <p className="text-center text-xs text-ink-500">
        <Link
          href={ROUTES.privacy}
          className="inline-flex min-h-11 items-center px-2 underline underline-offset-2"
        >
          {dict.legal.privacyTitle}
        </Link>
      </p>
    </div>
  );
}
