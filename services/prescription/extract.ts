import { toLines } from '@/utils/text';
import type { OcrResult } from '@/services/ocr/types';

/**
 * Prescription text extraction.
 *
 * This is an INFORMATION EXTRACTION feature only (see docs/SAFETY.md §9).
 * Rules encoded here:
 *  - `rawText` is copied verbatim and never corrected or normalised;
 *  - a medicine name is only separated out when the line is legible enough;
 *  - frequency text is copied as written — "1-0-1 x 5 days" is never expanded
 *    into an instruction;
 *  - nothing is interpreted, scored for appropriateness, or recommended.
 */

export interface ExtractedPrescriptionLine {
  lineNumber: number;
  /** Exactly as OCR read it. */
  rawText: string;
  detectedName: string | null;
  detectedStrength: string | null;
  /** Copied verbatim from the line. Never normalised into a schedule. */
  detectedFrequency: string | null;
  confidence: number;
  needsVerification: boolean;
}

export interface PrescriptionExtraction {
  lines: ExtractedPrescriptionLine[];
  /** False when the page as a whole is too unreliable to show line breakdowns. */
  isLegible: boolean;
  rawText: string;
  overallConfidence: number;
}

/** Below this, we will not attempt to separate a medicine name from a line. */
const LINE_CONFIDENCE_FLOOR = 0.7;
/** Below this for the page, we show only the raw text and a "cannot read" notice. */
const PAGE_LEGIBILITY_FLOOR = 0.45;

const STRENGTH_PATTERN = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml|iu|%)\b(?:\s*\/\s*\d*\s*(?:ml|g)\b)?/i;

/** Frequency notations commonly written on Indian prescriptions. */
const FREQUENCY_PATTERNS: RegExp[] = [
  /\b\d\s*-\s*\d\s*-\s*\d(?:\s*-\s*\d)?\b(?:\s*(?:x|for)\s*\d+\s*(?:days?|weeks?|months?))?/i,
  /\b(?:od|bd|bid|tds|tid|qid|hs|sos|stat|prn|q\d+h)\b(?:\s*(?:x|for)\s*\d+\s*(?:days?|weeks?|months?))?/i,
  /\b\d+\s*(?:times?|tabs?|capsules?)\s*(?:a|per)?\s*day\b(?:\s*(?:x|for)\s*\d+\s*(?:days?|weeks?))?/i,
  /\b(?:once|twice|thrice)\s*(?:a|per)?\s*day\b(?:\s*(?:x|for)\s*\d+\s*(?:days?|weeks?))?/i,
];

/** Header / footer text that is not a medicine line. */
const NON_MEDICINE_LINE =
  /^(dr\.?\s|clinic|hospital|reg\.?\s*no|regd|patient|name\s*:|age\s*:|sex\s*:|date\s*:|address|phone|mobile|diagnosis|advice|follow\s*up|review|signature|consultant|m\.?b\.?b\.?s|m\.?d\b|timings?)/i;

/** Prescription line markers: "1.", "1)", "Tab.", "Cap.", "Syp.", "R/", "Rx". */
const LINE_MARKER = /^\s*(?:\d+\s*[.)-]|r\s*\/|rx|tab\.?|cap\.?|syp\.?|syr\.?|inj\.?|oint\.?|drop?s?\.?)\s*/i;

/**
 * Administration instructions that follow a medicine name. They are part of the
 * prescription and stay in `rawText`; they are only trimmed off the *derived*
 * name so that "look this up" searches for a medicine, not for a sentence.
 */
const INSTRUCTION_TAIL =
  /\b(before|after|with|without)\s+(food|meals?|meal|breakfast|lunch|dinner)\b.*$|\b(empty\s+stomach|at\s+night|bedtime|as\s+needed|if\s+required|with\s+water|orally|locally|externally)\b.*$/i;

/** Strip stacked markers: "1. Tab. Dolo" needs two passes, not one. */
function stripMarkers(value: string): string {
  let text = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = text.replace(LINE_MARKER, ' ');
    if (next === text) break;
    text = next;
  }
  return text;
}

function detectFrequency(line: string): string | null {
  for (const pattern of FREQUENCY_PATTERNS) {
    const match = line.match(pattern);
    // Return the matched substring untouched — no expansion, no reformatting.
    if (match) return match[0].trim();
  }
  return null;
}

function detectStrength(line: string): string | null {
  const match = line.match(STRENGTH_PATTERN);
  return match ? match[0].trim() : null;
}

/**
 * Isolate a probable medicine name: the text after any list marker, with the
 * strength and frequency removed. Returns null whenever the remainder does not
 * clearly look like a name — MediLens never guesses a handwritten name.
 */
function detectName(line: string): string | null {
  let text = stripMarkers(line);
  const strength = detectStrength(text);
  if (strength) text = text.replace(strength, ' ');
  const frequency = detectFrequency(text);
  if (frequency) text = text.replace(frequency, ' ');
  text = text.replace(INSTRUCTION_TAIL, ' ');

  text = text
    .replace(/[.:•·|,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length < 3 || text.length > 60) return null;
  // Must be mostly letters; a smear of digits and symbols is not a name.
  const letters = text.replace(/[^A-Za-z]/g, '').length;
  if (letters / text.length < 0.7) return null;
  if (NON_MEDICINE_LINE.test(text)) return null;

  return text;
}

export function extractPrescription(ocr: OcrResult): PrescriptionExtraction {
  const rawText = ocr.text;
  const isLegible = ocr.confidence >= PAGE_LEGIBILITY_FLOOR;

  if (!isLegible) {
    return { lines: [], isLegible: false, rawText, overallConfidence: ocr.confidence };
  }

  // Prefer per-line confidences from the engine; fall back to splitting text.
  const sourceLines = ocr.lines.length
    ? ocr.lines
    : toLines(rawText).map((text) => ({ text, confidence: ocr.confidence }));

  const lines: ExtractedPrescriptionLine[] = [];
  let lineNumber = 0;

  for (const source of sourceLines) {
    const text = source.text.trim();
    if (!text) continue;
    if (NON_MEDICINE_LINE.test(text)) continue;

    lineNumber += 1;
    const legibleEnough = source.confidence >= LINE_CONFIDENCE_FLOOR;

    const detectedStrength = detectStrength(text);
    const detectedFrequency = detectFrequency(text);
    const detectedName = legibleEnough ? detectName(text) : null;

    // A *legible* line with no medicine-ish signal is page furniture and is
    // dropped. A line we could not read is kept and flagged: silently hiding it
    // could hide a medicine from the reader, which is the worse failure.
    const hasSignal = Boolean(detectedName || detectedStrength || detectedFrequency) || LINE_MARKER.test(text);
    if (legibleEnough && !hasSignal) {
      lineNumber -= 1;
      continue;
    }

    lines.push({
      lineNumber,
      rawText: text,
      detectedName,
      detectedStrength,
      detectedFrequency,
      confidence: Number(source.confidence.toFixed(3)),
      // Everything on a prescription is presented as needing verification
      // unless it was read cleanly AND split cleanly.
      needsVerification: !legibleEnough || !detectedName,
    });
  }

  return { lines, isLegible: true, rawText, overallConfidence: ocr.confidence };
}

export const __testables = { detectFrequency, detectName, detectStrength, stripMarkers };
export { LINE_CONFIDENCE_FLOOR, PAGE_LEGIBILITY_FLOOR };
