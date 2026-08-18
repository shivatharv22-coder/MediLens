/**
 * Bulk-import the A-Z India medicines CSV into PostgreSQL.
 *
 * Usage:
 *   npx tsx scripts/import-medicines.ts                 # import missing rows as DRAFT
 *   npx tsx scripts/import-medicines.ts --publish       # ...and make them visible to users
 *   npx tsx scripts/import-medicines.ts --limit 5000    # try a slice first
 *
 * WHY THIS WAS REWRITTEN
 * ----------------------
 * The first version issued one `prisma.medicine.upsert()` per CSV row. Against
 * a remote database that is one network round-trip each: measured at 12.8
 * rows/second, which is 5.4 hours for this file. It died 28 minutes in, having
 * written 21,406 rows, all still inside the "A" section of an A-Z sorted file.
 *
 * This version buffers rows and uses `createMany({ skipDuplicates: true })`,
 * turning ~250,000 round-trips into ~250. Because conflicting rows are skipped
 * rather than updated, re-running is safe and only inserts what is missing,
 * which is also how it resumes after an interruption.
 *
 * SAFETY
 * ------
 * Rows land UNVERIFIED and each gets a source row naming this CSV, which is a
 * scraped dataset and NOT an authoritative medical source. Nothing here can
 * mark a record VERIFIED: that still needs a reviewer and a real source through
 * the admin screens (docs/SAFETY.md section 4). `--publish` only controls
 * visibility; users still see "Not yet verified" on every one of these.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse';
import { loadEnvConfig } from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../database/generated/prisma/client';

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing.');

const PUBLISH = process.argv.includes('--publish');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

/** Rows per INSERT. The whole point of the rewrite: keep this well above 1. */
const BATCH = 1000;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const csvPath = path.join(process.cwd(), 'database', 'medicines.csv');

const clean = (v: unknown): string => String(v ?? '').trim();

