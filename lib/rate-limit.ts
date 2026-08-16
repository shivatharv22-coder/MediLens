import 'server-only';
import { env } from '@/config/env';
import { AppError, ERROR_CODES } from './errors';

/**
 * Fixed-window rate limiter.
 *
 * In-memory, which is correct for a single instance and for development. In a
 * multi-instance deployment, swap `store` for Redis — the interface below is
 * the only thing callers depend on.
 */

interface Counter {
  count: number;
  resetAt: number;
}

const store = new Map<string, Counter>();
let lastSweep = Date.now();

function sweep(now: number) {
  // Amortised cleanup so the map cannot grow without bound.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, counter] of store) {
    if (counter.resetAt <= now) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export function checkRateLimit(
  key: string,
  options: { limit?: number; windowSeconds?: number } = {},
): RateLimitResult {
  const limit = options.limit ?? env.RATE_LIMIT_MAX_REQUESTS;
  const windowMs = (options.windowSeconds ?? env.RATE_LIMIT_WINDOW_SECONDS) * 1000;
  const now = Date.now();
  sweep(now);

  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    const counter = { count: 1, resetAt: now + windowMs };
    store.set(key, counter);
    return { allowed: true, remaining: limit - 1, resetAt: counter.resetAt, limit };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    limit,
  };
}

export function enforceRateLimit(
  key: string,
  options: { limit?: number; windowSeconds?: number } = {},
): RateLimitResult {
  const result = checkRateLimit(key, options);
  if (!result.allowed) {
    throw new AppError(ERROR_CODES.RATE_LIMITED, {
      logContext: { key: key.slice(0, 24), limit: result.limit },
    });
  }
  return result;
}

/** Test helper. */
export function __resetRateLimits() {
  store.clear();
}
