import { z } from 'zod';
import { LANGUAGE_CODES } from '@/config/languages';
import { DOSAGE_FORMS, MEDICINE_STATUSES, SOURCE_CATEGORIES, TRANSLATION_STATUSES, VERIFICATION_STATUSES } from '@/types/medicine';

/**
 * Request validation schemas.
 *
 * Every API route validates with one of these. Client-side checks are for
 * user experience only — nothing here trusts them.
 */

export const languageSchema = z.enum(LANGUAGE_CODES as [string, ...string[]]);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const medicineSearchSchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  ingredient: z.string().trim().max(120).optional(),
  manufacturer: z.string().trim().max(160).optional(),
  dosageForm: z.enum(DOSAGE_FORMS).optional(),
  language: languageSchema.optional(),
});

export const extractedFieldsSchema = z.object({
  brandName: z.string().trim().max(120).nullable(),
  genericName: z.string().trim().max(160).nullable(),
  strength: z.string().trim().max(60).nullable(),
  dosageForm: z.string().trim().max(40).nullable(),
  manufacturer: z.string().trim().max(160).nullable(),
  compositionLine: z.string().trim().max(600).nullable(),
  strengthCandidates: z.array(z.string().trim().max(60)).max(20).default([]),
  ingredientCandidates: z.array(z.string().trim().max(160)).max(20).default([]),
  barcode: z.string().trim().max(32).nullable(),
});

export const reidentifySchema = z.object({
  scanId: z.string().trim().min(1).max(64).optional(),
  fields: extractedFieldsSchema,
  language: languageSchema.default('en'),
});

export const explainSchema = z.object({
  medicineId: z.string().trim().min(1).max(64),
  language: languageSchema.default('en'),
});

export const askSchema = z.object({
  medicineId: z.string().trim().min(1).max(64),
  question: z.string().trim().min(2).max(500),
  language: languageSchema.default('en'),
});

export const preferencesSchema = z.object({
  languageCode: languageSchema.optional(),
  ttsEnabled: z.boolean().optional(),
  ttsRate: z.number().min(0.5).max(2).optional(),
  saveScanImages: z.boolean().optional(),
  highContrast: z.boolean().optional(),
  largeText: z.boolean().optional(),
  onboardingDone: z.boolean().optional(),
});

export const historyCreateSchema = z.object({
  medicineId: z.string().trim().min(1).max(64),
  languageCode: languageSchema.default('en'),
  source: z.enum(['SCAN', 'SEARCH', 'PRESCRIPTION']).default('SEARCH'),
});

export const historyQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
});

// --- Auth -----------------------------------------------------------------

/**
 * Password policy, stated once and reused by sign-up and reset so the two can
 * never drift apart. The same rules are shown to the user by
 * `PASSWORD_RULES` in `config/app.ts`.
 */
const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(128, 'Use no more than 128 characters.')
  .refine((v) => /[a-z]/.test(v), { message: 'Include a lower-case letter.' })
  .refine((v) => /[A-Z]/.test(v), { message: 'Include an upper-case letter.' })
  .refine((v) => /\d/.test(v), { message: 'Include a number.' });

export const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(80).optional(),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export const deleteAccountSchema = z.object({
  confirm: z.literal('DELETE'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

export const resetPasswordSchema = z
  .object({
    // Long enough to be a real token; the value itself is never echoed back.
    token: z.string().trim().min(16).max(256),
    password: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'The two passwords do not match.',
    path: ['confirmPassword'],
  });

export const inspectResetTokenSchema = z.object({
  token: z.string().trim().min(16).max(256),
});

// --- Admin ----------------------------------------------------------------

export const adminMedicineSchema = z.object({
  brandName: z.string().trim().min(1).max(120),
  genericName: z.string().trim().min(1).max(160),
  strength: z.string().trim().min(1).max(60),
  dosageForm: z.enum(DOSAGE_FORMS),
  manufacturer: z.string().trim().max(160).nullish(),
  compositionText: z.string().trim().max(1000).nullish(),
  packSizeText: z.string().trim().max(120).nullish(),
  country: z.string().trim().length(2).default('IN'),
  prescriptionOnly: z.boolean().default(true),
  summary: z.string().trim().max(2000).nullish(),
  commonUses: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  mechanismSummary: z.string().trim().max(2000).nullish(),
  commonSideEffects: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
  importantWarnings: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  cautionGroups: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
  storageInformation: z.string().trim().max(1000).nullish(),
  status: z.enum(MEDICINE_STATUSES).default('DRAFT'),
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(160),
        amount: z.string().trim().max(30).nullish(),
        unit: z.string().trim().max(20).nullish(),
      }),
    )
    .max(12)
    .default([]),
});

export const adminMedicineUpdateSchema = adminMedicineSchema.partial();

export const adminVerifySchema = z.object({
  verificationStatus: z.enum(VERIFICATION_STATUSES),
  reviewNotes: z.string().trim().max(2000).nullish(),
});

export const adminSourceSchema = z.object({
  medicineId: z.string().trim().min(1).max(64),
  category: z.enum(SOURCE_CATEGORIES),
  name: z.string().trim().min(2).max(200),
  url: z.string().trim().url().max(500).nullish().or(z.literal('')),
  version: z.string().trim().max(60).nullish(),
  retrievedAt: z.string().datetime().nullish(),
  notes: z.string().trim().max(1000).nullish(),
});

export const adminTranslationSchema = z.object({
  medicineId: z.string().trim().min(1).max(64),
  languageCode: languageSchema,
  summary: z.string().trim().max(2000).nullish(),
  commonUses: z.array(z.string().trim().max(300)).max(20).default([]),
  mechanismSummary: z.string().trim().max(2000).nullish(),
  commonSideEffects: z.array(z.string().trim().max(300)).max(30).default([]),
  importantWarnings: z.array(z.string().trim().max(500)).max(30).default([]),
  cautionGroups: z.array(z.string().trim().max(300)).max(30).default([]),
  storageInformation: z.string().trim().max(1000).nullish(),
  status: z.enum(TRANSLATION_STATUSES).default('MACHINE_UNREVIEWED'),
});

export const adminListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  status: z.enum(MEDICINE_STATUSES).optional(),
  verificationStatus: z.enum(VERIFICATION_STATUSES).optional(),
});
