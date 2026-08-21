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

// The same predicate the identification pipeline uses to decide whether OCR
// produced anything worth matching. Shared deliberately: the retry below must
// trigger on exactly the condition that would otherwise end the scan.
import { hasUsableText } from '@/services/identification/extract';

/** Tesseract language data is fetched per code; keep this to what we ship. */
const DEFAULT_LANGUAGES = ['eng'];

/**
 * Page segmentation, set explicitly because the default is wrong for us.
 *
 * tesseract.js defaults to SINGLE_BLOCK, which assumes the whole image is one
 * uniform block of text. Medicine packaging is the opposite: the brand name is
 * set far larger than everything else, and SINGLE_BLOCK discards it as an
 * outlier while happily reading the small print around it. Measured on a pack
 * image, SINGLE_BLOCK returned every line *except* "DOLO 650"; AUTO returned
 * all of them.
 *
 * That matters beyond a missing line. The brand is the heaviest matching
 * signal, and the scorer refuses to confirm anything without brand evidence --
 * so losing it turns a clean scan into "we could not identify this".
 *
 * AUTO rather than SPARSE_TEXT because AUTO preserves reading order, which the
 * field extractor depends on: it scores earlier lines as more likely to be the
 * brand. SPARSE_TEXT finds text in no particular order and is kept for the
 * retry, where finding anything at all beats finding it in order.
 */
// The values come from the lazily-imported module, so naming them here would
// mean a static import and a much larger initial bundle. See `recogniseInBrowser`.

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
  const { createWorker, PSM } = await import('tesseract.js');

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
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    let result = await worker.recognize(image);

    // A tightly cropped pack can leave too little for full layout analysis to
    // work with. Retrying in sparse mode reads the same pixels with a more
    // permissive segmentation -- it does not invent text, and the result still
    // has to match a catalogue record like any other.
    if (!hasUsableText(result.data.text ?? '')) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      const retry = await worker.recognize(image);
      if ((retry.data.text ?? '').length > (result.data.text ?? '').length) result = retry;
    }

    return {
      text: result.data.text ?? '',
      confidence: Math.max(0, Math.min(1, (result.data.confidence ?? 0) / 100)),
      provider: 'tesseract-browser',
      durationMs: Date.now() - started,
    };
  } finally {
    // Frees the WASM heap. Without this a few scans in a row exhaust memory on
    // a low-end phone.
    await worker.terminate();
  }
}
