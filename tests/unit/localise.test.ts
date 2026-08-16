import { describe, expect, it } from 'vitest';
import { DEMO_MEDICINES } from '@/database/data/demo-medicines';
import { localiseMedicine } from '@/services/medicine/localise';
import type { Medicine } from '@/types/medicine';

const withTranslations = DEMO_MEDICINES.find((m) => m.id === 'med-paracetamol-500-tab')!;
const withoutTranslations = DEMO_MEDICINES.find((m) => m.id === 'med-amlodipine-5-tab')!;

describe('localiseMedicine', () => {
  it('returns the original content for English', () => {
    const result = localiseMedicine(withTranslations, 'en');
    expect(result.contentLanguage).toBe('en');
    expect(result.translationStatus).toBe('ORIGINAL');
    expect(result.translationFallback).toBe(false);
    expect(result.summary).toBe(withTranslations.summary);
  });

  it('uses a reviewed translation and reports its status', () => {
    const result = localiseMedicine(withTranslations, 'hi');
    expect(result.contentLanguage).toBe('hi');
    expect(result.translationStatus).toBe('HUMAN_REVIEWED');
    expect(result.translationFallback).toBe(false);
    expect(result.summary).toContain('पैरासिटामोल');
  });

  it('flags an unreviewed machine translation', () => {
    const dolo = DEMO_MEDICINES.find((m) => m.id === 'med-paracetamol-650-tab')!;
    const result = localiseMedicine(dolo, 'hi');
    expect(result.translationStatus).toBe('MACHINE_UNREVIEWED');
  });

  it('falls back to English and says so when no translation exists', () => {
    const result = localiseMedicine(withoutTranslations, 'mr');
    expect(result.contentLanguage).toBe('en');
    expect(result.requestedLanguage).toBe('mr');
    expect(result.translationFallback).toBe(true);
    expect(result.summary).toBe(withoutTranslations.summary);
  });

  it('never uses a rejected translation', () => {
    const rejected: Medicine = {
      ...withTranslations,
      translations: withTranslations.translations.map((t) => ({ ...t, status: 'REJECTED' as const })),
    };
    const result = localiseMedicine(rejected, 'hi');
    expect(result.contentLanguage).toBe('en');
    expect(result.translationFallback).toBe(true);
  });

  it('preserves the number of warnings when translating', () => {
    const result = localiseMedicine(withTranslations, 'hi');
    expect(result.importantWarnings).toHaveLength(withTranslations.importantWarnings.length);
  });

  it('falls back per field when a translated field is empty', () => {
    const partial: Medicine = {
      ...withTranslations,
      translations: [
        {
          languageCode: 'hi',
          status: 'HUMAN_REVIEWED',
          producedBy: 'test',
          reviewedAt: null,
          summary: 'अनुवादित सारांश',
          commonUses: [],
          mechanismSummary: null,
          commonSideEffects: [],
          importantWarnings: [],
          cautionGroups: [],
          storageInformation: null,
        },
      ],
    };

    const result = localiseMedicine(partial, 'hi');
    expect(result.summary).toBe('अनुवादित सारांश');
    // Untranslated fields must never render blank.
    expect(result.importantWarnings).toEqual(withTranslations.importantWarnings);
    expect(result.commonUses).toEqual(withTranslations.commonUses);
  });

  it('treats an unknown language as English', () => {
    const result = localiseMedicine(withTranslations, 'fr');
    expect(result.contentLanguage).toBe('en');
  });
});
