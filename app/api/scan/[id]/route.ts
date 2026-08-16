import { fail, guardRate, ok } from '@/lib/api';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { getDb } from '@/lib/db';
import { getSessionUser, readGuestKey } from '@/lib/session';
import { getMedicineRepository } from '@/services/medicine';
import type { ConfidenceLevel, MatchSignal } from '@/types/identification';

export const dynamic = 'force-dynamic';

/**
 * Re-fetch a stored scan result.
 *
 * Access control: a scan belongs either to a signed-in user or to the guest
 * cookie that created it. Anything else is a 404 — an IDOR probe must not be
 * able to distinguish "not yours" from "does not exist".
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    guardRate(req, 'scan:get', { limit: 60 });
    const { id } = await params;

    const db = getDb();
    if (!db) {
      // Without a database, results are not persisted; the client holds them.
      throw new AppError(ERROR_CODES.NOT_FOUND, { logContext: { reason: 'no database' } });
    }

    const user = await getSessionUser();
    const guestKey = user ? null : await readGuestKey();

    const scan = await db.medicineScan.findFirst({
      where: {
        id,
        ...(user ? { userId: user.id } : guestKey ? { guestKey } : { id: '__none__' }),
      },
      include: { results: { orderBy: { rank: 'asc' } } },
    });

    if (!scan) throw new AppError(ERROR_CODES.NOT_FOUND);

    const repository = getMedicineRepository();
    const medicineIds = scan.results.map((r) => r.medicineId).filter((v): v is string => !!v);
    const medicines = await repository.findManyByIds(medicineIds);
    const byId = new Map(medicines.map((m) => [m.id, m]));

    const top = scan.results[0];

    return ok({
      scanId: scan.id,
      status: scan.status,
      createdAt: scan.createdAt.toISOString(),
      ocr: {
        text: scan.rawOcrText ?? '',
        confidence: scan.ocrConfidence ?? 0,
        provider: scan.ocrProvider ?? 'unknown',
      },
      identification: {
        confidenceLevel: (top?.confidenceLevel ?? 'NOT_IDENTIFIED') as ConfidenceLevel,
        confidenceScore: top?.confidenceScore ?? 0,
        confirmedMedicineId:
          top?.confidenceLevel === 'HIGH' && top.medicineId ? top.medicineId : null,
        candidates: scan.results
          .filter((r) => r.medicineId && byId.has(r.medicineId))
          .map((r) => {
            const medicine = byId.get(r.medicineId!)!;
            return {
              medicine: {
                id: medicine.id,
                slug: medicine.slug,
                brandName: medicine.brandName,
                genericName: medicine.genericName,
                strength: medicine.strength,
                dosageForm: medicine.dosageForm,
                manufacturer: medicine.manufacturer,
              },
              score: r.confidenceScore,
              signals: r.matchedOn as MatchSignal[],
            };
          }),
        extracted: {
          brandName: top?.extractedBrand ?? null,
          genericName: top?.extractedGeneric ?? null,
          strength: top?.extractedStrength ?? null,
          dosageForm: top?.extractedForm ?? null,
          manufacturer: top?.extractedManufacturer ?? null,
          compositionLine: null,
          strengthCandidates: [],
          ingredientCandidates: [],
          barcode: null,
        },
        messageCode: scan.failureCode ?? 'IDENTIFIED',
      },
      isDemo: repository.isDemo,
    });
  } catch (e) {
    return fail(e, 'scan');
  }
}
