import 'server-only';
import { AppError, ERROR_CODES } from './errors';
import { getSessionUser, type SessionUser } from './session';
import { isAuthConfigured } from '@/config/env';

export type { SessionUser };

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AppError(ERROR_CODES.UNAUTHORIZED);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    throw new AppError(ERROR_CODES.FORBIDDEN, {
      logContext: { reason: 'non-admin attempted admin route', userId: user.id },
    });
  }
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'SUPER_ADMIN') {
    throw new AppError(ERROR_CODES.FORBIDDEN, {
      logContext: { reason: 'non-super-admin attempted privileged route', userId: user.id },
    });
  }
  return user;
}

export function assertAuthEnabled(): void {
  if (!isAuthConfigured()) {
    throw new AppError(ERROR_CODES.FEATURE_DISABLED, {
      logContext: { reason: 'SESSION_SECRET or DATABASE_URL missing' },
    });
  }
}

export const isAdminRole = (role: string): boolean => role === 'ADMIN' || role === 'SUPER_ADMIN';
