import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { isDatabaseUnavailable } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getRequestLocale } from '@/lib/i18n/server';
import { getMedicineRepository, localiseMedicine } from '@/services/medicine';
import { MedicineDetail } from '@/features/medicine/medicine-detail';
import { MedicineUnavailable } from '@/features/medicine/medicine-unavailable';
import type { Medicine } from '@/types/medicine';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const medicine = await getMedicineRepository().findByIdOrSlug(id);
    if (!medicine) return { title: 'Medicine not found' };
    return {
      title: `${medicine.brandName} ${medicine.strength}`,
      description: `Educational information about ${medicine.brandName} (${medicine.genericName}).`,
    };
  } catch {
    // Metadata must never be the thing that takes the page down.
    return { title: 'Medicine information' };
  }
}

export default async function MedicinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getRequestLocale();

  let medicine: Medicine | null;
  try {
    medicine = await getMedicineRepository().findByIdOrSlug(id);
  } catch (e) {
    // A database outage is not a bug in this page, and it must not fall back to
    // the demo dataset either — showing unverified sample records in place of
    // the real catalogue would be a safety failure (docs/SAFETY.md §9).
    // Say plainly that the information is unavailable and let the user retry.
    if (isDatabaseUnavailable(e)) {
      logger.error('Medicine page unavailable: database unreachable', { medicine: id });
      return (
        <AppShell>
          <MedicineUnavailable />
        </AppShell>
      );
    }
    throw e;
  }

  if (!medicine) notFound();

  return (
    <AppShell>
      <MedicineDetail medicine={localiseMedicine(medicine, locale)} />
    </AppShell>
  );
}
