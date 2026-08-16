import Link from 'next/link';
import { ROUTES } from '@/config/app';
import { assertProductionReady, env, isDemoMode } from '@/config/env';
import { getDb } from '@/lib/db';
import { Alert } from '@/components/ui/alert';
import { Card, CardHeading } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

/** Admin overview: catalogue health plus a deployment-readiness checklist. */
export default async function AdminOverviewPage() {
  const db = getDb();
  const problems = assertProductionReady();

  const counts = db
    ? await db.$transaction([
        db.medicine.count(),
        db.medicine.count({ where: { status: 'PUBLISHED' } }),
        db.medicine.count({ where: { verificationStatus: 'VERIFIED' } }),
        db.medicine.count({ where: { verificationStatus: { in: ['UNVERIFIED', 'PENDING_REVIEW'] } } }),
        db.medicineTranslation.count({ where: { status: 'MACHINE_UNREVIEWED' } }),
        db.medicineScan.count({ where: { status: 'OCR_FAILED' } }),
        db.systemErrorLog.count(),
      ])
    : [0, 0, 0, 0, 0, 0, 0];

  const [total, published, verified, pending, unreviewedTranslations, ocrFailures, errors] = counts;

  const stats = [
    { label: 'Medicine records', value: total },
    { label: 'Published', value: published },
    { label: 'Verified', value: verified },
    { label: 'Awaiting verification', value: pending },
    { label: 'Unreviewed translations', value: unreviewedTranslations },
    { label: 'OCR failures', value: ocrFailures },
    { label: 'Logged system errors', value: errors },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink-900">Overview</h1>

      {isDemoMode() && (
        <Alert tone="warning" label="Demo" title="This installation is in demo mode">
          <p>
            Users see the DEVELOPMENT / DEMO banner and the bundled sample dataset is in use. Set{' '}
            <code>NEXT_PUBLIC_DEMO_MODE=false</code> only after a verified medicine database is
            connected and reviewed.
          </p>
        </Alert>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <Card as="li" key={stat.label}>
            <p className="text-2xl font-semibold text-ink-900">{stat.value}</p>
            <p className="text-xs text-ink-500">{stat.label}</p>
          </Card>
        ))}
      </ul>

      <Card>
        <CardHeading>Production readiness</CardHeading>
        {problems.length === 0 ? (
          <p className="text-sm text-brand-700">All configuration checks pass.</p>
        ) : (
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-warn-700">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-ink-600 sm:grid-cols-3">
          {[
            ['OCR provider', env.OCR_PROVIDER],
            ['AI provider', env.AI_PROVIDER],
            ['Translation', env.TRANSLATION_PROVIDER],
            ['Speech', env.TTS_PROVIDER],
            ['Storage', env.STORAGE_PROVIDER],
            ['Image retention', `${env.UPLOAD_RETENTION_HOURS} h`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-ink-500">{label}</dt>
              <dd className="font-medium text-ink-900">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeading>Next actions</CardHeading>
        <ul className="space-y-1.5 text-sm">
          <li>
            <Link className="text-brand-700 underline" href={ROUTES.adminReview}>
              Work the review queue
            </Link>
          </li>
          <li>
            <Link className="text-brand-700 underline" href={ROUTES.adminMedicines}>
              Manage medicine records
            </Link>
          </li>
          <li>
            <Link className="text-brand-700 underline" href={ROUTES.adminSources}>
              Manage sources
            </Link>
          </li>
        </ul>
      </Card>
    </div>
  );
}
