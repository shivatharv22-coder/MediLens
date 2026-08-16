import 'server-only';
import { getDb } from './db';
import { logger } from './logger';

/**
 * Persist an operational failure for admin triage.
 *
 * Deliberately best-effort: if the database is the thing that failed, we still
 * want the request to return a clean error rather than throw again here.
 */
export async function recordSystemError(input: {
  code: string;
  area: string;
  message: string;
  context?: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.systemErrorLog.create({
      data: {
        code: input.code.slice(0, 64),
        area: input.area.slice(0, 32),
        message: input.message.slice(0, 500),
        context: (input.context ?? null) as never,
      },
    });
  } catch (e) {
    logger.warn('Could not persist system error log', { error: (e as Error).name });
  }
}
