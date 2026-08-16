import 'server-only';
import { randomUUID } from 'node:crypto';
import { env } from '@/config/env';
import { AppError, ERROR_CODES } from '@/lib/errors';
import type { StorageProvider, StoredObject } from './types';

/**
 * S3-compatible object storage.
 *
 * REQUIRES CREDENTIALS: STORAGE_PROVIDER=s3 plus S3_BUCKET, S3_REGION,
 * S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY (S3_ENDPOINT for non-AWS stores).
 *
 * NOT IMPLEMENTED IN v1. The interface, configuration and wiring exist so that
 * adding the SDK is a single-file change, but every method throws rather than
 * pretending to have stored something. Retention must be enforced with a bucket
 * lifecycle rule as well as by `purgeExpired`.
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';

  isConfigured(): boolean {
    return Boolean(env.S3_BUCKET && env.S3_REGION && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
  }

  private notImplemented(): never {
    throw new AppError(ERROR_CODES.FEATURE_DISABLED, {
      logContext: {
        provider: this.name,
        reason: 'S3 storage is not implemented in v1 — see services/storage/s3-provider.ts',
      },
    });
  }

  async put(input: {
    data: Buffer | Uint8Array;
    mimeType: string;
    prefix: string;
    retentionHours: number;
  }): Promise<StoredObject> {
    void input;
    void randomUUID;
    this.notImplemented();
  }

  async get(_key: string): Promise<Buffer | null> {
    this.notImplemented();
  }

  async delete(_key: string): Promise<void> {
    this.notImplemented();
  }

  async purgeExpired(): Promise<number> {
    this.notImplemented();
  }
}
