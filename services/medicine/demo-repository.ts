import { DEMO_MEDICINES } from '@/database/data/demo-medicines';
import { SEARCH_PAGE_SIZE } from '@/config/app';
import { normalise, similarity } from '@/utils/text';
import type {
  Medicine,
  MedicineSearchQuery,
  MedicineSummary,
  Paginated,
} from '@/types/medicine';
import { paginate, toSummary, type MedicineRepository } from './repository';

/**
 * Read-only repository over the bundled demo dataset.
 *
 * Used when DATABASE_URL is absent so the whole flow — scan, match, explain,
 * translate, listen — can be exercised. Every record it returns is marked
 * UNVERIFIED with a DEMO_SEED_DATA source, and `isDemo` drives the UI banner.
 */
export class DemoMedicineRepository implements MedicineRepository {
  readonly name = 'demo';
  readonly isDemo = true;

  private readonly medicines: Medicine[];

  constructor(medicines: Medicine[] = DEMO_MEDICINES) {
    this.medicines = medicines;
  }

  async findById(id: string): Promise<Medicine | null> {
    return this.medicines.find((m) => m.id === id) ?? null;
  }

  async findBySlug(slug: string): Promise<Medicine | null> {
    return this.medicines.find((m) => m.slug === slug) ?? null;
  }

  async findByIdOrSlug(key: string): Promise<Medicine | null> {
    return (await this.findById(key)) ?? (await this.findBySlug(key));
  }

  async findManyByIds(ids: string[]): Promise<Medicine[]> {
    const wanted = new Set(ids);
    return this.medicines.filter((m) => wanted.has(m.id));
  }

  async search(query: MedicineSearchQuery): Promise<Paginated<MedicineSummary>> {
    const q = normalise(query.q ?? '');
    const ingredient = normalise(query.ingredient ?? '');
    const manufacturer = normalise(query.manufacturer ?? '');

    const scored = this.medicines
      .map((medicine) => ({ medicine, score: this.score(medicine, q, ingredient, manufacturer) }))
      .filter((entry) => entry.score > 0)
      .filter((entry) => !query.dosageForm || entry.medicine.dosageForm === query.dosageForm)
      .sort(
        (a, b) => b.score - a.score || a.medicine.brandName.localeCompare(b.medicine.brandName),
      );

    return paginate(
      scored.map((entry) => toSummary(entry.medicine)),
      query.page ?? 1,
      query.pageSize ?? SEARCH_PAGE_SIZE,
    );
  }

  private score(medicine: Medicine, q: string, ingredient: string, manufacturer: string): number {
    // No criteria at all: return everything so the browse view has content.
    if (!q && !ingredient && !manufacturer) return 0.1;

    let score = 0;

    if (manufacturer) {
      const target = normalise(medicine.manufacturer ?? '');
      if (!target.includes(manufacturer)) return 0;
      score += 0.3;
    }

    if (ingredient) {
      const hit = medicine.ingredients.some((i) => normalise(i.name).includes(ingredient));
      if (!hit && !normalise(medicine.genericName).includes(ingredient)) return 0;
      score += 0.4;
    }

    if (q) {
      const brand = normalise(medicine.brandName);
      const generic = normalise(medicine.genericName);
      const maker = normalise(medicine.manufacturer ?? '');
      const ingredients = medicine.ingredients.map((i) => normalise(i.name));

      let best = 0;
      if (brand.startsWith(q)) best = Math.max(best, 1);
      else if (brand.includes(q)) best = Math.max(best, 0.85);
      if (generic.startsWith(q)) best = Math.max(best, 0.9);
      else if (generic.includes(q)) best = Math.max(best, 0.75);
      if (ingredients.some((i) => i.includes(q))) best = Math.max(best, 0.7);
      if (maker.includes(q)) best = Math.max(best, 0.5);
      if (normalise(medicine.strength).includes(q)) best = Math.max(best, 0.4);
      // Tolerate a typo. The brand stem is compared too, because a pack brand
      // usually repeats the strength ("Crocin 500") and a user searching
      // "crocine" should still find it.
      if (best === 0) {
        const brandStem = brand.replace(/\s*\d.*$/, '').trim();
        const fuzzy = Math.max(
          similarity(brand, q),
          similarity(brandStem, q),
          similarity(generic, q),
        );
        if (fuzzy >= 0.72) best = fuzzy * 0.6;
      }
      if (best === 0) return 0;
      score += best;
    }

    return score;
  }

  /**
   * The demo dataset is a few dozen records, so there is nothing to prefilter:
   * hand the matcher everything and let it score. The wider return type is
   * deliberate — callers holding a `DemoMedicineRepository` directly (the
   * tests) still see the full record.
   */
  async findMatchCandidates(): Promise<Medicine[]> {
    return this.medicines.filter((m) => m.status === 'PUBLISHED');
  }

  async findByBarcode(code: string): Promise<Medicine[]> {
    return this.medicines.filter((m) => m.barcodes.includes(code));
  }

  async listManufacturers(): Promise<string[]> {
    return [...new Set(this.medicines.map((m) => m.manufacturer).filter((v): v is string => !!v))].sort();
  }

  async count(): Promise<number> {
    return this.medicines.length;
  }
}
