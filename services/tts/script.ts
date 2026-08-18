import { getLanguage } from '@/config/languages';
import { getDictionary } from '@/lib/i18n';
import { dosageFormLabel } from '@/utils/format';
import type { LocalisedMedicine } from '@/types/medicine';
import type { SpeechScript, SpeechSegment } from './types';

/**
 * Build what the Listen button reads out.
 *
 * Only user-facing medicine information is included. Ids, slugs, confidence
 * scores, source URLs, verification status and every other piece of technical
 * metadata are deliberately excluded (§12).
 */
export function buildSpeechScript(
  medicine: LocalisedMedicine,
  languageCode: string,
): SpeechScript {
  const dict = getDictionary(languageCode);
  const m = dict.medicine;
  const segments: SpeechSegment[] = [];

  const push = (heading: string | null, body: string | null | undefined) => {
    const text = body?.trim();
    if (text) segments.push({ heading, body: text });
  };

  const pushList = (heading: string, items: string[]) => {
    if (!items.length) return;
    // Full stops give the synthesiser a natural pause between list items.
    segments.push({ heading, body: items.map((i) => i.replace(/\.$/, '')).join('. ') + '.' });
  };

  push(null, `${medicine.brandName}. ${medicine.strength}. ${dosageFormLabel(medicine.dosageForm, dict.dosageForms)}.`);
  push(m.activeIngredient, medicine.genericName);
  push(m.whatIsThis, medicine.summary);
  pushList(m.commonUses, medicine.commonUses);
  push(m.howItWorks, medicine.mechanismSummary);
  pushList(m.commonSideEffects, medicine.commonSideEffects);
  pushList(m.importantWarnings, medicine.importantWarnings);
  pushList(m.cautionGroups, medicine.cautionGroups);
  push(m.storage, medicine.storageInformation);
  // The safety notice is read last so it is never skipped by a short listen.
  push(null, m.safetyNotice);

  const plainText = segments
    .map((s) => (s.heading ? `${s.heading}. ${s.body}` : s.body))
    .join('\n\n');

  return {
    languageCode,
    speechLocale: getLanguage(languageCode).speechLocale,
    segments,
    plainText,
  };
}
