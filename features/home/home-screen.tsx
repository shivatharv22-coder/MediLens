'use client';

import Link from 'next/link';
import { APP_NAME, ROUTES } from '@/config/app';
import { AppShell } from '@/components/layout/app-shell';
import { SafetyNotice } from '@/components/safety-notice';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  CameraIcon,
  ChevronRightIcon,
  GlobeIcon,
  HistoryIcon,
  PrescriptionIcon,
  SearchIcon,
} from '@/components/ui/icons';
import { useDict } from '@/lib/i18n/client';
import { Onboarding } from './onboarding';

export function HomeScreen() {
  const dict = useDict();

  const secondary = [
    { href: ROUTES.search, label: dict.home.searchCta, Icon: SearchIcon },
    { href: ROUTES.prescription, label: dict.home.prescriptionCta, Icon: PrescriptionIcon },
    { href: ROUTES.history, label: dict.home.historyCta, Icon: HistoryIcon },
    { href: ROUTES.language, label: dict.home.languageCta, Icon: GlobeIcon },
  ];

  const steps = [
    { title: dict.home.step1Title, body: dict.home.step1Body },
    { title: dict.home.step2Title, body: dict.home.step2Body },
    { title: dict.home.step3Title, body: dict.home.step3Body },
  ];

  return (
    <AppShell>
      <Onboarding />

      <div className="space-y-6">
        {/* Hero. The single most important action on the whole product. */}
        <section className="rounded-2xl bg-gradient-to-b from-brand-50 to-white p-5 sm:p-7 border border-brand-100">
          <p className="text-sm font-medium text-brand-700">{APP_NAME}</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900 sm:text-3xl">
            {dict.home.heroTitle}
          </h1>
          <p className="mt-2 max-w-prose text-sm text-ink-600 sm:text-base">
            {dict.home.heroSubtitle}
          </p>
          <ButtonLink href={ROUTES.scan} size="lg" className="mt-5 w-full sm:w-auto">
            <CameraIcon className="size-5" />
            {dict.home.scanCta}
          </ButtonLink>
        </section>

        <nav aria-label={dict.nav.menu}>
          <ul className="grid grid-cols-2 gap-3">
            {secondary.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="card flex h-full min-h-24 flex-col justify-between gap-2 p-4 transition-colors hover:bg-ink-50"
                >
                  <Icon className="size-6 text-brand-600" />
                  <span className="flex items-center justify-between gap-2 text-sm font-medium text-ink-900">
                    {label}
                    <ChevronRightIcon className="size-4 shrink-0 text-ink-400" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="mb-3 text-base font-semibold text-ink-900">
            {dict.home.howItWorksTitle}
          </h2>
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <Card as="li" key={step.title} className="flex gap-3">
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800"
                >
                  {index + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink-900">{step.title}</span>
                  <span className="mt-0.5 block text-sm text-ink-600">{step.body}</span>
                </span>
              </Card>
            ))}
          </ol>
        </section>

        <SafetyNotice />
      </div>
    </AppShell>
  );
}
