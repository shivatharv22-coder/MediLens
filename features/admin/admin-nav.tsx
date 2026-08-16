'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/config/app';
import { cn } from '@/utils/cn';

const LINKS = [
  { href: ROUTES.admin, label: 'Overview' },
  { href: ROUTES.adminMedicines, label: 'Medicines' },
  { href: ROUTES.adminSources, label: 'Sources' },
  { href: ROUTES.adminReview, label: 'Review queue' },
  { href: ROUTES.adminAudit, label: 'Audit log' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="border-b border-[var(--border)] bg-white">
      <ul className="container-wide flex gap-1 overflow-x-auto">
        {LINKS.map((link) => {
          const active =
            link.href === ROUTES.admin ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium',
                  active
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-ink-600 hover:text-ink-900',
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
