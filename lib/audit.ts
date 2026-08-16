import 'server-only';
import { getDb } from './db';
import { logger } from './logger';
import { hashIp } from './crypto';
import { env } from '@/config/env';
import { clientIp } from './api';

export type AuditActionName =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_COMPLETE'
  | 'PASSWORD_CHANGE'
  | 'MEDICINE_CREATE'
  | 'MEDICINE_UPDATE'
  | 'MEDICINE_PUBLISH'
  | 'MEDICINE_ARCHIVE'
  | 'MEDICINE_VERIFY'
  | 'SOURCE_CREATE'
  | 'SOURCE_UPDATE'
  | 'TRANSLATION_CREATE'
  | 'TRANSLATION_UPDATE'
  | 'TRANSLATION_REVIEW'
  | 'USER_DELETE'
  | 'HISTORY_CLEAR'
  | 'ADMIN_CREATE'
  | 'SETTINGS_UPDATE';

/**
 * Append to the audit trail.
 *
 * `metadata` must contain only non-sensitive, structured detail — record ids
 * and changed field names, never medical content or credentials.
 */
export async function audit(input: {
  action: AuditActionName;
  actorId?: string | null;
  actorEmail?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  request?: Request;
}): Promise<void> {
  const db = getDb();
  if (!db) {
    logger.info('Audit event (no database)', { action: input.action, entityId: input.entityId });
    return;
  }

  try {
    await db.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: (input.metadata ?? null) as never,
        ipHash: input.request
          ? hashIp(clientIp(input.request), env.SESSION_SECRET || 'medilens-dev-salt')
          : null,
        userAgent: input.request?.headers.get('user-agent')?.slice(0, 255) ?? null,
      },
    });
  } catch (e) {
    // An audit write must never break the operation it is recording, but it is
    // a security-relevant failure, so log it loudly.
    logger.error('Audit write failed', { action: input.action, error: (e as Error).name });
  }
}
