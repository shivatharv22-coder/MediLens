import 'server-only';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { GoogleVisionOcrProvider } from './google-vision-provider';
import { MockOcrProvider } from './mock-provider';
import { TesseractOcrProvider } from './tesseract-provider';
import type { OcrProvider } from './types';

let cached: OcrProvider | null = null;

export function getOcrProvider(): OcrProvider {
  if (cached) return cached;

  switch (env.OCR_PROVIDER) {
    case 'google': {
      const google = new GoogleVisionOcrProvider();
      if (google.isConfigured()) {
        cached = google;
      } else {
        logger.warn('OCR_PROVIDER=google but no API key — falling back to tesseract');
        cached = new TesseractOcrProvider();
      }
      break;
    }
    case 'mock':
      cached = new MockOcrProvider();
      break;
    default:
      cached = new TesseractOcrProvider();
  }

  return cached;
}

/** Test helper. */
export function __setOcrProvider(provider: OcrProvider | null) {
  cached = provider;
}

export { GoogleVisionOcrProvider, MockOcrProvider, TesseractOcrProvider };
export * from './types';
