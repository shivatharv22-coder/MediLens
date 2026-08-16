import 'server-only';

/**
 * Structured server logging.
 *
 * Rules enforced here rather than left to callers:
 *  - never log raw OCR text, prescription content, image bytes, or credentials;
 *  - redact anything whose key looks sensitive, at any depth.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEY = /(password|secret|token|authorization|cookie|apikey|api_key|rawocr|rawtext|prescription|image|base64|dataurl|email)/i;

const MAX_STRING = 300;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[truncated]` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  return '[unserialisable]';
}

function emit(level: Level, message: string, context?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(context ? { context: redact(context) as Record<string, unknown> } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'production') emit('debug', message, context);
  },
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};

/** Exported for tests. */
export const __redactForTest = redact;
