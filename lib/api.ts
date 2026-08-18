import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { isDatabaseUnavailable } from './db';
import { AppError, ERROR_CODES, isAppError } from './errors';
import { logger } from './logger';
import { enforceRateLimit } from './rate-limit';
import { hashIp } from './crypto';
import { env } from '@/config/env';
import { recordSystemError } from './system-log';
import type { ApiResponse } from '@/types';

/** JSON success envelope. */
export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ ok: true as const, data }, { status: 200, ...init });
}

export function created<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ ok: true as const, data }, { status: 201 });
}

/**
 * Convert any thrown value into a safe JSON error response and log the real
 * cause server-side. This is the only place an exception becomes an HTTP body.
 */
export async function fail(e: unknown, area = 'api'): Promise<NextResponse<ApiResponse<never>>> {
  const error = isAppError(e)
    ? e
    : isDatabaseUnavailable(e)
      ? // "Postgres is down" is not an unknown internal fault. Saying so lets
        // the user retry meaningfully instead of reading "Something went wrong".
        new AppError(ERROR_CODES.DATABASE_UNAVAILABLE, { cause: e })
      : new AppError(ERROR_CODES.INTERNAL, { cause: e });

  if (error.status >= 500) {
    logger.error('Request failed', {
      code: error.code,
      area,
      cause: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      ...error.logContext,
    });
    await recordSystemError({
      code: error.code,
      area,
      message: e instanceof Error ? e.message : 'Unknown error',
      context: error.logContext,
    });
  } else {
    logger.warn('Request rejected', { code: error.code, area, ...error.logContext });
  }

  return NextResponse.json(error.toPublic(), { status: error.status });
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return req.headers.get('x-real-ip');
}

export function rateLimitKey(req: Request, scope: string, userId?: string | null): string {
  if (userId) return `${scope}:u:${userId}`;
  const ip = hashIp(clientIp(req), env.SESSION_SECRET || 'medilens-dev-salt') ?? 'anon';
  return `${scope}:i:${ip}`;
}

export function guardRate(
  req: Request,
  scope: string,
  options: { limit?: number; windowSeconds?: number; userId?: string | null } = {},
) {
  return enforceRateLimit(rateLimitKey(req, scope, options.userId), options);
}

/**
 * Parse and validate a JSON body. Rejects oversized payloads before parsing so
 * a hostile client cannot force a large allocation.
 */
export async function parseJson<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
  maxBytes = 64 * 1024,
): Promise<z.infer<S>> {
  const lengthHeader = req.headers.get('content-length');
  if (lengthHeader && Number(lengthHeader) > maxBytes) {
    throw new AppError(ERROR_CODES.FILE_TOO_LARGE, { logContext: { lengthHeader } });
  }

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > maxBytes) throw new AppError(ERROR_CODES.FILE_TOO_LARGE);
    body = text.length ? JSON.parse(text) : {};
  } catch (e) {
    if (isAppError(e)) throw e;
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, { logContext: { reason: 'malformed JSON' } });
  }

  return validate(schema, body);
}

/** Validate an already-parsed value, producing field-level details. */
export function validate<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;

  const details: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path.join('.') || '_';
    (details[path] ??= []).push(issue.message);
  }
  throw new AppError(ERROR_CODES.VALIDATION_FAILED, { details });
}

export function searchParamsOf(req: Request): Record<string, string> {
  const url = new URL(req.url);
  return Object.fromEntries(url.searchParams.entries());
}

/**
 * Reject cross-site state-changing requests.
 *
 * SameSite=Lax already blocks the classic CSRF shapes; this adds an origin
 * check so a same-site subdomain or a permissive future cookie policy does not
 * silently open a hole.
 */
export function assertSameOrigin(req: Request): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

  const origin = req.headers.get('origin');
  if (!origin) return; // Non-browser client; auth still applies.

  const allowed = new Set<string>([new URL(env.APP_URL).origin]);
  const host = req.headers.get('host');
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }

  if (!allowed.has(origin)) {
    throw new AppError(ERROR_CODES.FORBIDDEN, { logContext: { reason: 'cross-origin write', origin } });
  }
}
