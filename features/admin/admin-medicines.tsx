'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeading } from '@/components/ui/card';
import { Field, Select, TextArea, TextInput } from '@/components/ui/form';
import { ErrorState, SkeletonLines } from '@/components/ui/states';
import { ApiError, apiFetch } from '@/hooks/use-api';
import { dosageFormLabel, formatDate } from '@/utils/format';
import { DOSAGE_FORMS, MEDICINE_STATUSES, VERIFICATION_STATUSES } from '@/types/medicine';

interface AdminMedicineRow {
  id: string;
  slug: string;
  brandName: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string | null;
  status: string;
  verificationStatus: string;
  lastVerifiedAt: string | null;
  sourceCount: number;
  translationCount: number;
}

interface ListResponse {
  items: AdminMedicineRow[];
  total: number;
  page: number;
  totalPages: number;
}

const EMPTY_FORM = {
  brandName: '',
  genericName: '',
  strength: '',
  dosageForm: 'TABLET',
  manufacturer: '',
  compositionText: '',
  summary: '',
  commonUses: '',
  mechanismSummary: '',
  commonSideEffects: '',
  importantWarnings: '',
  cautionGroups: '',
  storageInformation: '',
  prescriptionOnly: true,
};

/** Split a textarea of one-item-per-line into an array. */
const lines = (value: string) =>
  value
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean);

