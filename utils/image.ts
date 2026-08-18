import { CLIENT_IMAGE_JPEG_QUALITY, CLIENT_IMAGE_MAX_EDGE } from '@/config/app';

/**
 * Client-side image preparation.
 *
 * Downscaling before upload is the single biggest win for the scanner on a
 * mobile network: a 12 MP camera photo is ~4 MB, and the OCR engine gains
 * nothing above roughly 1600 px on the long edge.
 */

async function loadBitmap(source: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    // `imageOrientation` is pinned rather than left to the default, which has
    // differed between engines. An <img> always applies EXIF orientation, so a
    // bitmap that ignored it would be rotated relative to the preview the user
    // cropped against -- and the crop would be applied to the wrong pixels.
    return createImageBitmap(source, { imageOrientation: 'from-image' });
  }
  // Safari fallback.
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return image;
  } finally {
    // The bitmap has been decoded into the element; the URL is no longer needed.
    URL.revokeObjectURL(url);
  }
}

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  previewUrl: string;
}

export async function prepareImage(
  source: Blob,
  options: { maxEdge?: number; quality?: number; crop?: CropRect | null } = {},
): Promise<PreparedImage> {
  const maxEdge = options.maxEdge ?? CLIENT_IMAGE_MAX_EDGE;
  const quality = options.quality ?? CLIENT_IMAGE_JPEG_QUALITY;

  const bitmap = await loadBitmap(source);
  const sourceWidth = 'width' in bitmap ? bitmap.width : 0;
  const sourceHeight = 'height' in bitmap ? bitmap.height : 0;

  const crop = options.crop ?? { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
  const scale = Math.min(1, maxEdge / Math.max(crop.width, crop.height));
  const targetWidth = Math.max(1, Math.round(crop.width * scale));
  const targetHeight = Math.max(1, Math.round(crop.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    bitmap as CanvasImageSource,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob) throw new Error('Could not encode the image');

  return {
    blob,
    width: targetWidth,
    height: targetHeight,
    previewUrl: URL.createObjectURL(blob),
  };
}

export interface ContentRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where an `object-contain` image actually sits inside its element box.
 *
 * An element showing a contained image is not the image: when the two aspect
 * ratios differ the image is centred and letterboxed, and the bars belong to
 * the element, not the picture. A pointer position measured against the
 * element therefore does not describe the same point on the image.
 *
 * This matters because a crop drawn on the preview is later applied to the
 * full-resolution pixels. Measuring against the element makes the overlay and
 * the pixels that actually get cropped disagree -- silently, because the
 * overlay still lands under the user's finger.
 */
export function containedImageRect(
  element: { width: number; height: number },
  naturalWidth: number,
  naturalHeight: number,
): ContentRect {
  // Before an image has loaded its natural size is 0. Treating the whole
  // element as the content area keeps the maths defined; callers gate on the
  // image being loaded before trusting a crop.
  if (!naturalWidth || !naturalHeight || element.width <= 0 || element.height <= 0) {
    return { left: 0, top: 0, width: Math.max(0, element.width), height: Math.max(0, element.height) };
  }

  const scale = Math.min(element.width / naturalWidth, element.height / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;

  return {
    left: (element.width - width) / 2,
    top: (element.height - height) / 2,
    width,
    height,
  };
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Convert a fractional crop (0..1) into pixel coordinates. */
export function toPixelCrop(
  fraction: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number,
): CropRect {
  return {
    x: Math.round(fraction.x * imageWidth),
    y: Math.round(fraction.y * imageHeight),
    width: Math.round(fraction.width * imageWidth),
    height: Math.round(fraction.height * imageHeight),
  };
}
