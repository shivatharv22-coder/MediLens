/**
 * Object storage abstraction for uploaded medicine and prescription images.
 *
 * Callers never construct paths themselves — `put` returns an opaque key that
 * is the only handle to the object. That keeps path traversal impossible by
 * construction and lets the S3 backend use a completely different layout.
 */

export interface StoredObject {
  key: string;
  size: number;
  mimeType: string;
  /** When the object becomes eligible for deletion. */
  expiresAt: Date;
}

export interface StorageProvider {
  readonly name: string;
  isConfigured(): boolean;
  put(input: {
    data: Buffer | Uint8Array;
    mimeType: string;
    /** Logical namespace, e.g. "scan" or "prescription". */
    prefix: string;
    retentionHours: number;
  }): Promise<StoredObject>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  /** Remove every object whose retention window has passed. Returns the count. */
  purgeExpired(): Promise<number>;
}
