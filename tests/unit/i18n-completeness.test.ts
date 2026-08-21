import { describe, expect, it } from 'vitest';
import { DOSAGE_FORMS, SOURCE_CATEGORIES } from '@/types/medicine';
import { SUPPORTED_LANGUAGES } from '@/config/languages';
import { getDictionary } from '@/lib/i18n';
import { dosageFormLabel, sourceCategoryLabel } from '@/utils/format';
import { en } from '@/lib/i18n/dictionaries/en';
import { hi } from '@/lib/i18n/dictionaries/hi';
import { mr } from '@/lib/i18n/dictionaries/mr';
import type { Dictionary } from '@/lib/i18n/types';

/**
 * A missing translation does not throw — it renders English to someone who
 * asked for Hindi. Nothing surfaces that in review, so it is pinned here.
 */

type Flat = Map<string, unknown>;

function flatten(value: unknown, prefix = '', into: Flat = new Map()): Flat {
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = `${prefix}${key}`;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, `${path}.`, into);
    else into.set(path, child);
  }
  return into;
}

const DICTS: [string, Dictionary][] = [
  ['hi', hi],
  ['mr', mr],
];

/**
 * Values that are correctly identical across languages: the product name, and
 * the text-direction marker.
 */
const SHARED_WITH_ENGLISH = new Set(['common.appName', 'meta.dir']);

const DEVANAGARI = /[ऀ-ॿ]/;

describe('dictionary completeness', () => {
  const english = flatten(en);

  it.each(DICTS)('%s defines every English key and no extras', (_name, dict) => {
    const other = flatten(dict);
    expect([...english.keys()].filter((k) => !other.has(k))).toEqual([]);
    expect([...other.keys()].filter((k) => !english.has(k))).toEqual([]);
  });

  it.each(DICTS)('%s does not leave prose sitting in English', (_name, dict) => {
    const other = flatten(dict);
    const untranslated = [...english.keys()].filter((key) => {
      if (SHARED_WITH_ENGLISH.has(key)) return false;
      const value = other.get(key);
      if (typeof value !== 'string') return false;
      // A string carrying no Devanagari at all, where English had real words,
      // is an untranslated entry rather than a deliberate shared token.
      return /[A-Za-z]{3}/.test(String(english.get(key))) && !DEVANAGARI.test(value);
    });
    expect(untranslated).toEqual([]);
  });
});

describe('enum labels', () => {
  it.each(SUPPORTED_LANGUAGES.map((l) => l.code))('%s labels every dosage form', (code) => {
    const dict = getDictionary(code);
    for (const form of DOSAGE_FORMS) {
      const label = dosageFormLabel(form, dict.dosageForms);
      expect(label, `${code} ${form}`).toBeTruthy();
      // The raw enum leaking through means a label is missing.
      expect(label).not.toBe(form);
      expect(label).not.toContain('_');
    }
  });

  it.each(SUPPORTED_LANGUAGES.map((l) => l.code))('%s labels every source category', (code) => {
    const dict = getDictionary(code);
    for (const category of SOURCE_CATEGORIES) {
      const label = sourceCategoryLabel(category, dict.sourceCategories);
      expect(label, `${code} ${category}`).toBeTruthy();
      expect(label).not.toBe(category);
    }
  });

  it('keeps the demo-data warning saying the source is not verified', () => {
    // Wording may differ per language; the meaning must not.
    expect(en.sourceCategories.DEMO_SEED_DATA).toMatch(/not a verified medical source/i);
    expect(hi.sourceCategories.DEMO_SEED_DATA).toContain('नहीं');
    expect(mr.sourceCategories.DEMO_SEED_DATA).toContain('नाही');
  });

  it('falls back to English, then the raw enum, for an unknown value', () => {
    expect(dosageFormLabel('TABLET')).toBe('Tablet');
    expect(dosageFormLabel('TABLET', {})).toBe('Tablet');
    // A form added to the schema before the dictionaries catch up.
    expect(dosageFormLabel('NEW_FORM')).toBe('new form');
  });

  it('never translates dose units', () => {
    // Guards the medical rule: mg/ml/mcg are printed on the pack and must not
    // be localised anywhere in the label tables.
    for (const dict of [en, hi, mr]) {
      for (const label of Object.values(dict.dosageForms)) {
        expect(label).not.toMatch(/\b\d/);
      }
    }
  });
});
