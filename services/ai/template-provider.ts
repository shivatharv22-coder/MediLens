import { AppError, ERROR_CODES } from '@/lib/errors';
import type { MedicineContent } from '@/types/medicine';
import { getDictionary } from '@/lib/i18n';
import { dosageFormLabel } from '@/utils/format';
import { noVerifiedInfoMessage, refusalMessage, screenQuestion } from './safety';
import type {
  AiAnswer,
  AiProvider,
  AnswerRequest,
  ExplainRequest,
  TranslateRequest,
  VerifiedMedicineContext,
} from './types';

/**
 * Deterministic, non-LLM provider. The default.
 *
 * It cannot hallucinate because it never generates a sentence that is not
 * assembled from a verified field plus a fixed connective phrase. That makes it
 * the safest option and means MediLens works with no AI credentials at all.
 */

type Intent =
  | 'WHAT_IS'
  | 'INGREDIENT'
  | 'USES'
  | 'MECHANISM'
  | 'SIDE_EFFECTS'
  | 'WARNINGS'
  | 'CAUTION_GROUPS'
  | 'STORAGE'
  | 'MANUFACTURER'
  | 'STRENGTH'
  | 'FORM'
  | 'SOURCE'
  | 'UNKNOWN';

const INTENT_PATTERNS: { intent: Intent; patterns: RegExp[] }[] = [
  {
    intent: 'INGREDIENT',
    patterns: [
      /\b(active )?(ingredient|salt|composition|generic|molecule)\b/i,
      /\bwhat is (it|this) made of\b/i,
      /(सक्रिय घटक|घटक|साल्ट|जेनेरिक|कंपोज़िशन)/,
      /(सक्रिय घटक|घटक|जेनेरिक|कंपोझिशन)/,
    ],
  },
  {
    intent: 'SIDE_EFFECTS',
    patterns: [
      /\bside[- ]?effects?\b/i,
      /\badverse (effects?|reactions?)\b/i,
      /(दुष्प्रभाव|साइड इफ़ेक्ट|साइड इफेक्ट)/,
      /(दुष्परिणाम|साइड इफेक्ट)/,
    ],
  },
  {
    intent: 'WARNINGS',
    patterns: [/\bwarnings?\b/i, /\bprecautions?\b/i, /\bdangers?\b/i, /(चेतावनी|सावधानी)/, /(सूचना|इशारा|खबरदारी)/],
  },
  {
    intent: 'CAUTION_GROUPS',
    patterns: [
      /\bwho (should|needs to) (be careful|take care|avoid)\b/i,
      /\bextra caution\b/i,
      /(किन्हें सावधानी|किसे सावधानी)/,
      /(कोणी काळजी|कोणाला काळजी)/,
    ],
  },
  {
    intent: 'USES',
    patterns: [
      /\b(what is (it|this) (used|for)|used for|uses|indications?|treats?|kis liye)\b/i,
      /\bwhy is (it|this) (given|used)\b/i,
      /(किस लिए|किसके लिए|उपयोग|इस्तेमाल)/,
      /(कशासाठी|उपयोग|वापर)/,
    ],
  },
  {
    intent: 'MECHANISM',
    patterns: [
      /\bhow does (it|this) work\b/i,
      /\bmechanism\b/i,
      /(कैसे काम करती|कैसे काम करता|कार्य कैसे)/,
      /(कसे काम करते|कार्य कसे)/,
    ],
  },
  {
    intent: 'STORAGE',
    patterns: [/\bstor(e|age)\b/i, /\bkeep (it|this) (in|at)\b/i, /(भंडारण|कैसे रखें|कहाँ रखें)/, /(साठवण|कसे ठेवाव)/],
  },
  {
    intent: 'MANUFACTURER',
    patterns: [/\b(manufacturer|company|who makes)\b/i, /(निर्माता|कंपनी|कौन बनाता)/, /(उत्पादक|कंपनी|कोण बनवत)/],
  },
  {
    intent: 'STRENGTH',
    patterns: [/\bstrength\b/i, /\bhow many mg\b/i, /(स्ट्रेंथ|कितने mg|कितना mg)/, /(स्ट्रेंथ|किती mg)/],
  },
  {
    intent: 'FORM',
    patterns: [/\b(dosage form|is it a tablet|tablet or capsule|what form)\b/i, /(दवा का रूप|टैबलेट है या)/, /(औषधाचा प्रकार|गोळी आहे का)/],
  },
  {
    intent: 'SOURCE',
    patterns: [/\b(source|where does this information|reference)\b/i, /(स्रोत|जानकारी कहाँ से)/, /(स्रोत|माहिती कुठून)/],
  },
  {
    intent: 'WHAT_IS',
    patterns: [
      /\bwhat is (this|it|the medicine)\b/i,
      /\btell me about\b/i,
      /\bexplain\b/i,
      /(यह दवा क्या|यह क्या है|समझाइए|सरल भाषा)/,
      /(हे औषध काय|हे काय आहे|समजावून|सोप्या भाषेत)/,
    ],
  },
];

