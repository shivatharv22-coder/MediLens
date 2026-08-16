import { assertSameOrigin, fail, guardRate, ok, parseJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { requireDb } from '@/lib/db';
import { deleteAccountSchema } from '@/lib/schemas';
import { destroySession } from '@/lib/session';
import { getStorageProvider } from '@/services/storage';

export const dynamic = 'force-dynamic';

/** The signed-in user's own record. */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    guardRate(req, 'auth:account', { limit: 60, userId: user.id });
    return ok({ user });
  } catch (e) {
    return fail(e, 'auth');
  }
}

/**
 * Delete the account and everything attached to it.
 *
 * This is a hard delete, not a flag: history rows, scans, prescription scans,
 * sessions and preferences all cascade, and any stored image is removed from
 * object storage first (§23).
 */
export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireUser();
    guardRate(req, 'auth:delete', { limit: 3, windowSeconds: 3600, userId: user.id });
    await parseJson(req, deleteAccountSchema);

    const db = requireDb();
    const storage = getStorageProvider();

    const [history, scans, prescriptions] = await Promise.all([
      db.userHistory.findMany({ where: { userId: user.id }, select: { imageKey: true } }),
      db.medicineScan.findMany({ where: { userId: user.id }, select: { imageKey: true } }),
      db.prescriptionScan.findMany({ where: { userId: user.id }, select: { imageKey: true } }),
    ]);

    const keys = [...history, ...scans, ...prescriptions]
      .map((row) => row.imageKey)
      .filter((key): key is string => !!key);
    await Promise.all(keys.map((key) => storage.delete(key)));

    // Scans use SetNull on user deletion, so remove them explicitly — an
    // orphaned medical image row is exactly what deletion must not leave.
    await db.$transaction([
      db.medicineScan.deleteMany({ where: { userId: user.id } }),
      db.prescriptionScan.deleteMany({ where: { userId: user.id } }),
      db.user.delete({ where: { id: user.id } }),
    ]);

    await audit({
      action: 'USER_DELETE',
      actorEmail: user.email,
      entityType: 'User',
      entityId: user.id,
      metadata: { imagesDeleted: keys.length },
      request: req,
    });

    await destroySession();
    return ok({ deleted: true });
  } catch (e) {
    return fail(e, 'auth');
  }
}
