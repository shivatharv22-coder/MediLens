import { assertSameOrigin, fail, guardRate, ok, parseJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth';
import { requireDb } from '@/lib/db';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { adminSourceSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

const updateSchema = adminSourceSchema.partial().omit({ medicineId: true });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const admin = await requireAdmin();
    guardRate(req, 'admin:sources:update', { limit: 60, userId: admin.id });

    const { id } = await params;
    const body = await parseJson(req, updateSchema);

    const source = await requireDb().medicineSource.update({
      where: { id },
      data: {
        ...(body.category ? { category: body.category } : {}),
        ...(body.name ? { name: body.name } : {}),
        ...(body.url !== undefined ? { url: body.url || null } : {}),
        ...(body.version !== undefined ? { version: body.version ?? null } : {}),
        ...(body.retrievedAt !== undefined
          ? { retrievedAt: body.retrievedAt ? new Date(body.retrievedAt) : null }
          : {}),
        ...(body.notes !== undefined ? { notes: body.notes ?? null } : {}),
      },
      select: { id: true, medicineId: true },
    });

    await audit({
      action: 'SOURCE_UPDATE',
      actorId: admin.id,
      actorEmail: admin.email,
      entityType: 'MedicineSource',
      entityId: id,
      metadata: { changedFields: Object.keys(body) },
      request: req,
    });

    return ok(source);
  } catch (e) {
    return fail(e, 'admin');
  }
}

/**
 * Remove a source. Refused when it is the medicine's only source and the
 * medicine is published — a live record must always cite something.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const admin = await requireAdmin();
    guardRate(req, 'admin:sources:delete', { limit: 30, userId: admin.id });

    const { id } = await params;
    const db = requireDb();

    const source = await db.medicineSource.findUnique({
      where: { id },
      select: { medicineId: true, medicine: { select: { status: true, _count: { select: { sources: true } } } } },
    });
    if (!source) throw new AppError(ERROR_CODES.NOT_FOUND);

    if (source.medicine.status === 'PUBLISHED' && source.medicine._count.sources <= 1) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
        details: { _: ['A published medicine must keep at least one source.'] },
      });
    }

    await db.medicineSource.delete({ where: { id } });
    await audit({
      action: 'SOURCE_UPDATE',
      actorId: admin.id,
      actorEmail: admin.email,
      entityType: 'MedicineSource',
      entityId: id,
      metadata: { deleted: true, medicineId: source.medicineId },
      request: req,
    });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e, 'admin');
  }
}
