import { assertSameOrigin, fail, guardRate, ok, parseJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth';
import { requireDb } from '@/lib/db';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { adminVerifySchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * Record a verification decision.
 *
 * A record cannot be marked VERIFIED without a non-demo source: verification
 * means "a reviewer checked this against a real source", and there has to be
 * one to check against.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const admin = await requireAdmin();
    guardRate(req, 'admin:medicines:verify', { limit: 60, userId: admin.id });

    const { id } = await params;
    const body = await parseJson(req, adminVerifySchema);
    const db = requireDb();

    const existing = await db.medicine.findUnique({
      where: { id },
      select: { id: true, sources: { select: { category: true } } },
    });
    if (!existing) throw new AppError(ERROR_CODES.NOT_FOUND);

    if (body.verificationStatus === 'VERIFIED') {
      const hasRealSource = existing.sources.some((s) => s.category !== 'DEMO_SEED_DATA');
      if (!hasRealSource) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
          details: {
            verificationStatus: [
              'Add a non-demo source before marking this record as verified.',
            ],
          },
        });
      }
    }

    const medicine = await db.medicine.update({
      where: { id },
      data: {
        verificationStatus: body.verificationStatus,
        reviewNotes: body.reviewNotes ?? null,
        reviewerId: admin.id,
        lastVerifiedAt: body.verificationStatus === 'VERIFIED' ? new Date() : null,
        // A rejected record must not stay visible to users.
        ...(body.verificationStatus === 'REJECTED' ? { status: 'IN_REVIEW' as const } : {}),
      },
      select: { id: true, verificationStatus: true, lastVerifiedAt: true, status: true },
    });

    await audit({
      action: 'MEDICINE_VERIFY',
      actorId: admin.id,
      actorEmail: admin.email,
      entityType: 'Medicine',
      entityId: id,
      metadata: { verificationStatus: body.verificationStatus },
      request: req,
    });

    return ok({
      ...medicine,
      lastVerifiedAt: medicine.lastVerifiedAt?.toISOString() ?? null,
    });
  } catch (e) {
    return fail(e, 'admin');
  }
}
