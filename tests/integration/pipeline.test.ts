import { describe, expect, it } from 'vitest';
import { DemoMedicineRepository } from '@/services/medicine/demo-repository';
import { identifyFromFields, identifyFromOcrText } from '@/services/identification';
import { localiseMedicine } from '@/services/medicine/localise';
import { MockOcrProvider } from '@/services/ocr/mock-provider';
import { TemplateAiProvider } from '@/services/ai/template-provider';
import { toVerifiedContext } from '@/services/ai';
import { buildSpeechScript } from '@/services/tts/script';

/**
 * The whole read path, end to end, against the demo repository:
 * OCR → extract → match → localise → explain → speech script.
 */
describe('scan pipeline', () => {
  const repository = new DemoMedicineRepository();

  it('identifies a clean pack from OCR text', async () => {
    const ocr = await new MockOcrProvider().recognise({
      image: Buffer.alloc(0),
      mimeType: 'image/jpeg',
    });

    const result = await identifyFromOcrText(ocr.text, repository);

    expect(result.messageCode).toBe('IDENTIFIED');
    expect(result.confidenceLevel).toBe('HIGH');
    expect(result.confirmedMedicineId).toBe('med-paracetamol-500-tab');
    expect(result.extracted.brandName).toBe('CROCIN 500');
  });

  it('reports NO_TEXT_DETECTED for an unreadable image', async () => {
    const result = await identifyFromOcrText('   \n\n  ', repository);
    expect(result.messageCode).toBe('NO_TEXT_DETECTED');
    expect(result.confirmedMedicineId).toBeNull();
    expect(result.candidates).toHaveLength(0);
  });

  it('treats user-corrected fields as claims, not facts', async () => {
    const result = await identifyFromFields(
      {
        brandName: 'Totally Made Up Brand',
        genericName: 'Nonexistium',
        strength: '999 mg',
        dosageForm: 'TABLET',
        manufacturer: null,
        compositionLine: null,
        strengthCandidates: ['999 mg'],
        ingredientCandidates: ['Nonexistium'],
        barcode: null,
      },
      repository,
    );

    // Corrections do not bypass verification.
    expect(result.confirmedMedicineId).toBeNull();
    expect(result.confidenceLevel).toBe('NOT_IDENTIFIED');
  });

  it('produces a grounded explanation for the identified medicine', async () => {
    const medicine = await repository.findById('med-paracetamol-500-tab');
    expect(medicine).not.toBeNull();

    const localised = localiseMedicine(medicine!, 'en');
    const answer = await new TemplateAiProvider().explain({
      medicine: toVerifiedContext(localised, { isDemoData: true }),
      language: 'en',
    });

    expect(answer.refused).toBe(false);
    expect(answer.text).toContain(medicine!.summary!);
    for (const use of medicine!.commonUses) {
      expect(answer.text).toContain(use);
    }
  });

  it('builds a speech script from user-facing content only', async () => {
    const medicine = await repository.findById('med-paracetamol-500-tab');
    const script = buildSpeechScript(localiseMedicine(medicine!, 'hi'), 'hi');

    expect(script.speechLocale).toBe('hi-IN');
    expect(script.segments.length).toBeGreaterThan(3);

    // No technical metadata may reach the synthesiser.
    expect(script.plainText).not.toContain(medicine!.id);
    expect(script.plainText).not.toContain(medicine!.slug);
    expect(script.plainText).not.toMatch(/UNVERIFIED|DEMO_SEED_DATA|confidence/i);

    // The safety notice is always read.
    expect(script.plainText).toContain('MediLens');
  });
});

describe('demo repository', () => {
  const repository = new DemoMedicineRepository();

  it('is flagged as demo data', () => {
    expect(repository.isDemo).toBe(true);
  });

  it('never reports demo records as verified', async () => {
    for (const medicine of await repository.listForMatching()) {
      expect(medicine.verificationStatus).toBe('UNVERIFIED');
      expect(medicine.lastVerifiedAt).toBeNull();
      expect(medicine.sources.every((s) => s.category === 'DEMO_SEED_DATA')).toBe(true);
    }
  });

  it('gives every record at least one source', async () => {
    for (const medicine of await repository.listForMatching()) {
      expect(medicine.sources.length).toBeGreaterThan(0);
    }
  });

  it('finds a medicine by brand name', async () => {
    const results = await repository.search({ q: 'crocin' });
    expect(results.items[0].brandName).toBe('Crocin 500');
  });

  it('finds medicines by active ingredient', async () => {
    const results = await repository.search({ q: 'paracetamol' });
    expect(results.total).toBeGreaterThanOrEqual(3);
  });

  it('finds a medicine by manufacturer', async () => {
    const results = await repository.search({ q: 'Cipla' });
    expect(results.total).toBeGreaterThan(0);
  });

  it('tolerates a typo in the brand name', async () => {
    const results = await repository.search({ q: 'crocine' });
    expect(results.items.some((m) => m.brandName === 'Crocin 500')).toBe(true);
  });

  it('filters by dosage form', async () => {
    const results = await repository.search({ q: 'paracetamol', dosageForm: 'ORAL_SUSPENSION' });
    expect(results.items.every((m) => m.dosageForm === 'ORAL_SUSPENSION')).toBe(true);
  });

  it('returns nothing for an unknown term', async () => {
    const results = await repository.search({ q: 'zzzznotamedicine' });
    expect(results.total).toBe(0);
  });

  it('paginates', async () => {
    const page = await repository.search({ q: 'paracetamol', pageSize: 1, page: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.totalPages).toBeGreaterThan(1);
  });

  it('resolves by id and by slug', async () => {
    const byId = await repository.findByIdOrSlug('med-paracetamol-500-tab');
    const bySlug = await repository.findByIdOrSlug('crocin-500-mg-tablet');
    expect(byId?.id).toBe(bySlug?.id);
  });
});
