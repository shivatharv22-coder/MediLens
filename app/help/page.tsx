import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME, ROUTES } from '@/config/app';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Prose } from '@/components/legal/prose';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Help & FAQ' };

const FAQ = [
  {
    q: 'The scan could not identify my medicine. What now?',
    a: 'Take another photo in good light with the brand name and strength in focus, and try to include the composition line. If it still cannot be matched, search by the name printed on the pack. MediLens will not guess a medicine it cannot confirm.',
  },
  {
    q: 'Why does it show several possible matches?',
    a: 'Some medicines have very similar names and differ only in strength or form — for example a 500 mg tablet and a 650 mg tablet of the same brand. Rather than pick one, MediLens shows the candidates and asks you to check the pack.',
  },
  {
    q: 'Can MediLens tell me how much to take?',
    a: 'No. Dose depends on the person, and only a doctor or pharmacist can advise on that. MediLens will decline questions about your own dose and point you to a professional.',
  },
  {
    q: 'Can I ask whether this medicine is safe for me?',
    a: 'No. MediLens can show general warnings and the groups who are usually advised to take extra care, but it cannot judge your situation. Please ask a doctor or pharmacist.',
  },
  {
    q: 'Does MediLens check whether two medicines can be taken together?',
    a: 'No. Interaction checking is not part of this version. A pharmacist can review everything you take.',
  },
  {
    q: 'What happens to my photos?',
    a: 'By default the photo is used to read the pack and is not stored. You can opt in to keeping images in Settings, and delete them at any time.',
  },
  {
    q: 'Can I use it without an account?',
    a: 'Yes. Scanning, searching, prescription text extraction, and listening all work as a guest. An account only adds a history that follows you across devices.',
  },
  {
    q: 'Why does some information appear in English when I chose Hindi or Marathi?',
    a: 'A translation has not been reviewed for that record yet. Rather than show a machine translation as if it were verified, MediLens shows the original and tells you what happened.',
  },
  {
    q: 'What does "Last verified" mean?',
    a: 'It is the date a reviewer last checked that record against the source shown at the bottom of the page. If a record has never been verified, it says so.',
  },
  {
    q: 'The reading voice sounds wrong or does not work.',
    a: 'Voice output uses the voices installed on your device. If no voice is available for the chosen language, MediLens tells you rather than reading it with the wrong accent. You can add language voices in your device settings.',
  },
];

export default function HelpPage() {
  return (
    <AppShell>
      <PageHeader title="Help & FAQ" />

      <div className="space-y-4">
        <Card>
          <h2 className="mb-2 text-base font-semibold text-ink-900">Getting started</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-700">
            <li>Open <Link className="text-brand-700 underline" href={ROUTES.scan}>Scan Medicine</Link>.</li>
            <li>Frame the pack so the medicine name and strength are inside the guide.</li>
            <li>Capture, then check the photo and crop it if the background is busy.</li>
            <li>Review what MediLens read, and correct anything wrong.</li>
            <li>Open the medicine page to read or listen to the information.</li>
          </ol>
        </Card>

        <Prose>
          <h2>Frequently asked questions</h2>
          <dl className="space-y-4">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="font-semibold text-ink-900">{item.q}</dt>
                <dd className="mt-1">{item.a}</dd>
              </div>
            ))}
          </dl>

          <h2>Still stuck?</h2>
          <p>
            For anything about your own health or medicines, please speak to a doctor or pharmacist.
            {' '}{APP_NAME} is an educational tool — see the{' '}
            <Link href={ROUTES.disclaimer}>Medical Disclaimer</Link>.
          </p>
        </Prose>
      </div>
    </AppShell>
  );
}
