import 'server-only';
import type { PrismaClient } from '@/lib/db';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { normalise, slugify } from '@/utils/text';
import type { z } from 'zod';
import type { adminMedicineSchema, adminMedicineUpdateSchema } from '@/lib/schemas';

type CreateInput = z.infer<typeof adminMedicineSchema>;
type UpdateInput = z.infer<typeof adminMedicineUpdateSchema>;

/**
 * Admin write operations on medicine records.
 *
 * Two invariants are enforced here rather than left to the caller:
 *  - the (brand, strength, form, manufacturer) tuple is unique, so the same
 *    product cannot be entered twice under slightly different text;
 *  - any content change resets verification to PENDING_REVIEW, so edited text
 *    can never keep an older record's "verified" badge.
 */

function buildSlug(input: { brandName: string; strength: string; dosageForm: string }): string {
  return slugify(`${input.brandName} ${input.strength} ${input.dosageForm.replace(/_/g, ' ')}`);
}

function buildSearchText(input: {
  brandName: string;
  genericName: string;
  manufacturer?: string | null;
  strength: string;
}): string {
  return normalise(
    [input.brandName, input.genericName, input.manufacturer ?? '', input.strength].join(' '),
  );
}

async function upsertIngredients(
  db: PrismaClient,
  medicineId: string,
  ingredients: CreateInput['ingredients'],
) {
  await db.medicineIngredient.deleteMany({ where: { medicineId } });
  if (!ingredients.length) return;

  let sortOrder = 0;
  for (const ingredient of ingredients) {
    const slug = slugify(ingredient.name);
    const record = await db.activeIngredient.upsert({
      where: { slug },
      create: { slug, name: ingredient.name.trim() },
      update: {},
      select: { id: true },
    });
    await db.medicineIngredient.create({
      data: {
        medicineId,
        ingredientId: record.id,
        amount: ingredient.amount ?? null,
        unit: ingredient.unit ?? null,
        sortOrder: sortOrder++,
      },
    });
  }
}

/** Fields whose change invalidates a previous verification. */
const CONTENT_FIELDS: string[] = [
  'summary',
  'commonUses',
  'mechanismSummary',
  'commonSideEffects',
  'importantWarnings',
  'cautionGroups',
  'storageInformation',
  'brandName',
  'genericName',
  'strength',
  'dosageForm',
  'manufacturer',
  'compositionText',
  'prescriptionOnly',
];

export async function createMedicine(db: PrismaClient, input: CreateInput) {
  const slug = buildSlug(input);

  const clash = await db.medicine.findFirst({
    where: {
      OR: [
        { slug },
        {
          brandName: input.brandName,
          strength: input.strength,
          dosageForm: input.dosageForm,
          manufacturer: input.manufacturer ?? null,
        },
      ],
    },
    select: { id: true },
  });
  if (clash) {
    throw new AppError(ERROR_CODES.CONFLICT, {
      details: { brandName: ['A medicine with this brand, strength, form and manufacturer already exists.'] },
    });
  }

  const { ingredients, ...rest } = input;
  const medicine = await db.medicine.create({
    data: {
      ...rest,
      manufacturer: rest.manufacturer ?? null,
      compositionText: rest.compositionText ?? null,
      packSizeText: rest.packSizeText ?? null,
      summary: rest.summary ?? null,
      mechanismSummary: rest.mechanismSummary ?? null,
      storageInformation: rest.storageInformation ?? null,
      slug,
      searchText: buildSearchText(rest),
      verificationStatus: 'UNVERIFIED',
    },
    select: { id: true, slug: true },
  });

  await upsertIngredients(db, medicine.id, ingredients);
  return medicine;
}

export async function updateMedicine(db: PrismaClient, id: string, input: UpdateInput) {
  const existing = await db.medicine.findUnique({ where: { id } });
  if (!existing) throw new AppError(ERROR_CODES.NOT_FOUND);

  const { ingredients, ...rest } = input;
  const merged = {
    brandName: rest.brandName ?? existing.brandName,
    genericName: rest.genericName ?? existing.genericName,
    strength: rest.strength ?? existing.strength,
    dosageForm: rest.dosageForm ?? existing.dosageForm,
    manufacturer: rest.manufacturer ?? existing.manufacturer,
  };

  const provided = rest as Record<string, unknown>;
  const contentChanged = CONTENT_FIELDS.some(
    (field) => field in provided && provided[field] !== undefined,
  );

  const medicine = await db.medicine.update({
    where: { id },
    data: {
      ...rest,
      slug: buildSlug(merged),
      searchText: buildSearchText(merged),
      ...(contentChanged
        ? {
            // Edited content is no longer the text a reviewer approved.
            verificationStatus: 'PENDING_REVIEW' as const,
            lastVerifiedAt: null,
          }
        : {}),
    },
    select: { id: true, slug: true, verificationStatus: true },
  });

  if (ingredients) await upsertIngredients(db, id, ingredients);
  return { ...medicine, verificationReset: contentChanged };
}

/**
 * Publishing gate: a record may only go live once it is VERIFIED and has at
 * least one source that is not demo seed data.
 */
export async function assertPublishable(db: PrismaClient, id: string): Promise<void> {
  const medicine = await db.medicine.findUnique({
    where: { id },
    select: { verificationStatus: true, sources: { select: { category: true } } },
  });
  if (!medicine) throw new AppError(ERROR_CODES.NOT_FOUND);

  const problems: string[] = [];
  if (medicine.verificationStatus !== 'VERIFIED') {
    problems.push('The record must be verified before it can be published.');
  }
  if (!medicine.sources.length) {
    problems.push('The record must have at least one source.');
  } else if (medicine.sources.every((s) => s.category === 'DEMO_SEED_DATA')) {
    problems.push('Demo seed data cannot be the only source of a published record.');
  }

  if (problems.length) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, { details: { status: problems } });
  }
}

export { buildSearchText, buildSlug };
