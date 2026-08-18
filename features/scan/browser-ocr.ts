'use client';

/**
 * Reading the pack, on the device.
 *
 * WHY THIS IS NOT AN API ROUTE
 * ----------------------------
 * OCR used to run inside `/api/scan`. On a serverless platform that does not
 * work: the function has no persistent disk, so tesseract.js re-downloads its
 * ~5 MB language model on every cold start and then races the request timeout
 * to finish. On Vercel the result was a reliable `FUNCTION_INVOCATION_TIMEOUT`
 * rather than a scan.
 *
 * The browser has the two things the function lacks — a cache that survives
 * between scans (IndexedDB) and no request deadline. It also means the photo
 * itself never has to leave the device: only the text read from it is sent,
 * and only so the catalogue can be searched.
 *
 * The server still accepts an image and OCRs it (see `/api/scan`), because a
 * self-hosted deployment with Google Vision configured has neither problem.
 * This is the default path, not the only one.
 */

/** Tesseract language data is fetched per code; keep this to what we ship. */
const DEFAULT_LANGUAGES = ['eng'];

export interface BrowserOcrOutcome {
  /** Raw recognised text, exactly as the engine returned it. Never rewritten. */
  text: string;
  /** 0..1 mean confidence across the page. */
  confidence: number;
  provider: string;
  durationMs: number;
}

export interface BrowserOcrOptions {
  languages?: string[];
  /**
   * 0..1 recognition progress. Called only while text is being recognised —
   * model download reports separately and would otherwise make the bar jump
   * backwards on the first scan.
   */
  onProgress?: (fraction: number) => void;
  /** True once the engine starts fetching its language model. */
  onDownloading?: () => void;
}

/**
 * Run OCR on an image blob in the browser.
 *
 * Throws if the engine cannot start (no WASM support, blocked CDN, offline on
 * the very first scan). The caller is expected to fall back to the server.
 */
export async function recogniseInBrowser(
  image: Blob,
  options: BrowserOcrOptions = {},
): Promise<BrowserOcrOutcome> {
  const started = Date.now();
  const languages = options.languages?.length ? options.languages : DEFAULT_LANGUAGES;

  // Imported lazily so the ~1 MB engine is not in the initial page bundle;
  // most visits never open the scanner.
  const { createWorker } = await import('tesseract.js');

  const worker = await createWorker(languages.join('+'), undefined, {
    logger: (message: { status?: string; progress?: number }) => {
      if (message.status === 'recognizing text' && typeof message.progress === 'number') {
        options.onProgress?.(message.progress);
      } else if (message.status?.startsWith('loading language traineddata')) {
        options.onDownloading?.();
      }
    },
  });

  try {
    const { data } = await worker.recognize(image);
    return {
      text: data.text ?? '',
      confidence: Math.max(0, Math.min(1, (data.confidence ?? 0) / 100)),
      provider: 'tesseract-browser',
      durationMs: Date.now() - started,
    };
  } finally {
    // Frees the WASM heap. Without this a few scans in a row exhaust memory on
    // a low-end phone.
    await worker.terminate();
  }
}
