import 'server-only';
import { env } from '@/config/env';
import { AppError, ERROR_CODES } from '@/lib/errors';

/**
 * Upload validation.
 *
 * A declared MIME type is attacker-controlled, so the real check is the magic
 * bytes. Anything that is not a recognised raster image is rejected before it
 * reaches disk or the OCR engine.
 */

export type DetectedImageType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';

interface Signature {
  type: DetectedImageType;
  test: (bytes: Uint8Array) => boolean;
}

const SIGNATURES: Signature[] = [
  { type: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: 'image/png',
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a,
  },
  {
    type: 'image/webp',
    test: (b) =>
      // "RIFF" .... "WEBP"
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    type: 'image/heic',
    test: (b) => {
      // ISO-BMFF: box size, then "ftyp", then a HEIF-family brand.
      if (!(b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70)) return false;
      const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
      return ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand);
    },
  },
];

/** Formats the OCR pipeline can actually decode. */
const OCR_READABLE: DetectedImageType[] = ['image/jpeg', 'image/png', 'image/webp'];

export function detectImageType(bytes: Uint8Array): DetectedImageType | null {
  if (bytes.length < 16) return null;
  for (const signature of SIGNATURES) {
    if (signature.test(bytes)) return signature.type;
  }
  return null;
}

export interface ValidatedUpload {
  data: Buffer;
  mimeType: DetectedImageType;
  size: number;
}

/**
 * Validate an uploaded file: size ceiling, real image content, and a format the
 * pipeline can decode. Throws an `AppError` the API layer can render safely.
 */
export async function validateImageUpload(file: File): Promise<ValidatedUpload> {
  if (file.size === 0) {
    throw new AppError(ERROR_CODES.UNSUPPORTED_FILE, { logContext: { reason: 'empty file' } });
  }
  if (file.size > env.MAX_UPLOAD_BYTES) {
    throw new AppError(ERROR_CODES.FILE_TOO_LARGE, {
      logContext: { size: file.size, limit: env.MAX_UPLOAD_BYTES },
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Re-check after reading: `File.size` is client-reported for streamed bodies.
  if (buffer.byteLength > env.MAX_UPLOAD_BYTES) {
    throw new AppError(ERROR_CODES.FILE_TOO_LARGE, { logContext: { size: buffer.byteLength } });
  }

  const detected = detectImageType(buffer);
  if (!detected) {
    throw new AppError(ERROR_CODES.UNSUPPORTED_FILE, {
      logContext: { reason: 'no recognised image signature', declared: file.type },
    });
  }

  if (!OCR_READABLE.includes(detected)) {
    throw new AppError(ERROR_CODES.UNSUPPORTED_FILE, {
      logContext: { reason: 'format cannot be decoded by the OCR pipeline', detected },
    });
  }

  // SVG and HTML masquerading as an image are already excluded by the
  // signature check; this catches an embedded script in a malformed container.
  const head = buffer.subarray(0, 512).toString('latin1').toLowerCase();
  if (head.includes('<script') || head.includes('<!doctype html') || head.includes('<svg')) {
    throw new AppError(ERROR_CODES.UNSUPPORTED_FILE, {
      logContext: { reason: 'markup detected inside image container' },
    });
  }

  return { data: buffer, mimeType: detected, size: buffer.byteLength };
}
