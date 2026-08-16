'use client';

import { SafetyNotice } from '@/components/safety-notice';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeading, DataRow } from '@/components/ui/card';
import { WarningIcon } from '@/components/ui/icons';
import { useDict, useLanguage } from '@/lib/i18n/client';
import { dosageFormLabel, formatDate, sourceCategoryLabel } from '@/utils/format';
import type { LocalisedMedicine } from '@/types/medicine';
import { AskPanel } from './ask-panel';
import { ListenButton } from './listen-button';
import { SaveToHistory } from './save-to-history';

/**
 * The medicine information page.
 *
 * Field order and wording follow §6 exactly. Sections with no verified content
 * say so rather than being hidden, because an absent warning section and an
 * empty one mean different things to a reader.
 */
export function MedicineDetail({ medicine }: { medicine: LocalisedMedicine }) {
  const dict = useDict();
  const { locale } = useLanguage();
  const m = dict.medicine;

  return (
    <article className="space-y-4">
      {/* A div, not <header>: the app shell already provides the one banner
          header, and a second <header> element reads as a second page header. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={medicine.prescriptionOnly ? 'warning' : 'neutral'}>
            {medicine.prescriptionOnly ? m.prescriptionOnly : m.overTheCounter}
          </Badge>
          {medicine.verificationStatus === 'VERIFIED' ? (
            <Badge tone="brand">
              {m.lastVerified}: {formatDate(medicine.lastVerifiedAt, locale) ?? '—'}
            </Badge>
          ) : (
            <Badge tone="warning">{m.neverVerified}</Badge>
          )}
        </div>

        <h1 className="text-2xl font-semibold text-ink-900">{medicine.brandName}</h1>
        <p className="text-base text-ink-600">
          {medicine.genericName} · {medicine.strength} · {dosageFormLabel(medicine.dosageForm)}
        </p>
      </div>

      {medicine.translationFallback && <Alert tone="info">{m.translationFallback}</Alert>}
      {medicine.translationStatus === 'MACHINE_UNREVIEWED' && (
        <Alert tone="warning" label="Unreviewed">
          {m.translationUnreviewed}
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <ListenButton medicine={medicine} />
        <SaveToHistory medicineId={medicine.id} />
      </div>

      <Card>
        <dl>
          <DataRow label={m.activeIngredient} value={medicine.genericName} />
          <DataRow label={m.strength} value={medicine.strength} />
          <DataRow label={m.dosageForm} value={dosageFormLabel(medicine.dosageForm)} />
          {medicine.manufacturer && (
            <DataRow label={m.manufacturer} value={medicine.manufacturer} />
          )}
          {medicine.compositionText && (
            <DataRow label={m.composition} value={medicine.compositionText} />
          )}
          {medicine.packSizeText && <DataRow label={m.packSize} value={medicine.packSizeText} />}
        </dl>
      </Card>

      <Section title={m.whatIsThis} body={medicine.summary} empty={m.noInformation} />

      <ListSection
        title={m.commonUses}
        lead={m.commonUsesLead}
        items={medicine.commonUses}
        empty={m.noInformation}
      />

      <Section title={m.howItWorks} body={medicine.mechanismSummary} empty={m.noInformation} />

      <ListSection
        title={m.commonSideEffects}
        items={medicine.commonSideEffects}
        empty={m.noInformation}
      />

      {/* Warnings are visually distinct from side effects: same list shape,
          different surface, plus an icon and a text label. */}
      <section aria-labelledby="warnings">
        <div className="rounded-xl border border-warn-100 bg-warn-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <WarningIcon className="size-5 text-warn-500" />
            <h2 id="warnings" className="text-base font-semibold text-ink-900">
              {m.importantWarnings}
            </h2>
          </div>
          {medicine.importantWarnings.length ? (
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-800">
              {medicine.importantWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-600">{m.noInformation}</p>
          )}
        </div>
      </section>

      <ListSection
        title={m.cautionGroups}
        lead={m.cautionGroupsLead}
        items={medicine.cautionGroups}
        empty={m.noInformation}
      />

      <Section title={m.storage} body={medicine.storageInformation} empty={m.noInformation} />

      <AskPanel medicineId={medicine.id} />

      <Card>
        <CardHeading>{m.source}</CardHeading>
        {medicine.sources.length ? (
          <ul className="space-y-3">
            {medicine.sources.map((source) => (
              <li key={source.id} className="text-sm">
                <p className="font-medium text-ink-900">{source.name}</p>
                <p className="text-ink-600">{sourceCategoryLabel(source.category)}</p>
                {source.version && <p className="text-xs text-ink-500">{source.version}</p>}
                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-xs text-brand-700 underline underline-offset-2 break-all"
                  >
                    {source.url}
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-600">{m.noInformation}</p>
        )}
        <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs text-ink-500">
          {m.lastVerified}: {formatDate(medicine.lastVerifiedAt, locale) ?? m.neverVerified}
        </p>
      </Card>

      <SafetyNotice />
    </article>
  );
}

function Section({
  title,
  body,
  empty,
}: {
  title: string;
  body: string | null;
  empty: string;
}) {
  const id = title.replace(/\s+/g, '-').toLowerCase();
  return (
    <Card as="section">
      <CardHeading id={id}>{title}</CardHeading>
      <p className="text-sm leading-relaxed text-ink-700">{body || empty}</p>
    </Card>
  );
}

function ListSection({
  title,
  lead,
  items,
  empty,
}: {
  title: string;
  lead?: string;
  items: string[];
  empty: string;
}) {
  const id = title.replace(/\s+/g, '-').toLowerCase();
  return (
    <Card as="section">
      <CardHeading id={id}>{title}</CardHeading>
      {items.length ? (
        <>
          {lead && <p className="mb-2 text-sm text-ink-600">{lead}</p>}
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-700">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-ink-600">{empty}</p>
      )}
    </Card>
  );
}
