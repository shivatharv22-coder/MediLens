import { assertSameOrigin, fail, guardRate, ok, parseJson } from '@/lib/api';
import { reidentifySchema } from '@/lib/schemas';
import { getSessionUser } from '@/lib/session';
import { getMedicineRepository } from '@/services/medicine';
import { identifyFromFields } from '@/services/identification';

export const dynamic = 'force-dynamic';

/**
 * Re-run matching after the user corrected the extracted fields.
 *
 * The corrected values are treated exactly like OCR output: they are still
 * only *claims about the pack* and must match a verified record before
 * anything is presented as identified.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    guardRate(req, 'scan:reidentify', { limit: 30, userId: user?.id });

    const body = await parseJson(req, reidentifySchema);
    const repository = getMedicineRepository();
    const identification = await identifyFromFields(body.fields, repository);

    return ok({ identification, isDemo: repository.isDemo });
  } catch (e) {
    return fail(e, 'scan');
  }
}
