import { describe, expect, it } from 'vitest';
import { DEMO_MEDICINES } from '@/database/data/demo-medicines';
import { extractPackageFields } from '@/services/identification/extract';
import { identify, scoreMedicine } from '@/services/identification/match';
import type { ExtractedPackageFields } from '@/types/identification';

const CATALOGUE = DEMO_MEDICINES;

function fields(partial: Partial<ExtractedPackageFields>): ExtractedPackageFields {
  return {
    brandName: null,
    genericName: null,
    strength: null,
    dosageForm: null,
    manufacturer: null,
    compositionLine: null,
    strengthCandidates: [],
    ingredientCandidates: [],
    barcode: null,
    ...partial,
  };
}

describe('scoreMedicine', () => {
  const crocin = CATALOGUE.find((m) => m.brandName === 'Crocin 500')!;

  it('scores an exact pack match very highly', () => {
    const { score, signals } = scoreMedicine(
      fields({
        brandName: 'Crocin 500',
        genericName: 'Paracetamol',
        strength: '500 mg',
        strengthCandidates: ['500 mg'],
        dosageForm: 'TABLET',
        manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd',
      }),
      crocin,
    );
    expect(score).toBeGreaterThan(0.9);
    expect(signals).toContain('BRAND_EXACT');
    expect(signals).toContain('STRENGTH');
  });

  it('caps the score when the strength contradicts the record', () => {
    const { score } = scoreMedicine(
      fields({
        brandName: 'Crocin 500',
        genericName: 'Paracetamol',
        strength: '650 mg',
        strengthCandidates: ['650 mg'],
        dosageForm: 'TABLET',
      }),
      crocin,
    );
    // Must not reach HIGH: a different strength is a different product.
    expect(score).toBeLessThan(0.85);
  });

  it('caps the score when the dosage form contradicts the record', () => {
    const { score } = scoreMedicine(
      fields({
        brandName: 'Crocin 500',
        genericName: 'Paracetamol',
        strengthCandidates: ['500 mg'],
        dosageForm: 'INJECTION',
      }),
      crocin,
    );
    expect(score).toBeLessThan(0.85);
  });

  it('refuses to identify on manufacturer alone', () => {
    const { score } = scoreMedicine(
      fields({ manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd' }),
      crocin,
    );
    expect(score).toBeLessThanOrEqual(0.25);
  });

  it('tolerates a small OCR typo in the brand name', () => {
    const { score, signals } = scoreMedicine(
      fields({
        brandName: 'Crocln 500',
        genericName: 'Paracetamol',
        strengthCandidates: ['500 mg'],
        dosageForm: 'TABLET',
      }),
      crocin,
    );
    expect(score).toBeGreaterThan(0.6);
    expect(signals).toContain('BRAND_FUZZY');
  });
});

describe('identify', () => {
  it('confirms a clean, unambiguous pack', () => {
    const result = identify(
      fields({
        brandName: 'Dolo 650',
        genericName: 'Paracetamol',
        strength: '650 mg',
        strengthCandidates: ['650 mg'],
        dosageForm: 'TABLET',
        manufacturer: 'Micro Labs Ltd',
      }),
      CATALOGUE,
    );

    expect(result.confidenceLevel).toBe('HIGH');
    expect(result.messageCode).toBe('IDENTIFIED');
    expect(result.confirmedMedicineId).toBe('med-paracetamol-650-tab');
  });

  it('never confirms anything below high confidence', () => {
    const result = identify(
      fields({ genericName: 'Paracetamol', ingredientCandidates: ['Paracetamol'] }),
      CATALOGUE,
    );
    expect(result.confidenceLevel).not.toBe('HIGH');
    expect(result.confirmedMedicineId).toBeNull();
  });

  it('reports multiple matches rather than choosing between look-alikes', () => {
    // Generic name and form only: several paracetamol products fit equally.
    const result = identify(
      fields({
        genericName: 'Paracetamol',
        ingredientCandidates: ['Paracetamol'],
        dosageForm: 'TABLET',
      }),
      CATALOGUE,
    );

    expect(result.confirmedMedicineId).toBeNull();
    expect(result.candidates.length).toBeGreaterThan(1);
    expect(['MULTIPLE_MATCHES', 'LOW_CONFIDENCE']).toContain(result.messageCode);
  });

  it('returns NOT_IDENTIFIED when nothing plausibly matches', () => {
    const result = identify(
      fields({ brandName: 'Zzyzx Ultra', genericName: 'Unobtainium' }),
      CATALOGUE,
    );
    expect(result.confidenceLevel).toBe('NOT_IDENTIFIED');
    expect(result.confirmedMedicineId).toBeNull();
    expect(result.candidates).toHaveLength(0);
  });

  it('does not let a barcode alone confirm a medicine', () => {
    const barcoded = CATALOGUE.filter((m) => m.barcodes.length > 0);
    expect(barcoded.length).toBeGreaterThan(0);

    const result = identify(fields({ barcode: '8901234567890' }), CATALOGUE, {
      barcodeMatches: barcoded,
    });

    expect(result.confirmedMedicineId).toBeNull();
    expect(result.confidenceLevel).not.toBe('HIGH');
  });

  it('distinguishes the same brand at different strengths', () => {
    const pack = extractPackageFields(
      ['DOLO 650', 'Paracetamol Tablets IP', 'Each film coated tablet contains Paracetamol IP 650 mg'].join('\n'),
    );
    const result = identify(pack, CATALOGUE);
    const top = result.candidates[0];
    expect(top.medicine.strength).toBe('650 mg');
  });

  it('does not treat a misread generic line as a wrong brand', () => {
    // OCR frequently drops the large brand text, leaving the composition line
    // as the best "brand" candidate. That must not be scored as a mismatch.
    const result = identify(
      fields({
        brandName: 'Paracetamol Tablets IP 500 mg',
        genericName: 'Paracetamol',
        strength: '500 mg',
        strengthCandidates: ['500 mg'],
        ingredientCandidates: ['Paracetamol'],
        dosageForm: 'TABLET',
        manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd',
      }),
      CATALOGUE,
    );

    expect(result.candidates[0].medicine.id).toBe('med-paracetamol-500-tab');
    expect(result.confidenceLevel).toBe('MEDIUM');
    // Still not confirmed: no brand was actually read off the pack.
    expect(result.confirmedMedicineId).toBeNull();
  });

  it('never confirms without brand evidence, however well the rest matches', () => {
    const result = identify(
      fields({
        genericName: 'Metformin Hydrochloride',
        ingredientCandidates: ['Metformin Hydrochloride'],
        strength: '500 mg',
        strengthCandidates: ['500 mg'],
        dosageForm: 'TABLET',
        manufacturer: 'USV Private Ltd',
      }),
      CATALOGUE,
    );
    expect(result.confirmedMedicineId).toBeNull();
    expect(result.confidenceLevel).not.toBe('HIGH');
  });

  it('caps the candidate list', () => {
    const result = identify(
      fields({ genericName: 'Paracetamol', ingredientCandidates: ['Paracetamol'] }),
      CATALOGUE,
      { maxCandidates: 2 },
    );
    expect(result.candidates.length).toBeLessThanOrEqual(2);
  });
});
