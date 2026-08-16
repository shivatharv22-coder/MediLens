import { fail, guardRate, ok, searchParamsOf, validate } from '@/lib/api';
import { medicineSearchSchema } from '@/lib/schemas';
import { getMedicineRepository } from '@/services/medicine';

export const dynamic = 'force-dynamic';

/** Medicine search. Public, read-only, rate limited. */
export async function GET(req: Request) {
  try {
    guardRate(req, 'medicines:search', { limit: 60 });
    const query = validate(medicineSearchSchema, searchParamsOf(req));
    const repository = getMedicineRepository();

    const results = await repository.search({
      q: query.q,
      ingredient: query.ingredient,
      manufacturer: query.manufacturer,
      dosageForm: query.dosageForm,
      page: query.page,
      pageSize: query.pageSize,
    });

    return ok({ ...results, isDemo: repository.isDemo });
  } catch (e) {
    return fail(e, 'medicines');
  }
}
