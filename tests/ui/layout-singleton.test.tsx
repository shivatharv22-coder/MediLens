// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/layout/app-shell';
import { LanguageProvider } from '@/lib/i18n/client';
import { SignUpPanel } from '@/features/account/sign-up-panel';
import { SignInPanel } from '@/features/account/sign-in-panel';

/**
 * Guards against the page rendering twice.
 *
 * A duplicated header, a second form, or two navigation landmarks sharing a
 * name all read to a user as "the page is rendered twice and overlapping", so
 * each is pinned here rather than left to visual inspection.
 */

vi.mock('next/navigation', () => ({
  usePathname: () => '/auth/sign-up',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

const wrap = (node: React.ReactNode) => (
  <LanguageProvider initialLocale="en">{node}</LanguageProvider>
);

describe('AppShell', () => {
  it('renders exactly one banner header and one main landmark', () => {
    const { container } = render(wrap(<AppShell>content</AppShell>));
    expect(container.querySelectorAll('header')).toHaveLength(1);
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(container.querySelectorAll('footer')).toHaveLength(1);
  });

  it('renders exactly one MediLens logo', () => {
    const { container } = render(wrap(<AppShell>content</AppShell>));
    expect(container.querySelectorAll('header a[href="/"]')).toHaveLength(1);
  });

  it('gives the desktop and mobile navigations distinct accessible names', () => {
    // Both are always in the DOM (one hidden per breakpoint). Sharing a name
    // makes a screen reader announce duplicate navigation.
    const { container } = render(wrap(<AppShell>content</AppShell>));
    const labels = [...container.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label'));
    expect(labels.length).toBeGreaterThan(1);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('SignUpPanel', () => {
  it('renders exactly one of every form element', () => {
    const { container } = render(wrap(<SignUpPanel />));
    expect(container.querySelectorAll('form')).toHaveLength(1);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelectorAll('input[type="email"]')).toHaveLength(1);
    expect(container.querySelectorAll('input[autocomplete="new-password"]')).toHaveLength(1);
    expect(container.querySelectorAll('input[autocomplete="name"]')).toHaveLength(1);
    expect(container.querySelectorAll('button[type="submit"]')).toHaveLength(1);
  });

  it('does not nest a second header element inside the page', () => {
    const { container } = render(wrap(<SignUpPanel />));
    expect(container.querySelectorAll('header')).toHaveLength(0);
  });

  it('shows the heading exactly once', () => {
    render(wrap(<SignUpPanel />));
    expect(screen.getAllByText('Create your account')).toHaveLength(1);
  });
});

describe('SignUpPanel inside AppShell', () => {
  it('still has one header, one main and one form together', () => {
    const { container } = render(
      wrap(
        <AppShell>
          <SignUpPanel />
        </AppShell>,
      ),
    );
    expect(container.querySelectorAll('header')).toHaveLength(1);
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(container.querySelectorAll('form')).toHaveLength(1);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelectorAll('input[type="email"]')).toHaveLength(1);
  });
});

describe('SignInPanel', () => {
  it('renders exactly one sign-in form and no nested header', () => {
    const { container } = render(wrap(<SignInPanel />));
    expect(container.querySelectorAll('form')).toHaveLength(1);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelectorAll('header')).toHaveLength(0);
    expect(container.querySelectorAll('input[autocomplete="current-password"]')).toHaveLength(1);
  });
});
