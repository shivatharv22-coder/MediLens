import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { getRequestLocale } from '@/lib/i18n/server';
import { getMedicineRepository, localiseMedicine } from '@/services/medicine';
import { MedicineDetail } from '@/features/medicine/medicine-detail';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const medicine = await getMedicineRepository().findByIdOrSlug(id);
  if (!medicine) return { title: 'Medicine not found' };
  return {
    title: `${medicine.brandName} ${medicine.strength}`,
    description: `Educational information about ${medicine.brandName} (${medicine.genericName}).`,
  };
}

export default async function MedicinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repository = getMedicineRepository();
  const medicine = await repository.findByIdOrSlug(id);
  if (!medicine) notFound();

  const locale = await getRequestLocale();

  return (
    <AppShell>
      <MedicineDetail medicine={localiseMedicine(medicine, locale)} />
    </AppShell>
  );
}
