/**
 * Bulk-import medicines from a CSV into the database.
 *
 * Usage:
 *   npx tsx scripts/import-medicines-csv.ts medicines.csv
 *   npx tsx scripts/import-medicines-csv.ts medicines.csv --publish
 *
 * Needs DATABASE_URL. Without it, the app serves the bundled demo dataset in
 * `database/data/demo-medicines.ts` instead and this script cannot run.
 *
 * SAFETY — read before using this on anything real
 * ------------------------------------------------
 * Rows are imported UNVERIFIED. `--publish` makes them visible in search and
 * scanning, which is what you want for a demo, but it does NOT mark them
 * verified: each record still shows "Not yet verified" and cites the source you
 * give below. Nothing here can produce a VERIFIED record — that still requires
 * a reviewer and a non-demo source through the admin screens, exactly as
 * docs/SAFETY.md §4 requires.
 *
 * Only put information in this CSV that you have taken from a real source, and
 * name that source in the sourceName/sourceCategory columns.
 *
 * CSV columns (header row required; order does not matter)
 * --------------------------------------------------------
 *   brandName*        Crocin 500
 *   genericName*      Paracetamol
 *   strength*         500 mg
 *   dosageForm*       TABLET | CAPSULE | ORAL_SUSPENSION | SYRUP | INHALER | ...
 *   manufacturer      GlaxoSmithKline Pharmaceuticals Ltd
 *   compositionText   Each tablet contains Paracetamol IP 500 mg
 *   packSizeText      Strip of 15 tablets
 *   prescriptionOnly  true | false
 *   summary           What the medicine is, in plain language
 *   commonUses        Fever | Headache | Body ache          (pipe separated)
 *   mechanismSummary  How it generally works
 *   commonSideEffects Nausea | Skin rash                    (pipe separated)
 *   importantWarnings Do not exceed the labelled dose        (pipe separated)
 *   cautionGroups     People with liver disease              (pipe separated)
 *   storageInformation Store below 30°C
 *   sourceName        CDSCO product information
 *   sourceCategory    GOVERNMENT_REGULATORY | OFFICIAL_PRODUCT_DOCUMENTATION |
 *                     AUTHORITATIVE_DRUG_DATABASE | MANUFACTURER_DOCUMENTATION |
 *                     ACADEMIC_REFERENCE | DEMO_SEED_DATA   (default DEMO_SEED_DATA)
 *   sourceUrl         https://...
 *
 * (* required)
 */
import path from 'node:path';
import fs from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../database/generated/prisma/client';
import { DOSAGE_FORMS, SOURCE_CATEGORIES } from '../types/medicine';
import { normalise, slugify } from '../utils/text';

for (const f of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(path.join(process.cwd(), f));
  } catch {
    // Optional.
  }
}

const file = process.argv[2];
const publish = process.argv.includes('--publish');

if (!file) {
  console.error('Usage: npx tsx scripts/import-medicines-csv.ts <file.csv> [--publish]');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. This script writes to PostgreSQL.');
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

/** Minimal RFC-4180 parser: handles quoted fields, embedded commas and newlines. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim().length));
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const list = (v: string) =>
  v ? v.split('|').map((s) => s.trim()).filter(Boolean) : [];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  console.log(`Read ${rows.length} rows from ${file}`);

  let created = 0;
  let updated = 0;
  const problems: string[] = [];

  for (const [index, row] of rows.entries()) {
    const line = index + 2; // +1 for the header, +1 for 1-based counting
    const brandName = row.brandName;
    const genericName = row.genericName;
    const strength = row.strength;
    const dosageForm = (row.dosageForm || 'TABLET').toUpperCase();

    if (!brandName || !genericName || !strength) {
      problems.push(`Line ${line}: brandName, genericName and strength are all required.`);
      continue;
    }
    if (!(DOSAGE_FORMS as readonly string[]).includes(dosageForm)) {
      problems.push(`Line ${line}: dosageForm "${dosageForm}" is not valid.`);
      continue;
    }

    const category = (row.sourceCategory || 'DEMO_SEED_DATA').toUpperCase();
    if (!(SOURCE_CATEGORIES as readonly string[]).includes(category)) {
      problems.push(`Line ${line}: sourceCategory "${category}" is not valid.`);
      continue;
    }

    const slug = slugify(`${brandName} ${strength} ${dosageForm.replace(/_/g, ' ')}`);
    const data = {
      brandName,
      genericName,
      strength,
      dosageForm: dosageForm as never,
      manufacturer: row.manufacturer || null,
      compositionText: row.compositionText || null,
      packSizeText: row.packSizeText || null,
      prescriptionOnly: (row.prescriptionOnly || 'true').toLowerCase() !== 'false',
      summary: row.summary || null,
      commonUses: list(row.commonUses),
      mechanismSummary: row.mechanismSummary || null,
      commonSideEffects: list(row.commonSideEffects),
      importantWarnings: list(row.importantWarnings),
      cautionGroups: list(row.cautionGroups),
      storageInformation: row.storageInformation || null,
      searchText: normalise([brandName, genericName, row.manufacturer ?? '', strength].join(' ')),
      // Imported content is never verified, whatever the source column says.
      // Verification is a human decision made in the admin screens.
      status: (publish ? 'PUBLISHED' : 'DRAFT') as never,
      verificationStatus: 'UNVERIFIED' as never,
      lastVerifiedAt: null,
    };

    const existing = await prisma.medicine.findUnique({ where: { slug }, select: { id: true } });
    const medicine = existing
      ? await prisma.medicine.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.medicine.create({ data: { slug, ...data }, select: { id: true } });
    existing ? (updated += 1) : (created += 1);

    // Ingredient: the generic name, so ingredient search finds the record.
    const ingredientSlug = slugify(genericName);
    const ingredient = await prisma.activeIngredient.upsert({
      where: { slug: ingredientSlug },
      create: { slug: ingredientSlug, name: genericName },
      update: {},
      select: { id: true },
    });
    await prisma.medicineIngredient.deleteMany({ where: { medicineId: medicine.id } });
    await prisma.medicineIngredient.create({
      data: { medicineId: medicine.id, ingredientId: ingredient.id, sortOrder: 0 },
    });

    // Every record must cite something (docs/SAFETY.md §4).
    await prisma.medicineSource.deleteMany({ where: { medicineId: medicine.id } });
    await prisma.medicineSource.create({
      data: {
        medicineId: medicine.id,
        category: category as never,
        name: row.sourceName || 'Bulk CSV import (not a verified medical source)',
        url: row.sourceUrl || null,
        notes: `Imported from ${path.basename(file)}.`,
      },
    });
  }

  console.log(`\nCreated ${created}, updated ${updated}.`);
  if (publish) {
    console.log('Rows were published, so they appear in search and scanning.');
  } else {
    console.log('Rows were imported as DRAFT. Re-run with --publish to make them visible.');
  }
  console.log('All rows are UNVERIFIED and will display "Not yet verified" to users.');

  if (problems.length) {
    console.log(`\n${problems.length} row(s) skipped:`);
    for (const p of problems.slice(0, 30)) console.log(`  ${p}`);
  }
}

main()
  .catch((e) => {
    console.error('Import failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
