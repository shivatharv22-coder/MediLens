'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeading } from '@/components/ui/card';
import { Field, Select, TextInput } from '@/components/ui/form';
import { ErrorState, SkeletonLines } from '@/components/ui/states';
import { ApiError, apiFetch } from '@/hooks/use-api';
import { formatDate, sourceCategoryLabel } from '@/utils/format';
import { SOURCE_CATEGORIES } from '@/types/medicine';

interface SourceRow {
  id: string;
  medicineId: string;
  medicineLabel: string;
  category: string;
  name: string;
  url: string | null;
  version: string | null;
  retrievedAt: string | null;
}

interface ListResponse {
  items: SourceRow[];
  total: number;
}

/**
 * Source management (§18).
 *
 * Every medicine must cite where its content came from. Demo seed data is a
 * category of its own so that it can never be mistaken for a real source, and
 * the API refuses to verify a record whose only source is demo data.
 */
export function AdminSources() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    medicineId: '',
    category: 'GOVERNMENT_REGULATORY',
    name: '',
    url: '',
    version: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      setData(await apiFetch<ListResponse>(`/api/admin/sources?${params}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load sources.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(handle);
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await apiFetch('/api/admin/sources', {
        method: 'POST',
        body: JSON.stringify({
          medicineId: form.medicineId.trim(),
          category: form.category,
          name: form.name.trim(),
          url: form.url.trim() || null,
          version: form.version.trim() || null,
        }),
      });
      setForm({ ...form, medicineId: '', name: '', url: '', version: '' });
      setNotice('Source added.');
      void load();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? Object.values(e.details ?? {}).flat().join(' ') || e.message
          : 'Could not add the source.',
      );
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      await apiFetch(`/api/admin/sources/${id}`, { method: 'DELETE' });
      void load();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? Object.values(e.details ?? {}).flat().join(' ') || e.message
          : 'Could not remove the source.',
      );
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink-900">Sources</h1>

      {notice && <Alert tone="success" role="status">{notice}</Alert>}
      {error && <ErrorState message={error} />}

      <Alert tone="info">
        Do not add general web pages as medical sources. Use regulatory documents, official product
        information, an authoritative drug database, or manufacturer documentation.
      </Alert>

      <Card>
        <CardHeading>Add a source</CardHeading>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={create}>
          <Field label="Medicine id" required hint="Copy the id from the medicines table">
            {(p) => <TextInput {...p} value={form.medicineId} onChange={(e) => setForm({ ...form, medicineId: e.target.value })} />}
          </Field>
          <Field label="Category" required>
            {(p) => (
              <Select {...p} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {SOURCE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {sourceCategoryLabel(c)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Source name" required>
            {(p) => <TextInput {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
          </Field>
          <Field label="URL">
            {(p) => <TextInput {...p} type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />}
          </Field>
          <Field label="Version / revision">
            {(p) => <TextInput {...p} value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />}
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm">
              Add source
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <Field label="Search sources">
          {(p) => <TextInput {...p} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />}
        </Field>
      </Card>

      {loading && <SkeletonLines count={4} />}

      {!loading && data && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-ink-500">
              <tr>
                <th scope="col" className="p-3">Medicine</th>
                <th scope="col" className="p-3">Source</th>
                <th scope="col" className="p-3">Category</th>
                <th scope="col" className="p-3">Retrieved</th>
                <th scope="col" className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.items.map((row) => (
                <tr key={row.id}>
                  <td className="p-3 text-ink-900">{row.medicineLabel}</td>
                  <td className="p-3">
                    <p className="text-ink-900">{row.name}</p>
                    {row.url && (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-xs text-brand-700 underline break-all"
                      >
                        {row.url}
                      </a>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge tone={row.category === 'DEMO_SEED_DATA' ? 'warning' : 'neutral'}>
                      {sourceCategoryLabel(row.category)}
                    </Badge>
                  </td>
                  <td className="p-3 text-ink-600">{formatDate(row.retrievedAt) ?? '—'}</td>
                  <td className="p-3">
                    <Button size="sm" variant="ghost" onClick={() => void remove(row.id)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-ink-500">
                    No sources recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
