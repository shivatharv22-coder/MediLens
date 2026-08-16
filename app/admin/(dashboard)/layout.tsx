import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/app';
import { isAuthConfigured } from '@/config/env';
import { isAdminRole } from '@/lib/auth';
import { getSessionUser } from '@/lib/session';
import { AdminNav } from '@/features/admin/admin-nav';

export const dynamic = 'force-dynamic';

/**
 * Admin access guard, enforced on every request.
 *
 * The API routes call `requireAdmin()` independently; this redirect is for
 * humans, not the security boundary.
 */
export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isAuthConfigured()) {
    return (
      <div className="container-page py-16">
        <div className="card p-6">
          <h1 className="text-lg font-semibold text-ink-900">Admin is unavailable</h1>
          <p className="mt-2 text-sm text-ink-600">
            The admin area needs a database and a session secret. Set <code>DATABASE_URL</code> and{' '}
            <code>SESSION_SECRET</code>, then create the first administrator with{' '}
            <code>npm run admin:create</code>.
          </p>
          <Link href={ROUTES.home} className="mt-4 inline-block text-sm text-brand-700 underline">
            Back to MediLens
          </Link>
        </div>
      </div>
    );
  }

  const user = await getSessionUser();
  if (!user || !isAdminRole(user.role)) redirect(ROUTES.adminLogin);

  return (
    <>
      <header className="border-b border-[var(--border)] bg-white">
        <div className="container-wide flex h-14 items-center justify-between gap-4">
          <Link href={ROUTES.admin} className="text-sm font-semibold text-ink-900">
            MediLens Admin
          </Link>
          <div className="flex items-center gap-3 text-xs text-ink-500">
            <span>{user.email}</span>
            <Link href={ROUTES.home} className="underline">
              Exit
            </Link>
          </div>
        </div>
      </header>
      <AdminNav />
      <main className="container-wide py-6">{children}</main>
    </>
  );
}
