/**
 * AI safety gate.
 *
 * This module decides — before any model is called, and again after it answers
 * — whether a question or an answer crosses from education into personalised
 * medical judgment. It is deliberately pattern-based and conservative: a false
 * refusal costs the user a click, a false allow costs medical safety.
 *
 * See docs/SAFETY.md. The rules here are the machine-readable form of §3.
 */

export const REFUSAL_REASONS = [
  'PERSONAL_SUITABILITY', // "should I take this"
  'DOSAGE_ADVICE', // "how much should I take"
  'STOP_OR_CHANGE', // "can I stop this"
  'DIAGNOSIS', // "do I have X"
  'PROGNOSIS_PREDICTION', // "will this harm me in five years"
  'INTERACTION_ADVICE', // "can I take this with X" — out of scope in v1
  'EMERGENCY', // "I took 20 tablets"
] as const;

export type RefusalReason = (typeof REFUSAL_REASONS)[number];

export interface SafetyVerdict {
  allowed: boolean;
  reason: RefusalReason | null;
}

/**
 * Patterns are matched against the lower-cased question in English, Hindi and
 * Marathi. Devanagari is matched on distinctive stems rather than whole words
 * so that inflection does not defeat the check.
 */
const RULES: { reason: RefusalReason; patterns: RegExp[] }[] = [
  {
    reason: 'EMERGENCY',
    patterns: [
      /\b(overdose|too many tablets|took \d+\s*(tablets|pills|capsules)|poison(ing)?|swallowed the whole|suicid)/i,
      /\b(can'?t breathe|not breathing|unconscious|chest pain right now)\b/i,
      /(ज़्यादा गोलियां|अधिक गोलियाँ|ओवरडोज़|जहर|विष)/,
      /(जास्त गोळ्या|ओव्हरडोस|विषबाधा)/,
    ],
  },
  {
    reason: 'DOSAGE_ADVICE',
    patterns: [
      /\bhow (much|many)\b.*\b(take|should|dose|tablets?|ml|spoons?)\b/i,
      /\b(what|which)\s+dose\b/i,
      /\b(double|triple|increase|decrease|reduce|halve|skip)\b.*\b(dose|dosage|tablet)/i,
      /\b(dose|dosage)\b.*\b(for me|my|i should|my child|my baby|my father|my mother)\b/i,
      /\bcan i take (two|three|2|3|\d+)\b/i,
      /(कितनी|कितना).*(खुराक|गोली|लेनी|लेना|लूँ|लूं)/,
      /(खुराक|डोज़).*(बढ़ा|घटा|दुगुन|दोगुन)/,
      /(किती).*(मात्रा|गोळी|घ्याव|घेऊ)/,
    ],
  },
  {
    reason: 'STOP_OR_CHANGE',
    patterns: [
      /\bcan i (stop|quit|discontinue|skip|pause)\b/i,
      /\bshould i (stop|quit|discontinue|switch|change)\b/i,
      /\b(stop|change|switch)\b.*\b(my|this)\b.*\b(medicine|medication|tablet|treatment)\b/i,
      /(बंद कर|छोड़ द|बदल).*(दवा|दवाई|गोली)/,
      /(दवा|दवाई|गोली).*(बंद कर|छोड़|बदल)/,
      /(बंद कर|थांबव|बदल).*(औषध|गोळी)/,
    ],
  },
  {
    // Checked before PERSONAL_SUITABILITY: "can I take this with my other
    // medicine" matches both, and the interaction wording is the more useful
    // referral.
    reason: 'INTERACTION_ADVICE',
    patterns: [
      // v1 has no interaction database (§3). Anything asking whether two
      // medicines can be combined is redirected rather than answered.
      /\bcan i take (this|it)\b.*\b(with|along ?with|together with)\b/i,
      /\b(interact|interaction|combine|combination)\b.*\b(with|between)\b/i,
      /\bis it (safe|ok|okay) (to take|with)\b.*\b(and|with)\b/i,
      /(साथ में).*(ले सकता|ले सकती|लेना)/,
      /(सोबत).*(घेऊ शकतो|घेऊ शकते|घेता येईल)/,
    ],
  },
  {
    reason: 'PERSONAL_SUITABILITY',
    patterns: [
      /\bshould i (take|use|have|start|try)\b/i,
      /\bis (this|it) (safe|ok|okay|good|fine|right|suitable)\b.*\b(for me|for my|in my case|for him|for her|for my child)\b/i,
      /\bis (this|it) (safe|ok|okay|suitable) (for me|for my)\b/i,
      /\bcan i (take|use|have)\b.*\b(if i|since i|because i|with my|i am|i have)\b/i,
      /\b(will|would) (this|it) (work|help|suit) (for )?me\b/i,
      /\b(is this|is it) the right medicine for\b/i,
      /(क्या मुझे|मुझे).*(लेनी चाहिए|लेना चाहिए|खानी चाहिए)/,
      /(मेरे लिए).*(सुरक्षित|ठीक|सही)/,
      /(मला).*(घ्यावी का|घ्यावे का|घेऊ का)/,
      /(माझ्यासाठी).*(सुरक्षित|योग्य|बरोबर)/,
    ],
  },
  {
    reason: 'DIAGNOSIS',
    patterns: [
      /\b(do|does) i have\b/i,
      /\bwhat (disease|illness|condition|infection) do i\b/i,
      /\b(diagnose|diagnosis) (me|my)\b/i,
      /\bwhat'?s wrong with me\b/i,
      /\b(am i|is my child) (suffering|having|sick with)\b/i,
      /\bmy symptoms are\b.*\bwhat (is it|do i have)\b/i,
      /(क्या मुझे).*(बीमारी|रोग|संक्रमण|है\?)/,
      /(मुझे कौन).*(बीमारी|रोग)/,
      /(मला).*(आजार|रोग).*(आहे का)/,
    ],
  },
  {
    reason: 'PROGNOSIS_PREDICTION',
    patterns: [
      // Allows an intervening noun: "will this medicine cause …".
      /\bwill (this|it|the)\b(\s+\w+){0,2}\s+(cause|give|lead to|harm|damage|affect)\b/i,
      /\b(in|after) (\d+|five|ten|two|three) (years?|months?)\b.*\b(will|would|problem|damage|effect)\b/i,
      /\bwill i (get|develop|have)\b/i,
      /\b(what are|what is) my (chances|risk)\b/i,
      /(क्या.*मुझे).*(भविष्य|बाद में|साल बाद).*(नुकसान|समस्या|होगा)/,
      /(मला).*(पुढे|नंतर|वर्षांनी).*(त्रास|नुकसान|होईल)/,
    ],
  },
];

/** Decide whether a user question may be answered from verified content. */
export function screenQuestion(question: string): SafetyVerdict {
  const text = question.trim();
  if (!text) return { allowed: false, reason: 'PERSONAL_SUITABILITY' };

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) return { allowed: false, reason: rule.reason };
    }
  }
  return { allowed: true, reason: null };
}

