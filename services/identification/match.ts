import { CONFIDENCE_THRESHOLDS, MIN_LEAD_OVER_RUNNER_UP } from '@/config/app';
import { canonicalStrength, normalise, similarity } from '@/utils/text';
import type { MedicineMatchRecord } from '@/types/medicine';
import type {
  ConfidenceLevel,
  ExtractedPackageFields,
  IdentificationResult,
  MatchCandidate,
  MatchSignal,
} from '@/types/identification';
import { toSummary } from '@/services/medicine/repository';

/**
 * Medicine matching and confidence scoring.
 *
 * Safety contract enforced here, not in the UI:
 *  - a medicine is only ever "confirmed" at HIGH confidence AND with a clear
 *    lead over the runner-up;
 *  - a mismatched strength or dosage form caps the score below HIGH, because
 *    "Dolo 650" and "Dolo 500" are different products;
 *  - when two candidates are close, the result is MULTIPLE_MATCHES and the user
 *    is asked to check the pack.
 */

/** Weights sum to 1.0 when every signal is available. */
const WEIGHTS = {
  brand: 0.45,
  generic: 0.2,
  strength: 0.2,
  form: 0.1,
  manufacturer: 0.05,
} as const;

interface FieldOutcome {
  score: number;
  signal: MatchSignal | null;
  /** True when the pack and the record actively disagree, not merely lack data. */
  contradicts: boolean;
}

/**
 * `needle` occurs in `haystack` delimited by spaces or string ends.
 *
 * Both inputs are expected to be `normalise`d, which collapses everything
 * except alphanumerics to single spaces.
 */
function containsWholeWords(haystack: string, needle: string): boolean {
  if (!needle || needle.length > haystack.length) return false;

  for (let from = 0; ; ) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return false;
    const startsWord = at === 0 || haystack[at - 1] === ' ';
    const end = at + needle.length;
    const endsWord = end === haystack.length || haystack[end] === ' ';
    if (startsWord && endsWord) return true;
    from = at + 1;
  }
}

function matchBrand(extracted: string | null, medicine: MedicineMatchRecord): FieldOutcome {
  if (!extracted) return { score: 0, signal: null, contradicts: false };

  const packBrand = normalise(extracted);
  const recordBrand = normalise(medicine.brandName);
  if (!packBrand || !recordBrand) return { score: 0, signal: null, contradicts: false };

  // When the "brand" we read is really the generic/composition line — which
  // happens whenever OCR drops the large brand text — treat it as no evidence
  // rather than as a contradiction. Otherwise a perfectly good match on
  // ingredient, strength, form and manufacturer gets penalised for an
  // extraction slip.
  const recordGeneric = normalise(medicine.genericName);
  if (recordGeneric && packBrand.includes(recordGeneric)) {
    return { score: 0, signal: null, contradicts: false };
  }

  if (packBrand === recordBrand) return { score: 1, signal: 'BRAND_EXACT', contradicts: false };

  // "Dolo 650" vs "Dolo": the pack often repeats the strength in the brand.
  const packWord = packBrand.replace(/\s*\d+.*$/, '').trim();
  const recordWord = recordBrand.replace(/\s*\d+.*$/, '').trim();
  if (packWord && packWord === recordWord) {
    return { score: 0.92, signal: 'BRAND_EXACT', contradicts: false };
  }

  // Whole words only. A plain `includes` makes "Aeldolo 650mg" a fuzzy match
  // for "Dolo 650", and in a catalogue of a quarter of a million Indian brands
  // that collision is the rule rather than the exception — dozens of unrelated
  // products embed a shorter brand name inside their own.
  if (containsWholeWords(recordBrand, packBrand) || containsWholeWords(packBrand, recordBrand)) {
    return { score: 0.85, signal: 'BRAND_FUZZY', contradicts: false };
  }

  const fuzzy = Math.max(similarity(packBrand, recordBrand), similarity(packWord, recordWord));
  if (fuzzy >= 0.8) return { score: fuzzy, signal: 'BRAND_FUZZY', contradicts: false };
  if (fuzzy >= 0.6) return { score: fuzzy * 0.5, signal: 'BRAND_FUZZY', contradicts: false };

  // A confidently-read but clearly different brand is evidence against.
  return { score: 0, signal: null, contradicts: true };
}

