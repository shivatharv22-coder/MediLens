/**
 * Database seed.
 *
 * Inserts the supported languages and the bundled DEMO dataset. Everything it
 * writes is marked `DEMO_SEED_DATA` and left `UNVERIFIED`, so a seeded database
 * still shows the DEVELOPMENT / DEMO banner and no record can be published
 * until a real source is attached and a reviewer verifies it (§47).
 *
 * Run with: npm run db:seed
 */
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
import { SUPPORTED_LANGUAGES } from '../config/languages';
import { DEMO_MEDICINES } from './data/demo-medicines';
import { normalise, slugify } from '../utils/text';

for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // Not present; the shell environment may already provide DATABASE_URL.
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Seeding needs a PostgreSQL connection.');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function seedLanguages() {
  for (const language of SUPPORTED_LANGUAGES) {
    await prisma.supportedLanguage.upsert({
      where: { code: language.code },
      create: {
        code: language.code,
        englishName: language.englishName,
        nativeName: language.nativeName,
        speechLocale: language.speechLocale,
        isRtl: language.isRtl,
        sortOrder: language.sortOrder,
      },
      update: {
        englishName: language.englishName,
        nativeName: language.nativeName,
        speechLocale: language.speechLocale,
        sortOrder: language.sortOrder,
      },
    });
  }
  console.log(`Seeded ${SUPPORTED_LANGUAGES.length} languages.`);
}

async function seedMedicines() {
  let created = 0;

  for (const medicine of DEMO_MEDICINES) {
    const searchText = normalise(
      [medicine.brandName, medicine.genericName, medicine.manufacturer ?? '', medicine.strength].join(' '),
    );

    const record = await prisma.medicine.upsert({
      where: { slug: medicine.slug },
      create: {
        slug: medicine.slug,
        brandName: medicine.brandName,
        genericName: medicine.genericName,
        strength: medicine.strength,
        dosageForm: medicine.dosageForm,
        manufacturer: medicine.manufacturer,
        compositionText: medicine.compositionText,
        packSizeText: medicine.packSizeText,
        country: medicine.country,
        prescriptionOnly: medicine.prescriptionOnly,
        summary: medicine.summary,
        commonUses: medicine.commonUses,
        mechanismSummary: medicine.mechanismSummary,
        commonSideEffects: medicine.commonSideEffects,
        importantWarnings: medicine.importantWarnings,
        cautionGroups: medicine.cautionGroups,
        storageInformation: medicine.storageInformation,
        searchText,
        // Demo content is published so the app is usable, but never verified.
        status: 'PUBLISHED',
        verificationStatus: 'UNVERIFIED',
        lastVerifiedAt: null,
      },
      update: { searchText },
      select: { id: true },
    });

    // Ingredients
    await prisma.medicineIngredient.deleteMany({ where: { medicineId: record.id } });
    let sortOrder = 0;
    for (const ingredient of medicine.ingredients) {
      const slug = ingredient.slug || slugify(ingredient.name);
      const active = await prisma.activeIngredient.upsert({
        where: { slug },
        create: { slug, name: ingredient.name },
        update: {},
        select: { id: true },
      });
      await prisma.medicineIngredient.create({
        data: {
          medicineId: record.id,
          ingredientId: active.id,
          amount: ingredient.amount,
          unit: ingredient.unit,
          sortOrder: sortOrder++,
        },
      });
    }

    // Sources — always the demo category for seeded content.
    await prisma.medicineSource.deleteMany({ where: { medicineId: record.id } });
    for (const source of medicine.sources) {
      await prisma.medicineSource.create({
        data: {
          medicineId: record.id,
          category: 'DEMO_SEED_DATA',
          name: source.name,
          url: source.url,
          version: source.version,
          notes: 'Seeded demo content. Replace with a verified source before publication.',
        },
      });
    }

    // Translations
    for (const translation of medicine.translations) {
      await prisma.medicineTranslation.upsert({
        where: {
          medicineId_languageCode: {
            medicineId: record.id,
            languageCode: translation.languageCode,
          },
        },
        create: {
          medicineId: record.id,
          languageCode: translation.languageCode,
          summary: translation.summary,
          commonUses: translation.commonUses,
          mechanismSummary: translation.mechanismSummary,
          commonSideEffects: translation.commonSideEffects,
          importantWarnings: translation.importantWarnings,
          cautionGroups: translation.cautionGroups,
          storageInformation: translation.storageInformation,
          status: translation.status,
          producedBy: 'seed',
          reviewedAt: translation.reviewedAt ? new Date(translation.reviewedAt) : null,
        },
        update: {},
      });
    }

    // Barcodes
    for (const code of medicine.barcodes) {
      await prisma.medicineBarcode.upsert({
        where: { code_medicineId: { code, medicineId: record.id } },
        create: { code, medicineId: record.id, symbology: 'EAN-13' },
        update: {},
      });
    }

    created += 1;
  }

  console.log(`Seeded ${created} demo medicine records (all UNVERIFIED, DEMO_SEED_DATA source).`);
}

async function main() {
  console.log('Seeding MediLens…');
  await seedLanguages();
  await seedMedicines();
  console.log('\nDone. This database contains DEMO data only.');
  console.log('Keep NEXT_PUBLIC_DEMO_MODE=true until verified records replace it.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
