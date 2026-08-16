'use client';

import { useEffect, useState } from 'react';
import { ROUTES } from '@/config/app';
import { SafetyNotice } from '@/components/safety-notice';
import { PageHeader } from '@/components/layout/page-header';
import { ButtonLink } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { apiFetch, translateError } from '@/hooks/use-api';
import { useDict } from '@/lib/i18n/client';
import { RawTextPanel } from './extracted-fields';
import { ResultView } from './result-view';
import { readScanResult, storeScanResult, type StoredScan } from './scan-storage';

/**
 * Standalone result page.
 *
 * Reads the session cache first so a result is available even when scans are
 * not persisted (no database), then falls back to the API.
 */
export function ScanResultClient({ scanId }: { scanId: string }) {
  const dict = useDict();
  const [scan, setScan] = useState<StoredScan | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // The session cache is checked inside the async flow rather than in the
    // effect body, so the effect never sets state synchronously.
    const load = async () => {
      const cached = readScanResult(scanId);
      if (cached) {
        if (!cancelled) {
          setScan(cached);
          setLoading(false);
        }
        return;
      }

      try {
        const data = await apiFetch<StoredScan>(`/api/scan/${encodeURIComponent(scanId)}`);
        if (cancelled) return;
        setScan(data);
        storeScanResult(scanId, data);
      } catch (e) {
        if (!cancelled) setErrorCode((e as { code?: string }).code ?? 'INTERNAL');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [scanId]);

  if (loading) {
    return <LoadingState message={dict.common.loading} regionLabel={dict.a11y.loadingRegion} />;
  }

  if (!scan) {
    return (
      <div className="space-y-4">
        <ErrorState
          title={dict.errors.notFound}
          message={errorCode ? translateError(errorCode, dict) : dict.errors.notFound}
          action={<ButtonLink href={ROUTES.scan} size="sm">{dict.result.scanAgain}</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title={dict.result.title} />
      <ResultView result={scan.identification} />
      <RawTextPanel text={scan.ocr.text} label={dict.result.rawTextLabel} />
      <SafetyNotice compact />
    </div>
  );
}
