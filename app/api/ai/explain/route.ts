import { assertSameOrigin, fail, guardRate, ok, parseJson } from '@/lib/api';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { explainSchema } from '@/lib/schemas';
import { getSessionUser } from '@/lib/session';
import { getAiProvider, toVerifiedContext } from '@/services/ai';
import { getMedicineRepository, localiseMedicine } from '@/services/medicine';

export const dynamic = 'force-dynamic';

/**
 * Plain-language explanation of a verified medicine record.
 *
 * The provider is handed the verified record and nothing else — see
 * `toVerifiedContext`. It cannot introduce a fact that is not in the record.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    guardRate(req, 'ai:explain', { limit: 20, userId: user?.id });

    const body = await parseJson(req, explainSchema);
    const repository = getMedicineRepository();
    const medicine = await repository.findByIdOrSlug(body.medicineId);
    if (!medicine) throw new AppError(ERROR_CODES.NOT_FOUND);

    const localised = localiseMedicine(medicine, body.language);
    const provider = getAiProvider();
    const answer = await provider.explain({
      medicine: toVerifiedContext(localised, { isDemoData: repository.isDemo }),
      language: body.language,
    });

    return ok({
      text: answer.text,
      provider: answer.provider,
      groundedIn: answer.groundedIn,
      refused: answer.refused,
    });
  } catch (e) {
    return fail(e, 'ai');
  }
}
