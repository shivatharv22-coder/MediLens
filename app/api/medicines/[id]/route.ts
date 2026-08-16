import { AppError, ERROR_CODES } from '@/lib/errors';
import { fail, guardRate, ok, searchParamsOf, validate } from '@/lib/api';
import { languageSchema } from '@/lib/schemas';
import { getMedicineRepository, localiseMedicine } from '@/services/medicine';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const querySchema = z.object({ language: languageSchema.default('en') });

/** Fetch one published medicine, resolved into the requested language. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    guardRate(req, 'medicines:get', { limit: 120 });
    const { id } = await params;
    const { language } = validate(querySchema, searchParamsOf(req));

    const repository = getMedicineRepository();
    const medicine = await repository.findByIdOrSlug(id);
    if (!medicine) throw new AppError(ERROR_CODES.NOT_FOUND);

    return ok({
      medicine: localiseMedicine(medicine, language),
      isDemo: repository.isDemo,
    });
  } catch (e) {
    return fail(e, 'medicines');
  }
}
