import { describe, expect, it } from 'vitest';
import { extractPackageFields, hasUsableText } from '@/services/identification/extract';

const CROCIN_PACK = [
  'CROCIN 500',
  'Paracetamol Tablets IP 500 mg',
  'Each uncoated tablet contains',
  'Paracetamol IP .......... 500 mg',
  'GlaxoSmithKline Pharmaceuticals Ltd',
  'Store below 30°C',
  'M.R.P. Rs. 30.00',
  '15 Tablets',
].join('\n');

const CALPOL_BOTTLE = [
  'CALPOL 125',
  'Paracetamol Oral Suspension IP',
  'Each 5 ml contains Paracetamol IP 125 mg',
  'GlaxoSmithKline Pharmaceuticals Ltd',
  '60 ml',
].join('\n');

describe('extractPackageFields', () => {
  it('reads the brand name from the dominant top line', () => {
    expect(extractPackageFields(CROCIN_PACK).brandName).toBe('CROCIN 500');
  });

  it('reads the generic name from the composition line', () => {
    expect(extractPackageFields(CROCIN_PACK).genericName?.toLowerCase()).toContain('paracetamol');
  });

  it('prefers the strength printed on the composition line', () => {
    expect(extractPackageFields(CROCIN_PACK).strength).toBe('500 mg');
  });

  it('detects the dosage form', () => {
    expect(extractPackageFields(CROCIN_PACK).dosageForm).toBe('TABLET');
    expect(extractPackageFields(CALPOL_BOTTLE).dosageForm).toBe('ORAL_SUSPENSION');
  });

  it('detects the manufacturer', () => {
    expect(extractPackageFields(CROCIN_PACK).manufacturer).toContain('GlaxoSmithKline');
  });

  it('handles a per-volume strength', () => {
    const fields = extractPackageFields(CALPOL_BOTTLE);
    expect(fields.strength).toMatch(/125\s*mg\/5\s*ml/);
  });

  it('ignores price and batch boilerplate when picking a brand name', () => {
    const fields = extractPackageFields(CROCIN_PACK);
    expect(fields.brandName).not.toMatch(/M\.R\.P|Rs\./);
  });

  it('returns nulls rather than guessing from noise', () => {
    const fields = extractPackageFields('#### ???? ....');
    expect(fields.brandName).toBeNull();
    expect(fields.genericName).toBeNull();
    expect(fields.strength).toBeNull();
  });

  it('collects every strength candidate it sees', () => {
    const fields = extractPackageFields('DOLO 650\nParacetamol 650 mg\nAlso contains 5 mg something');
    expect(fields.strengthCandidates).toContain('650 mg');
    expect(fields.strengthCandidates).toContain('5 mg');
  });

  it('finds a barcode-shaped digit run', () => {
    expect(extractPackageFields('CROCIN 500\n8901234567890').barcode).toBe('8901234567890');
  });
});

describe('hasUsableText', () => {
  it('rejects empty or near-empty OCR output', () => {
    expect(hasUsableText('')).toBe(false);
    expect(hasUsableText('   \n  ')).toBe(false);
    expect(hasUsableText('a1')).toBe(false);
  });

  it('accepts real packaging text', () => {
    expect(hasUsableText(CROCIN_PACK)).toBe(true);
  });
});
