import { assertSameOrigin, fail, guardRate, ok, parseJson } from '@/lib/api';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { askSchema } from '@/lib/schemas';
import { getSessionUser } from '@/lib/session';
import { getAiProvider, toVerifiedContext } from '@/services/ai';
import { getMedicineRepository, localiseMedicine } from '@/services/medicine';

export const dynamic = 'force-dynamic';

/**
 * Answer a question about one identified medicine.
 *
 * The safety gate runs inside the provider: `screenQuestion` before generation
 * and `screenAnswer` after it. A refusal is a normal 200 response carrying the
 * referral message, because it is a product behaviour, not an error.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    guardRate(req, 'ai:ask', { limit: 20, userId: user?.id });

    const body = await parseJson(req, askSchema);
    const repository = getMedicineRepository();
    const medicine = await repository.findByIdOrSlug(body.medicineId);
    if (!medicine) throw new AppError(ERROR_CODES.NOT_FOUND);

    const localised = localiseMedicine(medicine, body.language);
    const provider = getAiProvider();
    const answer = await provider.answer({
      medicine: toVerifiedContext(localised, { isDemoData: repository.isDemo }),
      question: body.question,
      language: body.language,
    });

    if (answer.refused) {
      // Refusals are tracked (without the question text) so the safety rules
      // can be reviewed against real usage.
      logger.info('AI question refused', { reason: answer.refusalReason, provider: answer.provider });
    }

    return ok({
      text: answer.text,
      refused: answer.refused,
      refusalReason: answer.refusalReason,
      groundedIn: answer.groundedIn,
      provider: answer.provider,
    });
  } catch (e) {
    return fail(e, 'ai');
  }
}
