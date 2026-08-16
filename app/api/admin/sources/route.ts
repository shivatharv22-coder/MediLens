import { ADMIN_PAGE_SIZE } from '@/config/app';
import { assertSameOrigin, fail, guardRate, ok, parseJson, searchParamsOf, validate } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth';
import { requireDb } from '@/lib/db';
import { adminListQuerySchema, adminSourceSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/** List medicine sources. */
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    guardRate(req, 'admin:sources:list', { limit: 120, userId: admin.id });

    const query = validate(adminListQuerySchema, searchParamsOf(req));
    const pageSize = query.pageSize ?? ADMIN_PAGE_SIZE;
    const db = requireDb();

    const where = query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' as const } },
            { medicine: { brandName: { contains: query.q, mode: 'insensitive' as const } } },
          ],
        }
      : {};

    const [total, items] = await Promise.all([
      db.medicineSource.count({ where }),
      db.medicineSource.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * pageSize,
        take: pageSize,
        include: { medicine: { select: { id: true, brandName: true, strength: true } } },
      }),
    ]);

    return ok({
      items: items.map((s) => ({
        id: s.id,
        medicineId: s.medicineId,
        medicineLabel: `${s.medicine.brandName} ${s.medicine.strength}`,
        category: s.category,
        name: s.name,
        url: s.url,
        version: s.version,
        retrievedAt: s.retrievedAt?.toISOString() ?? null,
        notes: s.notes,
        updatedAt: s.updatedAt.toISOString(),
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

/** Attach a source to a medicine. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const admin = await requireAdmin();
    guardRate(req, 'admin:sources:create', { limit: 60, userId: admin.id });

    const body = await parseJson(req, adminSourceSchema);
    const source = await requireDb().medicineSource.create({
      data: {
        medicineId: body.medicineId,
        category: body.category,
        name: body.name,
        url: body.url || null,
        version: body.version ?? null,
        retrievedAt: body.retrievedAt ? new Date(body.retrievedAt) : null,
        notes: body.notes ?? null,
      },
      select: { id: true },
    });

    await audit({
      action: 'SOURCE_CREATE',
      actorId: admin.id,
      actorEmail: admin.email,
      entityType: 'MedicineSource',
      entityId: source.id,
      metadata: { medicineId: body.medicineId, category: body.category },
      request: req,
    });

    return ok(source);
  } catch (e) {
    return fail(e, 'admin');
  }
}
