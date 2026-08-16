'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAME, ROUTES } from '@/config/app';
import { useDict } from '@/lib/i18n/client';
import { cn } from '@/utils/cn';
import { LanguageSwitcher } from './language-switcher';
import {
  HistoryIcon,
  HomeIcon,
  ScanIcon,
  SearchIcon,
  UserIcon,
} from '../ui/icons';

const NAV = [
  { href: ROUTES.home, key: 'home', Icon: HomeIcon },
  { href: ROUTES.search, key: 'search', Icon: SearchIcon },
  { href: ROUTES.scan, key: 'scan', Icon: ScanIcon, primary: true },
  { href: ROUTES.history, key: 'history', Icon: HistoryIcon },
  { href: ROUTES.profile, key: 'profile', Icon: UserIcon },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function Header() {
  const dict = useDict();

  // Opaque, not translucent + backdrop-blur. `backdrop-filter` promotes the
  // sticky header to its own compositing layer, which ghosts into an offset
  // second copy of the header when the renderer stalls or is resized. The page
  // sits on a near-white surface, so a solid background looks the same.
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link href={ROUTES.home} className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white font-bold"
          >
            M
          </span>
          <span className="leading-tight">
            <span className="block text-base font-semibold text-ink-900">{APP_NAME}</span>
            <span className="block text-2xs text-ink-500">{dict.common.tagline}</span>
          </span>
        </Link>
        <LanguageSwitcher />
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const dict = useDict();

  return (
    <nav
      // Distinct label: this and DesktopNav are both in the DOM at all times
      // (one is hidden per breakpoint), and two landmarks sharing a name are
      // announced by a screen reader as duplicate navigation.
      aria-label={dict.a11y.mobileNavigation}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV.map(({ href, key, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[4.25rem] flex-col items-center justify-center gap-1 px-1 text-2xs font-medium',
                  active ? 'text-brand-700' : 'text-ink-500',
                )}
              >
                <Icon className={cn('size-6', active && 'text-brand-600')} />
                <span>{dict.nav[key]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Horizontal navigation shown from the medium breakpoint upward. */
export function DesktopNav() {
  const pathname = usePathname();
  const dict = useDict();

  return (
    <nav
      aria-label={dict.a11y.mainNavigation}
      className="hidden border-b border-[var(--border)] bg-white md:block"
    >
      <ul className="container-page flex gap-1">
        {NAV.map(({ href, key, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 items-center gap-2 border-b-2 px-4 text-sm font-medium',
                  active
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-ink-600 hover:text-ink-900',
                )}
              >
                <Icon className="size-5" />
                {dict.nav[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Footer() {
  const dict = useDict();

  return (
    <footer className="mt-10 border-t border-[var(--border)] bg-white">
      <div className="container-page flex flex-col gap-3 py-6 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-xs leading-relaxed">{dict.home.safetyStatement}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <li>
            <Link className="underline underline-offset-2" href={ROUTES.disclaimer}>
              {dict.legal.disclaimerTitle}
            </Link>
          </li>
          <li>
            <Link className="underline underline-offset-2" href={ROUTES.privacy}>
              {dict.legal.privacyTitle}
            </Link>
          </li>
          <li>
            <Link className="underline underline-offset-2" href={ROUTES.terms}>
              {dict.legal.termsTitle}
            </Link>
          </li>
          <li>
            <Link className="underline underline-offset-2" href={ROUTES.help}>
              {dict.legal.helpTitle}
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const dict = useDict();

  return (
    <>
      <a href="#main" className="sr-only-focusable text-sm font-medium text-brand-700">
        {dict.nav.skipToContent}
      </a>
      <Header />
      <DesktopNav />
      <main id="main" className="container-page pb-nav pt-5 md:pb-10">
        {children}
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
