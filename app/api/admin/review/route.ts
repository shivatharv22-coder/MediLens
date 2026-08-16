import { fail, guardRate, ok } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { requireDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * The review queue.
 *
 * Four buckets an admin has to act on: records awaiting verification,
 * unreviewed translations, scans that failed OCR, and identifications that came
 * back uncertain. The last one is the signal that the medicine database has a
 * gap — it is the queue that actually improves coverage.
 */
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    guardRate(req, 'admin:review', { limit: 60, userId: admin.id });
    const db = requireDb();

    const since = new Date(Date.now() - 30 * 24 * 3600_000);

    const [pendingMedicines, pendingTranslations, ocrFailures, uncertainScans, recentErrors] =
      await Promise.all([
        db.medicine.findMany({
          where: { verificationStatus: { in: ['UNVERIFIED', 'PENDING_REVIEW'] } },
          orderBy: { updatedAt: 'desc' },
          take: 25,
          select: {
            id: true,
            brandName: true,
            strength: true,
            status: true,
            verificationStatus: true,
            updatedAt: true,
            _count: { select: { sources: true } },
          },
        }),
        db.medicineTranslation.findMany({
          where: { status: 'MACHINE_UNREVIEWED' },
          orderBy: { updatedAt: 'desc' },
          take: 25,
          select: {
            id: true,
            languageCode: true,
            updatedAt: true,
            medicine: { select: { id: true, brandName: true, strength: true } },
          },
        }),
        db.medicineScan.findMany({
          where: { status: 'OCR_FAILED', createdAt: { gte: since } },
          orderBy: { createdAt: 'desc' },
          take: 25,
          // Deliberately no OCR text and no image key: this view is for triage,
          // not for reading someone's medical images.
          select: { id: true, createdAt: true, failureCode: true, ocrProvider: true },
        }),
        db.medicineScan.findMany({
          where: {
            status: 'COMPLETED',
            failureCode: { in: ['LOW_CONFIDENCE', 'NOT_IDENTIFIED', 'MULTIPLE_MATCHES', 'NO_TEXT_DETECTED'] },
            createdAt: { gte: since },
          },
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: {
            id: true,
            createdAt: true,
            failureCode: true,
            ocrConfidence: true,
            results: {
              orderBy: { rank: 'asc' },
              take: 1,
              select: { extractedBrand: true, extractedStrength: true, confidenceScore: true },
            },
          },
        }),
        db.systemErrorLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: { id: true, code: true, area: true, message: true, createdAt: true },
        }),
      ]);

    return ok({
      pendingMedicines: pendingMedicines.map((m) => ({
        ...m,
        updatedAt: m.updatedAt.toISOString(),
        sourceCount: m._count.sources,
      })),
      pendingTranslations: pendingTranslations.map((t) => ({
        id: t.id,
        languageCode: t.languageCode,
        updatedAt: t.updatedAt.toISOString(),
        medicineId: t.medicine.id,
        medicineLabel: `${t.medicine.brandName} ${t.medicine.strength}`,
      })),
      ocrFailures: ocrFailures.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
      uncertainScans: uncertainScans.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        failureCode: s.failureCode,
        ocrConfidence: s.ocrConfidence,
        extractedBrand: s.results[0]?.extractedBrand ?? null,
        extractedStrength: s.results[0]?.extractedStrength ?? null,
        topScore: s.results[0]?.confidenceScore ?? 0,
      })),
      recentErrors: recentErrors.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    });
  } catch (e) {
    return fail(e, 'admin');
  }
}
