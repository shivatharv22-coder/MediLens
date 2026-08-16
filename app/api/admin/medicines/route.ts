import { ADMIN_PAGE_SIZE } from '@/config/app';
import { assertSameOrigin, fail, guardRate, ok, parseJson, searchParamsOf, validate } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth';
import { requireDb } from '@/lib/db';
import { adminListQuerySchema, adminMedicineSchema } from '@/lib/schemas';
import { createMedicine } from '@/services/admin/medicine-admin';

export const dynamic = 'force-dynamic';

/** Admin medicine list. Unlike the public search, this sees every status. */
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    guardRate(req, 'admin:medicines:list', { limit: 120, userId: admin.id });

    const query = validate(adminListQuerySchema, searchParamsOf(req));
    const pageSize = query.pageSize ?? ADMIN_PAGE_SIZE;
    const db = requireDb();

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.verificationStatus ? { verificationStatus: query.verificationStatus } : {}),
      ...(query.q
        ? {
            OR: [
              { brandName: { contains: query.q, mode: 'insensitive' as const } },
              { genericName: { contains: query.q, mode: 'insensitive' as const } },
              { manufacturer: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      db.medicine.count({ where }),
      db.medicine.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          slug: true,
          brandName: true,
          genericName: true,
          strength: true,
          dosageForm: true,
          manufacturer: true,
          status: true,
          verificationStatus: true,
          lastVerifiedAt: true,
          updatedAt: true,
          _count: { select: { sources: true, translations: true } },
        },
      }),
    ]);

    return ok({
      items: items.map((m) => ({
        ...m,
        lastVerifiedAt: m.lastVerifiedAt?.toISOString() ?? null,
        updatedAt: m.updatedAt.toISOString(),
        sourceCount: m._count.sources,
        translationCount: m._count.translations,
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

/** Create a medicine record. Always starts unverified and unpublished. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const admin = await requireAdmin();
    guardRate(req, 'admin:medicines:create', { limit: 60, userId: admin.id });

    const body = await parseJson(req, adminMedicineSchema, 128 * 1024);
    const medicine = await createMedicine(requireDb(), body);

    await audit({
      action: 'MEDICINE_CREATE',
      actorId: admin.id,
      actorEmail: admin.email,
      entityType: 'Medicine',
      entityId: medicine.id,
      metadata: { brandName: body.brandName, strength: body.strength },
      request: req,
    });

    return ok(medicine);
  } catch (e) {
    return fail(e, 'admin');
  }
}
