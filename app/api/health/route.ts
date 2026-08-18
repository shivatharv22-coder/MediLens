import { NextResponse } from 'next/server';
import { env, isAuthConfigured, isDatabaseConfigured, isDemoMode } from '@/config/env';
import { pingDb } from '@/lib/db';
import { getMedicineRepository } from '@/services/medicine';

export const dynamic = 'force-dynamic';

/**
 * Liveness / configuration probe.
 *
 * Reports which providers are wired up, and — when the database cannot be
 * reached — a coarse category for why. Never returns secret values: no
 * connection string, host, user or driver message.
 */
export async function GET() {
  const repository = getMedicineRepository();
  const ping = await pingDb();

  return NextResponse.json({
    ok: true,
    status: 'up',
    demoMode: isDemoMode(),
    database: {
      configured: isDatabaseConfigured(),
      reachable: ping.reachable,
      // A category, never a message: enough to tell a wrong password from a
      // blocked network path without naming the host or the credentials.
      ...(ping.reason ? { failureReason: ping.reason } : {}),
    },
    medicineSource: { name: repository.name, isDemo: repository.isDemo },
    providers: {
      ocr: env.OCR_PROVIDER,
      ai: env.AI_PROVIDER,
      translation: env.TRANSLATION_PROVIDER,
      tts: env.TTS_PROVIDER,
      storage: env.STORAGE_PROVIDER,
    },
    accounts: isAuthConfigured(),
  });
}
