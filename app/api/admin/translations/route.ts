import { assertSameOrigin, fail, guardRate, ok, parseJson, searchParamsOf, validate } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth';
import { requireDb } from '@/lib/db';
import { adminListQuerySchema, adminTranslationSchema } from '@/lib/schemas';
import { ADMIN_PAGE_SIZE } from '@/config/app';

export const dynamic = 'force-dynamic';

/** List translations, newest first, so unreviewed ones surface quickly. */
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    guardRate(req, 'admin:translations:list', { limit: 120, userId: admin.id });

    const query = validate(adminListQuerySchema, searchParamsOf(req));
    const pageSize = query.pageSize ?? ADMIN_PAGE_SIZE;
    const db = requireDb();

    const [total, items] = await Promise.all([
      db.medicineTranslation.count(),
      db.medicineTranslation.findMany({
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        skip: (query.page - 1) * pageSize,
        take: pageSize,
        include: { medicine: { select: { id: true, brandName: true, strength: true } } },
      }),
    ]);

    return ok({
      items: items.map((t) => ({
        id: t.id,
        medicineId: t.medicineId,
        medicineLabel: `${t.medicine.brandName} ${t.medicine.strength}`,
        languageCode: t.languageCode,
        status: t.status,
        producedBy: t.producedBy,
        reviewedAt: t.reviewedAt?.toISOString() ?? null,
        updatedAt: t.updatedAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    return fail(e, 'admin');
  }
}

/**
 * Create or replace a translation.
 *
 * A translation submitted through this endpoint is stored with whatever status
 * the reviewer chose; `HUMAN_REVIEWED` also stamps the reviewer and time, so
 * the medicine page can tell the user whether a person checked it.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const admin = await requireAdmin();
    guardRate(req, 'admin:translations:write', { limit: 60, userId: admin.id });

    const body = await parseJson(req, adminTranslationSchema, 128 * 1024);
    const db = requireDb();

    const reviewed = body.status === 'HUMAN_REVIEWED';
    const data = {
      summary: body.summary ?? null,
      commonUses: body.commonUses,
      mechanismSummary: body.mechanismSummary ?? null,
      commonSideEffects: body.commonSideEffects,
      importantWarnings: body.importantWarnings,
      cautionGroups: body.cautionGroups,
      storageInformation: body.storageInformation ?? null,
      status: body.status,
      producedBy: 'admin',
      reviewerId: reviewed ? admin.id : null,
      reviewedAt: reviewed ? new Date() : null,
    };

    const translation = await db.medicineTranslation.upsert({
      where: {
        medicineId_languageCode: {
          medicineId: body.medicineId,
          languageCode: body.languageCode,
        },
      },
      create: { medicineId: body.medicineId, languageCode: body.languageCode, ...data },
      update: data,
      select: { id: true, status: true },
    });

    await audit({
      action: reviewed ? 'TRANSLATION_REVIEW' : 'TRANSLATION_UPDATE',
      actorId: admin.id,
      actorEmail: admin.email,
      entityType: 'MedicineTranslation',
      entityId: translation.id,
      metadata: { medicineId: body.medicineId, languageCode: body.languageCode, status: body.status },
      request: req,
    });

    return ok(translation);
  } catch (e) {
    return fail(e, 'admin');
  }
}
