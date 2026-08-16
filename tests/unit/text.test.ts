import { describe, expect, it } from 'vitest';
import { canonicalStrength, levenshtein, normalise, similarity, slugify, truncate } from '@/utils/text';

describe('normalise', () => {
  it('lower-cases and collapses whitespace', () => {
    expect(normalise('  Crocin   500  ')).toBe('crocin 500');
  });

  it('strips Latin diacritics', () => {
    expect(normalise('Dr. Reddy’s Laboratories')).toBe('dr. reddy s laboratories');
  });

  it('preserves Devanagari', () => {
    expect(normalise('पैरासिटामोल 500')).toBe('पैरासिटामोल 500');
  });

  it('keeps characters that carry meaning in a strength', () => {
    expect(normalise('125 mg/5 ml')).toBe('125 mg/5 ml');
    expect(normalise('0.5%')).toBe('0.5%');
  });
});

describe('canonicalStrength', () => {
  it('treats formatting differences as equal', () => {
    const forms = ['500mg', '500 mg', '500 MG', ' 500mg '];
    const canonical = forms.map(canonicalStrength);
    expect(new Set(canonical).size).toBe(1);
  });

  it('normalises per-volume strengths', () => {
    expect(canonicalStrength('125 mg/5 ml')).toBe(canonicalStrength('125mg/5ml'));
  });

  it('keeps genuinely different strengths distinct', () => {
    expect(canonicalStrength('500 mg')).not.toBe(canonicalStrength('650 mg'));
  });

  it('returns empty for missing input', () => {
    expect(canonicalStrength(null)).toBe('');
  });
});

describe('levenshtein and similarity', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('crocin', 'crocin')).toBe(0);
  });

  it('counts single edits', () => {
    expect(levenshtein('crocin', 'crocine')).toBe(1);
    expect(levenshtein('dolo', 'dola')).toBe(1);
  });

  it('scores similar brand names highly', () => {
    expect(similarity('crocin', 'crocine')).toBeGreaterThan(0.85);
  });

  it('scores unrelated names low', () => {
    expect(similarity('crocin', 'metformin')).toBeLessThan(0.4);
  });
});

describe('slugify', () => {
  it('produces a URL-safe key', () => {
    expect(slugify('Calpol 125 mg/5 ml Oral Suspension')).toBe('calpol-125-mg-5-ml-oral-suspension');
  });
});

describe('truncate', () => {
  it('leaves short strings alone', () => {
    expect(truncate('short', 20)).toBe('short');
  });

  it('adds an ellipsis when cutting', () => {
    expect(truncate('a'.repeat(30), 10)).toMatch(/…$/);
  });
});
