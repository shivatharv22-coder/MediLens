import { Badge } from '@/components/ui/badge';
import { Card, CardHeading } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { requireDb } from '@/lib/db';
import { formatDateTime } from '@/utils/format';

export const dynamic = 'force-dynamic';

/**
 * Review queue.
 *
 * Rendered on the server so the medical-triage data never travels through an
 * extra client fetch. Deliberately shows no OCR text and no image references —
 * admins triage by counts and codes, not by reading users' medical images.
 */
export default async function AdminReviewPage() {
  const db = requireDb();
  // Reading the clock is exactly what this page needs — it is a dynamic server
  // component issuing a time-windowed query, not a render-pure client tree.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 30 * 24 * 3600_000);

  const [pendingMedicines, pendingTranslations, uncertainScans, ocrFailures, errors] =
    await Promise.all([
      db.medicine.findMany({
        where: { verificationStatus: { in: ['UNVERIFIED', 'PENDING_REVIEW'] } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          brandName: true,
          strength: true,
          status: true,
          verificationStatus: true,
          updatedAt: true,
          _count: { select: { sources: true } },
        },
      }),
      db.medicineTranslation.findMany({
        where: { status: 'MACHINE_UNREVIEWED' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          languageCode: true,
          updatedAt: true,
          medicine: { select: { brandName: true, strength: true } },
        },
      }),
      db.medicineScan.findMany({
        where: {
          status: 'COMPLETED',
          failureCode: {
            in: ['LOW_CONFIDENCE', 'NOT_IDENTIFIED', 'MULTIPLE_MATCHES', 'NO_TEXT_DETECTED'],
          },
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          failureCode: true,
          ocrConfidence: true,
          results: {
            orderBy: { rank: 'asc' },
            take: 1,
            select: { extractedBrand: true, extractedStrength: true, confidenceScore: true },
          },
        },
      }),
      db.medicineScan.findMany({
        where: { status: 'OCR_FAILED', createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, createdAt: true, failureCode: true, ocrProvider: true },
      }),
      db.systemErrorLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, code: true, area: true, message: true, createdAt: true },
      }),
    ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink-900">Review queue</h1>

      <Card as="section">
        <CardHeading>Records awaiting verification</CardHeading>
        {pendingMedicines.length === 0 ? (
          <EmptyState title="Nothing awaiting verification." />
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {pendingMedicines.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <span className="font-medium text-ink-900">
                    {m.brandName} {m.strength}
                  </span>
                  <span className="ml-2 text-xs text-ink-500">
                    {m.id} · {m._count.sources} source{m._count.sources === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone="warning">{m.verificationStatus}</Badge>
                  <Badge tone="neutral">{m.status}</Badge>
                  <span className="text-xs text-ink-500">{formatDateTime(m.updatedAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card as="section">
        <CardHeading>Unreviewed translations</CardHeading>
        {pendingTranslations.length === 0 ? (
          <EmptyState title="No unreviewed translations." />
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {pendingTranslations.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2.5">
                <span className="text-ink-900">
                  {t.medicine.brandName} {t.medicine.strength}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone="warning">{t.languageCode}</Badge>
                  <span className="text-xs text-ink-500">{formatDateTime(t.updatedAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card as="section">
        <CardHeading>Uncertain identifications</CardHeading>
        <p className="mb-2 text-xs text-ink-500">
          Scans where MediLens declined to confirm a match. These are the clearest signal of a gap
          in the medicine database.
        </p>
        {uncertainScans.length === 0 ? (
          <EmptyState title="No uncertain identifications in the last 30 days." />
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {uncertainScans.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <span className="font-medium text-ink-900">
                    {s.results[0]?.extractedBrand ?? '(no brand read)'}
                  </span>
                  {s.results[0]?.extractedStrength && (
                    <span className="ml-1 text-ink-600">{s.results[0].extractedStrength}</span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone="warning">{s.failureCode}</Badge>
                  <span className="text-xs text-ink-500">
                    OCR {Math.round((s.ocrConfidence ?? 0) * 100)}% · top{' '}
                    {Math.round((s.results[0]?.confidenceScore ?? 0) * 100)}%
                  </span>
                  <span className="text-xs text-ink-500">{formatDateTime(s.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card as="section">
        <CardHeading>OCR failures</CardHeading>
        {ocrFailures.length === 0 ? (
          <EmptyState title="No OCR failures in the last 30 days." />
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {ocrFailures.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                <span className="text-ink-700">{s.ocrProvider ?? 'unknown provider'}</span>
                <span className="flex items-center gap-2">
                  <Badge tone="danger">{s.failureCode ?? 'OCR_ERROR'}</Badge>
                  <span className="text-xs text-ink-500">{formatDateTime(s.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card as="section">
        <CardHeading>System errors</CardHeading>
        {errors.length === 0 ? (
          <EmptyState title="No system errors logged." />
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {errors.map((e) => (
              <li key={e.id} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="danger">{e.code}</Badge>
                  <span className="text-xs text-ink-500">
                    {e.area} · {formatDateTime(e.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-600 break-words">{e.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
