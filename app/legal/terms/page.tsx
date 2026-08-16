import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME, APP_PURPOSE_STATEMENT, ROUTES } from '@/config/app';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { LastUpdated, Prose } from '@/components/legal/prose';

export const metadata: Metadata = { title: 'Terms of Use' };

export default function TermsPage() {
  return (
    <AppShell>
      <PageHeader title="Terms of Use" />
      <Prose>
        <LastUpdated date="12 August 2026" />

        <h2>1. What this service is</h2>
        <p>{APP_PURPOSE_STATEMENT}</p>
        <p>
          {APP_NAME} is not a medical service and does not create a doctor–patient or
          pharmacist–patient relationship. Read the{' '}
          <Link href={ROUTES.disclaimer}>Medical Disclaimer</Link> before using it.
        </p>

        <h2>2. Acceptable use</h2>
        <ul>
          <li>Use MediLens for your own information, or to help someone in your care understand a medicine.</li>
          <li>Do not rely on it for any medical decision.</li>
          <li>Do not upload images that are not medicine packaging or your own prescription.</li>
          <li>Do not attempt to bypass rate limits, access other users&rsquo; data, or probe the service for vulnerabilities without written permission.</li>
          <li>Do not scrape or bulk-extract the medicine database.</li>
        </ul>

        <h2>3. Accounts</h2>
        <p>
          An account is optional. You are responsible for keeping your password confidential. You
          may delete your account at any time from your profile.
        </p>

        <h2>4. Accuracy</h2>
        <p>
          Medicine information is drawn from the sources shown on each medicine page. It is provided
          for education, may be incomplete, and may become out of date. Identification from a
          photograph may be wrong. Always verify against the packaging or with a pharmacist.
        </p>

        <h2>5. Availability</h2>
        <p>
          The service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. It
          may be interrupted for maintenance or for reasons outside the operator&rsquo;s control.
        </p>

        <h2>6. Limitation of liability</h2>
        <p>
          To the extent permitted by applicable law, the operator is not liable for any loss arising
          from reliance on information provided by MediLens. Nothing in these terms limits liability
          that cannot be limited by law.
        </p>

        <h2>7. Changes</h2>
        <p>
          These terms may change. Continued use after a change means you accept the updated terms.
        </p>

        <h2>8. Pre-launch note</h2>
        <p>
          This is a template. Before any public or commercial launch, the operator must have these
          terms reviewed by a qualified legal professional, and must add governing law, jurisdiction,
          dispute resolution, and contact details.
        </p>
      </Prose>
    </AppShell>
  );
}
