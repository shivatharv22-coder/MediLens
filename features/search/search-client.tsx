'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROUTES } from '@/config/app';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Select, TextInput } from '@/components/ui/form';
import { ChevronRightIcon, SearchIcon } from '@/components/ui/icons';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states';
import { apiFetch, translateError } from '@/hooks/use-api';
import { useDict } from '@/lib/i18n/client';
import { dosageFormLabel } from '@/utils/format';
import { DOSAGE_FORMS, type MedicineSummary, type Paginated } from '@/types/medicine';

type SearchResponse = Paginated<MedicineSummary> & { isDemo: boolean };

export function SearchClient() {
  const dict = useDict();
  const router = useRouter();
  const params = useSearchParams();

  const [query, setQuery] = useState(params.get('q') ?? '');
  const [dosageForm, setDosageForm] = useState(params.get('dosageForm') ?? '');
  const [page, setPage] = useState(Number(params.get('page') ?? 1));
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const search = useCallback(
    async (q: string, form: string, pageNumber: number) => {
      if (!q.trim() && !form) {
        setResults(null);
        return;
      }
      setLoading(true);
      setErrorCode(null);
      try {
        const searchParams = new URLSearchParams({ page: String(pageNumber) });
        if (q.trim()) searchParams.set('q', q.trim());
        if (form) searchParams.set('dosageForm', form);
        setResults(await apiFetch<SearchResponse>(`/api/medicines?${searchParams}`));
      } catch (e) {
        setErrorCode((e as { code?: string }).code ?? 'INTERNAL');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Debounced search-as-you-type; the URL is kept in sync so a result list can
  // be shared or reloaded.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      void search(query, dosageForm, page);
      const next = new URLSearchParams();
      if (query.trim()) next.set('q', query.trim());
      if (dosageForm) next.set('dosageForm', dosageForm);
      if (page > 1) next.set('page', String(page));
      router.replace(next.toString() ? `${ROUTES.search}?${next}` : ROUTES.search, { scroll: false });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, dosageForm, page, search, router]);

  return (
    <div className="space-y-5">
      <PageHeader title={dict.search.title} />

      <Card>
        <form
          className="space-y-3"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            void search(query, dosageForm, 1);
          }}
        >
          <Field label={dict.search.title}>
            {(props) => (
              <TextInput
                {...props}
                type="search"
                value={query}
                placeholder={dict.search.placeholder}
                autoComplete="off"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            )}
          </Field>

          <details>
            <summary className="cursor-pointer text-sm font-medium text-ink-700">
              {dict.search.filters}
            </summary>
            <div className="mt-3 space-y-3">
              <Field label={dict.search.filterForm}>
                {(props) => (
                  <Select
                    {...props}
                    value={dosageForm}
                    onChange={(e) => {
                      setDosageForm(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">{dict.common.optional}</option>
                    {DOSAGE_FORMS.map((form) => (
                      <option key={form} value={form}>
                        {dosageFormLabel(form)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {(query || dosageForm) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    setDosageForm('');
                    setPage(1);
                    setResults(null);
                  }}
                >
                  {dict.search.clearFilters}
                </Button>
              )}
            </div>
          </details>
        </form>
      </Card>

      <div aria-live="polite">
        {loading && <Spinner label={dict.search.searching} />}

        {errorCode && <ErrorState message={translateError(errorCode, dict)} />}

        {!loading && !results && !errorCode && (
          <EmptyState
            icon={<SearchIcon className="size-8" />}
            title={dict.search.emptyState}
          />
        )}

        {results && results.items.length === 0 && !loading && (
          <EmptyState title={dict.search.noResultsTitle} body={dict.search.noResultsBody} />
        )}

        {results && results.items.length > 0 && (
          <>
            <p className="mb-2 text-sm text-ink-500">
              {results.total} {dict.search.resultsCount}
            </p>
            <ul className="card divide-y divide-[var(--border)]">
              {results.items.map((medicine) => (
                <li key={medicine.id}>
                  <Link
                    href={ROUTES.medicine(medicine.slug)}
                    className="flex items-center gap-3 p-4 hover:bg-ink-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink-900">
                        {medicine.brandName}
                      </span>
                      <span className="block text-sm text-ink-600">
                        {medicine.genericName} · {medicine.strength} ·{' '}
                        {dosageFormLabel(medicine.dosageForm)}
                      </span>
                      {medicine.manufacturer && (
                        <span className="block text-xs text-ink-500">{medicine.manufacturer}</span>
                      )}
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-ink-400" />
                  </Link>
                </li>
              ))}
            </ul>

            {results.totalPages > 1 && (
              <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Pagination">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={results.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {dict.common.back}
                </Button>
                <span className="text-sm text-ink-600">
                  {results.page} / {results.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={results.page >= results.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {dict.common.next}
                </Button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
