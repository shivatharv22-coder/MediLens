import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration.
 *
 * The runtime connection is created in `lib/db.ts` with the pg driver adapter;
 * this file only tells the CLI (migrate / studio / db push / seed) where to
 * connect.
 *
 * Prisma 7 no longer loads `.env` files automatically, so we do it here.
 * `.env.local` wins over `.env`, matching Next.js precedence.
 */
for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // File absent — fine, the shell environment may already provide the vars.
  }
}

export default defineConfig({
  schema: path.join('database', 'schema.prisma'),
  datasource: {
    // Placeholder keeps `prisma generate` usable before a database is attached.
    // Any command that actually connects will fail loudly with a real message.
    url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/medilens',
    // `prisma migrate dev` replays every migration into a throwaway database to
    // detect drift. Point it at a dedicated one when the provider gives you a
    // second endpoint (`prisma dev` prints one), otherwise Prisma creates and
    // drops a temporary database next to the main one.
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
  migrations: {
    path: path.join('database', 'migrations'),
    seed: 'tsx database/seed.ts',
  },
});
