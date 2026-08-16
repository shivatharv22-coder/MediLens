import { DEFAULT_LANGUAGE, normaliseLanguage } from '@/config/languages';
import type { LocalisedMedicine, Medicine, MedicineContent } from '@/types/medicine';

/**
 * Resolve a medicine record into one display language.
 *
 * Rules that matter for safety:
 *  - a REJECTED translation is never shown;
 *  - a translation is used whole or not at all per field, so a half-translated
 *    warning can never be spliced with an English one;
 *  - the caller always learns which language the body text is actually in and
 *    whether a human reviewed it.
 */
export function localiseMedicine(medicine: Medicine, requestedLanguage: string): LocalisedMedicine {
  const language = normaliseLanguage(requestedLanguage);
  const { translations, ...rest } = medicine;

  const original: MedicineContent = {
    summary: medicine.summary,
    commonUses: medicine.commonUses,
    mechanismSummary: medicine.mechanismSummary,
    commonSideEffects: medicine.commonSideEffects,
    importantWarnings: medicine.importantWarnings,
    cautionGroups: medicine.cautionGroups,
    storageInformation: medicine.storageInformation,
  };

  if (language === DEFAULT_LANGUAGE) {
    return {
      ...rest,
      ...original,
      contentLanguage: DEFAULT_LANGUAGE,
      requestedLanguage: language,
      translationStatus: 'ORIGINAL',
      translationFallback: false,
    };
  }

  const translation = translations.find(
    (t) => t.languageCode === language && t.status !== 'REJECTED',
  );

  if (!translation) {
    return {
      ...rest,
      ...original,
      contentLanguage: DEFAULT_LANGUAGE,
      requestedLanguage: language,
      translationStatus: 'ORIGINAL',
      translationFallback: true,
    };
  }

  return {
    ...rest,
    // A field the translation left empty falls back to English rather than
    // rendering a blank section.
    summary: translation.summary ?? original.summary,
    commonUses: translation.commonUses.length ? translation.commonUses : original.commonUses,
    mechanismSummary: translation.mechanismSummary ?? original.mechanismSummary,
    commonSideEffects: translation.commonSideEffects.length
      ? translation.commonSideEffects
      : original.commonSideEffects,
    importantWarnings: translation.importantWarnings.length
      ? translation.importantWarnings
      : original.importantWarnings,
    cautionGroups: translation.cautionGroups.length
      ? translation.cautionGroups
      : original.cautionGroups,
    storageInformation: translation.storageInformation ?? original.storageInformation,
    contentLanguage: language,
    requestedLanguage: language,
    translationStatus: translation.status,
    translationFallback: false,
  };
}

/** The English content, used as the AI's grounding source regardless of display language. */
export function verifiedContentOf(medicine: Medicine): MedicineContent {
  return {
    summary: medicine.summary,
    commonUses: medicine.commonUses,
    mechanismSummary: medicine.mechanismSummary,
    commonSideEffects: medicine.commonSideEffects,
    importantWarnings: medicine.importantWarnings,
    cautionGroups: medicine.cautionGroups,
    storageInformation: medicine.storageInformation,
  };
}
