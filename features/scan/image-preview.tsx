'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDict } from '@/lib/i18n/client';
import { cn } from '@/utils/cn';
import { containedImageRect, type ContentRect } from '@/utils/image';

/**
 * Preview and crop step.
 *
 * The crop is a simple fractional rectangle dragged over the preview — enough
 * to cut away a cluttered background, which is what actually improves OCR,
 * without a full image editor.
 */
export interface FractionCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const FULL: FractionCrop = { x: 0, y: 0, width: 1, height: 1 };

export function ImagePreview({
  previewUrl,
  onRetake,
  onConfirm,
}: {
  previewUrl: string;
  onRetake: () => void;
  onConfirm: (crop: FractionCrop | null) => void;
}) {
  const dict = useDict();
  const imageRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<FractionCrop>(FULL);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  // Where the picture sits inside the <img> box. Needed by both the pointer
  // maths and the overlay, so that the rectangle the user sees is exactly the
  // rectangle that gets cropped.
  const [content, setContent] = useState<ContentRect | null>(null);

  const measure = useCallback(() => {
    const image = imageRef.current;
    if (!image || !image.naturalWidth) return;
    const rect = image.getBoundingClientRect();
    setContent(
      containedImageRect(
        { width: rect.width, height: rect.height },
        image.naturalWidth,
        image.naturalHeight,
      ),
    );
  }, []);

  // The letterbox changes with the viewport, so a resize invalidates it.
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, previewUrl]);

  // Escape cancels an in-progress drag rather than committing a stray crop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDragStart(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /**
   * Pointer position as a fraction *of the picture*, not of the element.
   * Returns null while the image is unmeasured, so a drag started before load
   * cannot produce a crop against a guessed geometry.
   */
  const pointFrom = (e: React.PointerEvent) => {
    const image = imageRef.current;
    if (!image || !content || content.width <= 0 || content.height <= 0) return null;
    const rect = image.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left - content.left) / content.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top - content.top) / content.height)),
    };
  };

  const isCropped = crop.width < 0.995 || crop.height < 0.995;

  return (
    <div className="space-y-4">
      <div
        className="relative touch-none overflow-hidden rounded-2xl bg-ink-900"
        onPointerDown={(e) => {
          const point = pointFrom(e);
          if (!point) return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setDragStart(point);
          setCrop({ ...point, width: 0, height: 0 });
        }}
        onPointerMove={(e) => {
          if (!dragStart) return;
          const point = pointFrom(e);
          if (!point) return;
          setCrop({
            x: Math.min(dragStart.x, point.x),
            y: Math.min(dragStart.y, point.y),
            width: Math.abs(point.x - dragStart.x),
            height: Math.abs(point.y - dragStart.y),
          });
        }}
        onPointerUp={() => {
          setDragStart(null);
          // Ignore an accidental tap; only a real rectangle counts as a crop.
          if (crop.width < 0.08 || crop.height < 0.08) setCrop(FULL);
        }}
      >
        {/* A blob: URL cannot be optimised by next/image, and the natural size
            is unknown here, so a plain <img> is correct. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={previewUrl}
          alt=""
          onLoad={measure}
          className="block max-h-[60vh] w-full object-contain"
        />

        {isCropped && content && (
          <div
            aria-hidden
            className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]"
            style={{
              left: `${content.left + crop.x * content.width}px`,
              top: `${content.top + crop.y * content.height}px`,
              width: `${crop.width * content.width}px`,
              height: `${crop.height * content.height}px`,
            }}
          />
        )}
      </div>

      <p className={cn('text-center text-xs', isCropped ? 'text-brand-700' : 'text-ink-500')}>
        {dict.scan.cropTitle}
      </p>

      <div className="flex gap-3">
        <Button variant="secondary" fullWidth onClick={onRetake}>
          {dict.scan.retake}
        </Button>
        <Button fullWidth onClick={() => onConfirm(isCropped ? crop : null)}>
          {dict.scan.usePhoto}
        </Button>
      </div>
    </div>
  );
}
