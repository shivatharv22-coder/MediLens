import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

/**
 * Bare wrapper for the whole /admin tree.
 *
 * The access guard lives in `(dashboard)/layout.tsx` so that `/admin/login`
 * — which necessarily has to be reachable while signed out — sits outside it.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[var(--page-bg)]">{children}</div>;
}
