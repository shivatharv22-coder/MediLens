import { NextResponse } from 'next/server';
import { env, isAuthConfigured, isDatabaseConfigured, isDemoMode } from '@/config/env';
import { pingDb } from '@/lib/db';
import { getMedicineRepository } from '@/services/medicine';

export const dynamic = 'force-dynamic';

/**
 * Liveness / configuration probe.
 * Reports which providers are wired up. Never returns secret values.
 */
export async function GET() {
  const repository = getMedicineRepository();

  return NextResponse.json({
    ok: true,
    status: 'up',
    demoMode: isDemoMode(),
    database: {
      configured: isDatabaseConfigured(),
      reachable: await pingDb(),
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
