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

/**
 * Coarse reason a connection attempt failed.
 *
 * Deliberately a fixed set of categories rather than the driver's message:
 * this is surfaced on a public health endpoint, so it must say enough to tell
 * a misconfigured password from a blocked network path, and nothing more. No
 * host, database name, user or connection string ever appears here.
 */
export type DbFailureReason =
  | 'AUTH_FAILED'
  | 'HOST_NOT_FOUND'
  | 'CONNECTION_REFUSED'
  | 'TIMEOUT'
  | 'TLS_FAILED'
  | 'MALFORMED_URL'
  | 'DATABASE_NOT_FOUND'
  | 'UNKNOWN';

export function classifyDbFailure(e: unknown): DbFailureReason {
  const message = String((e as { message?: unknown })?.message ?? '');
  const code = String((e as { code?: unknown })?.code ?? '');

  // Postgres SQLSTATEs are the most reliable signal when we get one.
  if (code === '28P01' || code === '28000') return 'AUTH_FAILED';
  if (code === '3D000') return 'DATABASE_NOT_FOUND';

  if (/password authentication failed|authentication failed|role .* does not exist/i.test(message)) {
    return 'AUTH_FAILED';
  }
  if (/database .* does not exist/i.test(message)) return 'DATABASE_NOT_FOUND';
  if (/ENOTFOUND|getaddrinfo|EAI_AGAIN|could not translate host name/i.test(message)) {
    return 'HOST_NOT_FOUND';
  }
  if (/ECONNREFUSED|connection refused/i.test(message)) return 'CONNECTION_REFUSED';
  if (/ETIMEDOUT|timeout|timed out/i.test(message)) return 'TIMEOUT';
  if (/SSL|TLS|certificate|self.signed/i.test(message)) return 'TLS_FAILED';
  if (/invalid (connection string|url|port)|must start with|malformed/i.test(message)) {
    return 'MALFORMED_URL';
  }
  return 'UNKNOWN';
}

export interface DbPing {
  reachable: boolean;
  /** Only set when `reachable` is false. */
  reason?: DbFailureReason;
}

/**
 * Try one trivial query.
 *
 * Returns *why* it failed, not just that it did: "DATABASE_URL is set but the
 * database is unreachable" is the same symptom for a wrong password, a network
 * path the platform cannot take, and a connection string that was pasted with
 * its surrounding quotes. Without the reason, diagnosing a deployment means
 * guessing between them.
 */
export async function pingDb(): Promise<DbPing> {
  const db = getDb();
  if (!db) return { reachable: false, reason: 'MALFORMED_URL' };
  try {
    await db.$queryRaw`SELECT 1`;
    return { reachable: true };
  } catch (e) {
    const reason = classifyDbFailure(e);
    // The full message goes to the server log, where secrets are acceptable
    // and the operator can actually read it.
    logger.error('Database ping failed', { error: (e as Error).name, reason, message: (e as Error).message });
    return { reachable: false, reason };
  }
}

export type { PrismaClient };
