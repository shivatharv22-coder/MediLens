import type {
  Medicine,
  MedicineSearchQuery,
  MedicineSummary,
  Paginated,
} from '@/types/medicine';

/**
 * The single interface every part of the application uses to read medicine
 * data. Swapping the backing store (Postgres, bundled demo data, a future
 * external registry) must not require a change anywhere above this line.
 */
export interface MedicineRepository {
  /** Identifies the backing store, e.g. "prisma" or "demo". */
  readonly name: string;
  /** True when the data is demo/seed content rather than verified records. */
  readonly isDemo: boolean;

  findById(id: string): Promise<Medicine | null>;
  findBySlug(slug: string): Promise<Medicine | null>;
  /** Accepts either an id or a slug — the medicine page takes both. */
  findByIdOrSlug(key: string): Promise<Medicine | null>;
  findManyByIds(ids: string[]): Promise<Medicine[]>;
  search(query: MedicineSearchQuery): Promise<Paginated<MedicineSummary>>;
  /** Every published record. Used by the identification matcher. */
  listForMatching(): Promise<Medicine[]>;
  findByBarcode(code: string): Promise<Medicine[]>;
  listManufacturers(): Promise<string[]>;
  count(): Promise<number>;
}

export function toSummary(medicine: Medicine): MedicineSummary {
  return {
    id: medicine.id,
    slug: medicine.slug,
    brandName: medicine.brandName,
    genericName: medicine.genericName,
    strength: medicine.strength,
    dosageForm: medicine.dosageForm,
    manufacturer: medicine.manufacturer,
  };
}

export function paginate<T>(items: T[], page: number, pageSize: number): Paginated<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}