export function AdminMedicines() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (status) params.set('status', status);
      setData(await apiFetch<ListResponse>(`/api/admin/medicines?${params}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load medicines.');
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(handle);
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await apiFetch('/api/admin/medicines', {
        method: 'POST',
        body: JSON.stringify({
          brandName: form.brandName,
          genericName: form.genericName,
          strength: form.strength,
          dosageForm: form.dosageForm,
          manufacturer: form.manufacturer || null,
          compositionText: form.compositionText || null,
          summary: form.summary || null,
          commonUses: lines(form.commonUses),
          mechanismSummary: form.mechanismSummary || null,
          commonSideEffects: lines(form.commonSideEffects),
          importantWarnings: lines(form.importantWarnings),
          cautionGroups: lines(form.cautionGroups),
          storageInformation: form.storageInformation || null,
          prescriptionOnly: form.prescriptionOnly,
          status: 'DRAFT',
          ingredients: form.genericName ? [{ name: form.genericName }] : [],
        }),
      });
      setForm(EMPTY_FORM);
      setCreating(false);
      setNotice('Created as a draft. Add a source and verify it before publishing.');
      void load();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? Object.values(e.details ?? {}).flat().join(' ') || e.message
          : 'Could not create the record.',
      );
    }
  };

  const act = async (id: string, action: 'verify' | 'publish' | 'archive') => {
    setError(null);
    setNotice(null);
    try {
      if (action === 'verify') {
        await apiFetch(`/api/admin/medicines/${id}/verify`, {
          method: 'POST',
          body: JSON.stringify({ verificationStatus: 'VERIFIED' }),
        });
        setNotice('Marked as verified.');
      } else if (action === 'publish') {
        await apiFetch(`/api/admin/medicines/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'PUBLISHED' }),
        });
        setNotice('Published.');
      } else {
        await apiFetch(`/api/admin/medicines/${id}`, { method: 'DELETE' });
        setNotice('Archived.');
      }
      void load();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? Object.values(e.details ?? {}).flat().join(' ') || e.message
          : 'The action failed.',
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-900">Medicines</h1>
        <Button size="sm" onClick={() => setCreating((v) => !v)}>
          {creating ? 'Cancel' : 'Add medicine'}
        </Button>
      </div>

      {notice && <Alert tone="success" role="status">{notice}</Alert>}
      {error && <ErrorState message={error} />}

      {creating && (
        <Card>
          <CardHeading>New medicine record</CardHeading>
          <p className="mb-3 text-xs text-ink-500">
            A new record starts as an unverified draft. It cannot be published until it has a
            non-demo source and a verification decision.
          </p>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={create}>
            <Field label="Brand name" required>
              {(p) => <TextInput {...p} value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} />}
            </Field>
            <Field label="Generic / active ingredient" required>
              {(p) => <TextInput {...p} value={form.genericName} onChange={(e) => setForm({ ...form, genericName: e.target.value })} />}
            </Field>
            <Field label="Strength" required hint="As printed, e.g. 500 mg or 125 mg/5 ml">
              {(p) => <TextInput {...p} value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })} />}
            </Field>
            <Field label="Dosage form" required>
              {(p) => (
                <Select {...p} value={form.dosageForm} onChange={(e) => setForm({ ...form, dosageForm: e.target.value })}>
                  {DOSAGE_FORMS.map((f) => (
                    <option key={f} value={f}>
                      {dosageFormLabel(f)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Manufacturer">
              {(p) => <TextInput {...p} value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />}
            </Field>
            <Field label="Composition line">
              {(p) => <TextInput {...p} value={form.compositionText} onChange={(e) => setForm({ ...form, compositionText: e.target.value })} />}
            </Field>

            <Field label="What is this medicine?" className="sm:col-span-2">
              {(p) => <TextArea {...p} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />}
            </Field>
            <Field label="Common uses" hint="One per line" className="sm:col-span-2">
              {(p) => <TextArea {...p} value={form.commonUses} onChange={(e) => setForm({ ...form, commonUses: e.target.value })} />}
            </Field>
            <Field label="How it generally works" className="sm:col-span-2">
              {(p) => <TextArea {...p} value={form.mechanismSummary} onChange={(e) => setForm({ ...form, mechanismSummary: e.target.value })} />}
            </Field>
            <Field label="Common side effects" hint="One per line" className="sm:col-span-2">
              {(p) => <TextArea {...p} value={form.commonSideEffects} onChange={(e) => setForm({ ...form, commonSideEffects: e.target.value })} />}
            </Field>
            <Field label="Important warnings" hint="One per line" className="sm:col-span-2">
              {(p) => <TextArea {...p} value={form.importantWarnings} onChange={(e) => setForm({ ...form, importantWarnings: e.target.value })} />}
            </Field>
            <Field label="Who may need extra caution" hint="One per line" className="sm:col-span-2">
              {(p) => <TextArea {...p} value={form.cautionGroups} onChange={(e) => setForm({ ...form, cautionGroups: e.target.value })} />}
            </Field>
            <Field label="Storage" className="sm:col-span-2">
              {(p) => <TextArea {...p} value={form.storageInformation} onChange={(e) => setForm({ ...form, storageInformation: e.target.value })} />}
            </Field>

            <label className="flex items-center gap-2 text-sm text-ink-800 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.prescriptionOnly}
                onChange={(e) => setForm({ ...form, prescriptionOnly: e.target.checked })}
                className="size-4"
              />
              Prescription only
            </label>

            <div className="sm:col-span-2">
              <Button type="submit" size="sm">
                Create draft
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Search">
            {(p) => <TextInput {...p} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />}
          </Field>
          <Field label="Status">
            {(p) => (
              <Select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                {MEDICINE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Card>

      {loading && <SkeletonLines count={5} />}

      {!loading && data && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-ink-500">
              <tr>
                <th scope="col" className="p-3">Medicine</th>
                <th scope="col" className="p-3">Status</th>
                <th scope="col" className="p-3">Verification</th>
                <th scope="col" className="p-3">Sources</th>
                <th scope="col" className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.items.map((row) => (
                <tr key={row.id}>
                  <td className="p-3">
                    <p className="font-medium text-ink-900">{row.brandName}</p>
                    <p className="text-xs text-ink-500">
                      {row.genericName} · {row.strength} · {dosageFormLabel(row.dosageForm)}
                    </p>
                  </td>
                  <td className="p-3">
                    <Badge tone={row.status === 'PUBLISHED' ? 'brand' : 'neutral'}>{row.status}</Badge>
                  </td>
                  <td className="p-3">
                    <Badge tone={row.verificationStatus === 'VERIFIED' ? 'brand' : 'warning'}>
                      {row.verificationStatus}
                    </Badge>
                    {row.lastVerifiedAt && (
                      <p className="mt-1 text-2xs text-ink-500">{formatDate(row.lastVerifiedAt)}</p>
                    )}
                  </td>
                  <td className="p-3 text-ink-600">{row.sourceCount}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {row.verificationStatus !== 'VERIFIED' && (
                        <Button size="sm" variant="ghost" onClick={() => void act(row.id, 'verify')}>
                          Verify
                        </Button>
                      )}
                      {row.status !== 'PUBLISHED' && (
                        <Button size="sm" variant="ghost" onClick={() => void act(row.id, 'publish')}>
                          Publish
                        </Button>
                      )}
                      {row.status !== 'ARCHIVED' && (
                        <Button size="sm" variant="ghost" onClick={() => void act(row.id, 'archive')}>
                          Archive
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-ink-500">
                    No medicine records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-ink-500">
        Verification states: {VERIFICATION_STATUSES.join(', ')}.
      </p>
    </div>
  );
}
