import { ADMIN_PAGE_SIZE } from '@/config/app';
import { fail, guardRate, ok, searchParamsOf, validate } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { requireDb } from '@/lib/db';
import { paginationSchema } from '@/lib/schemas';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const querySchema = paginationSchema.extend({
  action: z.string().trim().max(40).optional(),
  entityType: z.string().trim().max(40).optional(),
});

/** Read-only audit trail. There is no endpoint that edits or deletes entries. */
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    guardRate(req, 'admin:audit', { limit: 60, userId: admin.id });

    const query = validate(querySchema, searchParamsOf(req));
    const pageSize = query.pageSize ?? ADMIN_PAGE_SIZE;
    const db = requireDb();

    const where = {
      ...(query.action ? { action: query.action as never } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
    };

    const [total, items] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          action: true,
          actorEmail: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ]);

    return ok({
      items: items.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      total,
      page: query.page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    return fail(e, 'admin');
  }
}
