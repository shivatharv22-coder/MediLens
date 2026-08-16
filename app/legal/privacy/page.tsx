import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME, ROUTES } from '@/config/app';
import { env } from '@/config/env';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { LastUpdated, Prose } from '@/components/legal/prose';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <AppShell>
      <PageHeader title="Privacy Policy" />
      <Prose>
        <LastUpdated date="12 August 2026" />

        <p>
          Photographs of medicines and prescriptions can reveal health information. {APP_NAME}
          {' '}treats them as sensitive and keeps as little as possible.
        </p>

        <h2>What we collect</h2>
        <h3>If you use MediLens as a guest</h3>
        <ul>
          <li>
            <strong>The image you upload</strong>, for as long as it takes to read the text from it.
            It is not stored unless you turn on &ldquo;Keep my scanned images&rdquo; in Settings.
          </li>
          <li>
            <strong>The text read from the image</strong>, and the identification result. These are
            stored only when the installation has a database attached; otherwise they exist only in
            your browser tab.
          </li>
          <li>
            <strong>A random device key</strong> in a cookie, so you can reopen the result of a scan
            you just made. It is not linked to your identity.
          </li>
          <li>
            <strong>Your language and accessibility choices</strong>, stored on your device.
          </li>
        </ul>

        <h3>If you create an account</h3>
        <ul>
          <li>Your email address and a one-way hash of your password. We never store the password itself.</li>
          <li>A display name, if you give one.</li>
          <li>Your saved medicine history — only the items you explicitly choose to save.</li>
          <li>Your preferences, so they follow you between devices.</li>
        </ul>

        <h2>What we do not do</h2>
        <ul>
          <li>We do not sell personal data.</li>
          <li>We do not use your medicine or prescription images to train AI models.</li>
          <li>We do not build advertising profiles.</li>
          <li>We do not write prescription text or medical images into ordinary application logs.</li>
        </ul>

        <h2>How long we keep things</h2>
        <ul>
          <li>
            Uploaded images: deleted immediately after processing unless you asked us to keep them,
            in which case they are deleted after {env.UPLOAD_RETENTION_HOURS} hours.
          </li>
          <li>Scan records: kept so you can revisit a result, and removed when you delete your account.</li>
          <li>History items: kept until you delete them or clear your history.</li>
          <li>Security and audit logs: kept for operational and security purposes, without medical content.</li>
        </ul>

        <h2>AI processing</h2>
        <p>
          Explanations and translations are produced from the verified medicine record only. When an
          external AI provider is configured, the medicine record and your question are sent to that
          provider; your image, your identity, and your history are not. When no AI provider is
          configured, MediLens builds explanations locally from the stored record without any
          external call.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>Use MediLens without an account.</li>
          <li>Turn image retention off — it is off by default.</li>
          <li>Delete any history item, or clear your whole history, at any time.</li>
          <li>
            Delete your account from <Link href={ROUTES.profile}>Profile</Link>. This permanently
            removes your account, history, scans, and any stored images.
          </li>
          <li>Clear the data stored on this device from <Link href={ROUTES.settings}>Settings</Link>.</li>
        </ul>

        <h2>Security</h2>
        <p>
          Passwords are hashed with bcrypt. Session cookies are HTTP-only and signed. Uploads are
          validated by content, not by file name. Administrative actions are recorded in an audit
          trail. No system is perfectly secure, and we encourage you to use a unique password.
        </p>

        <h2>Children</h2>
        <p>
          MediLens is intended for adults. It is not designed for children to use on their own.
        </p>

        <h2>Contact</h2>
        <p>
          This is a template privacy notice for a product that has not yet completed the regulatory
          review described in the <Link href={ROUTES.disclaimer}>Medical Disclaimer</Link>. Before
          public release, the operator must add a real contact address, a grievance officer as
          required under Indian law, and a lawful-basis statement reviewed by a qualified
          professional.
        </p>
      </Prose>
    </AppShell>
  );
}
