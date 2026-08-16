/**
 * Text normalisation and similarity helpers used by search and by the
 * identification matcher. Pure functions, no I/O — heavily unit tested.
 */

/** Lower-case, strip accents, collapse whitespace and punctuation to spaces. */
export function normalise(value: string): string {
  return value
    .normalize('NFKD')
    // Strip Latin combining diacritics only; Devanagari matras must survive.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Keep Latin alphanumerics, the Devanagari block, and the few punctuation
    // marks that carry meaning in a strength ("125 mg/5 ml", "0.5%").
    .replace(/[^a-z0-9ऀ-ॿ/.%\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(value: string): string {
  return normalise(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Levenshtein distance with an early-exit ceiling. */
export function levenshtein(a: string, b: string, max = 8): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** 0..1 similarity between two already-normalised strings. */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const longer = Math.max(a.length, b.length);
  const distance = levenshtein(a, b, Math.ceil(longer / 2));
  if (distance > longer) return 0;
  return 1 - distance / longer;
}

/**
 * Strength comparison that survives formatting differences:
 * "500mg", "500 MG", "500 mg" all compare equal, and "125mg/5ml" matches
 * "125 mg/5 ml".
 */
export function canonicalStrength(value: string | null | undefined): string {
  if (!value) return '';
  return normalise(value)
    .replace(/\s*\/\s*/g, '/')
    .replace(/(\d)\s+(mg|mcg|g|ml|iu|%)/g, '$1$2')
    .replace(/\s+/g, '')
    .replace(/microgram(s)?/g, 'mcg')
    .replace(/milligram(s)?/g, 'mg');
}

/** Split a free-text blob into trimmed, non-empty lines. */
export function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Collapse a multi-line blob to a single space-separated string. */
export function flatten(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Truncate for display without cutting mid-word where avoidable. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
