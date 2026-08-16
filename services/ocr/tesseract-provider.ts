import 'server-only';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { OcrProvider, OcrRequest, OcrResult } from './types';

/**
 * Local OCR using tesseract.js. No API key required.
 *
 * Note for operators: on first use tesseract.js downloads its language data
 * (a few MB per language) and caches it on disk. An air-gapped deployment
 * should pre-seed that cache or switch OCR_PROVIDER to a hosted engine.
 */
export class TesseractOcrProvider implements OcrProvider {
  readonly name = 'tesseract';

  isConfigured(): boolean {
    return true;
  }

  async recognise(request: OcrRequest): Promise<OcrResult> {
    const started = Date.now();
    const languages = request.languages?.length ? request.languages : ['eng'];

    try {
      // Imported lazily: the worker pulls in a large WASM bundle that must not
      // be part of the cold-start path for requests that never OCR anything.
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(languages.join('+'));

      try {
        const { data } = await worker.recognize(Buffer.from(request.image));
        const pageConfidence = Math.max(0, Math.min(1, (data.confidence ?? 0) / 100));

        // Per-line confidences live under blocks → paragraphs → lines. They are
        // only present when the engine emitted structured output, so fall back
        // to splitting the plain text at the page confidence.
        const lines: OcrResult['lines'] = [];
        for (const block of data.blocks ?? []) {
          for (const paragraph of block.paragraphs ?? []) {
            for (const line of paragraph.lines ?? []) {
              const text = line.text.trim();
              if (text) {
                lines.push({
                  text,
                  confidence: Math.max(0, Math.min(1, (line.confidence ?? 0) / 100)),
                });
              }
            }
          }
        }

        if (!lines.length && data.text) {
          for (const raw of data.text.split(/\r?\n/)) {
            const text = raw.trim();
            if (text) lines.push({ text, confidence: pageConfidence });
          }
        }

        return {
          text: data.text ?? '',
          confidence: pageConfidence,
          lines,
          provider: this.name,
          durationMs: Date.now() - started,
          languages,
        };
      } finally {
        await worker.terminate();
      }
    } catch (e) {
      logger.error('Tesseract OCR failed', { error: (e as Error).name });
      throw new AppError(ERROR_CODES.OCR_FAILED, {
        cause: e,
        logContext: { provider: this.name, languages },
      });
    }
  }
}
