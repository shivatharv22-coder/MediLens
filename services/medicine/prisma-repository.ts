import 'server-only';
import { Prisma } from '@/database/generated/prisma/client';
import type { PrismaClient } from '@/lib/db';
import { SEARCH_PAGE_SIZE } from '@/config/app';
import { normalise } from '@/utils/text';
import type { MatchHints } from '@/types/identification';
import type {
  DosageForm,
  Medicine,
  MedicineMatchRecord,
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

/** Only what the matcher reads. See `MedicineMatchRecord`. */
const MATCH_SELECT = {
  id: true,
  slug: true,
  brandName: true,
  genericName: true,
  strength: true,
  dosageForm: true,
  manufacturer: true,
  ingredients: { select: { ingredient: { select: { name: true } } } },
} as const;

/**
 * Rows fetched per search term before scoring.
 *
 * Generous enough that a common generic like "Paracetamol" still surfaces the
 * right brand, small enough that the whole shortlist stays in memory and scores
 * in milliseconds.
 */
const PER_TERM_CANDIDATES = 200;

/**
 * Turn the fields read off a pack into the handful of strings worth querying.
 *
 * The brand *stem* is queried alongside the brand itself because OCR routinely
 * merges or drops the strength printed next to it: "DOLO650" and "DOLO 650"
 * must both reach the "Dolo 650 Tablet" record.
 */
function matchTerms(hints: MatchHints): string[] {
  const raw = [hints.brandName, hints.genericName, ...hints.ingredientNames];
  if (hints.brandName) {
    const stem = hints.brandName.replace(/\s*\d+.*$/, '').trim();
    if (stem && stem !== hints.brandName) raw.push(stem);
  }

  const terms: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    const term = value?.trim();
    // Two characters matches most of the catalogue and identifies nothing.
    if (!term || term.length < 3) continue;
    const key = normalise(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
  }
  // Cap the fan-out: past a few terms each extra query costs a round trip and
  // adds candidates the scorer would reject anyway.
  return terms.slice(0, 5);
}

type Sql = ReturnType<typeof Prisma.sql>;

/** The columns the raw search projects. */
interface SearchRow {
  id: string;
  slug: string;
  brandName: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string | null;
}

/**
 * Neutralise LIKE wildcards in user input.
 *
 * Values are parameterised, so this is not about injection — it is about a
 * search for "50%" meaning "50 percent" rather than "50 followed by anything".
 */
function escapeLike(value: string): string {
  // Backslash first, or the escapes added below would be escaped again.
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** EXISTS over the ingredient join, used by both the free-text and filter paths. */
function ingredientMatches(value: string): Sql {
  const like = `%${escapeLike(value)}%`;
  return Prisma.sql`EXISTS (
    SELECT 1 FROM medicine_ingredients mi
    JOIN active_ingredients ai ON ai.id = mi."ingredientId"
    WHERE mi."medicineId" = m.id AND ai.name ILIKE ${like}
  )`;
}

/**
 * Relevance tiers for a free-text query, emitted as a leading ORDER BY term.
 *
 * Plain alphabetical order is unusable at this catalogue size: searching "dolo"
 * fills the first page with Adoloc, Aeldolo and Aldoloc while Dolo 650 sits
 * hundreds of rows down. What the user typed is almost always the start of a
 * brand name, so exact and prefix matches come first and the substring matches
 * that make search forgiving stay available underneath.
 *
 * Returns an empty fragment when there is no query, leaving the alphabetical
 * ordering that a pure filter listing wants. The tie-break sorts on
 * `lower(brandName)`, because the database collation otherwise files every
 * SHOUTED brand name ahead of the Title Case ones.
 */
function relevanceOrder(q: string): Sql {
  if (!q) return Prisma.empty;
  const escaped = escapeLike(q);
  return Prisma.sql`CASE
    WHEN m."brandName" ILIKE ${escaped} THEN 0
    WHEN m."brandName" ILIKE ${`${escaped} %`} THEN 1
    WHEN m."brandName" ILIKE ${`${escaped}%`} THEN 2
    WHEN m."searchText" LIKE ${`${escapeLike(normalise(q))}%`} THEN 3
    WHEN m."genericName" ILIKE ${escaped} THEN 4
    WHEN m."genericName" ILIKE ${`${escaped}%`} THEN 5
    ELSE 6
  END ASC,`;
}

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
    const filters: Sql[] = [Prisma.sql`m.status::text = ${query.status ?? 'PUBLISHED'}`];

    if (q) {
      const like = `%${escapeLike(q)}%`;
      filters.push(Prisma.sql`(
        m."brandName" ILIKE ${like}
        OR m."genericName" ILIKE ${like}
        OR m.manufacturer ILIKE ${like}
        OR m.strength ILIKE ${like}
        OR m."searchText" LIKE ${`%${escapeLike(normalise(q))}%`}
        OR ${ingredientMatches(q)}
      )`);
    }
    if (query.ingredient) {
      const like = `%${escapeLike(query.ingredient)}%`;
      filters.push(Prisma.sql`(m."genericName" ILIKE ${like} OR ${ingredientMatches(query.ingredient)})`);
    }
    if (query.manufacturer) {
      filters.push(Prisma.sql`m.manufacturer ILIKE ${`%${escapeLike(query.manufacturer)}%`}`);
    }
    if (query.dosageForm) {
      filters.push(Prisma.sql`m."dosageForm"::text = ${query.dosageForm}`);
    }

    const where = Prisma.join(filters, ' AND ');

    // `count(*) OVER ()` rides along with the page instead of a second query.
    // The ordering already forces the whole match set to be evaluated, so the
    // total is free at that point.
    const rows = await this.db.$queryRaw<(SearchRow & { total: bigint })[]>(Prisma.sql`
      SELECT m.id, m.slug, m."brandName", m."genericName", m.strength,
             m."dosageForm"::text AS "dosageForm", m.manufacturer,
             count(*) OVER () AS total
      FROM medicines m
      WHERE ${where}
      ORDER BY ${relevanceOrder(q)} lower(m."brandName") ASC, m.id ASC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `);

    const total = rows.length ? Number(rows[0].total) : 0;

    return {
      items: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        brandName: r.brandName,
        genericName: r.genericName,
        strength: r.strength,
        dosageForm: r.dosageForm as DosageForm,
        manufacturer: r.manufacturer,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findMatchCandidates(hints: MatchHints): Promise<MedicineMatchRecord[]> {
    const terms = matchTerms(hints);
    if (!terms.length) return [];

    // One query per term rather than a single OR: Postgres can stop each query
    // as soon as it has `PER_TERM_CANDIDATES` rows, whereas one big OR over a
    // quarter-million rows has to evaluate every branch against every row.
    // There is deliberately no ORDER BY, for the same reason — sorting would
    // force the full result set to be materialised before the LIMIT applies.
    const batches = await Promise.all(
      terms.map((term) =>
        this.db.medicine.findMany({
          where: {
            status: 'PUBLISHED',
            OR: [
              { searchText: { contains: normalise(term) } },
              { brandName: { contains: term, mode: 'insensitive' } },
            ],
          },
          select: MATCH_SELECT,
          take: PER_TERM_CANDIDATES,
        }),
      ),
    );

    // Union by id: a pack that reads "Dolo 650 / Paracetamol" hits the same
    // record from two terms, and it must be scored once.
    const byId = new Map<string, MedicineMatchRecord>();
    for (const batch of batches) {
      for (const row of batch) {
        if (byId.has(row.id)) continue;
        byId.set(row.id, {
          id: row.id,
          slug: row.slug,
          brandName: row.brandName,
          genericName: row.genericName,
          strength: row.strength,
          dosageForm: row.dosageForm as DosageForm,
          manufacturer: row.manufacturer,
          ingredients: row.ingredients.map((i) => ({ name: i.ingredient.name })),
        });
      }
    }

    return [...byId.values()];
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