/** Fixed connective phrases per language. Nothing here is a medical claim. */
const PHRASES: Record<
  string,
  {
    isA: (brand: string, generic: string, strength: string, form: string) => string;
    commonlyUsedFor: string;
    sideEffectsLead: string;
    warningsLead: string;
    cautionLead: string;
    storageLead: string;
    manufacturerLead: (name: string) => string;
    strengthLead: (brand: string, strength: string) => string;
    formLead: (brand: string, form: string) => string;
    sourceLead: string;
    prescriptionOnly: string;
    talkToProfessional: string;
  }
> = {
  en: {
    isA: (brand, generic, strength, form) =>
      `${brand} is a ${form.toLowerCase()} containing ${generic} ${strength}.`,
    commonlyUsedFor: 'It is commonly used for:',
    sideEffectsLead: 'Commonly reported side effects include:',
    warningsLead: 'Important warnings recorded for this medicine:',
    cautionLead: 'These groups are generally advised to take extra care:',
    storageLead: 'Storage information:',
    manufacturerLead: (name) => `The manufacturer recorded for this medicine is ${name}.`,
    strengthLead: (brand, strength) => `${brand} is recorded at a strength of ${strength}.`,
    formLead: (brand, form) => `${brand} is supplied as a ${form.toLowerCase()}.`,
    sourceLead: 'This information comes from:',
    prescriptionOnly: 'This medicine is recorded as prescription only.',
    talkToProfessional: 'For anything about your own situation, please ask a doctor or pharmacist.',
  },
  hi: {
    isA: (brand, generic, strength, form) =>
      `${brand} एक ${form.toLowerCase()} है जिसमें ${generic} ${strength} है।`,
    commonlyUsedFor: 'यह आम तौर पर इनके लिए उपयोग की जाती है:',
    sideEffectsLead: 'सामान्य रूप से बताए गए दुष्प्रभाव:',
    warningsLead: 'इस दवा के लिए दर्ज महत्वपूर्ण चेतावनियाँ:',
    cautionLead: 'इन समूहों को आम तौर पर अतिरिक्त सावधानी की सलाह दी जाती है:',
    storageLead: 'भंडारण संबंधी जानकारी:',
    manufacturerLead: (name) => `इस दवा के लिए दर्ज निर्माता ${name} है।`,
    strengthLead: (brand, strength) => `${brand} की दर्ज स्ट्रेंथ ${strength} है।`,
    formLead: (brand, form) => `${brand} ${form.toLowerCase()} के रूप में मिलती है।`,
    sourceLead: 'यह जानकारी इस स्रोत से है:',
    prescriptionOnly: 'यह दवा केवल डॉक्टर के पर्चे पर दर्ज है।',
    talkToProfessional: 'अपनी स्थिति से जुड़ी किसी भी बात के लिए कृपया डॉक्टर या फार्मासिस्ट से पूछें।',
  },
  mr: {
    isA: (brand, generic, strength, form) =>
      `${brand} हे ${form.toLowerCase()} स्वरूपाचे औषध असून त्यात ${generic} ${strength} आहे.`,
    commonlyUsedFor: 'हे सामान्यतः यासाठी वापरले जाते:',
    sideEffectsLead: 'सामान्यतः नोंदवलेले दुष्परिणाम:',
    warningsLead: 'या औषधासाठी नोंदवलेल्या महत्त्वाच्या सूचना:',
    cautionLead: 'या गटांना सामान्यतः अधिक काळजी घेण्याचा सल्ला दिला जातो:',
    storageLead: 'साठवणीविषयी माहिती:',
    manufacturerLead: (name) => `या औषधासाठी नोंदवलेला उत्पादक ${name} आहे.`,
    strengthLead: (brand, strength) => `${brand} ची नोंदवलेली स्ट्रेंथ ${strength} आहे.`,
    formLead: (brand, form) => `${brand} हे ${form.toLowerCase()} स्वरूपात मिळते.`,
    sourceLead: 'ही माहिती या स्रोतातून आली आहे:',
    prescriptionOnly: 'हे औषध फक्त डॉक्टरांच्या चिठ्ठीवर उपलब्ध म्हणून नोंदवले आहे.',
    talkToProfessional: 'तुमच्या स्वतःच्या परिस्थितीबद्दल कोणत्याही गोष्टीसाठी कृपया डॉक्टर किंवा फार्मासिस्टला विचारा.',
  },
};

function phrasesFor(language: string) {
  return PHRASES[language] ?? PHRASES.en;
}

function bullets(values: string[]): string {
  return values.map((v) => `• ${v}`).join('\n');
}

