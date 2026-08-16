import { describe, expect, it } from 'vitest';
import { extractPrescription } from '@/services/prescription/extract';
import type { OcrResult } from '@/services/ocr/types';

function ocr(lines: { text: string; confidence?: number }[], pageConfidence = 0.85): OcrResult {
  return {
    text: lines.map((l) => l.text).join('\n'),
    confidence: pageConfidence,
    lines: lines.map((l) => ({ text: l.text, confidence: l.confidence ?? pageConfidence })),
    provider: 'mock',
    durationMs: 1,
    languages: ['eng'],
  };
}

describe('extractPrescription', () => {
  it('keeps every line exactly as it was read', () => {
    const raw = 'Tab. Dolo 650   1-0-1 x 5 days';
    const result = extractPrescription(ocr([{ text: raw }]));
    expect(result.lines[0].rawText).toBe(raw);
  });

  it('copies frequency text verbatim without expanding it', () => {
    const result = extractPrescription(ocr([{ text: 'Tab. Dolo 650 1-0-1 x 5 days' }]));
    const line = result.lines[0];
    expect(line.detectedFrequency).toBe('1-0-1 x 5 days');
    // No expansion into an instruction.
    expect(line.detectedFrequency).not.toMatch(/morning|night|twice/i);
  });

  it('recognises common Indian frequency notations without interpreting them', () => {
    const result = extractPrescription(
      ocr([
        { text: '1. Tab Pan 40 OD x 7 days' },
        { text: '2. Cap Mox 500 TDS' },
      ]),
    );
    expect(result.lines[0].detectedFrequency?.toLowerCase()).toContain('od');
    expect(result.lines[1].detectedFrequency?.toLowerCase()).toContain('tds');
  });

  it('separates a name and strength from a clean line', () => {
    const result = extractPrescription(ocr([{ text: 'Tab. Dolo 650 mg 1-0-1' }], 0.9));
    const line = result.lines[0];
    expect(line.detectedStrength).toBe('650 mg');
    expect(line.detectedName?.toLowerCase()).toContain('dolo');
  });

  it('refuses to separate a name from an illegible line', () => {
    const result = extractPrescription(ocr([{ text: 'Tqb Dxlo 65O', confidence: 0.4 }], 0.6));
    const line = result.lines[0];
    expect(line.detectedName).toBeNull();
    expect(line.needsVerification).toBe(true);
    // The raw text is still shown, unaltered.
    expect(line.rawText).toBe('Tqb Dxlo 65O');
  });

  it('marks the whole page illegible below the confidence floor', () => {
    const result = extractPrescription(ocr([{ text: 'scrawl' }], 0.2));
    expect(result.isLegible).toBe(false);
    expect(result.lines).toHaveLength(0);
    // The raw text survives even when nothing could be broken out.
    expect(result.rawText).toBe('scrawl');
  });

  it('skips clinic and patient header lines', () => {
    const result = extractPrescription(
      ocr([
        { text: 'Dr. A. Sharma MBBS MD' },
        { text: 'Patient: Ravi Kumar' },
        { text: 'Date: 12/08/2026' },
        { text: 'Tab. Pan 40 OD' },
      ]),
    );
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].rawText).toContain('Pan 40');
  });

  it('flags every line it could not split cleanly', () => {
    const result = extractPrescription(ocr([{ text: '3. ???? 1-1-1', confidence: 0.72 }]));
    expect(result.lines[0].needsVerification).toBe(true);
  });

  it('strips stacked line markers from the derived name', () => {
    const result = extractPrescription(ocr([{ text: '1. Tab. Dolo 650 mg 1-0-1 x 5 days' }], 0.9));
    expect(result.lines[0].detectedName).toBe('Dolo');
  });

  it('keeps administration instructions out of the derived name', () => {
    const result = extractPrescription(ocr([{ text: '3. Tab. Pan 40 mg OD before food' }], 0.9));
    const line = result.lines[0];
    expect(line.detectedName).toBe('Pan');
    // …but the instruction is still visible in the verbatim line.
    expect(line.rawText).toContain('before food');
  });

  it('never invents a dose or an instruction', () => {
    const result = extractPrescription(ocr([{ text: 'Tab. Dolo 650 1-0-1 x 5 days' }], 0.9));
    const serialised = JSON.stringify(result);
    expect(serialised).not.toMatch(/should take|recommend|advis/i);
  });
});
