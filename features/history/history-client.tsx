'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/config/app';
import { PageHeader } from '@/components/layout/page-header';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, TextInput } from '@/components/ui/form';
import { HistoryIcon, TrashIcon } from '@/components/ui/icons';
import { ConfirmDialog } from '@/components/ui/modal';
import { EmptyState, ErrorState, SkeletonLines } from '@/components/ui/states';
import { apiFetch, translateError } from '@/hooks/use-api';
import { useDict, useLanguage } from '@/lib/i18n/client';
import { formatDateTime } from '@/utils/format';

interface HistoryItem {
  id: string;
  medicineId: string | null;
  medicineName: string;
  languageCode: string;
  source: string;
  viewedAt: string;
  medicine: { id: string; slug: string; genericName: string; strength: string } | null;
}

interface HistoryResponse {
  items: HistoryItem[];
  total: number;
  page: number;
  totalPages: number;
}

export function HistoryClient() {
  const dict = useDict();
  const { locale } = useLanguage();

  const [query, setQuery] = useState('');
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setErrorCode(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      setData(await apiFetch<HistoryResponse>(`/api/history?${params}`));
    } catch (e) {
      setErrorCode((e as { code?: string }).code ?? 'INTERNAL');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(query), 250);
    return () => window.clearTimeout(handle);
  }, [query, load]);

  const remove = async (id: string) => {
    try {
      await apiFetch(`/api/history/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setData((current) =>
        current ? { ...current, items: current.items.filter((i) => i.id !== id), total: current.total - 1 } : current,
      );
    } catch (e) {
      setErrorCode((e as { code?: string }).code ?? 'INTERNAL');
    }
  };

  const clearAll = async () => {
    setConfirmClear(false);
    try {
      await apiFetch('/api/history', { method: 'DELETE' });
      setData({ items: [], total: 0, page: 1, totalPages: 1 });
    } catch (e) {
      setErrorCode((e as { code?: string }).code ?? 'INTERNAL');
    }
  };

  // Not signed in (or accounts disabled): history is an account feature.
  if (errorCode === 'UNAUTHORIZED' || errorCode === 'FEATURE_DISABLED') {
    return (
      <div className="space-y-5">
        <PageHeader title={dict.history.title} />
        <EmptyState
          icon={<HistoryIcon className="size-8" />}
          title={dict.history.emptyState}
          body={dict.history.emptyStateGuest}
          action={
            <ButtonLink href={ROUTES.profile} variant="secondary">
              {dict.profile.signIn}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={dict.history.title}
        actions={
          data && data.items.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
              <TrashIcon className="size-4" />
              {dict.history.clearAll}
            </Button>
          ) : undefined
        }
      />

      <Card>
        <Field label={dict.history.searchPlaceholder}>
          {(props) => (
            <TextInput
              {...props}
              type="search"
              value={query}
              placeholder={dict.history.searchPlaceholder}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
        </Field>
      </Card>

      {errorCode && <ErrorState message={translateError(errorCode, dict)} />}

      {loading && <SkeletonLines count={4} />}

      {!loading && data && data.items.length === 0 && (
        <EmptyState
          icon={<HistoryIcon className="size-8" />}
          title={dict.history.emptyState}
          action={
            <ButtonLink href={ROUTES.scan} variant="secondary">
              {dict.home.scanCta}
            </ButtonLink>
          }
        />
      )}

      {!loading && data && data.items.length > 0 && (
        <ul className="card divide-y divide-[var(--border)]">
          {data.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                {item.medicine ? (
                  <Link
                    href={ROUTES.medicine(item.medicine.slug)}
                    className="text-sm font-semibold text-ink-900 underline-offset-2 hover:underline"
                  >
                    {item.medicineName}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-ink-900">{item.medicineName}</span>
                )}
                <p className="text-xs text-ink-500">
                  {dict.history.viewedOn} {formatDateTime(item.viewedAt, locale)} ·{' '}
                  {dict.history.languageUsed}: {item.languageCode}
                </p>
              </div>
              <button
                type="button"
                aria-label={`${dict.history.deleteItem}: ${item.medicineName}`}
                onClick={() => void remove(item.id)}
                className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-danger-700"
              >
                <TrashIcon className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => void clearAll()}
        title={dict.history.clearAll}
        message={dict.history.clearAllConfirm}
        confirmLabel={dict.common.delete}
        cancelLabel={dict.common.cancel}
        closeLabel={dict.a11y.closeDialog}
        destructive
      />
    </div>
  );
}
