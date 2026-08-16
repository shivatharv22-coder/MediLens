'use client';

import { useCallback, useState } from 'react';
import type { ApiResponse } from '@/types';
import type { Dictionary } from '@/lib/i18n/types';

/**
 * Map a machine error code to the user's language.
 *
 * The server sends a stable code plus a safe English fallback; the client
 * decides the wording. A code we do not recognise falls back to the generic
 * message rather than showing anything technical.
 */
export function translateError(code: string | undefined, dict: Dictionary): string {
  const e = dict.errors;
  switch (code) {
    case 'VALIDATION_FAILED':
      return e.validationFailed;
    case 'UNAUTHORIZED':
      return e.unauthorized;
    case 'FORBIDDEN':
      return e.forbidden;
    case 'NOT_FOUND':
      return e.notFound;
    case 'RATE_LIMITED':
      return e.rateLimited;
    case 'FILE_TOO_LARGE':
      return e.fileTooLarge;
    case 'UNSUPPORTED_FILE':
      return e.unsupportedFile;
    case 'OCR_FAILED':
      return e.ocrFailed;
    case 'AI_FAILED':
      return e.aiFailed;
    case 'DATABASE_UNAVAILABLE':
      return e.databaseUnavailable;
    case 'UNSUPPORTED_LANGUAGE':
      return e.unsupportedLanguage;
    case 'NETWORK':
      return e.network;
    default:
      return e.generic;
  }
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** `fetch` that always resolves to typed data or throws an `ApiError`. */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError('NETWORK', 'Network request failed');
  }

  let body: ApiResponse<T> | null = null;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError('INTERNAL', 'Malformed response');
  }

  if (!body || body.ok !== true) {
    const failure = body as { error?: string; message?: string; details?: Record<string, string[]> } | null;
    throw new ApiError(failure?.error ?? 'INTERNAL', failure?.message ?? 'Request failed', failure?.details);
  }

  return body.data;
}

/** Small request-state helper so components do not re-implement it each time. */
export function useAsync<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [data, setData] = useState<TResult | null>(null);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await fn(...args);
        setData(result);
        return result;
      } catch (e) {
        setError(e instanceof ApiError ? e : new ApiError('INTERNAL', 'Unexpected error'));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [fn],
  );

  return { run, loading, error, data, setData, reset: () => { setError(null); setData(null); } };
}
