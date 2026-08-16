'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeading } from '@/components/ui/card';
import { Field, TextInput } from '@/components/ui/form';
import { useDict } from '@/lib/i18n/client';
import type { ExtractedPackageFields } from '@/types/identification';

/**
 * "What we read from the pack", with correction.
 *
 * The heading and helper text are careful: these values are claims about the
 * photograph, not facts about a medicine, and the UI says so before the user
 * can act on them (§5B).
 */
export function ExtractedFields({
  fields,
  onReidentify,
  busy,
}: {
  fields: ExtractedPackageFields;
  onReidentify: (fields: ExtractedPackageFields) => void;
  busy?: boolean;
}) {
  const dict = useDict();
  const [draft, setDraft] = useState(fields);
  const [editing, setEditing] = useState(false);

  const set = (key: keyof ExtractedPackageFields) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value.trim() ? value : null }));

  const rows: { key: keyof ExtractedPackageFields; label: string }[] = [
    { key: 'brandName', label: dict.result.title },
    { key: 'genericName', label: dict.medicine.activeIngredient },
    { key: 'strength', label: dict.medicine.strength },
    { key: 'dosageForm', label: dict.medicine.dosageForm },
    { key: 'manufacturer', label: dict.medicine.manufacturer },
  ];

  return (
    <Card>
      <CardHeading>{dict.result.whatWeRead}</CardHeading>
      <p className="mb-3 text-xs text-ink-500">{dict.result.whatWeReadHelp}</p>

      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onReidentify(draft);
          }}
        >
          {rows.map(({ key, label }) => (
            <Field key={key} label={label}>
              {(props) => (
                <TextInput
                  {...props}
                  defaultValue={(draft[key] as string | null) ?? ''}
                  onChange={(e) => set(key)(e.target.value)}
                />
              )}
            </Field>
          ))}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              {dict.common.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? dict.common.loading : dict.scan.confirmExtracted}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <dl className="text-sm">
            {rows.map(({ key, label }) => (
              <div
                key={key}
                className="flex justify-between gap-4 border-b border-[var(--border)] py-2 last:border-b-0"
              >
                <dt className="text-ink-500">{label}</dt>
                <dd className="text-right font-medium text-ink-900">
                  {(fields[key] as string | null) ?? (
                    <span className="font-normal text-ink-400">{dict.common.notAvailable}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => {
              setDraft(fields);
              setEditing(true);
            }}
          >
            {dict.common.edit}
          </Button>
        </>
      )}
    </Card>
  );
}

/** Collapsible raw OCR text. Shown verbatim, never cleaned up. */
export function RawTextPanel({ text, label }: { text: string; label: string }) {
  if (!text.trim()) return null;
  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-medium text-ink-800">{label}</summary>
      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--surface-muted)] p-3 text-xs text-ink-700">
        {text}
      </pre>
    </details>
  );
}
