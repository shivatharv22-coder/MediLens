import 'server-only';
import { env } from '@/config/env';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { OcrProvider, OcrRequest, OcrResult } from './types';

/**
 * Google Cloud Vision `DOCUMENT_TEXT_DETECTION`.
 *
 * REQUIRES CREDENTIALS: set OCR_PROVIDER=google and GOOGLE_VISION_API_KEY.
 * Without a key `isConfigured()` returns false and the factory falls back to
 * the local engine rather than silently failing at request time.
 */
export class GoogleVisionOcrProvider implements OcrProvider {
  readonly name = 'google-vision';

  isConfigured(): boolean {
    return env.GOOGLE_VISION_API_KEY.trim().length > 0;
  }

  async recognise(request: OcrRequest): Promise<OcrResult> {
    if (!this.isConfigured()) {
      throw new AppError(ERROR_CODES.FEATURE_DISABLED, {
        logContext: { provider: this.name, reason: 'GOOGLE_VISION_API_KEY is empty' },
      });
    }

    const started = Date.now();
    const languages = request.languages?.length ? request.languages : ['en'];

    try {
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(env.GOOGLE_VISION_API_KEY)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            requests: [
              {
                image: { content: Buffer.from(request.image).toString('base64') },
                features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
                imageContext: { languageHints: languages },
              },
            ],
          }),
          signal: AbortSignal.timeout(20_000),
        },
      );

      if (!response.ok) {
        throw new Error(`Vision API responded ${response.status}`);
      }

      const body = (await response.json()) as {
        responses?: {
          fullTextAnnotation?: { text?: string; pages?: { confidence?: number }[] };
          error?: { message?: string };
        }[];
      };

      const first = body.responses?.[0];
      if (first?.error) throw new Error(first.error.message ?? 'Vision API error');

      const text = first?.fullTextAnnotation?.text ?? '';
      const confidence = first?.fullTextAnnotation?.pages?.[0]?.confidence ?? (text ? 0.9 : 0);

      return {
        text,
        confidence: Math.max(0, Math.min(1, confidence)),
        lines: text
          .split(/\r?\n/)
          .map((line) => ({ text: line.trim(), confidence }))
          .filter((l) => l.text.length > 0),
        provider: this.name,
        durationMs: Date.now() - started,
        languages,
      };
    } catch (e) {
      logger.error('Google Vision OCR failed', { error: (e as Error).name });
      throw new AppError(ERROR_CODES.OCR_FAILED, { cause: e, logContext: { provider: this.name } });
    }
  }
}