/**
 * Phrases an answer must never contain, whatever produced it.
 * Checked after generation as a backstop against a model drifting off-policy.
 */
const FORBIDDEN_OUTPUT: RegExp[] = [
  /\byou should (take|stop|start|increase|reduce|switch|use)\b/i,
  /\bi recommend (that )?you\b/i,
  /\btake (one|two|three|\d+)\s*(tablet|capsule|spoon|ml|dose)/i,
  /\b(you|your) (can|may) safely (take|stop|double)\b/i,
  /\byou (probably|likely) have\b/i,
  /\byou (do not|don't) need (to see|a) (a )?doctor\b/i,
  /\bit is safe for you\b/i,
  /\bthis will cure\b/i,
  /\byour (diagnosis|condition) is\b/i,
];

export function screenAnswer(answer: string): SafetyVerdict {
  for (const pattern of FORBIDDEN_OUTPUT) {
    if (pattern.test(answer)) return { allowed: false, reason: 'PERSONAL_SUITABILITY' };
  }
  return { allowed: true, reason: null };
}

/** Localised refusal copy. Wording matches §20 of the product specification. */
const REFUSALS: Record<string, { standard: string; emergency: string; interaction: string }> = {
  en: {
    standard:
      'I can provide general information about this medicine, but I cannot determine what is medically appropriate for you. Please speak with a qualified healthcare professional.',
    emergency:
      'This sounds urgent. MediLens cannot help with a medical emergency. Please contact a doctor, a poison control centre, or your local emergency medical service straight away.',
    interaction:
      'MediLens does not check how medicines interact with each other. Please ask a pharmacist or doctor, who can look at everything you are taking.',
  },
  hi: {
    standard:
      'मैं इस दवा के बारे में सामान्य जानकारी दे सकता हूँ, लेकिन यह तय नहीं कर सकता कि आपके लिए चिकित्सकीय रूप से क्या उचित है। कृपया किसी योग्य स्वास्थ्य पेशेवर से बात करें।',
    emergency:
      'यह आपातकालीन स्थिति लगती है। MediLens चिकित्सा आपातकाल में मदद नहीं कर सकता। कृपया तुरंत डॉक्टर, ज़हर नियंत्रण केंद्र या अपनी स्थानीय आपातकालीन चिकित्सा सेवा से संपर्क करें।',
    interaction:
      'MediLens यह नहीं जाँचता कि दवाएँ आपस में कैसे प्रतिक्रिया करती हैं। कृपया फार्मासिस्ट या डॉक्टर से पूछें, जो आपकी सभी दवाओं को देख सकते हैं।',
  },
  mr: {
    standard:
      'मी या औषधाबद्दल सर्वसाधारण माहिती देऊ शकतो, पण तुमच्यासाठी वैद्यकीयदृष्ट्या काय योग्य आहे हे ठरवू शकत नाही. कृपया पात्र आरोग्य व्यावसायिकाशी बोला.',
    emergency:
      'ही तातडीची परिस्थिती वाटते. MediLens वैद्यकीय आणीबाणीत मदत करू शकत नाही. कृपया लगेच डॉक्टर, विषबाधा नियंत्रण केंद्र किंवा स्थानिक आपत्कालीन वैद्यकीय सेवेशी संपर्क साधा.',
    interaction:
      'औषधे एकमेकांवर कसा परिणाम करतात हे MediLens तपासत नाही. कृपया फार्मासिस्ट किंवा डॉक्टरांना विचारा, जे तुमची सर्व औषधे पाहू शकतात.',
  },
};

export function refusalMessage(reason: RefusalReason | null, language = 'en'): string {
  const set = REFUSALS[language] ?? REFUSALS.en;
  if (reason === 'EMERGENCY') return set.emergency;
  if (reason === 'INTERACTION_ADVICE') return set.interaction;
  return set.standard;
}

const NO_INFO: Record<string, string> = {
  en: "I don't have verified information for that question.",
  hi: 'इस प्रश्न के लिए मेरे पास सत्यापित जानकारी नहीं है।',
  mr: 'या प्रश्नासाठी माझ्याकडे पडताळलेली माहिती नाही.',
};

export function noVerifiedInfoMessage(language = 'en'): string {
  return NO_INFO[language] ?? NO_INFO.en;
}
