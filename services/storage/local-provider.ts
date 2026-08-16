import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/config/env';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { StorageProvider, StoredObject } from './types';

/**
 * Filesystem storage for development.
 *
 * Not suitable for production: it has no replication, no server-side
 * encryption, and no lifecycle policy beyond `purgeExpired`. Use the S3
 * provider (or another object store behind this interface) for a real deploy.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';

  private readonly root: string;

  constructor(root: string = env.STORAGE_LOCAL_DIR) {
    // turbopackIgnore: the path is configuration, not a module import — without
    // this the bundler traces the entire project into the server output.
    this.root = path.resolve(/* turbopackIgnore: true */ process.cwd(), root);
  }

  isConfigured(): boolean {
    return true;
  }

  /**
   * Keys are `<prefix>/<expiryEpoch>-<uuid>`. Reject anything else so a
   * caller-supplied key can never escape the storage root.
   */
  private resolve(key: string): string {
    if (!/^[a-z]+\/\d+-[0-9a-f-]{36}$/i.test(key)) {
      throw new AppError(ERROR_CODES.STORAGE_FAILED, { logContext: { reason: 'malformed key' } });
    }
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) {
      throw new AppError(ERROR_CODES.STORAGE_FAILED, { logContext: { reason: 'path escape' } });
    }
    return full;
  }

  async put(input: {
    data: Buffer | Uint8Array;
    mimeType: string;
    prefix: string;
    retentionHours: number;
  }): Promise<StoredObject> {
    const prefix = input.prefix.replace(/[^a-z]/gi, '').toLowerCase() || 'misc';
    const expiresAt = new Date(Date.now() + input.retentionHours * 3600_000);
    const key = `${prefix}/${Math.floor(expiresAt.getTime() / 1000)}-${randomUUID()}`;

    try {
      const full = this.resolve(key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      // 0600: readable only by the service account.
      await fs.writeFile(full, Buffer.from(input.data), { mode: 0o600 });
      return { key, size: input.data.byteLength, mimeType: input.mimeType, expiresAt };
    } catch (e) {
      logger.error('Local storage write failed', { error: (e as Error).name });
      throw new AppError(ERROR_CODES.STORAGE_FAILED, { cause: e });
    }
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolve(key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch {
      // Already gone is the desired end state.
    }
  }

  async purgeExpired(): Promise<number> {
    let removed = 0;
    const now = Math.floor(Date.now() / 1000);
    try {
      const prefixes = await fs.readdir(this.root, { withFileTypes: true });
      for (const dir of prefixes) {
        if (!dir.isDirectory()) continue;
        const files = await fs.readdir(path.join(this.root, dir.name));
        for (const file of files) {
          const expiry = Number(file.split('-')[0]);
          if (Number.isFinite(expiry) && expiry <= now) {
            await fs.unlink(path.join(this.root, dir.name, file)).catch(() => undefined);
            removed += 1;
          }
        }
      }
    } catch (e) {
      logger.warn('Storage purge failed', { error: (e as Error).name });
    }
    return removed;
  }

  /** Digest used only for de-duplication in tests. */
  static digest(data: Buffer | Uint8Array): string {
    return createHash('sha256').update(Buffer.from(data)).digest('hex');
  }
}
