'use client';

import { useEffect, useRef } from 'react';
import { ACCEPTED_IMAGE_MIME_TYPES } from '@/config/app';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CameraIcon, UploadIcon } from '@/components/ui/icons';
import { useCamera } from '@/hooks/use-camera';
import { useDict } from '@/lib/i18n/client';

/**
 * The camera screen.
 *
 * Mobile-first and intentionally sparse: preview, framing guide, one large
 * capture button, and an always-available gallery fallback so a denied camera
 * permission never blocks the user.
 */
export function CameraCapture({
  guidance,
  onCaptured,
}: {
  guidance: string;
  onCaptured: (blob: Blob) => void;
}) {
  const dict = useDict();
  // Destructured so the ref stays separate from the plain values: reading
  // `status` off the hook object during render reads as a ref access.
  const { videoRef, status, torchOn, torchSupported, start, stop, capture, toggleTorch, switchCamera } =
    useCamera();
  const fileRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
  }, [start]);

  const handleCapture = async () => {
    const blob = await capture();
    if (blob) {
      stop();
      onCaptured(blob);
    }
  };

  const pickFile = () => fileRef.current?.click();

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-ink-900 aspect-[3/4] sm:aspect-[4/3]">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          aria-label={dict.a11y.cameraPreview}
          className="size-full object-cover"
        />

        {status === 'ready' && (
          <>
            <div className="scan-frame" aria-hidden />
            <p className="absolute inset-x-0 bottom-3 px-4 text-center text-sm font-medium text-white drop-shadow">
              {guidance}
            </p>
          </>
        )}

        {status === 'starting' && (
          <p className="absolute inset-0 grid place-items-center text-sm text-white">
            {dict.common.loading}…
          </p>
        )}

        {(status === 'denied' || status === 'unavailable') && (
          <div className="absolute inset-0 grid place-items-center p-6">
            <div className="max-w-sm text-center text-white">
              <CameraIcon className="mx-auto size-8 opacity-70" />
              <p className="mt-3 font-semibold">
                {status === 'denied'
                  ? dict.scan.permissionDeniedTitle
                  : dict.scan.cameraUnavailableTitle}
              </p>
              <p className="mt-1 text-sm opacity-90">
                {status === 'denied'
                  ? dict.scan.permissionDeniedBody
                  : dict.scan.cameraUnavailableBody}
              </p>
            </div>
          </div>
        )}
      </div>

      {status === 'ready' && (
        <p className="text-center text-xs text-ink-500">{dict.scan.frameHint}</p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" size="md" onClick={pickFile}>
          <UploadIcon className="size-5" />
          <span className="hidden sm:inline">{dict.scan.uploadImage}</span>
        </Button>

        {status === 'ready' ? (
          <Button size="lg" onClick={handleCapture} className="flex-1 sm:flex-none">
            <CameraIcon className="size-5" />
            {dict.scan.capture}
          </Button>
        ) : (
          <Button size="lg" onClick={() => void start()} className="flex-1 sm:flex-none">
            {dict.scan.startCamera}
          </Button>
        )}

        <div className="flex gap-2">
          {torchSupported && (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={torchOn}
              onClick={() => void toggleTorch()}
            >
              {torchOn ? dict.scan.flashOff : dict.scan.flashOn}
            </Button>
          )}
          {status === 'ready' && (
            <Button variant="ghost" size="sm" onClick={switchCamera}>
              <span className="sr-only sm:not-sr-only">{dict.scan.switchCamera}</span>
              <span aria-hidden className="sm:hidden">
                ⇄
              </span>
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_IMAGE_MIME_TYPES.join(',')}
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            stop();
            onCaptured(file);
          }
          e.target.value = '';
        }}
      />

      <Alert tone="neutral">{dict.scan.imagesNotStoredNote}</Alert>
    </div>
  );
}
