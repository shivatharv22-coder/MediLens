/**
 * Delete expired medicine and prescription images.
 *
 * Run on a schedule (cron, a platform scheduled job, or a container sidecar).
 * Data minimisation is a privacy commitment, not a best-effort cleanup — if
 * this never runs, retained images outlive the window promised in the privacy
 * policy.
 *
 * Usage: npx tsx scripts/purge-expired-uploads.ts
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../database/generated/prisma/client';

for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // Optional.
  }
}

const connectionString = process.env.DATABASE_URL;
const storageDir = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? './storage/local');

async function deleteLocal(key: string): Promise<void> {
  // Keys are `<prefix>/<expiry>-<uuid>`; reject anything else rather than
  // unlinking a path an unexpected value could point at.
  if (!/^[a-z]+\/\d+-[0-9a-f-]{36}$/i.test(key)) return;
  const full = path.resolve(storageDir, key);
  if (!full.startsWith(storageDir + path.sep)) return;
  await fs.unlink(full).catch(() => undefined);
}

async function main() {
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const now = new Date();

  try {
    const [scans, prescriptions] = await Promise.all([
      prisma.medicineScan.findMany({
        where: { imageKey: { not: null }, imageExpiresAt: { lte: now } },
        select: { id: true, imageKey: true },
      }),
      prisma.prescriptionScan.findMany({
        where: { imageKey: { not: null }, imageExpiresAt: { lte: now } },
        select: { id: true, imageKey: true },
      }),
    ]);

    for (const scan of scans) {
      if (scan.imageKey) await deleteLocal(scan.imageKey);
      await prisma.medicineScan.update({
        where: { id: scan.id },
        data: { imageKey: null, imageExpiresAt: null, imageBytes: null, imageMimeType: null },
      });
    }

    for (const scan of prescriptions) {
      if (scan.imageKey) await deleteLocal(scan.imageKey);
      await prisma.prescriptionScan.update({
        where: { id: scan.id },
        data: { imageKey: null, imageExpiresAt: null },
      });
    }

    // Expired sessions are not sensitive, but leaving them is pointless.
    const sessions = await prisma.session.deleteMany({ where: { expiresAt: { lte: now } } });

    console.log(
      `Purged ${scans.length} medicine images, ${prescriptions.length} prescription images, ${sessions.count} expired sessions.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Purge failed:', error);
  process.exit(1);
});
