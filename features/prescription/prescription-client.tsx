'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/config/app';
import { usePreferences } from '@/components/preferences-provider';
import { SafetyNotice } from '@/components/safety-notice';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeading } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { RawTextPanel } from '@/features/scan/extracted-fields';
import { CameraCapture } from '@/features/scan/camera-capture';
import { ProcessingState } from '@/features/scan/processing';
import { apiFetch, translateError } from '@/hooks/use-api';
import { useDict, useLanguage } from '@/lib/i18n/client';
import { prepareImage } from '@/utils/image';

interface PrescriptionLine {
  lineNumber: number;
  rawText: string;
  detectedName: string | null;
  detectedStrength: string | null;
  detectedFrequency: string | null;
  confidence: number;
  needsVerification: boolean;
}

interface PrescriptionResponse {
  scanId: string;
  isLegible: boolean;
  overallConfidence: number;
  rawText: string;
  lines: PrescriptionLine[];
  notice: string;
}

/**
 * Prescription scanning.
 *
 * Extraction only (§9). Every rendered line shows the raw text; the split-out
 * name/strength/frequency are presented as *what was read*, always alongside
 * the verify-with-your-doctor notice, and nothing links to a "take this" action.
 */
export function PrescriptionClient() {
  const dict = useDict();
  const { locale } = useLanguage();
  const { preferences } = usePreferences();

  const [stage, setStage] = useState<'capture' | 'processing' | 'result'>('capture');
  const [result, setResult] = useState<PrescriptionResponse | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleCaptured = async (blob: Blob) => {
    setStage('processing');
    setErrorCode(null);
    try {
      // Prescriptions are text-dense, so keep more resolution than a pack scan.
      const prepared = await prepareImage(blob, { maxEdge: 2000, quality: 0.9 });
      URL.revokeObjectURL(prepared.previewUrl);

      const form = new FormData();
      form.append('image', prepared.blob, 'prescription.jpg');
      form.append('language', locale);
      form.append('keepImage', String(preferences.saveScanImages));

      setResult(await apiFetch<PrescriptionResponse>('/api/prescription', { method: 'POST', body: form }));
      setStage('result');
    } catch (e) {
      setErrorCode((e as { code?: string }).code ?? 'INTERNAL');
      setStage('capture');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title={dict.prescription.title} description={dict.prescription.intro} />

      <Alert tone="warning" label="Important" title={dict.prescription.verifyNotice}>
        <p>{dict.prescription.noPrescribingNotice}</p>
      </Alert>

      {errorCode && <ErrorState message={translateError(errorCode, dict)} />}

      {stage === 'capture' && (
        <CameraCapture guidance={dict.prescription.guidance} onCaptured={(b) => void handleCaptured(b)} />
      )}

      {stage === 'processing' && <ProcessingState />}

      {stage === 'result' && result && (
        <div className="space-y-4">
          {!result.isLegible ? (
            <Alert tone="danger" title={dict.prescription.illegibleTitle} role="alert">
              <p>{dict.prescription.illegibleBody}</p>
            </Alert>
          ) : result.lines.length === 0 ? (
            <EmptyState title={dict.prescription.nothingExtracted} body={dict.prescription.illegibleBody} />
          ) : (
            <Card as="section">
              <CardHeading>{dict.prescription.extractedTitle}</CardHeading>
              <ul className="divide-y divide-[var(--border)]">
                {result.lines.map((line) => (
                  <li key={line.lineNumber} className="py-3">
                    {/* The verbatim line is the primary content. */}
                    <p className="font-mono text-sm text-ink-900 break-words">{line.rawText}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {line.needsVerification && (
                        <Badge tone="warning">{dict.prescription.lineNeedsCheck}</Badge>
                      )}
                      {line.detectedStrength && (
                        <Badge tone="neutral">{line.detectedStrength}</Badge>
                      )}
                      {line.detectedFrequency && (
                        <Badge tone="neutral">
                          {dict.prescription.frequencyAsWritten}: {line.detectedFrequency}
                        </Badge>
                      )}
                    </div>

                    {line.detectedName && (
                      <Link
                        href={`${ROUTES.search}?q=${encodeURIComponent(line.detectedName)}`}
                        className="mt-2 inline-block text-sm font-medium text-brand-700 underline underline-offset-2"
                      >
                        {dict.prescription.lookUpMedicine}: {line.detectedName}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <RawTextPanel text={result.rawText} label={dict.prescription.rawTextTitle} />

          <Alert tone="warning" label="Important">
            {result.notice}
          </Alert>

          <Button variant="secondary" onClick={() => { setStage('capture'); setResult(null); }}>
            {dict.result.scanAgain}
          </Button>
        </div>
      )}

      <SafetyNotice />
    </div>
  );
}
