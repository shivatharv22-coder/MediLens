import { assertSameOrigin, fail, guardRate, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { requireDb } from '@/lib/db';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { getStorageProvider } from '@/services/storage';

export const dynamic = 'force-dynamic';

/** Remove one history item. Scoped to the owner — no cross-user deletes. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requireUser();
    guardRate(req, 'history:delete', { limit: 60, userId: user.id });

    const { id } = await params;
    const db = requireDb();

    const row = await db.userHistory.findFirst({
      where: { id, userId: user.id },
      select: { id: true, imageKey: true },
    });
    if (!row) throw new AppError(ERROR_CODES.NOT_FOUND);

    // Delete the saved image too — history removal must not leave the medical
    // image behind.
    if (row.imageKey) await getStorageProvider().delete(row.imageKey);
    await db.userHistory.delete({ where: { id: row.id } });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e, 'history');
  }
}
