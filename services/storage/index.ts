import 'server-only';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { LocalStorageProvider } from './local-provider';
import { S3StorageProvider } from './s3-provider';
import type { StorageProvider } from './types';

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cached) return cached;

  if (env.STORAGE_PROVIDER === 's3') {
    const s3 = new S3StorageProvider();
    if (s3.isConfigured()) {
      cached = s3;
      return cached;
    }
    logger.warn('STORAGE_PROVIDER=s3 but credentials are missing — using local storage');
  }

  cached = new LocalStorageProvider();
  return cached;
}

export function __setStorageProvider(provider: StorageProvider | null) {
  cached = provider;
}

export { LocalStorageProvider, S3StorageProvider };
export * from './types';
