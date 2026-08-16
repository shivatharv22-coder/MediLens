import { env } from '@/config/env';
import { normaliseLanguage } from '@/config/languages';
import { assertSameOrigin, fail, guardRate, ok } from '@/lib/api';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { getSessionUser, getOrCreateGuestKey } from '@/lib/session';
import { processMedicineScan } from '@/services/scan';
import { getMedicineRepository } from '@/services/medicine';

export const dynamic = 'force-dynamic';
// OCR is CPU-bound and can take a while on a large photo.
export const maxDuration = 60;

/**
 * Upload a medicine package image and get an identification result.
 * Works for guests; an account is not required to scan.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    guardRate(req, 'scan:upload', { limit: 10, windowSeconds: 60, userId: user?.id });

    const form = await req.formData().catch(() => null);
    if (!form) throw new AppError(ERROR_CODES.VALIDATION_FAILED, { logContext: { reason: 'not multipart' } });

    const file = form.get('image');
    if (!(file instanceof File)) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
        details: { image: ['An image file is required.'] },
      });
    }

    const language = normaliseLanguage(String(form.get('language') ?? 'en'));
    // Opt-in only. Absent or anything other than "true" means do not keep it.
    const keepImage = String(form.get('keepImage') ?? '') === 'true';

    const outcome = await processMedicineScan(file, {
      userId: user?.id ?? null,
      guestKey: user ? null : await getOrCreateGuestKey(),
      languageCode: language,
      keepImage,
    });

    return ok({
      scanId: outcome.scanId,
      persisted: outcome.persisted,
      identification: outcome.identification,
      ocr: {
        // The raw text is returned so the user can see exactly what was read.
        text: outcome.rawOcrText,
        confidence: outcome.ocrConfidence,
        provider: outcome.ocrProvider,
      },
      isDemo: getMedicineRepository().isDemo,
      retentionHours: keepImage ? env.UPLOAD_RETENTION_HOURS : 0,
    });
  } catch (e) {
    return fail(e, 'scan');
  }
}
