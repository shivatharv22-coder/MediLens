import type { DosageForm, SourceCategory } from '@/types/medicine';

/**
 * Display labels.
 *
 * These are English labels for enum values. They are intentionally not part of
 * the i18n dictionaries: the set changes with the schema, and a missing label
 * should read as the raw enum rather than as an empty string.
 */

const DOSAGE_FORM_LABELS: Record<DosageForm, string> = {
  TABLET: 'Tablet',
  CAPSULE: 'Capsule',
  ORAL_SUSPENSION: 'Oral suspension',
  ORAL_SOLUTION: 'Oral solution',
  SYRUP: 'Syrup',
  INJECTION: 'Injection',
  TOPICAL_CREAM: 'Cream',
  TOPICAL_OINTMENT: 'Ointment',
  TOPICAL_GEL: 'Gel',
  EYE_DROPS: 'Eye drops',
  EAR_DROPS: 'Ear drops',
  NASAL_SPRAY: 'Nasal spray',
  INHALER: 'Inhaler',
  POWDER: 'Powder',
  GRANULES: 'Granules',
  SUPPOSITORY: 'Suppository',
  PATCH: 'Patch',
  OTHER: 'Other',
};

export function dosageFormLabel(form: DosageForm | string): string {
  return DOSAGE_FORM_LABELS[form as DosageForm] ?? String(form).replace(/_/g, ' ').toLowerCase();
}

const SOURCE_CATEGORY_LABELS: Record<SourceCategory, string> = {
  GOVERNMENT_REGULATORY: 'Government / regulatory source',
  OFFICIAL_PRODUCT_DOCUMENTATION: 'Official product documentation',
  AUTHORITATIVE_DRUG_DATABASE: 'Authoritative drug information database',
  MANUFACTURER_DOCUMENTATION: 'Manufacturer documentation',
  ACADEMIC_REFERENCE: 'Academic reference',
  DEMO_SEED_DATA: 'Demo seed data — not a verified medical source',
};

export function sourceCategoryLabel(category: SourceCategory | string): string {
  return (
    SOURCE_CATEGORY_LABELS[category as SourceCategory] ??
    String(category).replace(/_/g, ' ').toLowerCase()
  );
}

/** Locale-aware date, safe against invalid input. */
export function formatDate(value: string | Date | null | undefined, locale = 'en-IN'): string | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-IN' : `${locale}-IN`, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined, locale = 'en-IN'): string | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-IN' : `${locale}-IN`, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
