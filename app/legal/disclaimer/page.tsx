import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME, ROUTES } from '@/config/app';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { LastUpdated, Prose } from '@/components/legal/prose';

export const metadata: Metadata = { title: 'Medical Disclaimer' };

export default function DisclaimerPage() {
  return (
    <AppShell>
      <PageHeader title="Medical Disclaimer" />
      <Prose>
        <LastUpdated date="12 August 2026" />

        <p>
          <strong>{APP_NAME} provides educational information about medicines. It is not a
          medical service, a medical device, or a substitute for professional advice.</strong>
        </p>

        <h2>What MediLens does</h2>
        <ul>
          <li>Reads text from a photograph of medicine packaging.</li>
          <li>Attempts to match that text against records in its medicine database.</li>
          <li>
            Shows educational information from those records, translated into the language you
            choose, and reads it aloud if you ask it to.
          </li>
          <li>Extracts and displays the text written on a prescription, exactly as written.</li>
        </ul>

        <h2>What MediLens does not do</h2>
        <ul>
          <li>It does not diagnose medical conditions.</li>
          <li>It does not prescribe medicines.</li>
          <li>
            It does not recommend starting, stopping, continuing, or changing any medicine or
            treatment.
          </li>
          <li>It does not provide personalised medical advice or personalised dosage information.</li>
          <li>It does not predict what will happen to your health.</li>
          <li>It does not check interactions between medicines.</li>
          <li>It does not interpret, correct, or modify a prescription.</li>
          <li>It does not replace a qualified doctor, pharmacist, or other healthcare professional.</li>
        </ul>

        <h2>Accuracy and limitations</h2>
        <p>
          Identification from a photograph can be wrong. Packaging changes, similar brand names,
          poor lighting, and damaged labels all affect the result. When MediLens is not confident,
          it says so and asks you to check the pack — it does not guess. Always confirm the identity
          of a medicine against the packaging itself, the dispensing label, or a pharmacist.
        </p>
        <p>
          Medicine information can change. Records in MediLens carry a source and a
          &ldquo;last verified&rdquo; date, and information that has not been verified is labelled
          as such. Information that is accurate in general may not apply to you.
        </p>

        <h2>Personal medical decisions</h2>
        <p>
          Any decision about whether to take a medicine, how much to take, when to take it, whether
          to stop it, or whether it is suitable for you or for someone in your care is a decision
          for a qualified healthcare professional who knows your situation. Please consult a doctor
          or pharmacist.
        </p>

        <h2>Emergencies</h2>
        <p>
          <strong>
            Do not use MediLens in an emergency. If you or someone else may have taken too much
            medicine, is having an allergic reaction, is having difficulty breathing, or is
            seriously unwell, contact a doctor, a poison control centre, or your local emergency
            medical service immediately.
          </strong>
        </p>

        <h2>Regulatory position</h2>
        <p>
          This disclaimer describes the intended purpose of the product. It does not, by itself,
          make the product compliant with any law or regulation. Before any public or commercial
          launch, MediLens must be reviewed against applicable Indian healthcare, medical device,
          privacy, consumer protection, and advertising requirements by an appropriately qualified
          professional.
        </p>

        <p>
          See also the <Link href={ROUTES.privacy}>Privacy Policy</Link> and{' '}
          <Link href={ROUTES.terms}>Terms of Use</Link>.
        </p>
      </Prose>
    </AppShell>
  );
}
