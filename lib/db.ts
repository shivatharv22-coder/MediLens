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

/**
 * Codes that mean "the database is not reachable", as opposed to "the query was
 * wrong".
 *
 * Two families, because Prisma 7 with a driver adapter surfaces both: its own
 * P-codes (P1001 cannot reach the server, P1002/P1008 timeouts, P1017 server
 * closed the connection, P2024 pool timeout) *and*, for a refused socket, the
 * raw errno from the pg driver in the same `code` field — a
 * PrismaClientKnownRequestError carrying `code: 'ECONNREFUSED'`.
 */
const CONNECTIVITY_CODES = new Set([
  'P1000', 'P1001', 'P1002', 'P1008', 'P1010', 'P1017', 'P2024',
  'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH', 'EPIPE',
]);

/**
 * True when a thrown value is a database *connectivity* failure.
 *
 * Used to turn "Postgres is down" into an honest DATABASE_UNAVAILABLE message
 * instead of a generic "Something went wrong", which tells the user nothing and
 * looks identical to a bug in the app.
 */
export function isDatabaseUnavailable(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;

  const code = (e as { code?: unknown }).code;
  if (typeof code === 'string' && CONNECTIVITY_CODES.has(code)) return true;

  const name = (e as { name?: unknown }).name;
  if (name === 'PrismaClientInitializationError') return true;

  // Some failures are only identifiable from the message.
  //
  //  * The pg driver surfaces a refused socket rather than a Prisma code.
  //  * `$queryRaw` reports *every* failure as P2010 ("raw query failed") and
  //    puts the real cause in the message, so an unreachable server and a typo
  //    in the SQL arrive under the same code. Matching on the wording is what
  //    keeps the honest DATABASE_UNAVAILABLE for the first without also
  //    claiming the database is down for the second.
  const message = (e as { message?: unknown }).message;
  if (typeof message === 'string') {
    if (
      /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Connection terminated|server closed the connection|(?:can'?t|cannot) reach database server/i.test(
        message,
      )
    ) {
      return true;
    }
  }

  return isDatabaseUnavailable((e as { cause?: unknown }).cause);
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
