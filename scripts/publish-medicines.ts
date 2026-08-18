/**
 * Flip DRAFT medicines to PUBLISHED, in batches.
 *
 * Usage:
 *   npx tsx scripts/publish-medicines.ts            # publish all DRAFT rows
 *   npx tsx scripts/publish-medicines.ts --revert   # put them back to DRAFT
 *
 * WHY BATCHED
 * -----------
 * A single `UPDATE medicines SET status='PUBLISHED'` over 251k rows fails on a
 * Neon free project:
 *
 *   error 53100: could not extend file because project size limit (512 MB)
 *                has been exceeded
 *
 * Postgres is MVCC, so an UPDATE writes a NEW version of every row it touches
 * and leaves the old one as a dead tuple. Rewriting the whole table therefore
 * needs roughly a second copy of it (~264 MB) before anything can be reclaimed,
 * and the project was already at 493 MB of its 512 MB.
 *
 * Batching plus a VACUUM after each batch keeps the peak small: VACUUM marks
 * the dead tuples reusable, so the next batch writes into space already inside
 * the table instead of extending the file. Peak growth is one batch, not one
 * table.
 *
 * This only changes visibility. `verificationStatus` is untouched, so every
 * record still shows "Not yet verified" to users.
 */
import path from 'node:path';
import pg from 'pg';

for (const f of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(path.join(process.cwd(), f));
  } catch {
    // Optional.
  }
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing.');

const REVERT = process.argv.includes('--revert');
const FROM = REVERT ? 'PUBLISHED' : 'DRAFT';
const TO = REVERT ? 'DRAFT' : 'PUBLISHED';

/** Small enough that one batch fits in the remaining headroom. */
let batchSize = 5000;
const MIN_BATCH = 500;

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const pretty = (n: number) => n.toLocaleString('en-US');

async function sizeMb(): Promise<number> {
  const r = await client.query(
    'SELECT pg_database_size(current_database())::bigint AS b',
  );
  return Number(r.rows[0].b) / (1024 * 1024);
}

async function main() {
  await client.connect();

  const start = await client.query(
    'SELECT status, COUNT(*)::int n FROM medicines GROUP BY status ORDER BY status',
  );
  console.log('Before :', JSON.stringify(start.rows));
  console.log(`Size   : ${(await sizeMb()).toFixed(0)} MB`);
  console.log(`Moving : ${FROM} -> ${TO}\n`);

  let total = 0;
  let batches = 0;

  for (;;) {
    let updated: number;
    try {
      const res = await client.query(
        `UPDATE medicines SET status = $1
          WHERE id IN (SELECT id FROM medicines WHERE status = $2 LIMIT $3)`,
        [TO, FROM, batchSize],
      );
      updated = res.rowCount ?? 0;
    } catch (e) {
      // 53100 = out of disk / project size limit. Reclaim and try smaller.
      if ((e as { code?: string }).code === '53100' && batchSize > MIN_BATCH) {
        batchSize = Math.max(MIN_BATCH, Math.floor(batchSize / 2));
        console.log(`\n  hit the size limit, vacuuming and retrying with batch ${batchSize}`);
        await client.query('VACUUM medicines');
        continue;
      }
      throw e;
    }

    if (updated === 0) break;

    total += updated;
    batches += 1;

    // Reclaim the dead tuples this batch created so the next one reuses the
    // space rather than extending the file.
    await client.query('VACUUM medicines');

    process.stdout.write(
      `  ${pretty(total)} updated | batch ${batches} | ${(await sizeMb()).toFixed(0)} MB   \r`,
    );
  }

  console.log(`\n\nROWS UPDATED : ${pretty(total)}`);

  const end = await client.query(
    'SELECT status, COUNT(*)::int n FROM medicines GROUP BY status ORDER BY status',
  );
  console.log('After  :', JSON.stringify(end.rows));
  console.log(
    'Verification (unchanged):',
    JSON.stringify(
      (await client.query('SELECT "verificationStatus" v, COUNT(*)::int n FROM medicines GROUP BY 1'))
        .rows,
    ),
  );
  console.log(`Size   : ${(await sizeMb()).toFixed(0)} MB`);
}

main()
  .catch((e) => {
    console.error('\nFAILED:', e.message ?? e);
    process.exit(1);
  })
  .finally(() => client.end());
