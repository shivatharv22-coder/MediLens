import { beforeEach, describe, expect, it } from 'vitest';
import { detectImageType, validateImageUpload } from '@/lib/upload';
import { __resetRateLimits, checkRateLimit, enforceRateLimit } from '@/lib/rate-limit';
import { __redactForTest } from '@/lib/logger';
import { AppError } from '@/lib/errors';
import { hashIp, sha256, safeEqual } from '@/lib/crypto';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(60).fill(0)]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(60).fill(0)]);
const WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, ...new Array(60).fill(0),
]);

function fileOf(bytes: Buffer, type = 'image/jpeg', name = 'pack.jpg'): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('detectImageType', () => {
  it('recognises real image signatures', () => {
    expect(detectImageType(JPEG)).toBe('image/jpeg');
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(WEBP)).toBe('image/webp');
  });

  it('rejects anything without a known signature', () => {
    expect(detectImageType(Buffer.from('#!/bin/sh\necho hi\n'.padEnd(64, ' ')))).toBeNull();
    expect(detectImageType(Buffer.from('<svg xmlns="..."></svg>'.padEnd(64, ' ')))).toBeNull();
  });

  it('rejects a buffer too short to classify', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe('validateImageUpload', () => {
  it('accepts a well-formed JPEG', async () => {
    const result = await validateImageUpload(fileOf(JPEG));
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.size).toBe(JPEG.byteLength);
  });

  it('does not trust the declared content type', async () => {
    // A shell script labelled as an image must still be refused.
    const hostile = fileOf(Buffer.from('#!/bin/sh\nrm -rf /\n'.padEnd(64, ' ')), 'image/jpeg', 'x.jpg');
    await expect(validateImageUpload(hostile)).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE' });
  });

  it('rejects an SVG, which can carry script', async () => {
    const svg = fileOf(Buffer.from('<svg onload="alert(1)"></svg>'.padEnd(64, ' ')), 'image/svg+xml', 'x.svg');
    await expect(validateImageUpload(svg)).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE' });
  });

  it('rejects HTML disguised with an image extension', async () => {
    const html = fileOf(Buffer.from('<!DOCTYPE html><script>alert(1)</script>'.padEnd(64, ' ')), 'image/png', 'x.png');
    await expect(validateImageUpload(html)).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE' });
  });

  it('rejects an empty file', async () => {
    await expect(validateImageUpload(fileOf(Buffer.alloc(0)))).rejects.toBeInstanceOf(AppError);
  });

  it('rejects a file over the size limit', async () => {
    const huge = fileOf(Buffer.concat([JPEG, Buffer.alloc(9 * 1024 * 1024)]));
    await expect(validateImageUpload(huge)).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });
});

describe('rate limiting', () => {
  beforeEach(() => __resetRateLimits());

  it('allows requests up to the limit', () => {
    for (let i = 0; i < 3; i += 1) {
      expect(checkRateLimit('test:key', { limit: 3, windowSeconds: 60 }).allowed).toBe(true);
    }
  });

  it('blocks past the limit', () => {
    for (let i = 0; i < 3; i += 1) checkRateLimit('test:key', { limit: 3, windowSeconds: 60 });
    expect(checkRateLimit('test:key', { limit: 3, windowSeconds: 60 }).allowed).toBe(false);
  });

  it('keeps buckets independent per key', () => {
    for (let i = 0; i < 3; i += 1) checkRateLimit('a', { limit: 3, windowSeconds: 60 });
    expect(checkRateLimit('b', { limit: 3, windowSeconds: 60 }).allowed).toBe(true);
  });

  it('throws a RATE_LIMITED AppError when enforced', () => {
    enforceRateLimit('enforced', { limit: 1, windowSeconds: 60 });
    expect(() => enforceRateLimit('enforced', { limit: 1, windowSeconds: 60 })).toThrowError(AppError);
    try {
      enforceRateLimit('enforced', { limit: 1, windowSeconds: 60 });
    } catch (e) {
      expect((e as AppError).code).toBe('RATE_LIMITED');
      expect((e as AppError).status).toBe(429);
    }
  });
});

describe('log redaction', () => {
  it('redacts anything that looks sensitive', () => {
    const redacted = __redactForTest({
      password: 'hunter2',
      apiKey: 'sk-live-123',
      authorization: 'Bearer abc',
      rawOcrText: 'Tab Dolo 650',
      prescriptionLine: 'confidential',
      email: 'a@b.com',
      medicineId: 'med-1',
    }) as Record<string, unknown>;

    expect(redacted.password).toBe('[redacted]');
    expect(redacted.apiKey).toBe('[redacted]');
    expect(redacted.authorization).toBe('[redacted]');
    expect(redacted.rawOcrText).toBe('[redacted]');
    expect(redacted.prescriptionLine).toBe('[redacted]');
    expect(redacted.email).toBe('[redacted]');
    // Non-sensitive identifiers survive, or triage becomes impossible.
    expect(redacted.medicineId).toBe('med-1');
  });

  it('redacts nested values too', () => {
    const redacted = __redactForTest({ outer: { inner: { secret: 'x' } } }) as {
      outer: { inner: { secret: string } };
    };
    expect(redacted.outer.inner.secret).toBe('[redacted]');
  });

  it('truncates long strings', () => {
    const redacted = __redactForTest({ note: 'a'.repeat(1000) }) as { note: string };
    expect(redacted.note.length).toBeLessThan(1000);
    expect(redacted.note).toMatch(/truncated/);
  });
});

describe('crypto helpers', () => {
  it('hashes IPs with a salt and does not return the input', () => {
    const hashed = hashIp('203.0.113.5', 'salt');
    expect(hashed).not.toContain('203.0.113');
    expect(hashed).toHaveLength(32);
  });

  it('produces different hashes for different salts', () => {
    expect(hashIp('203.0.113.5', 'a')).not.toBe(hashIp('203.0.113.5', 'b'));
  });

  it('returns null for a missing IP', () => {
    expect(hashIp(null, 'salt')).toBeNull();
  });

  it('compares strings without leaking length mismatches as a throw', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('hashes session tokens deterministically', () => {
    expect(sha256('token')).toBe(sha256('token'));
    expect(sha256('token')).not.toBe('token');
  });
});
