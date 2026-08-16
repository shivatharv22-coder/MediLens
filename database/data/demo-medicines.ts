import type { Medicine } from '@/types/medicine';

/**
 * DEMO / DEVELOPMENT DATASET — NOT VERIFIED MEDICAL INFORMATION.
 *
 * Every record here carries `verificationStatus: 'UNVERIFIED'` and a single
 * source of category `DEMO_SEED_DATA`, so the UI always labels it as demo
 * content. It exists so the application can be exercised end to end before a
 * real, governed medicine database is attached. See docs/SAFETY.md.
 *
 * Do not add a record here without the DEMO_SEED_DATA source, and never change
 * `verificationStatus` on these records to `VERIFIED`.
 */

const DEMO_SOURCE = {
  id: 'src-demo',
  category: 'DEMO_SEED_DATA' as const,
  name: 'MediLens demo dataset (not a verified medical source)',
  url: null,
  version: 'v1',
  retrievedAt: null,
};

type DemoInput = Omit<Medicine, 'sources' | 'status' | 'verificationStatus' | 'lastVerifiedAt' | 'createdAt' | 'updatedAt' | 'country' | 'barcodes'> &
  Partial<Pick<Medicine, 'barcodes' | 'country'>>;

function demo(input: DemoInput): Medicine {
  return {
    country: 'IN',
    barcodes: [],
    ...input,
    sources: [{ ...DEMO_SOURCE, id: `${DEMO_SOURCE.id}-${input.id}` }],
    status: 'PUBLISHED',
    // Demo data is never verified. This is load-bearing for the UI labelling.
    verificationStatus: 'UNVERIFIED',
    lastVerifiedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

export const DEMO_MEDICINES: Medicine[] = [
  demo({
    id: 'med-paracetamol-500-tab',
    slug: 'crocin-500-mg-tablet',
    brandName: 'Crocin 500',
    genericName: 'Paracetamol',
    strength: '500 mg',
    dosageForm: 'TABLET',
    manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd',
    compositionText: 'Each uncoated tablet contains Paracetamol IP 500 mg',
    packSizeText: 'Strip of 15 tablets',
    prescriptionOnly: false,
    summary:
      'Paracetamol is a medicine used to bring down fever and to relieve mild to moderate pain. It is one of the most widely used medicines in India and is available in tablets, syrups and drops.',
    commonUses: ['Fever', 'Headache', 'Body ache and muscle pain', 'Toothache', 'Period pain'],
    mechanismSummary:
      'Paracetamol is thought to act mainly in the brain, reducing the signals that produce pain and raise body temperature. It does not reduce inflammation the way anti-inflammatory painkillers do.',
    commonSideEffects: [
      'Most people have no side effects at usual doses',
      'Nausea',
      'Skin rash in a small number of people',
    ],
    importantWarnings: [
      'Taking more paracetamol than the labelled dose can cause serious liver damage, even if you feel well at first.',
      'Many combination cold and pain products already contain paracetamol. Check labels so you do not take it twice.',
      'Avoid regular alcohol use while taking paracetamol.',
    ],
    cautionGroups: [
      'People with liver disease',
      'People who drink alcohol regularly',
      'People with very low body weight',
      'People taking other medicines that contain paracetamol',
    ],
    storageInformation: 'Store below 30°C in a dry place, away from direct sunlight. Keep out of reach of children.',
    ingredients: [{ name: 'Paracetamol', slug: 'paracetamol', amount: '500', unit: 'mg' }],
    translations: [
      {
        languageCode: 'hi',
        status: 'HUMAN_REVIEWED',
        producedBy: 'demo',
        reviewedAt: '2026-01-01T00:00:00.000Z',
        summary:
          'पैरासिटामोल बुखार कम करने और हल्के से मध्यम दर्द में राहत देने वाली दवा है। यह भारत में सबसे अधिक उपयोग होने वाली दवाओं में से एक है और टैबलेट, सिरप तथा ड्रॉप्स में मिलती है।',
        commonUses: ['बुखार', 'सिरदर्द', 'शरीर और मांसपेशियों में दर्द', 'दाँत का दर्द', 'माहवारी का दर्द'],
        mechanismSummary:
          'माना जाता है कि पैरासिटामोल मुख्य रूप से मस्तिष्क में काम करती है और दर्द तथा शरीर का तापमान बढ़ाने वाले संकेतों को कम करती है। यह सूजन-रोधी दर्द निवारकों की तरह सूजन कम नहीं करती।',
        commonSideEffects: ['सामान्य खुराक पर अधिकतर लोगों को कोई दुष्प्रभाव नहीं होता', 'जी मिचलाना', 'कुछ लोगों में त्वचा पर चकत्ते'],
        importantWarnings: [
          'लेबल पर लिखी खुराक से अधिक पैरासिटामोल लेने से जिगर (लिवर) को गंभीर नुकसान हो सकता है, भले ही शुरुआत में तबीयत ठीक लगे।',
          'सर्दी-जुकाम और दर्द की कई मिली-जुली दवाओं में पहले से पैरासिटामोल होती है। लेबल देखें ताकि यह दो बार न ली जाए।',
          'पैरासिटामोल लेते समय नियमित शराब सेवन से बचें।',
        ],
        cautionGroups: ['जिगर की बीमारी वाले लोग', 'नियमित शराब पीने वाले लोग', 'बहुत कम वज़न वाले लोग', 'पैरासिटामोल वाली अन्य दवाएँ ले रहे लोग'],
        storageInformation: '30°C से कम तापमान पर सूखी जगह पर, सीधी धूप से दूर रखें। बच्चों की पहुँच से दूर रखें।',
      },
      {
        languageCode: 'mr',
        status: 'HUMAN_REVIEWED',
        producedBy: 'demo',
        reviewedAt: '2026-01-01T00:00:00.000Z',
        summary:
          'पॅरासिटामोल हे ताप कमी करण्यासाठी आणि सौम्य ते मध्यम वेदना कमी करण्यासाठी वापरले जाणारे औषध आहे. भारतात सर्वाधिक वापरल्या जाणाऱ्या औषधांपैकी हे एक असून गोळ्या, सिरप आणि थेंब स्वरूपात मिळते.',
        commonUses: ['ताप', 'डोकेदुखी', 'अंगदुखी आणि स्नायूदुखी', 'दातदुखी', 'मासिक पाळीतील वेदना'],
        mechanismSummary:
          'पॅरासिटामोल मुख्यतः मेंदूत काम करते असे मानले जाते; ते वेदना आणि शरीराचे तापमान वाढवणारे संकेत कमी करते. दाहशामक वेदनाशामकांप्रमाणे ते सूज कमी करत नाही.',
        commonSideEffects: ['नेहमीच्या मात्रेत बहुतेकांना कोणतेही दुष्परिणाम होत नाहीत', 'मळमळ', 'काही लोकांमध्ये त्वचेवर पुरळ'],
        importantWarnings: [
          'लेबलवरील मात्रेपेक्षा जास्त पॅरासिटामोल घेतल्यास यकृताला गंभीर इजा होऊ शकते, सुरुवातीला बरे वाटत असले तरीही.',
          'सर्दी आणि वेदनांच्या अनेक संमिश्र औषधांत आधीच पॅरासिटामोल असते. ते दोनदा घेतले जाऊ नये म्हणून लेबल तपासा.',
          'पॅरासिटामोल घेत असताना नियमित मद्यपान टाळा.',
        ],
        cautionGroups: ['यकृताचा आजार असलेले लोक', 'नियमित मद्यपान करणारे लोक', 'खूप कमी वजन असलेले लोक', 'पॅरासिटामोल असलेली इतर औषधे घेणारे लोक'],
        storageInformation: '30°C पेक्षा कमी तापमानात कोरड्या जागी, थेट सूर्यप्रकाशापासून दूर ठेवा. मुलांच्या आवाक्याबाहेर ठेवा.',
      },
    ],
    barcodes: ['8901234567890'],
  }),

  demo({
    id: 'med-paracetamol-650-tab',
    slug: 'dolo-650-mg-tablet',
    brandName: 'Dolo 650',
    genericName: 'Paracetamol',
    strength: '650 mg',
    dosageForm: 'TABLET',
    manufacturer: 'Micro Labs Ltd',
    compositionText: 'Each film coated tablet contains Paracetamol IP 650 mg',
    packSizeText: 'Strip of 15 tablets',
    prescriptionOnly: false,
    summary:
      'This is a paracetamol tablet at a 650 mg strength. Paracetamol is used to reduce fever and relieve mild to moderate pain.',
    commonUses: ['Fever', 'Headache', 'Body ache'],
    mechanismSummary:
      'Paracetamol is thought to act mainly in the brain, reducing the signals that produce pain and raise body temperature.',
    commonSideEffects: ['Most people have no side effects at usual doses', 'Nausea'],
    importantWarnings: [
      'Taking more paracetamol than the labelled dose can cause serious liver damage.',
      'Check other medicines you are taking — many cold and pain products also contain paracetamol.',
    ],
    cautionGroups: ['People with liver disease', 'People who drink alcohol regularly'],
    storageInformation: 'Store below 30°C in a dry place. Keep out of reach of children.',
    ingredients: [{ name: 'Paracetamol', slug: 'paracetamol', amount: '650', unit: 'mg' }],
    translations: [
      {
        languageCode: 'hi',
        status: 'MACHINE_UNREVIEWED',
        producedBy: 'demo',
        reviewedAt: null,
        summary: 'यह 650 mg स्ट्रेंथ की पैरासिटामोल टैबलेट है। पैरासिटामोल बुखार कम करने और हल्के से मध्यम दर्द में राहत के लिए उपयोग होती है।',
        commonUses: ['बुखार', 'सिरदर्द', 'शरीर में दर्द'],
        mechanismSummary: 'माना जाता है कि पैरासिटामोल मुख्य रूप से मस्तिष्क में काम करती है और दर्द तथा तापमान बढ़ाने वाले संकेतों को कम करती है।',
        commonSideEffects: ['सामान्य खुराक पर अधिकतर लोगों को कोई दुष्प्रभाव नहीं होता', 'जी मिचलाना'],
        importantWarnings: [
          'लेबल पर लिखी खुराक से अधिक पैरासिटामोल लेने से जिगर को गंभीर नुकसान हो सकता है।',
          'अपनी अन्य दवाएँ जाँचें — कई सर्दी और दर्द की दवाओं में भी पैरासिटामोल होती है।',
        ],
        cautionGroups: ['जिगर की बीमारी वाले लोग', 'नियमित शराब पीने वाले लोग'],
        storageInformation: '30°C से कम तापमान पर सूखी जगह रखें। बच्चों की पहुँच से दूर रखें।',
      },
    ],
    barcodes: [],
  }),

  demo({
    id: 'med-paracetamol-125-susp',
    slug: 'calpol-125-mg-5-ml-oral-suspension',
    brandName: 'Calpol 125',
    genericName: 'Paracetamol',
    strength: '125 mg/5 ml',
    dosageForm: 'ORAL_SUSPENSION',
    manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd',
    compositionText: 'Each 5 ml contains Paracetamol IP 125 mg',
    packSizeText: 'Bottle of 60 ml',
    prescriptionOnly: false,
    summary:
      'A liquid paracetamol preparation, commonly supplied for children. Paracetamol reduces fever and relieves mild to moderate pain.',
    commonUses: ['Fever in children', 'Pain relief in children'],
    mechanismSummary:
      'Paracetamol is thought to act mainly in the brain, reducing the signals that produce pain and raise body temperature.',
    commonSideEffects: ['Usually well tolerated', 'Occasional nausea'],
    importantWarnings: [
      'Dosing for children depends on body weight and age. Use only the dose written on the pack or given by a doctor or pharmacist.',
      'Use the measuring cup or syringe supplied with the bottle. Household spoons are not accurate.',
      'Exceeding the labelled dose can cause serious liver damage.',
    ],
    cautionGroups: ['Children below the age stated on the pack', 'Children with liver or kidney problems'],
    storageInformation: 'Store below 30°C. Do not freeze. Discard any remaining suspension as stated on the pack after opening.',
    ingredients: [{ name: 'Paracetamol', slug: 'paracetamol', amount: '125', unit: 'mg/5 ml' }],
    translations: [],
    barcodes: [],
  }),

  demo({
    id: 'med-amoxicillin-500-cap',
    slug: 'mox-500-mg-capsule',
    brandName: 'Mox 500',
    genericName: 'Amoxicillin',
    strength: '500 mg',
    dosageForm: 'CAPSULE',
    manufacturer: 'Sun Pharmaceutical Industries Ltd',
    compositionText: 'Each capsule contains Amoxicillin Trihydrate IP equivalent to Amoxicillin 500 mg',
    packSizeText: 'Strip of 10 capsules',
    prescriptionOnly: true,
    summary:
      'Amoxicillin is an antibiotic from the penicillin group. It is prescribed by doctors to treat certain bacterial infections. It does not work against viral illnesses such as the common cold or flu.',
    commonUses: [
      'Certain chest and throat infections',
      'Certain ear and sinus infections',
      'Certain urinary tract infections',
      'Certain skin and dental infections',
    ],
    mechanismSummary:
      'Amoxicillin interferes with the building of the bacterial cell wall, which stops susceptible bacteria from multiplying.',
    commonSideEffects: ['Nausea', 'Loose motions or diarrhoea', 'Skin rash', 'Stomach discomfort'],
    importantWarnings: [
      'Do not take this medicine if you have ever had an allergic reaction to penicillin or any other antibiotic.',
      'Seek urgent medical help for swelling of the face, lips or throat, breathing difficulty, or a spreading rash.',
      'Antibiotics should be taken exactly as prescribed. Not completing a prescribed course can make infections harder to treat.',
      'Severe or bloody diarrhoea during or after antibiotic treatment needs medical attention.',
    ],
    cautionGroups: [
      'People with any penicillin or cephalosporin allergy',
      'People with kidney disease',
      'People with a history of severe skin reactions to medicines',
      'People who are pregnant or breastfeeding should tell their doctor',
    ],
    storageInformation: 'Store below 25°C in a dry place, protected from light. Keep out of reach of children.',
    ingredients: [{ name: 'Amoxicillin', slug: 'amoxicillin', amount: '500', unit: 'mg' }],
    translations: [
      {
        languageCode: 'hi',
        status: 'HUMAN_REVIEWED',
        producedBy: 'demo',
        reviewedAt: '2026-01-01T00:00:00.000Z',
        summary:
          'एमोक्सिसिलिन पेनिसिलिन समूह की एक एंटीबायोटिक दवा है। डॉक्टर इसे कुछ बैक्टीरियल संक्रमणों के इलाज के लिए लिखते हैं। यह सर्दी-जुकाम या फ्लू जैसे वायरल रोगों पर असर नहीं करती।',
        commonUses: ['कुछ छाती और गले के संक्रमण', 'कुछ कान और साइनस के संक्रमण', 'कुछ मूत्र मार्ग के संक्रमण', 'कुछ त्वचा और दाँत के संक्रमण'],
        mechanismSummary:
          'एमोक्सिसिलिन बैक्टीरिया की कोशिका भित्ति बनने में बाधा डालती है, जिससे संवेदनशील बैक्टीरिया बढ़ नहीं पाते।',
        commonSideEffects: ['जी मिचलाना', 'दस्त या पतले दस्त', 'त्वचा पर चकत्ते', 'पेट में असहजता'],
        importantWarnings: [
          'यदि आपको कभी पेनिसिलिन या किसी अन्य एंटीबायोटिक से एलर्जी हुई हो तो यह दवा न लें।',
          'चेहरे, होंठ या गले में सूजन, साँस लेने में कठिनाई, या फैलते हुए चकत्ते होने पर तुरंत चिकित्सा सहायता लें।',
          'एंटीबायोटिक ठीक वैसे ही लें जैसे डॉक्टर ने लिखा है। कोर्स अधूरा छोड़ने से संक्रमण का इलाज कठिन हो सकता है।',
          'एंटीबायोटिक के दौरान या बाद में तेज़ या खूनी दस्त होने पर चिकित्सा सहायता ज़रूरी है।',
        ],
        cautionGroups: [
          'पेनिसिलिन या सेफालोस्पोरिन से एलर्जी वाले लोग',
          'गुर्दे की बीमारी वाले लोग',
          'दवाओं से गंभीर त्वचा प्रतिक्रिया के इतिहास वाले लोग',
          'गर्भवती या स्तनपान कराने वाली महिलाएँ अपने डॉक्टर को बताएँ',
        ],
        storageInformation: '25°C से कम तापमान पर सूखी जगह, रोशनी से बचाकर रखें। बच्चों की पहुँच से दूर रखें।',
      },
      {
        languageCode: 'mr',
        status: 'MACHINE_UNREVIEWED',
        producedBy: 'demo',
        reviewedAt: null,
        summary:
          'अमोक्सिसिलिन हे पेनिसिलिन गटातील प्रतिजैविक (अँटिबायोटिक) औषध आहे. काही जिवाणूजन्य संसर्गांवर डॉक्टर ते लिहून देतात. सर्दी किंवा फ्लूसारख्या विषाणूजन्य आजारांवर ते काम करत नाही.',
        commonUses: ['काही छाती व घशाचे संसर्ग', 'काही कान व सायनसचे संसर्ग', 'काही मूत्रमार्गाचे संसर्ग', 'काही त्वचा व दातांचे संसर्ग'],
        mechanismSummary: 'अमोक्सिसिलिन जिवाणूंची पेशीभित्तिका तयार होण्यात अडथळा आणते, त्यामुळे संवेदनशील जिवाणू वाढू शकत नाहीत.',
        commonSideEffects: ['मळमळ', 'जुलाब', 'त्वचेवर पुरळ', 'पोटात अस्वस्थता'],
        importantWarnings: [
          'पेनिसिलिन किंवा इतर कोणत्याही प्रतिजैविकाची कधी अ‍ॅलर्जी झाली असल्यास हे औषध घेऊ नका.',
          'चेहरा, ओठ किंवा घसा सुजणे, श्वास घेण्यास त्रास, किंवा पसरणारे पुरळ असल्यास तातडीने वैद्यकीय मदत घ्या.',
          'प्रतिजैविक डॉक्टरांनी सांगितल्याप्रमाणेच घ्या. कोर्स अर्धवट सोडल्यास संसर्गावर उपचार कठीण होऊ शकतात.',
          'उपचारादरम्यान किंवा नंतर तीव्र किंवा रक्तमिश्रित जुलाब झाल्यास वैद्यकीय मदत घ्या.',
        ],
        cautionGroups: ['पेनिसिलिन किंवा सेफॅलोस्पोरिनची अ‍ॅलर्जी असलेले लोक', 'मूत्रपिंडाचा आजार असलेले लोक', 'औषधांमुळे गंभीर त्वचाप्रतिक्रिया झालेल्या व्यक्ती', 'गर्भवती किंवा स्तनपान करणाऱ्या स्त्रियांनी डॉक्टरांना सांगावे'],
        storageInformation: '25°C पेक्षा कमी तापमानात कोरड्या जागी, प्रकाशापासून दूर ठेवा. मुलांच्या आवाक्याबाहेर ठेवा.',
      },
    ],
    barcodes: [],
  }),

  demo({
    id: 'med-azithromycin-500-tab',
    slug: 'azithral-500-mg-tablet',
    brandName: 'Azithral 500',
    genericName: 'Azithromycin',
    strength: '500 mg',
    dosageForm: 'TABLET',
    manufacturer: 'Alembic Pharmaceuticals Ltd',
    compositionText: 'Each film coated tablet contains Azithromycin Dihydrate IP equivalent to Azithromycin 500 mg',
    packSizeText: 'Strip of 5 tablets',
    prescriptionOnly: true,
    summary:
      'Azithromycin is a macrolide antibiotic prescribed for certain bacterial infections. It is not effective against viral illnesses.',
    commonUses: ['Certain respiratory tract infections', 'Certain skin and soft tissue infections', 'Certain sexually transmitted infections'],
    mechanismSummary:
      'Azithromycin blocks bacterial protein production, which stops susceptible bacteria from growing.',
    commonSideEffects: ['Nausea', 'Abdominal pain', 'Diarrhoea', 'Headache'],
    importantWarnings: [
      'Tell your doctor about any heart rhythm problem before taking this medicine.',
      'Seek medical help for severe diarrhoea, yellowing of the eyes or skin, or an allergic reaction.',
      'Take exactly the course your doctor prescribed.',
    ],
    cautionGroups: ['People with heart rhythm disorders', 'People with liver disease', 'People taking other medicines that affect heart rhythm'],
    storageInformation: 'Store below 30°C, protected from light and moisture.',
    ingredients: [{ name: 'Azithromycin', slug: 'azithromycin', amount: '500', unit: 'mg' }],
    translations: [],
    barcodes: [],
  }),

  demo({
    id: 'med-metformin-500-tab',
    slug: 'glycomet-500-mg-tablet',
    brandName: 'Glycomet 500',
    genericName: 'Metformin Hydrochloride',
    strength: '500 mg',
    dosageForm: 'TABLET',
    manufacturer: 'USV Private Ltd',
    compositionText: 'Each film coated tablet contains Metformin Hydrochloride IP 500 mg',
    packSizeText: 'Strip of 20 tablets',
    prescriptionOnly: true,
    summary:
      'Metformin is a medicine used in the long-term management of type 2 diabetes. It is prescribed alongside diet and physical activity.',
    commonUses: ['Type 2 diabetes management, as prescribed by a doctor'],
    mechanismSummary:
      'Metformin lowers the amount of glucose the liver releases and helps the body respond better to its own insulin.',
    commonSideEffects: ['Nausea', 'Loose motions, especially when starting', 'Metallic taste', 'Loss of appetite'],
    importantWarnings: [
      'Tell your doctor if you have kidney problems, since metformin is cleared by the kidneys.',
      'Stop and seek urgent medical help for unusual muscle pain, deep or fast breathing, severe tiredness, or stomach pain with vomiting.',
      'Tell your doctor before any scan that uses contrast dye, and before surgery.',
      'Alcohol increases the risk of a rare but serious side effect called lactic acidosis.',
    ],
    cautionGroups: [
      'People with reduced kidney function',
      'People with liver disease',
      'People with heart failure',
      'People who drink alcohol heavily',
      'Older adults',
    ],
    storageInformation: 'Store below 30°C in a dry place, away from light.',
    ingredients: [{ name: 'Metformin Hydrochloride', slug: 'metformin-hydrochloride', amount: '500', unit: 'mg' }],
    translations: [
      {
        languageCode: 'mr',
        status: 'HUMAN_REVIEWED',
        producedBy: 'demo',
        reviewedAt: '2026-01-01T00:00:00.000Z',
        summary:
          'मेटफॉर्मिन हे टाइप २ मधुमेहाच्या दीर्घकालीन व्यवस्थापनासाठी वापरले जाणारे औषध आहे. ते आहार आणि शारीरिक हालचालींसोबत डॉक्टरांच्या सल्ल्याने दिले जाते.',
        commonUses: ['डॉक्टरांनी सांगितल्याप्रमाणे टाइप २ मधुमेहाचे व्यवस्थापन'],
        mechanismSummary: 'मेटफॉर्मिन यकृतातून बाहेर पडणाऱ्या ग्लुकोजचे प्रमाण कमी करते आणि शरीराला स्वतःच्या इन्सुलिनला अधिक चांगला प्रतिसाद देण्यास मदत करते.',
        commonSideEffects: ['मळमळ', 'सुरुवातीला जुलाब', 'तोंडात धातूसारखी चव', 'भूक कमी होणे'],
        importantWarnings: [
          'मूत्रपिंडाचा त्रास असल्यास डॉक्टरांना सांगा, कारण मेटफॉर्मिन मूत्रपिंडांमार्फत शरीराबाहेर जाते.',
          'असामान्य स्नायुदुखी, खोल किंवा जलद श्वास, अतिशय थकवा, किंवा उलट्यांसह पोटदुखी असल्यास औषध थांबवून तातडीने वैद्यकीय मदत घ्या.',
          'कॉन्ट्रास्ट डाय वापरणाऱ्या तपासणीपूर्वी आणि शस्त्रक्रियेपूर्वी डॉक्टरांना सांगा.',
          'मद्यपानामुळे लॅक्टिक अ‍ॅसिडोसिस या दुर्मिळ पण गंभीर दुष्परिणामाचा धोका वाढतो.',
        ],
        cautionGroups: ['मूत्रपिंडाचे कार्य कमी असलेले लोक', 'यकृताचा आजार असलेले लोक', 'हृदय निकामी असलेले लोक', 'जास्त मद्यपान करणारे लोक', 'वयस्कर व्यक्ती'],
        storageInformation: '30°C पेक्षा कमी तापमानात कोरड्या जागी, प्रकाशापासून दूर ठेवा.',
      },
    ],
    barcodes: [],
  }),

  demo({
    id: 'med-amlodipine-5-tab',
    slug: 'amlopres-5-mg-tablet',
    brandName: 'Amlopres 5',
    genericName: 'Amlodipine',
    strength: '5 mg',
    dosageForm: 'TABLET',
    manufacturer: 'Cipla Ltd',
    compositionText: 'Each uncoated tablet contains Amlodipine Besylate IP equivalent to Amlodipine 5 mg',
    packSizeText: 'Strip of 15 tablets',
    prescriptionOnly: true,
    summary:
      'Amlodipine is a calcium channel blocker used in the long-term treatment of high blood pressure and certain types of chest pain (angina).',
    commonUses: ['High blood pressure', 'Angina (chest pain related to the heart)'],
    mechanismSummary:
      'Amlodipine relaxes the muscle in blood vessel walls, which widens the vessels and lowers the pressure the heart has to work against.',
    commonSideEffects: ['Swelling of the ankles or feet', 'Flushing', 'Headache', 'Dizziness', 'Tiredness'],
    importantWarnings: [
      'Blood pressure medicines are usually taken long term. Do not change how you take them without talking to your doctor.',
      'Tell your doctor about marked ankle swelling, fainting, or a very fast heartbeat.',
      'Grapefruit juice can affect how this medicine behaves in the body.',
    ],
    cautionGroups: ['People with severe liver disease', 'People with very low blood pressure', 'Older adults', 'People with heart failure'],
    storageInformation: 'Store below 30°C in a dry place, protected from light.',
    ingredients: [{ name: 'Amlodipine', slug: 'amlodipine', amount: '5', unit: 'mg' }],
    translations: [],
    barcodes: [],
  }),

  demo({
    id: 'med-pantoprazole-40-tab',
    slug: 'pan-40-mg-tablet',
    brandName: 'Pan 40',
    genericName: 'Pantoprazole',
    strength: '40 mg',
    dosageForm: 'TABLET',
    manufacturer: 'Alkem Laboratories Ltd',
    compositionText: 'Each enteric coated tablet contains Pantoprazole Sodium Sesquihydrate IP equivalent to Pantoprazole 40 mg',
    packSizeText: 'Strip of 15 tablets',
    prescriptionOnly: true,
    summary:
      'Pantoprazole is a proton pump inhibitor. It reduces the amount of acid the stomach makes and is used for acid-related conditions.',
    commonUses: ['Acid reflux and heartburn', 'Stomach and duodenal ulcers', 'Protecting the stomach lining when prescribed alongside certain other medicines'],
    mechanismSummary:
      'Pantoprazole switches off the acid pumps in the stomach lining, so less acid is produced.',
    commonSideEffects: ['Headache', 'Diarrhoea', 'Nausea', 'Stomach pain', 'Wind'],
    importantWarnings: [
      'Long-term use is a decision for your doctor. Do not extend the course on your own.',
      'Tell your doctor about persistent difficulty swallowing, vomiting blood, black stools, or unexplained weight loss — these need assessment, not self-treatment.',
      'Long-term use has been associated with low magnesium and vitamin B12 levels.',
    ],
    cautionGroups: ['People with liver disease', 'People with low magnesium levels', 'People at risk of osteoporosis', 'Older adults on long-term treatment'],
    storageInformation: 'Store below 30°C, protected from light and moisture. Swallow the tablet whole; do not crush enteric coated tablets.',
    ingredients: [{ name: 'Pantoprazole', slug: 'pantoprazole', amount: '40', unit: 'mg' }],
    translations: [],
    barcodes: [],
  }),

  demo({
    id: 'med-cetirizine-10-tab',
    slug: 'cetzine-10-mg-tablet',
    brandName: 'Cetzine 10',
    genericName: 'Cetirizine Hydrochloride',
    strength: '10 mg',
    dosageForm: 'TABLET',
    manufacturer: 'Dr. Reddy’s Laboratories Ltd',
    compositionText: 'Each film coated tablet contains Cetirizine Hydrochloride IP 10 mg',
    packSizeText: 'Strip of 10 tablets',
    prescriptionOnly: false,
    summary:
      'Cetirizine is an antihistamine used for allergy symptoms such as sneezing, runny nose, itching and hives.',
    commonUses: ['Allergic rhinitis (sneezing, runny or itchy nose)', 'Itchy or watery eyes due to allergy', 'Hives and allergic skin itching'],
    mechanismSummary:
      'Cetirizine blocks histamine, one of the chemicals the body releases during an allergic reaction.',
    commonSideEffects: ['Drowsiness or sleepiness', 'Dry mouth', 'Tiredness', 'Headache'],
    importantWarnings: [
      'This medicine can cause drowsiness. Be careful when driving or operating machinery until you know how it affects you.',
      'Alcohol can increase drowsiness.',
    ],
    cautionGroups: ['People with kidney disease', 'Older adults', 'People who drive or operate machinery'],
    storageInformation: 'Store below 30°C in a dry place, away from light.',
    ingredients: [{ name: 'Cetirizine Hydrochloride', slug: 'cetirizine-hydrochloride', amount: '10', unit: 'mg' }],
    translations: [
      {
        languageCode: 'hi',
        status: 'MACHINE_UNREVIEWED',
        producedBy: 'demo',
        reviewedAt: null,
        summary: 'सेटिरिज़िन एक एंटीहिस्टामाइन दवा है जो छींक, नाक बहना, खुजली और पित्ती जैसे एलर्जी के लक्षणों में उपयोग होती है।',
        commonUses: ['एलर्जिक राइनाइटिस (छींक, नाक बहना या खुजली)', 'एलर्जी से आँखों में खुजली या पानी आना', 'पित्ती और एलर्जी से त्वचा में खुजली'],
        mechanismSummary: 'सेटिरिज़िन हिस्टामाइन को रोकती है, जो एलर्जी प्रतिक्रिया के दौरान शरीर द्वारा छोड़े जाने वाले रसायनों में से एक है।',
        commonSideEffects: ['नींद या सुस्ती', 'मुँह सूखना', 'थकान', 'सिरदर्द'],
        importantWarnings: ['इस दवा से नींद आ सकती है। जब तक इसका असर समझ न आए, गाड़ी चलाते या मशीन चलाते समय सावधानी रखें।', 'शराब से सुस्ती बढ़ सकती है।'],
        cautionGroups: ['गुर्दे की बीमारी वाले लोग', 'बुज़ुर्ग', 'गाड़ी या मशीन चलाने वाले लोग'],
        storageInformation: '30°C से कम तापमान पर सूखी जगह, रोशनी से दूर रखें।',
      },
    ],
    barcodes: [],
  }),

  demo({
    id: 'med-ors-powder',
    slug: 'electral-oral-rehydration-salts-powder',
    brandName: 'Electral',
    genericName: 'Oral Rehydration Salts',
    strength: '21.8 g sachet',
    dosageForm: 'POWDER',
    manufacturer: 'FDC Ltd',
    compositionText:
      'Sodium chloride 2.6 g, Potassium chloride 1.5 g, Sodium citrate 2.9 g, Dextrose anhydrous 13.5 g per sachet',
    packSizeText: 'Sachet of 21.8 g',
    prescriptionOnly: false,
    summary:
      'Oral rehydration salts are a balanced mixture of salts and glucose dissolved in water. They are used to replace fluid and salts lost through diarrhoea, vomiting or heavy sweating.',
    commonUses: ['Replacing fluids and salts lost in diarrhoea', 'Replacing fluids lost through vomiting or heat'],
    mechanismSummary:
      'Glucose helps the gut absorb sodium and water together, so the balanced salt-and-sugar solution is absorbed more effectively than plain water.',
    commonSideEffects: ['Usually well tolerated', 'Occasional vomiting if drunk too quickly'],
    importantWarnings: [
      'Dissolve the whole sachet in the exact amount of clean drinking water stated on the pack. A stronger or weaker solution is not safe.',
      'Seek medical help for signs of severe dehydration: very little urine, sunken eyes, extreme drowsiness, or inability to keep fluids down.',
      'Use the prepared solution within the time stated on the pack, then discard it.',
    ],
    cautionGroups: ['Infants and very young children', 'People with kidney disease', 'People with heart failure', 'People on a salt-restricted diet'],
    storageInformation: 'Store the sachet below 30°C in a dry place. Discard prepared solution as stated on the pack.',
    ingredients: [
      { name: 'Sodium Chloride', slug: 'sodium-chloride', amount: '2.6', unit: 'g' },
      { name: 'Potassium Chloride', slug: 'potassium-chloride', amount: '1.5', unit: 'g' },
      { name: 'Sodium Citrate', slug: 'sodium-citrate', amount: '2.9', unit: 'g' },
      { name: 'Dextrose', slug: 'dextrose', amount: '13.5', unit: 'g' },
    ],
    translations: [],
    barcodes: [],
  }),

  demo({
    id: 'med-ibuprofen-400-tab',
    slug: 'brufen-400-mg-tablet',
    brandName: 'Brufen 400',
    genericName: 'Ibuprofen',
    strength: '400 mg',
    dosageForm: 'TABLET',
    manufacturer: 'Abbott India Ltd',
    compositionText: 'Each film coated tablet contains Ibuprofen IP 400 mg',
    packSizeText: 'Strip of 15 tablets',
    prescriptionOnly: false,
    summary:
      'Ibuprofen is a non-steroidal anti-inflammatory medicine (NSAID) used for pain, inflammation and fever.',
    commonUses: ['Pain with inflammation, such as sprains', 'Joint and muscle pain', 'Period pain', 'Fever', 'Dental pain'],
    mechanismSummary:
      'Ibuprofen reduces the production of prostaglandins, chemicals involved in pain, swelling and fever.',
    commonSideEffects: ['Stomach discomfort or heartburn', 'Nausea', 'Indigestion', 'Dizziness'],
    importantWarnings: [
      'NSAIDs can irritate the stomach lining and can cause bleeding in the digestive tract. Taking them with food may help, but does not remove the risk.',
      'Seek medical help for black stools, vomiting blood, or severe stomach pain.',
      'NSAIDs can affect the kidneys and can raise blood pressure.',
      'Not suitable for everyone during pregnancy — ask a doctor or pharmacist.',
    ],
    cautionGroups: [
      'People with stomach ulcers or a history of gastrointestinal bleeding',
      'People with kidney disease',
      'People with heart disease or high blood pressure',
      'People with asthma who react to painkillers',
      'Older adults',
      'People who are pregnant',
    ],
    storageInformation: 'Store below 30°C in a dry place, protected from light.',
    ingredients: [{ name: 'Ibuprofen', slug: 'ibuprofen', amount: '400', unit: 'mg' }],
    translations: [],
    barcodes: [],
  }),

  demo({
    id: 'med-salbutamol-inhaler',
    slug: 'asthalin-100-mcg-inhaler',
    brandName: 'Asthalin HFA',
    genericName: 'Salbutamol',
    strength: '100 mcg/actuation',
    dosageForm: 'INHALER',
    manufacturer: 'Cipla Ltd',
    compositionText: 'Each actuation delivers Salbutamol Sulphate IP equivalent to Salbutamol 100 mcg',
    packSizeText: '200 metered doses',
    prescriptionOnly: true,
    summary:
      'Salbutamol is a quick-acting inhaled medicine that opens the airways. It is commonly prescribed as a reliever inhaler in asthma and some other breathing conditions.',
    commonUses: ['Relief of wheeze, breathlessness and chest tightness in asthma', 'Relief of airway narrowing in some other lung conditions'],
    mechanismSummary:
      'Salbutamol relaxes the muscle around the airways, which widens them and makes breathing easier within minutes.',
    commonSideEffects: ['Shakiness or tremor, especially in the hands', 'Faster heartbeat', 'Headache', 'Muscle cramps'],
    importantWarnings: [
      'Needing a reliever inhaler more often than usual can be a sign that a breathing condition is not controlled. Tell your doctor.',
      'Seek emergency medical help if breathlessness is severe or the inhaler is not helping.',
      'Correct inhaler technique matters. Ask a pharmacist or nurse to check yours.',
    ],
    cautionGroups: ['People with heart rhythm problems', 'People with an overactive thyroid', 'People with diabetes', 'People with low potassium levels'],
    storageInformation: 'Store below 30°C. Do not freeze or puncture the canister. Keep away from direct sunlight and heat.',
    ingredients: [{ name: 'Salbutamol', slug: 'salbutamol', amount: '100', unit: 'mcg' }],
    translations: [],
    barcodes: [],
  }),

  demo({
    id: 'med-ferrous-folic-tab',
    slug: 'autrin-ferrous-fumarate-folic-acid-tablet',
    brandName: 'Autrin',
    genericName: 'Ferrous Fumarate + Folic Acid',
    strength: '300 mg + 1.5 mg',
    dosageForm: 'TABLET',
    manufacturer: 'Pfizer Ltd',
    compositionText: 'Each tablet contains Ferrous Fumarate 300 mg and Folic Acid 1.5 mg',
    packSizeText: 'Strip of 15 tablets',
    prescriptionOnly: false,
    summary:
      'This is an iron and folic acid supplement. It is used where the body needs additional iron and folate, for example in some forms of anaemia and during pregnancy when advised.',
    commonUses: ['Iron deficiency anaemia, when advised', 'Iron and folic acid supplementation in pregnancy, when advised'],
    mechanismSummary:
      'Iron is needed to make haemoglobin, the part of red blood cells that carries oxygen. Folic acid is needed for making new cells.',
    commonSideEffects: ['Black stools, which is expected with iron', 'Constipation', 'Nausea', 'Stomach discomfort'],
    importantWarnings: [
      'Iron tablets are a common cause of serious poisoning in young children. Keep them well out of reach.',
      'Anaemia has many causes. It should be investigated by a doctor rather than treated on assumption.',
      'Iron can reduce the absorption of some other medicines. Tell your pharmacist what else you take.',
    ],
    cautionGroups: ['Young children (risk of accidental overdose)', 'People with iron overload conditions', 'People with inflammatory bowel disease', 'People taking thyroid or certain antibiotic medicines'],
    storageInformation: 'Store below 30°C in a dry place. Keep securely out of reach of children.',
    ingredients: [
      { name: 'Ferrous Fumarate', slug: 'ferrous-fumarate', amount: '300', unit: 'mg' },
      { name: 'Folic Acid', slug: 'folic-acid', amount: '1.5', unit: 'mg' },
    ],
    translations: [],
    barcodes: [],
  }),
];