function matchGeneric(
  extracted: ExtractedPackageFields,
  medicine: MedicineMatchRecord,
): FieldOutcome {
  const packNames = [extracted.genericName, ...extracted.ingredientCandidates]
    .filter((v): v is string => !!v)
    .map(normalise);
  if (!packNames.length) return { score: 0, signal: null, contradicts: false };

  const recordNames = [medicine.genericName, ...medicine.ingredients.map((i) => i.name)].map(normalise);

  let best = 0;
  let signal: MatchSignal | null = null;
  for (const pack of packNames) {
    for (const record of recordNames) {
      if (!pack || !record) continue;
      if (pack === record) {
        return { score: 1, signal: 'GENERIC_EXACT', contradicts: false };
      }
      if (record.includes(pack) || pack.includes(record)) {
        if (0.9 > best) {
          best = 0.9;
          signal = 'INGREDIENT';
        }
        continue;
      }
      const fuzzy = similarity(pack, record);
      if (fuzzy >= 0.82 && fuzzy > best) {
        best = fuzzy;
        signal = 'GENERIC_FUZZY';
      }
    }
  }

  if (best === 0) return { score: 0, signal: null, contradicts: true };
  return { score: best, signal, contradicts: false };
}

function matchStrength(extracted: ExtractedPackageFields, medicine: MedicineMatchRecord): FieldOutcome {
  const recordStrength = canonicalStrength(medicine.strength);
  if (!recordStrength) return { score: 0, signal: null, contradicts: false };

  const packStrengths = [extracted.strength, ...extracted.strengthCandidates]
    .filter((v): v is string => !!v)
    .map(canonicalStrength)
    .filter(Boolean);

  if (!packStrengths.length) return { score: 0, signal: null, contradicts: false };

  if (packStrengths.includes(recordStrength)) {
    return { score: 1, signal: 'STRENGTH', contradicts: false };
  }

  // The pack showed strengths and none is this record's — an active mismatch.
  return { score: 0, signal: null, contradicts: true };
}

function matchForm(extracted: ExtractedPackageFields, medicine: MedicineMatchRecord): FieldOutcome {
  if (!extracted.dosageForm) return { score: 0, signal: null, contradicts: false };
  if (extracted.dosageForm === medicine.dosageForm) {
    return { score: 1, signal: 'DOSAGE_FORM', contradicts: false };
  }
  // Liquid forms are frequently printed interchangeably; treat as neutral.
  const liquids = new Set(['ORAL_SUSPENSION', 'ORAL_SOLUTION', 'SYRUP']);
  if (liquids.has(extracted.dosageForm) && liquids.has(medicine.dosageForm)) {
    return { score: 0.7, signal: 'DOSAGE_FORM', contradicts: false };
  }
  return { score: 0, signal: null, contradicts: true };
}

function matchManufacturer(extracted: ExtractedPackageFields, medicine: MedicineMatchRecord): FieldOutcome {
  if (!extracted.manufacturer || !medicine.manufacturer) {
    return { score: 0, signal: null, contradicts: false };
  }
  const pack = normalise(extracted.manufacturer);
  const record = normalise(medicine.manufacturer);
  if (pack === record || record.includes(pack) || pack.includes(record)) {
    return { score: 1, signal: 'MANUFACTURER', contradicts: false };
  }
  const fuzzy = similarity(pack, record);
  if (fuzzy >= 0.75) return { score: fuzzy, signal: 'MANUFACTURER', contradicts: false };
  return { score: 0, signal: null, contradicts: false };
}

export function scoreMedicine(
  extracted: ExtractedPackageFields,
  medicine: MedicineMatchRecord,
): { score: number; signals: MatchSignal[] } {
  const outcomes = {
    brand: matchBrand(extracted.brandName, medicine),
    generic: matchGeneric(extracted, medicine),
    strength: matchStrength(extracted, medicine),
    form: matchForm(extracted, medicine),
    manufacturer: matchManufacturer(extracted, medicine),
  };

  // Normalise over the signals we actually had evidence for, so a pack where
  // the manufacturer was unreadable is not penalised for it.
  let weighted = 0;
  let available = 0;
  const signals: MatchSignal[] = [];

  for (const [key, outcome] of Object.entries(outcomes) as [keyof typeof WEIGHTS, FieldOutcome][]) {
    const weight = WEIGHTS[key];
    const hadEvidence = outcome.score > 0 || outcome.contradicts;
    if (!hadEvidence) continue;
    available += weight;
    weighted += weight * outcome.score;
    if (outcome.signal) signals.push(outcome.signal);
  }

  if (available === 0) return { score: 0, signals: [] };
  let score = weighted / available;

  // Hard caps. A product is defined by its strength and form as much as by its
  // name, so a contradiction there must never reach HIGH confidence.
  if (outcomes.strength.contradicts) score = Math.min(score, 0.55);
  if (outcomes.form.contradicts) score = Math.min(score, 0.6);
  if (outcomes.brand.contradicts && outcomes.generic.score < 1) score = Math.min(score, 0.5);
  // Nothing identifies a product on manufacturer alone.
  if (!outcomes.brand.score && !outcomes.generic.score) score = Math.min(score, 0.25);
  // Without any brand evidence the product cannot be *confirmed*, however well
  // everything else lines up — the user is asked to check the pack instead.
  if (!outcomes.brand.score) score = Math.min(score, CONFIDENCE_THRESHOLDS.high - 0.01);

  return { score: Math.max(0, Math.min(1, score)), signals };
}

