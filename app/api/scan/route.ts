import { env } from '@/config/env';
import { normaliseLanguage } from '@/config/languages';
import { assertSameOrigin, fail, guardRate, ok } from '@/lib/api';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { getSessionUser, getOrCreateGuestKey } from '@/lib/session';
import { processMedicineScan, type SuppliedOcr } from '@/services/scan';
import { getMedicineRepository } from '@/services/medicine';

export const dynamic = 'force-dynamic';
// Only relevant on the server-OCR fallback path; the browser path returns in
// well under a second because all this route then does is match text.
export const maxDuration = 60;

/**
 * The most a pack can plausibly contain. Anything longer is not a medicine
 * label, and the matcher would only spend time on it.
 */
const MAX_OCR_TEXT_CHARS = 20_000;
const MAX_OCR_PROVIDER_CHARS = 40;

/**
 * OCR the device already performed, if it sent any.
 *
 * This is untrusted input like any other form field — it is capped, and it
 * never shortcuts the matcher, which still has to find a catalogue record
 * before the result is presented as identified.
 */
function readSuppliedOcr(form: FormData): SuppliedOcr | null {
  const raw = form.get('ocrText');
  if (typeof raw !== 'string') return null;
  const text = raw.slice(0, MAX_OCR_TEXT_CHARS);
  if (!text.trim()) return null;

  const confidence = Number(form.get('ocrConfidence'));
  const provider = String(form.get('ocrProvider') ?? 'client').slice(0, MAX_OCR_PROVIDER_CHARS);

  return {
    text,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    provider: provider.trim() || 'client',
  };
}

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

    const image = form.get('image');
    const file = image instanceof File && image.size > 0 ? image : null;
    const suppliedOcr = readSuppliedOcr(form);

    if (!file && !suppliedOcr) {
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
      suppliedOcr,
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
