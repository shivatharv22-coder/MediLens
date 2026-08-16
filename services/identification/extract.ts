import { canonicalStrength, flatten, normalise, toLines } from '@/utils/text';
import type { DosageForm } from '@/types/medicine';
import type { ExtractedPackageFields } from '@/types/identification';

/**
 * Turn raw OCR text into candidate packaging fields.
 *
 * This module is deliberately conservative: it prefers `null` to a guess. A
 * wrong extracted brand name is worse than no brand name, because it feeds the
 * matcher. The raw OCR text is never modified — everything here is derived.
 */

/** e.g. "500 mg", "125mg/5ml", "0.5 %", "100 mcg/actuation", "21.8 g" */
const STRENGTH_PATTERN =
  /\b(\d+(?:\.\d+)?)\s*(mg|mcg|µg|ug|g|ml|iu|%)\b(?:\s*\/\s*(\d+(?:\.\d+)?)?\s*(ml|g|actuation|dose|tab|cap)\b)?/gi;

const DOSAGE_FORM_KEYWORDS: { pattern: RegExp; form: DosageForm }[] = [
  { pattern: /\btablets?\b|\btab\b|\bcaplets?\b/i, form: 'TABLET' },
  { pattern: /\bcapsules?\b|\bcaps?\b/i, form: 'CAPSULE' },
  { pattern: /\boral suspension\b|\bsuspension\b/i, form: 'ORAL_SUSPENSION' },
  { pattern: /\boral solution\b|\bsolution\b/i, form: 'ORAL_SOLUTION' },
  { pattern: /\bsyrup\b/i, form: 'SYRUP' },
  { pattern: /\binjection\b|\bvial\b|\bampoule\b/i, form: 'INJECTION' },
  { pattern: /\bcream\b/i, form: 'TOPICAL_CREAM' },
  { pattern: /\bointment\b/i, form: 'TOPICAL_OINTMENT' },
  { pattern: /\bgel\b/i, form: 'TOPICAL_GEL' },
  { pattern: /\beye drops?\b/i, form: 'EYE_DROPS' },
  { pattern: /\bear drops?\b/i, form: 'EAR_DROPS' },
  { pattern: /\bnasal spray\b/i, form: 'NASAL_SPRAY' },
  { pattern: /\binhaler\b|\brotacaps?\b|\bmetered dose\b|\bhfa\b/i, form: 'INHALER' },
  { pattern: /\bpowder\b|\bsachet\b/i, form: 'POWDER' },
  { pattern: /\bgranules\b/i, form: 'GRANULES' },
  { pattern: /\bsuppositor(y|ies)\b/i, form: 'SUPPOSITORY' },
  { pattern: /\bpatch(es)?\b/i, form: 'PATCH' },
];

/** Company suffixes seen on Indian medicine packs. */
const MANUFACTURER_PATTERN =
  /^(.{2,60}?)\s+(pvt\.?\s*ltd\.?|private\s+limited|ltd\.?|limited|inc\.?|pharmaceuticals?(?:\s+(?:pvt\.?\s*)?(?:ltd\.?|limited))?|laboratories(?:\s+(?:pvt\.?\s*)?(?:ltd\.?|limited))?|labs?(?:\s+(?:pvt\.?\s*)?(?:ltd\.?|limited))?|healthcare(?:\s+(?:pvt\.?\s*)?(?:ltd\.?|limited))?|industries(?:\s+(?:pvt\.?\s*)?(?:ltd\.?|limited))?)\s*$/i;

/** Lines that are packaging boilerplate rather than product identity. */
const NOISE_PATTERN =
  /^(mfg|mfd|exp|batch|b\.?no|lot|m\.?r\.?p|rs\.?|price|store|keep|dosage|read|schedule|caution|warning|not to be sold|to be sold|for the use|manufactured|marketed|licence|lic\.?\s*no|gtin|www\.|http|customer care|consumer|net (wt|weight)|contents?)\b/i;

const COMPOSITION_LEAD =
  /(each\s+(?:uncoated|film\s*coated|enteric\s*coated|sugar\s*coated|hard\s*gelatin|soft\s*gelatin)?\s*(?:tablet|capsule|5\s*ml|ml|sachet|actuation|gram|g)\s*contains|composition|contains\s*:|each\s+\d+\s*(?:ml|g|mg)\s+contains)/i;

