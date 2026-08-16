'use client';

import Link from 'next/link';
import { ROUTES } from '@/config/app';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeading } from '@/components/ui/card';
import { ConfidenceBadge } from '@/components/ui/badge';
import { ChevronRightIcon } from '@/components/ui/icons';
import { useDict } from '@/lib/i18n/client';
import { dosageFormLabel } from '@/utils/format';
import type { IdentificationResult, MatchCandidate } from '@/types/identification';

/**
 * Identification outcome.
 *
 * The safety rule this component exists to enforce: only `IDENTIFIED` presents
 * a medicine as confirmed. Every other outcome shows candidates as *possible*
 * matches and asks the user to check the pack (§27).
 */
export function ResultView({ result }: { result: IdentificationResult }) {
  const dict = useDict();

  const confidenceLabel = {
    HIGH: dict.result.confidenceHigh,
    MEDIUM: dict.result.confidenceMedium,
    LOW: dict.result.confidenceLow,
    NOT_IDENTIFIED: dict.result.notIdentified,
  }[result.confidenceLevel];

  const headline = {
    IDENTIFIED: { title: dict.result.identifiedTitle, body: null, tone: 'success' as const },
    MULTIPLE_MATCHES: {
      title: dict.result.multipleMatchesTitle,
      body: dict.result.multipleMatchesBody,
      tone: 'warning' as const,
    },
    LOW_CONFIDENCE: {
      title: dict.result.lowConfidenceTitle,
      body: dict.result.lowConfidenceBody,
      tone: 'warning' as const,
    },
    NOT_IDENTIFIED: {
      title: dict.result.notIdentifiedTitle,
      body: dict.result.notIdentifiedBody,
      tone: 'danger' as const,
    },
    NO_TEXT_DETECTED: {
      title: dict.result.noTextTitle,
      body: dict.result.noTextBody,
      tone: 'danger' as const,
    },
  }[result.messageCode];

  const confirmed = result.messageCode === 'IDENTIFIED' && result.confirmedMedicineId;
  const confirmedCandidate = confirmed
    ? result.candidates.find((c) => c.medicine.id === result.confirmedMedicineId)
    : null;
  const otherCandidates = confirmed
    ? result.candidates.filter((c) => c.medicine.id !== result.confirmedMedicineId)
    : result.candidates;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ConfidenceBadge
          level={result.confidenceLevel}
          label={confidenceLabel}
          a11yLabel={dict.a11y.confidenceBadge}
        />
        <span className="text-xs text-ink-500">
          {Math.round(result.confidenceScore * 100)}%
        </span>
      </div>

      <Alert tone={headline.tone} title={headline.title} role={confirmed ? 'status' : 'alert'}>
        {headline.body && <p>{headline.body}</p>}
        {!confirmed && result.candidates.length > 0 && (
          <p className="mt-2 font-medium">{dict.result.verifyWithPackage}</p>
        )}
      </Alert>

      {confirmedCandidate && (
        <Card>
          <CardHeading>{dict.result.viewDetails}</CardHeading>
          <CandidateRow candidate={confirmedCandidate} emphasised />
          <ButtonLink
            href={ROUTES.medicine(confirmedCandidate.medicine.slug)}
            fullWidth
            className="mt-3"
          >
            {dict.result.viewDetails}
          </ButtonLink>
        </Card>
      )}

      {otherCandidates.length > 0 && (
        <Card>
          <CardHeading>
            {confirmed ? dict.result.multipleMatchesTitle : dict.search.resultsCount}
          </CardHeading>
          <ul className="divide-y divide-[var(--border)]">
            {otherCandidates.map((candidate) => (
              <li key={candidate.medicine.id}>
                <Link
                  href={ROUTES.medicine(candidate.medicine.slug)}
                  className="flex items-center gap-3 py-3 hover:bg-ink-50"
                >
                  <CandidateRow candidate={candidate} />
                  <ChevronRightIcon className="size-4 shrink-0 text-ink-400" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <ButtonLink href={ROUTES.scan} variant="secondary">
          {dict.result.scanAgain}
        </ButtonLink>
        <ButtonLink href={ROUTES.search} variant="ghost">
          {dict.result.searchInstead}
        </ButtonLink>
      </div>
    </div>
  );
}

function CandidateRow({
  candidate,
  emphasised,
}: {
  candidate: MatchCandidate;
  emphasised?: boolean;
}) {
  const dict = useDict();
  const m = candidate.medicine;

  return (
    <div className="min-w-0 flex-1">
      <p className={emphasised ? 'text-base font-semibold text-ink-900' : 'text-sm font-medium text-ink-900'}>
        {m.brandName}
      </p>
      <p className="text-sm text-ink-600">
        {m.genericName} · {m.strength} · {dosageFormLabel(m.dosageForm)}
      </p>
      {m.manufacturer && <p className="text-xs text-ink-500">{m.manufacturer}</p>}
      {candidate.signals.length > 0 && (
        <p className="mt-1 text-2xs text-ink-500">
          {dict.result.matchSignals}:{' '}
          {candidate.signals.map((s) => s.toLowerCase().replace(/_/g, ' ')).join(', ')}
        </p>
      )}
    </div>
  );
}
