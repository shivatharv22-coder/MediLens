/**
 * Vitest global setup.
 *
 * Pins the environment the server modules validate at import time so tests do
 * not depend on the developer's `.env.local`, and keeps every test on
 * credential-free providers.
 */
// Vite loads `.env.local` into process.env, so a developer with a database
// configured would otherwise run a different suite from CI — and `pingDb()`
// would make real connections. Force the documented no-database configuration.
delete process.env.DATABASE_URL;
delete process.env.SHADOW_DATABASE_URL;
process.env.MAIL_PROVIDER = 'none';
process.env.RESEND_API_KEY = '';

process.env.APP_URL ??= 'http://localhost:3000';
process.env.SESSION_SECRET ??= 'test-session-secret-value-at-least-32-chars-long';
process.env.OCR_PROVIDER ??= 'mock';
process.env.AI_PROVIDER ??= 'template';
process.env.TRANSLATION_PROVIDER ??= 'stored';
process.env.TTS_PROVIDER ??= 'browser';
process.env.STORAGE_PROVIDER ??= 'local';
process.env.NEXT_PUBLIC_DEMO_MODE ??= 'true';
// No DATABASE_URL: the suite runs against the bundled demo repository, which is
// exactly the configuration a contributor gets on a fresh clone.
