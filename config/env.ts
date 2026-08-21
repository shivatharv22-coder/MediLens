import 'server-only';
import { z } from 'zod';

/**
 * Server-side environment configuration.
 *
 * Nothing in here may be imported from a client component — the `server-only`
 * import makes that a build error rather than a leaked secret.
 */

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().optional().default(''),

  SESSION_SECRET: z.string().optional().default(''),
  SESSION_MAX_AGE: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),

  OCR_PROVIDER: z.enum(['tesseract', 'google', 'mock']).default('tesseract'),
  OCR_LANGUAGES: z.string().default('eng'),
  GOOGLE_VISION_API_KEY: z.string().optional().default(''),

  AI_PROVIDER: z.enum(['template', 'anthropic']).default('template'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5'),

  // none -> nothing is sent and the UI says so; dev -> written to .dev-mail/;
  // resend -> a real transactional provider.
  MAIL_PROVIDER: z.enum(['none', 'dev', 'resend']).default('none'),
  MAIL_FROM: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().max(1440).default(30),

  TRANSLATION_PROVIDER: z.enum(['stored', 'ai']).default('stored'),
  TTS_PROVIDER: z.enum(['browser', 'server']).default('browser'),

  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./storage/local'),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_REGION: z.string().optional().default(''),
  S3_BUCKET: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
  UPLOAD_RETENTION_HOURS: z.coerce.number().int().positive().default(24),

  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(8 * 1024 * 1024),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(30),

  NEXT_PUBLIC_DEMO_MODE: booleanish.default(true),
});

export type Env = z.infer<typeof envSchema>;

function load(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Fail fast and loudly at boot rather than mid-request.
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env: Env = load();

/** True once a PostgreSQL connection string is present. */
export const isDatabaseConfigured = (): boolean => env.DATABASE_URL.trim().length > 0;

/**
 * True when the app is serving the bundled demo dataset instead of a verified
 * medicine database. Drives the DEVELOPMENT / DEMO banner.
 */
export const isDemoMode = (): boolean => env.NEXT_PUBLIC_DEMO_MODE || !isDatabaseConfigured();

/** Sessions require a real secret; without one, accounts are disabled. */
export const isAuthConfigured = (): boolean =>
  env.SESSION_SECRET.trim().length >= 32 && isDatabaseConfigured();

export function assertProductionReady(): string[] {
  const problems: string[] = [];
  if (!isDatabaseConfigured()) problems.push('DATABASE_URL is not set.');
  if (env.SESSION_SECRET.trim().length < 32) problems.push('SESSION_SECRET must be at least 32 characters.');
  if (env.NEXT_PUBLIC_DEMO_MODE) problems.push('NEXT_PUBLIC_DEMO_MODE is still true.');
  if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
    problems.push('AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is empty.');
  }
  if (env.OCR_PROVIDER === 'google' && !env.GOOGLE_VISION_API_KEY) {
    problems.push('OCR_PROVIDER=google but GOOGLE_VISION_API_KEY is empty.');
  }
  if (env.STORAGE_PROVIDER === 's3' && !env.S3_BUCKET) {
    problems.push('STORAGE_PROVIDER=s3 but S3_BUCKET is empty.');
  }
  if (env.MAIL_PROVIDER !== 'resend') {
    problems.push('MAIL_PROVIDER is not a real email provider, so password reset cannot email users.');
  }
  if (env.MAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) {
    // MAIL_FROM is optional: it defaults to Resend's sandbox sender.
    problems.push('MAIL_PROVIDER=resend but RESEND_API_KEY is empty.');
  }
  return problems;
}
