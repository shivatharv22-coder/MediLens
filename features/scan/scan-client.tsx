'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/app';
import { usePreferences } from '@/components/preferences-provider';
import { SafetyNotice } from '@/components/safety-notice';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/states';
import { apiFetch, translateError, useAsync } from '@/hooks/use-api';
import { useDict, useLanguage } from '@/lib/i18n/client';
import { prepareImage, toPixelCrop } from '@/utils/image';
import type { ExtractedPackageFields, IdentificationResult } from '@/types/identification';
import { CameraCapture } from './camera-capture';
import { ExtractedFields, RawTextPanel } from './extracted-fields';
import { ImagePreview, type FractionCrop } from './image-preview';
import { ProcessingState } from './processing';
import { ResultView } from './result-view';
import { storeScanResult, type StoredScan } from './scan-storage';

type Stage = 'capture' | 'preview' | 'processing' | 'result';

interface ScanResponse {
  scanId: string;
  persisted: boolean;
  identification: IdentificationResult;
  ocr: { text: string; confidence: number; provider: string };
  isDemo: boolean;
}

/** Package types, each with its own framing guidance (§14). */
type PackType = 'general' | 'strip' | 'bottle' | 'box';

export function ScanClient() {
  const dict = useDict();
  const { locale } = useLanguage();
  const router = useRouter();
  const { preferences } = usePreferences();

  const [stage, setStage] = useState<Stage>('capture');
  const [packType, setPackType] = useState<PackType>('general');
  const [captured, setCaptured] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const upload = useAsync(async (blob: Blob) => {
    const form = new FormData();
    form.append('image', blob, 'scan.jpg');
    form.append('language', locale);
    form.append('keepImage', String(preferences.saveScanImages));
    return apiFetch<ScanResponse>('/api/scan', { method: 'POST', body: form });
  });

  const reidentify = useAsync(async (fields: ExtractedPackageFields) =>
    apiFetch<{ identification: IdentificationResult; isDemo: boolean }>('/api/scan/reidentify', {
      method: 'POST',
      body: JSON.stringify({ fields, language: locale }),
    }),
  );

  const handleCaptured = useCallback(
    (blob: Blob) => {
      setCaptured(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      setStage('preview');
    },
    [],
  );

  const handleConfirm = useCallback(
    async (crop: FractionCrop | null) => {
      if (!captured) return;
      setStage('processing');

      try {
        const bitmapSize = await imageSize(captured);
        const prepared = await prepareImage(captured, {
          crop: crop ? toPixelCrop(crop, bitmapSize.width, bitmapSize.height) : null,
        });
        // The prepared preview URL is not shown; release it immediately.
        URL.revokeObjectURL(prepared.previewUrl);

        const response = await upload.run(prepared.blob);
        if (!response) {
          setStage('preview');
          return;
        }

        setResult(response);
        // Cached so the result page survives a refresh even without a database.
        storeScanResult(response.scanId, response as StoredScan);
        setStage('result');
      } catch {
        setStage('preview');
      }
    },
    [captured, upload],
  );

  const handleReidentify = useCallback(
    async (fields: ExtractedPackageFields) => {
      const response = await reidentify.run(fields);
      if (response && result) {
        const next = { ...result, identification: response.identification };
        setResult(next);
        storeScanResult(next.scanId, next as StoredScan);
      }
    },
    [reidentify, result],
  );

  const guidance = {
    general: dict.scan.guidanceGeneral,
    strip: dict.scan.guidanceStrip,
    bottle: dict.scan.guidanceBottle,
    box: dict.scan.guidanceBox,
  }[packType];

  return (
    <div className="space-y-5">
      <PageHeader title={dict.scan.title} description={dict.scan.intro} />

      {stage === 'capture' && (
        <>
          <PackTypePicker value={packType} onChange={setPackType} />
          <CameraCapture guidance={guidance} onCaptured={handleCaptured} />
        </>
      )}

      {stage === 'preview' && previewUrl && (
        <>
          {upload.error && (
            <ErrorState
              message={translateError(upload.error.code, dict)}
              action={
                <Button size="sm" variant="secondary" onClick={() => void handleConfirm(null)}>
                  {dict.common.retry}
                </Button>
              }
            />
          )}
          <ImagePreview
            previewUrl={previewUrl}
            onRetake={() => {
              setStage('capture');
              setCaptured(null);
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              setPreviewUrl(null);
              upload.reset();
            }}
            onConfirm={(crop) => void handleConfirm(crop)}
          />
        </>
      )}

      {stage === 'processing' && <ProcessingState />}

      {stage === 'result' && result && (
        <div className="space-y-4">
          <ResultView result={result.identification} />

          <ExtractedFields
            fields={result.identification.extracted}
            onReidentify={(fields) => void handleReidentify(fields)}
            busy={reidentify.loading}
          />

          <RawTextPanel text={result.ocr.text} label={dict.result.rawTextLabel} />

          {result.identification.messageCode !== 'IDENTIFIED' && (
            <Alert tone="info">
              <p>{dict.scan.poorQualityBody}</p>
            </Alert>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setStage('capture');
                setResult(null);
                setCaptured(null);
                setPreviewUrl(null);
                upload.reset();
              }}
            >
              {dict.scan.addAnotherSide}
            </Button>
            <Button variant="ghost" onClick={() => router.push(ROUTES.search)}>
              {dict.result.searchInstead}
            </Button>
          </div>
        </div>
      )}

      <SafetyNotice compact />
    </div>
  );
}

function PackTypePicker({
  value,
  onChange,
}: {
  value: PackType;
  onChange: (next: PackType) => void;
}) {
  const dict = useDict();
  const options: { key: PackType; label: string }[] = [
    { key: 'general', label: dict.scan.scanFront },
    { key: 'strip', label: dict.medicine.dosageForm },
    { key: 'bottle', label: dict.scan.guidanceBottle.slice(0, 18) },
    { key: 'box', label: dict.scan.scanBack },
  ];

  return (
    <fieldset>
      <legend className="sr-only">{dict.scan.intro}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={value === option.key}
            onClick={() => onChange(option.key)}
            className={
              value === option.key
                ? 'min-h-11 rounded-full border border-brand-500 bg-brand-50 px-4 text-sm font-medium text-brand-800'
                : 'min-h-11 rounded-full border border-[var(--border)] bg-white px-4 text-sm text-ink-600'
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Natural pixel size of a blob, needed to convert a fractional crop. */
async function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}
