import { normaliseLanguage } from '@/config/languages';
import { assertSameOrigin, fail, guardRate, ok } from '@/lib/api';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { getOrCreateGuestKey, getSessionUser } from '@/lib/session';
import { processPrescriptionScan } from '@/services/scan';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Extract text from a prescription image.
 *
 * INFORMATION EXTRACTION ONLY. The response contains what was read, verbatim,
 * plus a flag telling the UI when the page was too unclear to break into lines.
 * Nothing here interprets, corrects, or acts on the prescription.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    guardRate(req, 'prescription:upload', { limit: 6, windowSeconds: 60, userId: user?.id });

    const form = await req.formData().catch(() => null);
    if (!form) throw new AppError(ERROR_CODES.VALIDATION_FAILED, { logContext: { reason: 'not multipart' } });

    const file = form.get('image');
    if (!(file instanceof File)) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
        details: { image: ['An image file is required.'] },
      });
    }

    const outcome = await processPrescriptionScan(file, {
      userId: user?.id ?? null,
      guestKey: user ? null : await getOrCreateGuestKey(),
      languageCode: normaliseLanguage(String(form.get('language') ?? 'en')),
      keepImage: String(form.get('keepImage') ?? '') === 'true',
    });

    return ok({
      scanId: outcome.scanId,
      persisted: outcome.persisted,
      isLegible: outcome.extraction.isLegible,
      overallConfidence: outcome.extraction.overallConfidence,
      rawText: outcome.extraction.rawText,
      lines: outcome.extraction.lines,
      // Restated on every response so a client cannot render the data without it.
      notice:
        'Please verify prescription information with your doctor or pharmacist. MediLens does not prescribe or modify medicines.',
    });
  } catch (e) {
    return fail(e, 'prescription');
  }
}