/** Pharmacopoeia markers that sit next to a generic name. */
const PHARMACOPOEIA = /\b(i\.?p\.?|b\.?p\.?|u\.?s\.?p\.?|ph\.?\s?eur\.?)\b/i;

function collectStrengths(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(STRENGTH_PATTERN)) {
    const [, amount, unit, perAmount, perUnit] = match;
    const normalisedUnit = unit.toLowerCase().replace('µg', 'mcg').replace('ug', 'mcg');
    const label = perUnit
      ? `${amount} ${normalisedUnit}/${perAmount ? `${perAmount} ` : ''}${perUnit.toLowerCase()}`
      : `${amount} ${normalisedUnit}`;
    const key = canonicalStrength(label);
    if (key && !seen.has(key)) {
      seen.add(key);
      found.push(label);
    }
  }
  return found;
}

/** "Each 5 ml contains", "Each 21.8 g sachet contains" — the dosing basis. */
const COMPOSITION_BASIS =
  /each\s+(\d+(?:\.\d+)?)\s*(ml|g|gram|sachet|actuation|dose)\b[^.]*?contains/i;

/** Units that express a dose rather than a pack volume. */
const DOSE_UNITS = new Set(['mg', 'mcg', 'g', 'iu', '%']);

/**
 * Work out the product strength from a composition line.
 *
 * "Each 5 ml contains Paracetamol IP 125 mg" must yield "125 mg/5 ml", not the
 * "5 ml" that appears first in the string. Positional order is the wrong
 * heuristic here, so the dosing basis is parsed explicitly.
 */
function strengthFromComposition(compositionLine: string | null): string | null {
  if (!compositionLine) return null;

  const candidates = collectStrengths(compositionLine);
  // A strength that already carries a denominator is used as-is.
  const explicit = candidates.find((c) => c.includes('/'));
  if (explicit) return explicit;

  const dose = candidates.find((c) => {
    const unit = c.split(/\s+/)[1]?.toLowerCase();
    return unit ? DOSE_UNITS.has(unit) : false;
  });
  if (!dose) return candidates[0] ?? null;

  const basis = compositionLine.match(COMPOSITION_BASIS);
  // Only liquids and measured volumes get a denominator; a tablet's strength is
  // just "500 mg".
  if (basis && ['ml', 'g', 'gram'].includes(basis[2].toLowerCase())) {
    const basisUnit = basis[2].toLowerCase() === 'gram' ? 'g' : basis[2].toLowerCase();
    return `${dose}/${basis[1]} ${basisUnit}`;
  }

  return dose;
}

function detectDosageForm(text: string): string | null {
  for (const { pattern, form } of DOSAGE_FORM_KEYWORDS) {
    if (pattern.test(text)) return form;
  }
  return null;
}

function detectManufacturer(lines: string[]): string | null {
  for (const line of lines) {
    const cleaned = line.replace(/^(mfd\.?\s*by|manufactured\s*by|marketed\s*by)\s*[:\-]?\s*/i, '').trim();
    const match = cleaned.match(MANUFACTURER_PATTERN);
    if (match) return cleaned.replace(/\s+/g, ' ').trim();
  }
  return null;
}

function findCompositionLine(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i += 1) {
    if (COMPOSITION_LEAD.test(lines[i])) {
      // The ingredient list often wraps onto the following line.
      const tail = lines[i + 1] && !NOISE_PATTERN.test(lines[i + 1]) ? ` ${lines[i + 1]}` : '';
      return flatten(`${lines[i]}${tail}`);
    }
  }
  // Fall back to a line that names a pharmacopoeia and a strength.
  for (const line of lines) {
    if (PHARMACOPOEIA.test(line) && new RegExp(STRENGTH_PATTERN.source, 'i').test(line)) {
      return flatten(line);
    }
  }
  return null;
}

/**
 * Pull ingredient names out of a composition line by removing the boilerplate
 * around them. Returns names only — amounts are handled separately.
 */
