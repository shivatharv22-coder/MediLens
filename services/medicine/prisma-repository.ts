import 'server-only';
import type { PrismaClient } from '@/lib/db';
import { SEARCH_PAGE_SIZE } from '@/config/app';
import { normalise } from '@/utils/text';
import type {
  DosageForm,
  Medicine,
  MedicineSearchQuery,
  MedicineSummary,
  Paginated,
  SourceCategory,
  TranslationStatus,
} from '@/types/medicine';
import { toSummary, type MedicineRepository } from './repository';

/** Shape returned by every `include` below. Keeps the mapper honest. */
const MEDICINE_INCLUDE = {
  ingredients: { include: { ingredient: true }, orderBy: { sortOrder: 'asc' } },
  sources: { orderBy: { createdAt: 'asc' } },
  translations: true,
  barcodes: true,
} as const;

type MedicineRow = Awaited<
  ReturnType<PrismaClient['medicine']['findFirstOrThrow']>
> & {
  ingredients: { amount: string | null; unit: string | null; ingredient: { name: string; slug: string } }[];
  sources: {
    id: string;
    category: string;
    name: string;
    url: string | null;
    version: string | null;
    retrievedAt: Date | null;
  }[];
  translations: {
    languageCode: string;
    summary: string | null;
    commonUses: string[];
    mechanismSummary: string | null;
    commonSideEffects: string[];
    importantWarnings: string[];
    cautionGroups: string[];
    storageInformation: string | null;
    status: string;
    producedBy: string | null;
    reviewedAt: Date | null;
  }[];
  barcodes: { code: string }[];
};

function mapMedicine(row: MedicineRow): Medicine {
  return {
    id: row.id,
    slug: row.slug,
    brandName: row.brandName,
    genericName: row.genericName,
    strength: row.strength,
    dosageForm: row.dosageForm as DosageForm,
    manufacturer: row.manufacturer,
    compositionText: row.compositionText,
    packSizeText: row.packSizeText,
    country: row.country,
    prescriptionOnly: row.prescriptionOnly,
    summary: row.summary,
    commonUses: row.commonUses,
    mechanismSummary: row.mechanismSummary,
    commonSideEffects: row.commonSideEffects,
    importantWarnings: row.importantWarnings,
    cautionGroups: row.cautionGroups,
    storageInformation: row.storageInformation,
    status: row.status,
    verificationStatus: row.verificationStatus,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    ingredients: row.ingredients.map((i) => ({
      name: i.ingredient.name,
      slug: i.ingredient.slug,
      amount: i.amount,
      unit: i.unit,
    })),
    sources: row.sources.map((s) => ({
      id: s.id,
      category: s.category as SourceCategory,
      name: s.name,
      url: s.url,
      version: s.version,
      retrievedAt: s.retrievedAt?.toISOString() ?? null,
    })),
    translations: row.translations.map((t) => ({
      languageCode: t.languageCode,
      summary: t.summary,
      commonUses: t.commonUses,
      mechanismSummary: t.mechanismSummary,
      commonSideEffects: t.commonSideEffects,
      importantWarnings: t.importantWarnings,
      cautionGroups: t.cautionGroups,
      storageInformation: t.storageInformation,
      status: t.status as TranslationStatus,
      producedBy: t.producedBy,
      reviewedAt: t.reviewedAt?.toISOString() ?? null,
    })),
    barcodes: row.barcodes.map((b) => b.code),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Repository backed by PostgreSQL through Prisma. */
export class PrismaMedicineRepository implements MedicineRepository {
  readonly name = 'prisma';
  readonly isDemo = false;

  constructor(private readonly db: PrismaClient) {}

  private async findOne(where: Record<string, unknown>): Promise<Medicine | null> {
    const row = await this.db.medicine.findFirst({
      where: { ...where, status: 'PUBLISHED' },
      include: MEDICINE_INCLUDE,
    });
    return row ? mapMedicine(row as unknown as MedicineRow) : null;
  }

  findById(id: string): Promise<Medicine | null> {
    return this.findOne({ id });
  }

  findBySlug(slug: string): Promise<Medicine | null> {
    return this.findOne({ slug });
  }

  findByIdOrSlug(key: string): Promise<Medicine | null> {
    return this.findOne({ OR: [{ id: key }, { slug: key }] });
  }

  async findManyByIds(ids: string[]): Promise<Medicine[]> {
    if (!ids.length) return [];
    const rows = await this.db.medicine.findMany({
      where: { id: { in: ids }, status: 'PUBLISHED' },
      include: MEDICINE_INCLUDE,
    });
    return rows.map((r) => mapMedicine(r as unknown as MedicineRow));
  }

  async search(query: MedicineSearchQuery): Promise<Paginated<MedicineSummary>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? SEARCH_PAGE_SIZE));

    const q = (query.q ?? '').trim();
    const conditions: Record<string, unknown>[] = [];

    if (q) {
      conditions.push({
        OR: [
          { brandName: { contains: q, mode: 'insensitive' } },
          { genericName: { contains: q, mode: 'insensitive' } },
          { manufacturer: { contains: q, mode: 'insensitive' } },
          { strength: { contains: q, mode: 'insensitive' } },
          { searchText: { contains: normalise(q) } },
          { ingredients: { some: { ingredient: { name: { contains: q, mode: 'insensitive' } } } } },
        ],
      });
    }
    if (query.ingredient) {
      conditions.push({
        OR: [
          { genericName: { contains: query.ingredient, mode: 'insensitive' } },
          {
            ingredients: {
              some: { ingredient: { name: { contains: query.ingredient, mode: 'insensitive' } } },
            },
          },
        ],
      });
    }
    if (query.manufacturer) {
      conditions.push({ manufacturer: { contains: query.manufacturer, mode: 'insensitive' } });
    }
    if (query.dosageForm) conditions.push({ dosageForm: query.dosageForm });

    const where = {
      status: query.status ?? 'PUBLISHED',
      ...(conditions.length ? { AND: conditions } : {}),
    };

    const [total, rows] = await Promise.all([
      this.db.medicine.count({ where: where as never }),
      this.db.medicine.findMany({
        where: where as never,
        include: MEDICINE_INCLUDE,
        orderBy: [{ brandName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((r) => toSummary(mapMedicine(r as unknown as MedicineRow))),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async listForMatching(): Promise<Medicine[]> {
    // Matching needs the full published catalogue. For a catalogue larger than
    // a few thousand rows, replace this with a trigram-indexed SQL prefilter —
    // the matcher only depends on being handed candidate rows.
    const rows = await this.db.medicine.findMany({
      where: { status: 'PUBLISHED' },
      include: MEDICINE_INCLUDE,
      take: 5000,
    });
    return rows.map((r) => mapMedicine(r as unknown as MedicineRow));
  }

  async findByBarcode(code: string): Promise<Medicine[]> {
    const rows = await this.db.medicine.findMany({
      where: { status: 'PUBLISHED', barcodes: { some: { code } } },
      include: MEDICINE_INCLUDE,
    });
    return rows.map((r) => mapMedicine(r as unknown as MedicineRow));
  }

  async listManufacturers(): Promise<string[]> {
    const rows = await this.db.medicine.findMany({
      where: { status: 'PUBLISHED', manufacturer: { not: null } },
      select: { manufacturer: true },
      distinct: ['manufacturer'],
      orderBy: { manufacturer: 'asc' },
    });
    return rows.map((r) => r.manufacturer).filter((v): v is string => !!v);
  }

  count(): Promise<number> {
    return this.db.medicine.count({ where: { status: 'PUBLISHED' } });
  }
}

export { mapMedicine, MEDICINE_INCLUDE };
