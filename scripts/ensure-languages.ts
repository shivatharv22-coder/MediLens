/**
 * Insert the `supported_languages` rows.
 *
 * WHY THIS IS NOT PART OF THE SEED
 * --------------------------------
 * These rows are reference data, not demo content. `user_preferences`
 * and `medicine_translations` both carry a foreign key to
 * `supported_languages.code`, so an empty table does not degrade the app — it
 * breaks it outright:
 *
 *   Foreign key constraint violated on the constraint:
 *   `user_preferences_languageCode_fkey`
 *
 * That is what every sign-up returns as a 500 when the table is empty, because
 * creating an account creates a `UserPreference` with `languageCode = "en"`.
 *
 * `npm run db:seed` does insert them, but it also inserts the bundled DEMO
 * medicines, so it must never be run against a production catalogue. Hence a
 * separate, idempotent script that touches nothing else and is safe to re-run
 * after every deploy.
 *
 * Usage:
 *   npm run db:languages
 */
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../database/generated/prisma/client';
import { SUPPORTED_LANGUAGES } from '../config/languages';

for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // Not present; the shell environment may already provide DATABASE_URL.
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Not exported: this module connects and runs on import, so it is a script,
// not a library. `database/seed.ts` reads the same SUPPORTED_LANGUAGES source.
async function ensureLanguages(client: PrismaClient = prisma): Promise<number> {
  for (const language of SUPPORTED_LANGUAGES) {
    await client.supportedLanguage.upsert({
      where: { code: language.code },
      create: {
        code: language.code,
        englishName: language.englishName,
        nativeName: language.nativeName,
        speechLocale: language.speechLocale,
        isRtl: language.isRtl,
        sortOrder: language.sortOrder,
      },
      // `isEnabled` is deliberately not overwritten: an operator may have
      // turned a language off, and re-running this must not turn it back on.
      update: {
        englishName: language.englishName,
        nativeName: language.nativeName,
        speechLocale: language.speechLocale,
        sortOrder: language.sortOrder,
      },
    });
  }
  return SUPPORTED_LANGUAGES.length;
}

async function main() {
  const count = await ensureLanguages();
  const rows = await prisma.supportedLanguage.findMany({
    select: { code: true, englishName: true, isEnabled: true },
    orderBy: { sortOrder: 'asc' },
  });
  console.log(`Ensured ${count} languages. Table now holds:`);
  for (const row of rows) {
    console.log(`  ${row.code}  ${row.englishName}${row.isEnabled ? '' : '  (disabled)'}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
