import { assertSameOrigin, fail, guardRate, ok, parseJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth';
import { requireDb } from '@/lib/db';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { adminMedicineUpdateSchema } from '@/lib/schemas';
import { assertPublishable, updateMedicine } from '@/services/admin/medicine-admin';
import { MEDICINE_INCLUDE, mapMedicine } from '@/services/medicine/prisma-repository';

export const dynamic = 'force-dynamic';

/** Full record, any status. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    guardRate(req, 'admin:medicines:get', { limit: 120, userId: admin.id });

    const { id } = await params;
    const row = await requireDb().medicine.findUnique({ where: { id }, include: MEDICINE_INCLUDE });
    if (!row) throw new AppError(ERROR_CODES.NOT_FOUND);

    return ok({ medicine: mapMedicine(row as never) });
  } catch (e) {
    return fail(e, 'admin');
  }
}

/**
 * Update a record.
 *
 * Moving to PUBLISHED goes through `assertPublishable`, so an unverified or
 * demo-sourced record cannot be made visible to users.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const admin = await requireAdmin();
    guardRate(req, 'admin:medicines:update', { limit: 60, userId: admin.id });

    const { id } = await params;
    const body = await parseJson(req, adminMedicineUpdateSchema, 128 * 1024);
    const db = requireDb();

    if (body.status === 'PUBLISHED') await assertPublishable(db, id);

    const result = await updateMedicine(db, id, body);

    await audit({
      action: body.status === 'PUBLISHED' ? 'MEDICINE_PUBLISH' : 'MEDICINE_UPDATE',
      actorId: admin.id,
      actorEmail: admin.email,
      entityType: 'Medicine',
      entityId: id,
      metadata: {
        changedFields: Object.keys(body),
        verificationReset: result.verificationReset,
      },
      request: req,
    });

    return ok(result);
  } catch (e) {
    return fail(e, 'admin');
  }
}

/**
 * Archive a record. Medicine records are never hard-deleted: a scan result or
 * a history row may still reference them, and the audit trail must stay
 * reconstructable.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const admin = await requireAdmin();
    guardRate(req, 'admin:medicines:archive', { limit: 30, userId: admin.id });

    const { id } = await params;
    const medicine = await requireDb().medicine.update({
      where: { id },
      data: { status: 'ARCHIVED' },
      select: { id: true, status: true },
    });

    await audit({
      action: 'MEDICINE_ARCHIVE',
      actorId: admin.id,
      actorEmail: admin.email,
      entityType: 'Medicine',
      entityId: id,
      request: req,
    });

    return ok(medicine);
  } catch (e) {
    return fail(e, 'admin');
  }
}