function classify(question: string): Intent {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(question))) return intent;
  }
  return 'UNKNOWN';
}

export class TemplateAiProvider implements AiProvider {
  readonly name = 'template';

  isConfigured(): boolean {
    return true;
  }

  async explain(request: ExplainRequest): Promise<AiAnswer> {
    const { medicine, language } = request;
    const p = phrasesFor(language);
    const parts: string[] = [];
    const grounded: string[] = [];

    if (medicine.content.summary) {
      parts.push(medicine.content.summary);
      grounded.push('summary');
    } else {
      parts.push(
        p.isA(
          medicine.brandName,
          medicine.genericName,
          medicine.strength,
          dosageFormLabel(medicine.dosageForm, getDictionary(language).dosageForms),
        ),
      );
      grounded.push('brandName', 'genericName', 'strength', 'dosageForm');
    }

    if (medicine.content.commonUses.length) {
      parts.push(`${p.commonlyUsedFor}\n${bullets(medicine.content.commonUses)}`);
      grounded.push('commonUses');
    }

    if (medicine.prescriptionOnly) parts.push(p.prescriptionOnly);
    parts.push(p.talkToProfessional);

    return {
      text: parts.join('\n\n'),
      refused: false,
      refusalReason: null,
      groundedIn: grounded,
      provider: this.name,
    };
  }

  async answer(request: AnswerRequest): Promise<AiAnswer> {
    const { medicine, question, language } = request;

    const verdict = screenQuestion(question);
    if (!verdict.allowed) {
      return {
        text: refusalMessage(verdict.reason, language),
        refused: true,
        refusalReason: verdict.reason,
        groundedIn: [],
        provider: this.name,
      };
    }

    const p = phrasesFor(language);
    const intent = classify(question);
    const c = medicine.content;

    const build = (text: string | null, field: string): AiAnswer | null =>
      text
        ? {
            text,
            refused: false,
            refusalReason: null,
            groundedIn: [field],
            provider: this.name,
          }
        : null;

    let result: AiAnswer | null = null;

    switch (intent) {
      case 'WHAT_IS':
        return this.explain({ medicine, language });
      case 'INGREDIENT':
        result = build(
          `${medicine.genericName} ${medicine.strength}`.trim() +
            (medicine.content.summary ? `\n\n${medicine.content.summary}` : ''),
          'genericName',
        );
        break;
      case 'USES':
        result = c.commonUses.length
          ? build(`${p.commonlyUsedFor}\n${bullets(c.commonUses)}`, 'commonUses')
          : null;
        break;
      case 'MECHANISM':
        result = build(c.mechanismSummary, 'mechanismSummary');
        break;
      case 'SIDE_EFFECTS':
        result = c.commonSideEffects.length
          ? build(`${p.sideEffectsLead}\n${bullets(c.commonSideEffects)}`, 'commonSideEffects')
          : null;
        break;
      case 'WARNINGS':
        result = c.importantWarnings.length
          ? build(`${p.warningsLead}\n${bullets(c.importantWarnings)}`, 'importantWarnings')
          : null;
        break;
      case 'CAUTION_GROUPS':
        result = c.cautionGroups.length
          ? build(`${p.cautionLead}\n${bullets(c.cautionGroups)}`, 'cautionGroups')
          : null;
        break;
      case 'STORAGE':
        result = build(
          c.storageInformation ? `${p.storageLead} ${c.storageInformation}` : null,
          'storageInformation',
        );
        break;
      case 'MANUFACTURER':
        result = build(
          medicine.manufacturer ? p.manufacturerLead(medicine.manufacturer) : null,
          'manufacturer',
        );
        break;
      case 'STRENGTH':
        result = build(p.strengthLead(medicine.brandName, medicine.strength), 'strength');
        break;
      case 'FORM':
        result = build(
          p.formLead(medicine.brandName, dosageFormLabel(medicine.dosageForm, getDictionary(language).dosageForms)),
          'dosageForm',
        );
        break;
      case 'SOURCE':
        result = medicine.sourceNames.length
          ? build(`${p.sourceLead}\n${bullets(medicine.sourceNames)}`, 'sources')
          : null;
        break;
      default:
        result = null;
    }

    if (!result) {
      return {
        text: noVerifiedInfoMessage(language),
        refused: false,
        refusalReason: null,
        groundedIn: [],
        provider: this.name,
      };
    }
    return result;
  }

  async translate(_request: TranslateRequest): Promise<MedicineContent> {
    // Machine translation of medical text needs a model. Rather than return
    // English content labelled as a translation, refuse explicitly.
    throw new AppError(ERROR_CODES.FEATURE_DISABLED, {
      logContext: { provider: this.name, reason: 'template provider cannot translate' },
    });
  }
}

export const __testables = { classify };
