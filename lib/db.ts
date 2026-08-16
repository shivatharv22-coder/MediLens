import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/database/generated/prisma/client';
import { env, isDatabaseConfigured } from '@/config/env';
import { AppError, ERROR_CODES } from './errors';
import { logger } from './logger';

/**
 * Prisma client, created lazily.
 *
 * MediLens is designed to boot without a database so the bundled demo dataset
 * can serve read-only medicine pages. Anything that genuinely needs Postgres
 * calls `requireDb()` and gets a clean DATABASE_UNAVAILABLE error when it is
 * missing, rather than a stack trace.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

let client: PrismaClient | null = globalForPrisma.prisma ?? null;

export function getDb(): PrismaClient | null {
  if (!isDatabaseConfigured()) return null;
  if (client) return client;

  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  client = new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  if (env.NODE_ENV !== 'production') globalForPrisma.prisma = client;
  return client;
}

export function requireDb(): PrismaClient {
  const db = getDb();
  if (!db) {
    logger.warn('Database access attempted without DATABASE_URL');
    throw new AppError(ERROR_CODES.DATABASE_UNAVAILABLE, {
      logContext: { reason: 'DATABASE_URL is empty' },
    });
  }
  return db;
}

export async function pingDb(): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (e) {
    logger.error('Database ping failed', { error: (e as Error).name });
    return false;
  }
}

export type { PrismaClient };
