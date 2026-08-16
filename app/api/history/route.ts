import { HISTORY_PAGE_SIZE } from '@/config/app';
import { assertSameOrigin, fail, guardRate, ok, parseJson, searchParamsOf, validate } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { requireDb } from '@/lib/db';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { historyCreateSchema, historyQuerySchema } from '@/lib/schemas';
import { getMedicineRepository } from '@/services/medicine';

export const dynamic = 'force-dynamic';

/** List the signed-in user's medicine history. */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    guardRate(req, 'history:list', { limit: 60, userId: user.id });

    const query = validate(historyQuerySchema, searchParamsOf(req));
    const pageSize = query.pageSize ?? HISTORY_PAGE_SIZE;
    const db = requireDb();

    const where = {
      userId: user.id,
      ...(query.q ? { medicineName: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };

    const [total, rows] = await Promise.all([
      db.userHistory.count({ where }),
      db.userHistory.findMany({
        where,
        orderBy: { viewedAt: 'desc' },
        skip: (query.page - 1) * pageSize,
        take: pageSize,
        include: { medicine: { select: { id: true, slug: true, genericName: true, strength: true, dosageForm: true } } },
      }),
    ]);

    return ok({
      items: rows.map((row) => ({
        id: row.id,
        medicineId: row.medicineId,
        medicineName: row.medicineName,
        languageCode: row.languageCode,
        source: row.source,
        viewedAt: row.viewedAt.toISOString(),
        hasImage: !!row.imageKey,
        medicine: row.medicine
          ? {
              id: row.medicine.id,
              slug: row.medicine.slug,
              genericName: row.medicine.genericName,
              strength: row.medicine.strength,
              dosageForm: row.medicine.dosageForm,
            }
          : null,
      })),
      total,
      page: query.page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    return fail(e, 'history');
  }
}

/** Save a medicine to history. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireUser();
    guardRate(req, 'history:create', { limit: 60, userId: user.id });

    const body = await parseJson(req, historyCreateSchema);
    const medicine = await getMedicineRepository().findByIdOrSlug(body.medicineId);
    if (!medicine) throw new AppError(ERROR_CODES.NOT_FOUND);

    const row = await requireDb().userHistory.create({
      data: {
        userId: user.id,
        // Only link when the record lives in this database; a demo record has
        // no row to point at.
        medicineId: getMedicineRepository().isDemo ? null : medicine.id,
        medicineName: `${medicine.brandName} ${medicine.strength}`.trim(),
        languageCode: body.languageCode,
        source: body.source,
      },
      select: { id: true, viewedAt: true },
    });

    return ok({ id: row.id, viewedAt: row.viewedAt.toISOString() });
  } catch (e) {
    return fail(e, 'history');
  }
}

/** Clear the whole history. */
export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireUser();
    guardRate(req, 'history:clear', { limit: 5, windowSeconds: 300, userId: user.id });

    const result = await requireDb().userHistory.deleteMany({ where: { userId: user.id } });
    await audit({
      action: 'HISTORY_CLEAR',
      actorId: user.id,
      actorEmail: user.email,
      entityType: 'UserHistory',
      metadata: { deleted: result.count },
      request: req,
    });

    return ok({ deleted: result.count });
  } catch (e) {
    return fail(e, 'history');
  }
}
