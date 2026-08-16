/**
 * Domain types for medicine data.
 *
 * These are deliberately independent of Prisma so that the repository layer can
 * be backed by the database, by the bundled demo dataset, or by a future
 * external source without the UI noticing.
 */

export const DOSAGE_FORMS = [
  'TABLET',
  'CAPSULE',
  'ORAL_SUSPENSION',
  'ORAL_SOLUTION',
  'SYRUP',
  'INJECTION',
  'TOPICAL_CREAM',
  'TOPICAL_OINTMENT',
  'TOPICAL_GEL',
  'EYE_DROPS',
  'EAR_DROPS',
  'NASAL_SPRAY',
  'INHALER',
  'POWDER',
  'GRANULES',
  'SUPPOSITORY',
  'PATCH',
  'OTHER',
] as const;

export type DosageForm = (typeof DOSAGE_FORMS)[number];

export const SOURCE_CATEGORIES = [
  'GOVERNMENT_REGULATORY',
  'OFFICIAL_PRODUCT_DOCUMENTATION',
  'AUTHORITATIVE_DRUG_DATABASE',
  'MANUFACTURER_DOCUMENTATION',
  'ACADEMIC_REFERENCE',
  'DEMO_SEED_DATA',
] as const;

export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

export const MEDICINE_STATUSES = ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED'] as const;
export type MedicineStatus = (typeof MEDICINE_STATUSES)[number];

export const VERIFICATION_STATUSES = [
  'UNVERIFIED',
  'PENDING_REVIEW',
  'VERIFIED',
  'REJECTED',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const TRANSLATION_STATUSES = [
  'MACHINE_UNREVIEWED',
  'HUMAN_REVIEWED',
  'REJECTED',
] as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

export interface MedicineIngredientRef {
  name: string;
  slug: string;
  amount: string | null;
  unit: string | null;
}

export interface MedicineSourceRef {
  id: string;
  category: SourceCategory;
  name: string;
  url: string | null;
  version: string | null;
  retrievedAt: string | null;
}

/**
 * The verified, language-specific body content of a medicine record.
 * Every field here must trace back to `sources`.
 */
export interface MedicineContent {
  summary: string | null;
  commonUses: string[];
  mechanismSummary: string | null;
  commonSideEffects: string[];
  importantWarnings: string[];
  cautionGroups: string[];
  storageInformation: string | null;
}

export interface MedicineTranslationRecord extends MedicineContent {
  languageCode: string;
  status: TranslationStatus;
  producedBy: string | null;
  reviewedAt: string | null;
}

/** A medicine exactly as stored. Language-neutral fields plus English content. */
export interface Medicine extends MedicineContent {
  id: string;
  slug: string;
  brandName: string;
  genericName: string;
  strength: string;
  dosageForm: DosageForm;
  manufacturer: string | null;
  compositionText: string | null;
  packSizeText: string | null;
  country: string;
  prescriptionOnly: boolean;
  status: MedicineStatus;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string | null;
  ingredients: MedicineIngredientRef[];
  sources: MedicineSourceRef[];
  translations: MedicineTranslationRecord[];
  barcodes: string[];
  createdAt: string;
  updatedAt: string;
}

/** Compact shape used by search results and candidate lists. */
export interface MedicineSummary {
  id: string;
  slug: string;
  brandName: string;
  genericName: string;
  strength: string;
  dosageForm: DosageForm;
  manufacturer: string | null;
}

/**
 * A medicine resolved into one display language.
 *
 * `contentLanguage` is the language the body text is actually in — it can differ
 * from the requested language when no translation exists, and
 * `translationStatus` tells the UI whether a human has reviewed it.
 */
export interface LocalisedMedicine extends Omit<Medicine, 'translations'> {
  contentLanguage: string;
  requestedLanguage: string;
  translationStatus: TranslationStatus | 'ORIGINAL';
  translationFallback: boolean;
}

export interface MedicineSearchQuery {
  q?: string;
  ingredient?: string;
  manufacturer?: string;
  dosageForm?: DosageForm;
  page?: number;
  pageSize?: number;
  /** Admin-only. Users always get PUBLISHED records. */
  status?: MedicineStatus;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
