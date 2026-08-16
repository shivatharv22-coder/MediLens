import 'server-only';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';
import { DemoMedicineRepository } from './demo-repository';
import { PrismaMedicineRepository } from './prisma-repository';
import type { MedicineRepository } from './repository';

let cached: MedicineRepository | null = null;

/**
 * Resolve the active medicine repository.
 *
 * With a database configured this is Postgres. Without one it is the bundled
 * demo dataset, which keeps the whole product usable in development while the
 * `isDemo` flag makes that unmistakable in the UI.
 */
export function getMedicineRepository(): MedicineRepository {
  if (cached) return cached;
  const db = getDb();
  if (db) {
    cached = new PrismaMedicineRepository(db);
  } else {
    logger.warn('No DATABASE_URL — serving the bundled demo medicine dataset');
    cached = new DemoMedicineRepository();
  }
  return cached;
}

/** Test helper: force a specific repository. */
export function __setMedicineRepository(repo: MedicineRepository | null) {
  cached = repo;
}

export { DemoMedicineRepository, PrismaMedicineRepository };
export type { MedicineRepository };
export * from './localise';
