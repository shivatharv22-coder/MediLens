import { describe, expect, it } from 'vitest';
import { randomNumericCode } from '@/lib/crypto';

/**
 * The reset code's unguessability rests on it being a full six digits drawn
 * uniformly. A generator that dropped leading zeros would quietly shrink the
 * space (and leak the length), so that is what these check.
 */
describe('randomNumericCode', () => {
  it('is always exactly six digits', () => {
    for (let i = 0; i < 2000; i += 1) {
      expect(randomNumericCode(6)).toMatch(/^\d{6}$/);
    }
  });

  it('produces codes across the whole range, including leading zeros', () => {
    const codes = Array.from({ length: 5000 }, () => randomNumericCode(6));
    // With 5000 draws over 000000–999999, a value under 100000 (i.e. a leading
    // zero) is overwhelmingly likely; its absence would mean zeros were lost.
    expect(codes.some((c) => c[0] === '0')).toBe(true);
    expect(codes.every((c) => Number(c) >= 0 && Number(c) <= 999999)).toBe(true);
    // Not a constant.
    expect(new Set(codes).size).toBeGreaterThan(100);
  });

  it('honours a custom length', () => {
    expect(randomNumericCode(4)).toMatch(/^\d{4}$/);
  });
});