function makeSlug(name: string, manufacturer: string, id: string): string {
  const base = `${name}-${manufacturer}-${id}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `medicine-${id}`;
}

const STRENGTH = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|%|iu)\b/i;

function getStrength(name: string, composition: string): string {
  return name.match(STRENGTH)?.[0] ?? composition.match(STRENGTH)?.[0] ?? 'Not specified';
}

const FORMS: [string, string][] = [
  ['eye drop', 'EYE_DROPS'],
  ['ear drop', 'EAR_DROPS'],
  ['nasal spray', 'NASAL_SPRAY'],
  ['tablet', 'TABLET'],
  ['capsule', 'CAPSULE'],
  ['syrup', 'SYRUP'],
  ['suspension', 'ORAL_SUSPENSION'],
  ['solution', 'ORAL_SOLUTION'],
  ['injection', 'INJECTION'],
  ['cream', 'TOPICAL_CREAM'],
  ['ointment', 'TOPICAL_OINTMENT'],
  ['gel', 'TOPICAL_GEL'],
  ['inhaler', 'INHALER'],
  ['powder', 'POWDER'],
  ['granule', 'GRANULES'],
  ['suppository', 'SUPPOSITORY'],
  ['patch', 'PATCH'],
];

function getDosageForm(name: string, packSize: string): string {
  const text = `${name} ${packSize}`.toLowerCase();
  for (const [needle, form] of FORMS) if (text.includes(needle)) return form;
  return 'OTHER';
}

interface Row {
  slug: string;
  brandName: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string | null;
  compositionText: string | null;
  packSizeText: string | null;
  country: string;
  commonUses: string[];
  commonSideEffects: string[];
  importantWarnings: string[];
  cautionGroups: string[];
  searchText: string;
  status: string;
  verificationStatus: string;
}

async function flush(buffer: Row[]): Promise<number> {
  if (!buffer.length) return 0;
  // skipDuplicates makes this idempotent against BOTH unique constraints: the
  // slug index and the (brandName, strength, dosageForm, manufacturer) identity
  // index. That is what lets the script resume.
  const result = await prisma.medicine.createMany({
    data: buffer as never,
    skipDuplicates: true,
  });
  return result.count;
}

/** Give every medicine a source row. Idempotent, so safe to re-run. */
async function backfillSources(): Promise<number> {
  let created = 0;
  for (;;) {
    const missing = await prisma.medicine.findMany({
      where: { sources: { none: {} } },
      select: { id: true },
      take: 5000,
    });
    if (!missing.length) break;
    const res = await prisma.medicineSource.createMany({
      data: missing.map((m) => ({
        medicineId: m.id,
        category: 'DEMO_SEED_DATA',
        name: 'A-Z India medicines dataset (bulk CSV import, not a verified medical source)',
        notes: 'Imported by scripts/import-medicines.ts. Requires review before verification.',
      })) as never,
      skipDuplicates: true,
    });
    created += res.count;
    process.stdout.write(`  sources: ${created}\r`);
  }
  return created;
}

async function main() {
  if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);

  const before = await prisma.medicine.count();
  console.log('MediLens bulk medicine import');
  console.log(`CSV        : ${csvPath}`);
  console.log(`Already in : ${before.toLocaleString()} medicines`);
  console.log(
    `Mode       : ${PUBLISH ? 'PUBLISHED (visible to users)' : 'DRAFT (not visible until published)'}`,
  );
  console.log(`Batch size : ${BATCH}\n`);

  // Existing slugs are loaded once so known rows are never re-sent over the
  // wire. The database would reject them anyway; this just saves the traffic
  // and makes "already present" reportable.
  console.log('Loading existing slugs...');
  const existing = new Set<string>();
  const pageSize = 50_000;
  for (let skip = 0; ; skip += pageSize) {
    const page = await prisma.medicine.findMany({
      select: { slug: true },
      skip,
      take: pageSize,
      orderBy: { slug: 'asc' },
    });
    for (const r of page) existing.add(r.slug);
    if (page.length < pageSize) break;
  }
  console.log(`Loaded ${existing.size.toLocaleString()} existing slugs.\n`);

  const seenSlug = new Set<string>(existing);
  const seenIdentity = new Set<string>();

  let processed = 0;
  let inserted = 0;
  let alreadyPresent = 0;
  let dupInFile = 0;
  let identityClash = 0;
  let noName = 0;
  let buffered = 0;
  let buffer: Row[] = [];

  const started = Date.now();
  const parser = fs
    .createReadStream(csvPath)
    .pipe(parse({ columns: true, skip_empty_lines: true, relax_column_count: true, bom: true }));

  for await (const row of parser) {
    if (processed >= LIMIT) break;
    processed++;

    const brandName = clean(row.name);
    if (!brandName) {
      noName++;
      continue;
    }

    const manufacturer = clean(row.manufacturer_name);
    const id = clean(row.id) || String(processed);
    const c1 = clean(row.short_composition1);
    const c2 = clean(row.short_composition2);
    const compositionText = [c1, c2].filter(Boolean).join(' + ');
    const packSizeText = clean(row.pack_size_label);
    const strength = getStrength(brandName, compositionText);
    const dosageForm = getDosageForm(brandName, packSizeText);
    const slug = makeSlug(brandName, manufacturer, id);

    if (existing.has(slug)) {
      alreadyPresent++;
      continue;
    }
    if (seenSlug.has(slug)) {
      dupInFile++;
      continue;
    }
    seenSlug.add(slug);

    // The composite unique index would reject these anyway; filtering here
    // keeps the batch clean and makes the count reportable.
    const identity = `${brandName}|${strength}|${dosageForm}|${manufacturer}`;
    if (seenIdentity.has(identity)) {
      identityClash++;
      continue;
    }
    seenIdentity.add(identity);

    const genericName = c1.split('(')[0].trim().replace(/\s+/g, ' ') || brandName;

    buffer.push({
      slug,
      brandName,
      genericName,
      strength,
      dosageForm,
      manufacturer: manufacturer || null,
      compositionText: compositionText || null,
      packSizeText: packSizeText || null,
      country: 'IN',
      commonUses: [row.use0, row.use1, row.use2, row.use3, row.use4].map(clean).filter(Boolean),
      commonSideEffects: clean(row.Consolidated_Side_Effects)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      importantWarnings: [],
      cautionGroups: [],
      searchText: `${brandName} ${genericName} ${manufacturer}`.toLowerCase(),
      status: PUBLISH ? 'PUBLISHED' : 'DRAFT',
      verificationStatus: 'UNVERIFIED',
    });

    if (buffer.length >= BATCH) {
      buffered += buffer.length;
      inserted += await flush(buffer);
      buffer = [];
      const rate = processed / ((Date.now() - started) / 1000);
      process.stdout.write(
        `  read ${processed.toLocaleString()} | inserted ${inserted.toLocaleString()} | ${rate.toFixed(0)}/s   \r`,
      );
    }
  }

  buffered += buffer.length;
  inserted += await flush(buffer);

  const secs = (Date.now() - started) / 1000;
  const after = await prisma.medicine.count();

  console.log('\n\n========== IMPORT COMPLETE ==========');
  console.log(`Rows read from CSV      : ${processed.toLocaleString()}`);
  console.log(`  already in database   : ${alreadyPresent.toLocaleString()}`);
  console.log(`  duplicate slug in file: ${dupInFile.toLocaleString()}`);
  console.log(`  identity collisions   : ${identityClash.toLocaleString()}`);
  console.log(`  missing name          : ${noName.toLocaleString()}`);
  console.log(`Sent to database        : ${buffered.toLocaleString()}`);
  // The database enforces the identity index too. Anything sent but not
  // inserted collided with a row that was already there under a different
  // slug, which the in-memory checks above cannot know about.
  console.log(`  rejected by db index  : ${(buffered - inserted).toLocaleString()}`);
  console.log(`Newly inserted          : ${inserted.toLocaleString()}`);
  console.log(
    `Elapsed                 : ${(secs / 60).toFixed(1)} min  (${(processed / secs).toFixed(0)} rows/s)`,
  );
  console.log(`\nmedicines before        : ${before.toLocaleString()}`);
  console.log(`medicines after         : ${after.toLocaleString()}`);

  console.log('\nBackfilling source rows (every medicine must cite a source)...');
  const sources = await backfillSources();
  console.log(`  created ${sources.toLocaleString()} source rows.`);

  if (!PUBLISH) {
    const drafts = await prisma.medicine.count({ where: { status: 'DRAFT' } });
    console.log(
      `\nNOTE: ${drafts.toLocaleString()} records are DRAFT, so they do NOT appear in search or scanning.`,
    );
    console.log('Re-run with --publish to make them visible.');
  }
  console.log('\nAll imported records are UNVERIFIED and display "Not yet verified" to users.');
}

main()
  .catch((error) => {
    console.error('\nIMPORT FAILED');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