function extractIngredients(compositionLine: string | null): string[] {
  if (!compositionLine) return [];

  const body = compositionLine.replace(COMPOSITION_LEAD, ' ');
  const parts = body.split(/\s*(?:,|\band\b|\+|;)\s*/i);
  const names: string[] = [];

  for (const part of parts) {
    const cleaned = part
      .replace(new RegExp(STRENGTH_PATTERN.source, 'gi'), ' ')
      .replace(PHARMACOPOEIA, ' ')
      .replace(/\b(equivalent to|eq\.? to|as|anhydrous|trihydrate|dihydrate|hydrochloride salt of|colour|colours?|excipients?|q\.?s\.?)\b/gi, ' ')
      .replace(/[.:•·|]+/g, ' ')
      .replace(/\d+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Ingredient names are words, not fragments. Two characters is noise.
    if (cleaned.length >= 4 && /^[A-Za-z][A-Za-z\s'-]+$/.test(cleaned)) {
      names.push(cleaned.replace(/\s+/g, ' ').trim());
    }
  }

  return [...new Set(names)].slice(0, 6);
}

/**
 * The brand name is normally the visually dominant line: short, near the top,
 * often upper-case, and not boilerplate. We only accept a candidate that looks
 * like a name — otherwise we return null and let the matcher work from the
 * generic name and strength.
 */
function detectBrandName(lines: string[]): string | null {
  const candidates = lines.slice(0, 8).filter((line) => {
    if (NOISE_PATTERN.test(line)) return false;
    if (COMPOSITION_LEAD.test(line)) return false;
    if (MANUFACTURER_PATTERN.test(line)) return false;
    const words = line.trim().split(/\s+/);
    if (words.length > 5) return false;
    const letters = line.replace(/[^A-Za-z]/g, '');
    return letters.length >= 3;
  });

  if (!candidates.length) return null;

  const scored = candidates.map((line, index) => {
    const trimmed = line.trim();
    const letters = trimmed.replace(/[^A-Za-z]/g, '');
    const upperRatio = letters ? letters.replace(/[^A-Z]/g, '').length / letters.length : 0;
    let score = 0;
    score += Math.max(0, 1 - index * 0.15); // earlier lines are more likely
    score += upperRatio * 0.6; // brand names are often set in caps
    if (/\d/.test(trimmed)) score += 0.25; // "Dolo 650", "Pan 40"
    if (trimmed.split(/\s+/).length <= 3) score += 0.2;
    return { line: trimmed, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.line.replace(/\s+/g, ' ') ?? null;
}

/**
 * The generic name is the first plausible ingredient from the composition, or
 * a pharmacopoeia-marked word elsewhere on the pack.
 */
function detectGenericName(lines: string[], ingredients: string[]): string | null {
  if (ingredients.length) return ingredients[0];

  for (const line of lines) {
    const match = line.match(/([A-Za-z][A-Za-z\s'-]{4,40}?)\s+(?:i\.?p\.?|b\.?p\.?|u\.?s\.?p\.?)\b/i);
    if (match) {
      const name = match[1].replace(/\s+/g, ' ').trim();
      if (name.length >= 4 && !NOISE_PATTERN.test(name)) return name;
    }
  }
  return null;
}

/** EAN-13 / UPC-A digit runs. Presence is a hint; verification happens later. */
function detectBarcode(text: string): string | null {
  const match = text.match(/\b(\d{12,13})\b/);
  return match ? match[1] : null;
}

export function extractPackageFields(rawOcrText: string): ExtractedPackageFields {
  const lines = toLines(rawOcrText);
  const flat = flatten(rawOcrText);

  const compositionLine = findCompositionLine(lines);
  const ingredientCandidates = extractIngredients(compositionLine);
  const strengthCandidates = collectStrengths(flat);
  const brandName = detectBrandName(lines);
  const genericName = detectGenericName(lines, ingredientCandidates);

  // Prefer the composition line: the front of a pack also prints pack counts
  // and bottle volumes, which are not the medicine's strength.
  const strength =
    strengthFromComposition(compositionLine) ??
    strengthCandidates.find((c) => {
      const unit = c.split(/\s+/)[1]?.toLowerCase();
      return unit ? DOSE_UNITS.has(unit) : false;
    }) ??
    strengthCandidates[0] ??
    null;

  return {
    brandName,
    genericName,
    strength,
    dosageForm: detectDosageForm(flat),
    manufacturer: detectManufacturer(lines),
    compositionLine,
    strengthCandidates,
    ingredientCandidates,
    barcode: detectBarcode(flat),
  };
}

/** True when the OCR output has too little signal to attempt matching at all. */
export function hasUsableText(rawOcrText: string): boolean {
  const letters = normalise(rawOcrText).replace(/[^a-z]/g, '');
  return letters.length >= 6;
}

export const __testables = {
  collectStrengths,
  detectBrandName,
  detectDosageForm,
  detectManufacturer,
  extractIngredients,
  findCompositionLine,
  strengthFromComposition,
};
