/**
 * Application error model.
 *
 * Every user-visible failure goes through `AppError` so that the HTTP layer can
 * emit a stable machine code plus a safe English fallback message. Raw
 * exception text never reaches the client.
 */

export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE: 'UNSUPPORTED_FILE',
  OCR_FAILED: 'OCR_FAILED',
  AI_FAILED: 'AI_FAILED',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  STORAGE_FAILED: 'STORAGE_FAILED',
  EMAIL_FAILED: 'EMAIL_FAILED',
  INVALID_RESET_TOKEN: 'INVALID_RESET_TOKEN',
  UNSUPPORTED_LANGUAGE: 'UNSUPPORTED_LANGUAGE',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE: 415,
  OCR_FAILED: 422,
  AI_FAILED: 503,
  DATABASE_UNAVAILABLE: 503,
  STORAGE_FAILED: 503,
  EMAIL_FAILED: 503,
  INVALID_RESET_TOKEN: 400,
  UNSUPPORTED_LANGUAGE: 400,
  FEATURE_DISABLED: 503,
  CONFLICT: 409,
  INTERNAL: 500,
};

/** Safe fallback copy. Clients should prefer their own translated string. */
const SAFE_MESSAGE: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Please check the highlighted fields and try again.',
  UNAUTHORIZED: 'Please sign in to continue.',
  FORBIDDEN: 'You do not have access to this.',
  NOT_FOUND: 'We could not find what you were looking for.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  FILE_TOO_LARGE: 'That image is too large. Please use a smaller photo.',
  UNSUPPORTED_FILE: 'That file type is not supported. Please use a JPG, PNG, or WebP photo.',
  OCR_FAILED: 'We could not read the image. Please try a clearer photo.',
  AI_FAILED: 'We could not prepare the explanation right now.',
  DATABASE_UNAVAILABLE: 'Medicine information is temporarily unavailable. Please try again shortly.',
  STORAGE_FAILED: 'We could not save that file. Please try again.',
  EMAIL_FAILED: 'We could not send that email right now. Please try again shortly.',
  INVALID_RESET_TOKEN:
    'This password reset link is invalid or has expired. Please request a new one.',
  UNSUPPORTED_LANGUAGE: 'That language is not supported yet.',
  FEATURE_DISABLED: 'This feature is not enabled on this installation.',
  CONFLICT: 'That change conflicts with an existing record.',
  INTERNAL: 'Something went wrong. Please try again.',
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, string[]>;
  /** Extra context for the server log only. Never serialised to the client. */
  readonly logContext?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    options: {
      message?: string;
      status?: number;
      details?: Record<string, string[]>;
      logContext?: Record<string, unknown>;
      cause?: unknown;
    } = {},
  ) {
    super(options.message ?? SAFE_MESSAGE[code], { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = options.status ?? DEFAULT_STATUS[code];
    this.details = options.details;
    this.logContext = options.logContext;
  }

  /** The client-safe body. */
  toPublic() {
    return {
      ok: false as const,
      error: this.code,
      message: SAFE_MESSAGE[this.code],
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** Wrap any thrown value into an AppError without leaking its message. */
export function toAppError(e: unknown): AppError {
  if (isAppError(e)) return e;
  return new AppError(ERROR_CODES.INTERNAL, { cause: e });
}

export { SAFE_MESSAGE };
