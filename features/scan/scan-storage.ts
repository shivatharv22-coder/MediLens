'use client';

import type { IdentificationResult } from '@/types/identification';

/**
 * Short-lived client cache for a scan result.
 *
 * Uses `sessionStorage`, so it dies with the tab. This is what lets the result
 * page survive a refresh when there is no database, without ever persisting a
 * medical result to durable device storage.
 */

export interface StoredScan {
  scanId: string;
  persisted: boolean;
  identification: IdentificationResult;
  ocr: { text: string; confidence: number; provider: string };
  isDemo: boolean;
}

const PREFIX = 'medilens.scan.';

export function storeScanResult(scanId: string, scan: StoredScan): void {
  try {
    window.sessionStorage.setItem(PREFIX + scanId, JSON.stringify(scan));
  } catch {
    // Storage full or blocked: the in-memory result still renders.
  }
}

export function readScanResult(scanId: string): StoredScan | null {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + scanId);
    return raw ? (JSON.parse(raw) as StoredScan) : null;
  } catch {
    return null;
  }
}

export function clearScanResults(): void {
  try {
    for (const key of Object.keys(window.sessionStorage)) {
      if (key.startsWith(PREFIX)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Nothing to do.
  }
}
