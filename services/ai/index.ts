import 'server-only';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import type { LocalisedMedicine, Medicine } from '@/types/medicine';
import { AnthropicAiProvider } from './anthropic-provider';
import { TemplateAiProvider } from './template-provider';
import type { AiProvider, VerifiedMedicineContext } from './types';

let cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cached) return cached;

  if (env.AI_PROVIDER === 'anthropic') {
    const anthropic = new AnthropicAiProvider();
    if (anthropic.isConfigured()) {
      cached = anthropic;
      return cached;
    }
    logger.warn('AI_PROVIDER=anthropic but no API key — falling back to the template provider');
  }

  cached = new TemplateAiProvider();
  return cached;
}

/** Test helper. */
export function __setAiProvider(provider: AiProvider | null) {
  cached = provider;
}

/**
 * Build the only medicine context an AI provider is ever given.
 *
 * Nothing outside these fields is passed: no user history, no scan image, no
 * free-form text from the pack, and no unverified candidate data.
 */
export function toVerifiedContext(
  medicine: Medicine | LocalisedMedicine,
  options: { isDemoData?: boolean } = {},
): VerifiedMedicineContext {
  return {
    brandName: medicine.brandName,
    genericName: medicine.genericName,
    strength: medicine.strength,
    dosageForm: medicine.dosageForm,
    manufacturer: medicine.manufacturer,
    prescriptionOnly: medicine.prescriptionOnly,
    content: {
      summary: medicine.summary,
      commonUses: medicine.commonUses,
      mechanismSummary: medicine.mechanismSummary,
      commonSideEffects: medicine.commonSideEffects,
      importantWarnings: medicine.importantWarnings,
      cautionGroups: medicine.cautionGroups,
      storageInformation: medicine.storageInformation,
    },
    sourceNames: medicine.sources.map((s) => s.name),
    isDemoData:
      options.isDemoData ??
      medicine.sources.some((s) => s.category === 'DEMO_SEED_DATA'),
  };
}

export { AnthropicAiProvider, TemplateAiProvider };
export * from './safety';
export type { AiProvider, AiAnswer, VerifiedMedicineContext } from './types';