function levelFor(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_THRESHOLDS.high) return 'HIGH';
  if (score >= CONFIDENCE_THRESHOLDS.medium) return 'MEDIUM';
  if (score >= CONFIDENCE_THRESHOLDS.low) return 'LOW';
  return 'NOT_IDENTIFIED';
}

export interface IdentifyOptions {
  /** Barcode read from the pack, already verified to exist in the catalogue. */
  barcodeMatches?: MedicineMatchRecord[];
  maxCandidates?: number;
}

export function identify(
  extracted: ExtractedPackageFields,
  catalogue: MedicineMatchRecord[],
  options: IdentifyOptions = {},
): IdentificationResult {
  const maxCandidates = options.maxCandidates ?? 5;

  const scored: MatchCandidate[] = catalogue
    .map((medicine) => {
      const { score, signals } = scoreMedicine(extracted, medicine);
      return { medicine: toSummary(medicine), score, signals };
    })
    .filter((c) => c.score >= CONFIDENCE_THRESHOLDS.low)
    .sort((a, b) => b.score - a.score);

  // A barcode hit is a strong hint, but §46: it still has to agree with the
  // record. We promote it only when the text-based score also supports it.
  if (options.barcodeMatches?.length) {
    for (const medicine of options.barcodeMatches) {
      const existing = scored.find((c) => c.medicine.id === medicine.id);
      if (existing) {
        existing.score = Math.min(1, existing.score + 0.1);
        if (!existing.signals.includes('BARCODE_EXACT')) existing.signals.push('BARCODE_EXACT');
      } else {
        const { score, signals } = scoreMedicine(extracted, medicine);
        scored.push({
          medicine: toSummary(medicine),
          // Barcode alone caps at MEDIUM: the pack text did not corroborate it.
          score: Math.max(score, CONFIDENCE_THRESHOLDS.medium),
          signals: [...signals, 'BARCODE_EXACT'],
        });
      }
    }
    scored.sort((a, b) => b.score - a.score);
  }

  const candidates = scored.slice(0, maxCandidates);
  const top = candidates[0];
  const runnerUp = candidates[1];

  if (!top) {
    return {
      confidenceLevel: 'NOT_IDENTIFIED',
      confidenceScore: 0,
      confirmedMedicineId: null,
      candidates: [],
      extracted,
      messageCode: 'NOT_IDENTIFIED',
    };
  }

  const lead = runnerUp ? top.score - runnerUp.score : 1;
  let level = levelFor(top.score);

  // Two plausible products that look alike must not resolve silently.
  const ambiguous = !!runnerUp && lead < MIN_LEAD_OVER_RUNNER_UP;
  if (ambiguous && level === 'HIGH') level = 'MEDIUM';

  const confirmed = level === 'HIGH' && !ambiguous;

  let messageCode: IdentificationResult['messageCode'];
  if (confirmed) messageCode = 'IDENTIFIED';
  else if (ambiguous || (candidates.length > 1 && level === 'MEDIUM')) messageCode = 'MULTIPLE_MATCHES';
  else if (level === 'NOT_IDENTIFIED') messageCode = 'NOT_IDENTIFIED';
  else messageCode = 'LOW_CONFIDENCE';

  return {
    confidenceLevel: level,
    confidenceScore: Number(top.score.toFixed(4)),
    confirmedMedicineId: confirmed ? top.medicine.id : null,
    candidates,
    extracted,
    messageCode,
  };
}

export const __testables = {
  containsWholeWords,
  matchBrand,
  matchGeneric,
  matchStrength,
  matchForm,
  matchManufacturer,
  levelFor,
};
