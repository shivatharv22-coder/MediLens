/**
 * OCR provider abstraction.
 *
 * The rest of the application only ever sees `OcrResult`. Nothing downstream
 * knows or cares which engine produced it, and `text` is preserved verbatim —
 * interpretation happens later, in the extraction step.
 */

export interface OcrLine {
  text: string;
  /** 0..1 */
  confidence: number;
}

export interface OcrResult {
  /** Raw recognised text, exactly as the engine returned it. Never rewritten. */
  text: string;
  /** 0..1 mean confidence across the page. */
  confidence: number;
  lines: OcrLine[];
  provider: string;
  durationMs: number;
  /** Language hints actually used, e.g. ["eng"]. */
  languages: string[];
}

export interface OcrRequest {
  image: Buffer | Uint8Array;
  mimeType: string;
  /** Tesseract-style language codes, e.g. ["eng", "hin"]. */
  languages?: string[];
}

export interface OcrProvider {
  readonly name: string;
  /** False when the provider needs credentials it does not have. */
  isConfigured(): boolean;
  recognise(request: OcrRequest): Promise<OcrResult>;
}
