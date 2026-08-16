import type { MedicineSummary } from './medicine';

export const CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW', 'NOT_IDENTIFIED'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/** Named matching strategies. Recorded so a result can always be explained. */
export const MATCH_SIGNALS = [
  'BARCODE_EXACT',
  'BRAND_EXACT',
  'BRAND_FUZZY',
  'GENERIC_EXACT',
  'GENERIC_FUZZY',
  'INGREDIENT',
  'STRENGTH',
  'DOSAGE_FORM',
  'MANUFACTURER',
] as const;
export type MatchSignal = (typeof MATCH_SIGNALS)[number];

/**
 * Values read off the packaging. These are *claims about the image*, never
 * facts about a medicine — they stay separate from the database record all the
 * way to the UI.
 */
export interface ExtractedPackageFields {
  brandName: string | null;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  manufacturer: string | null;
  compositionLine: string | null;
  /** Every strength-looking token found, e.g. ["500 mg", "125 mg/5 ml"]. */
  strengthCandidates: string[];
  /** Ingredient-looking tokens found in the composition area. */
  ingredientCandidates: string[];
  barcode: string | null;
}

export interface MatchCandidate {
  medicine: MedicineSummary;
  score: number;
  signals: MatchSignal[];
}

export interface IdentificationResult {
  confidenceLevel: ConfidenceLevel;
  /** 0..1. The top candidate's score, or 0 when nothing matched. */
  confidenceScore: number;
  /** Only populated at HIGH confidence. Anything else must stay unconfirmed. */
  confirmedMedicineId: string | null;
  candidates: MatchCandidate[];
  extracted: ExtractedPackageFields;
  /** Stable code the UI maps to a translated message. */
  messageCode:
    | 'IDENTIFIED'
    | 'MULTIPLE_MATCHES'
    | 'LOW_CONFIDENCE'
    | 'NOT_IDENTIFIED'
    | 'NO_TEXT_DETECTED';
}
