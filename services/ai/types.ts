import type { MedicineContent } from '@/types/medicine';
import type { RefusalReason } from './safety';

/**
 * AI provider abstraction.
 *
 * Every method receives STRUCTURED VERIFIED DATA, never a free-form prompt from
 * the user alone. The provider's job is to simplify, translate or summarise
 * what it is given — never to supply medical facts of its own.
 */

/** The only medicine facts a provider is ever allowed to see or use. */
export interface VerifiedMedicineContext {
  brandName: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string | null;
  prescriptionOnly: boolean;
  content: MedicineContent;
  /** Source names, so the provider can say where something came from. */
  sourceNames: string[];
  isDemoData: boolean;
}

export interface ExplainRequest {
  medicine: VerifiedMedicineContext;
  /** Target language code, e.g. "hi". */
  language: string;
}

export interface AnswerRequest {
  medicine: VerifiedMedicineContext;
  question: string;
  language: string;
}

export interface TranslateRequest {
  content: MedicineContent;
  targetLanguage: string;
}

export interface AiAnswer {
  text: string;
  /** True when the gate refused rather than answering. */
  refused: boolean;
  refusalReason: RefusalReason | null;
  /** Which fields of the verified record the answer drew on. */
  groundedIn: string[];
  provider: string;
}

export interface AiProvider {
  readonly name: string;
  isConfigured(): boolean;
  /** Plain-language summary built only from `medicine`. */
  explain(request: ExplainRequest): Promise<AiAnswer>;
  /** Answer a user question strictly from `medicine`. */
  answer(request: AnswerRequest): Promise<AiAnswer>;
  /** Translate verified content without adding or removing meaning. */
  translate(request: TranslateRequest): Promise<MedicineContent>;
}
