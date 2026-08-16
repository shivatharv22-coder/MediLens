import type { OcrProvider, OcrRequest, OcrResult } from './types';

/**
 * Deterministic OCR for tests and offline development.
 *
 * Never selected in production: the factory only returns it when
 * OCR_PROVIDER=mock, which `.env.example` documents as test-only.
 */
export class MockOcrProvider implements OcrProvider {
  readonly name = 'mock';

  constructor(
    private readonly fixture: string = [
      'CROCIN 500',
      'Paracetamol Tablets IP 500 mg',
      'Each uncoated tablet contains',
      'Paracetamol IP .......... 500 mg',
      'GlaxoSmithKline Pharmaceuticals Ltd',
      'Store below 30°C',
      '15 Tablets',
    ].join('\n'),
    private readonly confidence = 0.91,
  ) {}

  isConfigured(): boolean {
    return true;
  }

  async recognise(_request: OcrRequest): Promise<OcrResult> {
    return {
      text: this.fixture,
      confidence: this.confidence,
      lines: this.fixture
        .split('\n')
        .map((text) => ({ text, confidence: this.confidence }))
        .filter((l) => l.text.length > 0),
      provider: this.name,
      durationMs: 1,
      languages: ['eng'],
    };
  }
}
