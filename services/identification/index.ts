import 'server-only';
import type { MedicineRepository } from '@/services/medicine/repository';
import type { ExtractedPackageFields, IdentificationResult } from '@/types/identification';
import { extractPackageFields, hasUsableText } from './extract';
import { identify } from './match';

/**
 * OCR text in, identification result out.
 *
 * The pipeline is: raw OCR text -> extracted packaging fields -> catalogue
 * match -> confidence. Each step is a pure function above this one, so the
 * whole chain is testable without a database or an image.
 */
export async function identifyFromOcrText(
  rawOcrText: string,
  repository: MedicineRepository,
): Promise<IdentificationResult> {
  if (!hasUsableText(rawOcrText)) {
    const empty: ExtractedPackageFields = {
      brandName: null,
      genericName: null,
      strength: null,
      dosageForm: null,
      manufacturer: null,
      compositionLine: null,
      strengthCandidates: [],
      ingredientCandidates: [],
      barcode: null,
    };
    return {
      confidenceLevel: 'NOT_IDENTIFIED',
      confidenceScore: 0,
      confirmedMedicineId: null,
      candidates: [],
      extracted: empty,
      messageCode: 'NO_TEXT_DETECTED',
    };
  }

  const extracted = extractPackageFields(rawOcrText);
  const catalogue = await repository.listForMatching();
  const barcodeMatches = extracted.barcode
    ? await repository.findByBarcode(extracted.barcode)
    : [];

  return identify(extracted, catalogue, { barcodeMatches });
}

/**
 * Re-run matching against fields the user corrected on the confirmation screen.
 * The user's corrections are treated exactly like OCR output — they still have
 * to match a verified record before anything is presented as identified.
 */
export async function identifyFromFields(
  fields: ExtractedPackageFields,
  repository: MedicineRepository,
): Promise<IdentificationResult> {
  const catalogue = await repository.listForMatching();
  const barcodeMatches = fields.barcode ? await repository.findByBarcode(fields.barcode) : [];
  return identify(fields, catalogue, { barcodeMatches });
}

export { extractPackageFields, hasUsableText } from './extract';
export { identify, scoreMedicine } from './match';
