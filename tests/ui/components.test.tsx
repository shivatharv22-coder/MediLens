// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Alert } from '@/components/ui/alert';
import { Badge, ConfidenceBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/states';
import { LanguageProvider } from '@/lib/i18n/client';
import { MedicineDetail } from '@/features/medicine/medicine-detail';
import { ResultView } from '@/features/scan/result-view';
import { DEMO_MEDICINES } from '@/database/data/demo-medicines';
import { localiseMedicine } from '@/services/medicine/localise';
import type { IdentificationResult } from '@/types/identification';

afterEach(cleanup);

function withLocale(node: React.ReactNode, locale = 'en') {
  return render(<LanguageProvider initialLocale={locale}>{node}</LanguageProvider>);
}

const crocin = DEMO_MEDICINES.find((m) => m.id === 'med-paracetamol-500-tab')!;

describe('Alert', () => {
  it('does not rely on colour alone', () => {
    render(
      <Alert tone="warning" label="Warning" title="Check the pack">
        Body text
      </Alert>,
    );
    // A text label accompanies the colour and the icon.
    expect(screen.getByText('Warning')).toBeTruthy();
    expect(screen.getByText('Check the pack')).toBeTruthy();
  });

  it('marks a danger alert as an alert for assistive tech', () => {
    render(<Alert tone="danger">Something failed</Alert>);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});

describe('ConfidenceBadge', () => {
  it('states the confidence in words, not only in colour', () => {
    render(
      <ConfidenceBadge level="LOW" label="Low confidence" a11yLabel="Identification confidence" />,
    );
    expect(screen.getByText('Low confidence')).toBeTruthy();
    expect(screen.getByText(/Identification confidence/)).toBeTruthy();
  });
});

describe('Button', () => {
  it('renders an accessible button element', () => {
    render(<Button>Scan Medicine</Button>);
    expect(screen.getByRole('button', { name: 'Scan Medicine' })).toBeTruthy();
  });

  it('is disabled when asked', () => {
    render(<Button disabled>Scan</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Field', () => {
  it('binds the label to the control', () => {
    render(<Field label="Email">{(props) => <TextInput {...props} />}</Field>);
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  it('associates an error with the control and announces it', () => {
    render(
      <Field label="Email" error="That address is not valid.">
        {(props) => <TextInput {...props} />}
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('not valid');
  });
});

describe('EmptyState', () => {
  it('shows the title and body', () => {
    render(<EmptyState title="Nothing saved yet" body="Scan a medicine to get started." />);
    expect(screen.getByText('Nothing saved yet')).toBeTruthy();
  });
});

describe('ResultView', () => {
  const base: IdentificationResult = {
    confidenceLevel: 'HIGH',
    confidenceScore: 0.95,
    confirmedMedicineId: 'med-paracetamol-500-tab',
    candidates: [
      {
        medicine: {
          id: 'med-paracetamol-500-tab',
          slug: 'crocin-500-mg-tablet',
          brandName: 'Crocin 500',
          genericName: 'Paracetamol',
          strength: '500 mg',
          dosageForm: 'TABLET',
          manufacturer: 'GSK',
        },
        score: 0.95,
        signals: ['BRAND_EXACT', 'STRENGTH'],
      },
    ],
    extracted: {
      brandName: 'CROCIN 500',
      genericName: 'Paracetamol',
      strength: '500 mg',
      dosageForm: 'TABLET',
      manufacturer: null,
      compositionLine: null,
      strengthCandidates: [],
      ingredientCandidates: [],
      barcode: null,
    },
    messageCode: 'IDENTIFIED',
  };

  it('presents a high-confidence result as identified', () => {
    withLocale(<ResultView result={base} />);
    expect(screen.getByText('Medicine identified')).toBeTruthy();
    expect(screen.getByText('High confidence')).toBeTruthy();
  });

  it('never says "identified" for multiple matches, and asks the user to verify', () => {
    withLocale(
      <ResultView
        result={{
          ...base,
          confidenceLevel: 'MEDIUM',
          confirmedMedicineId: null,
          messageCode: 'MULTIPLE_MATCHES',
        }}
      />,
    );
    expect(screen.queryByText('Medicine identified')).toBeNull();
    expect(screen.getByText('We found several possible matches')).toBeTruthy();
    expect(
      screen.getByText(/verify the medicine name with the package or a pharmacist/i),
    ).toBeTruthy();
  });

  it('shows the low-confidence wording required by the specification', () => {
    withLocale(
      <ResultView
        result={{
          ...base,
          confidenceLevel: 'LOW',
          confidenceScore: 0.4,
          confirmedMedicineId: null,
          messageCode: 'LOW_CONFIDENCE',
        }}
      />,
    );
    expect(screen.getByText('Medicine identification is uncertain')).toBeTruthy();
    expect(
      screen.getByText(/upload a clearer image showing the medicine name, strength, and composition/i),
    ).toBeTruthy();
  });

  it('translates the outcome into the selected language', () => {
    withLocale(
      <ResultView
        result={{ ...base, confirmedMedicineId: null, messageCode: 'LOW_CONFIDENCE', confidenceLevel: 'LOW' }}
      />,
      'hi',
    );
    expect(screen.getByText('दवा की पहचान अनिश्चित है')).toBeTruthy();
  });
});

describe('MedicineDetail', () => {
  it('shows the safety notice on the medicine page', () => {
    withLocale(<MedicineDetail medicine={localiseMedicine(crocin, 'en')} />);
    expect(
      screen.getAllByText(/does not diagnose, prescribe, or replace advice/i).length,
    ).toBeGreaterThan(0);
  });

  it('does not show a demo banner to normal users', () => {
    withLocale(<MedicineDetail medicine={localiseMedicine(crocin, 'en')} />);
    expect(screen.queryByText(/development \/ demo data/i)).toBeNull();
  });

  it('still marks demo content as an unverified source, banner or not', () => {
    // Removing the banner must not remove the honesty: the record is demo data,
    // and the page has to keep saying so where it matters.
    withLocale(<MedicineDetail medicine={localiseMedicine(crocin, 'en')} />);
    expect(screen.getByText('Not yet verified')).toBeTruthy();
    expect(screen.getAllByText(/not a verified medical source/i).length).toBeGreaterThan(0);
  });

  it('labels an unverified record as not verified', () => {
    withLocale(<MedicineDetail medicine={localiseMedicine(crocin, 'en')} />);
    expect(screen.getByText('Not yet verified')).toBeTruthy();
  });

  it('phrases uses as "commonly used for", never as an instruction', () => {
    withLocale(<MedicineDetail medicine={localiseMedicine(crocin, 'en')} />);
    expect(screen.getByText('This medicine is commonly used for:')).toBeTruthy();
    expect(screen.queryByText(/you should take this for/i)).toBeNull();
  });

  it('separates warnings from side effects', () => {
    withLocale(<MedicineDetail medicine={localiseMedicine(crocin, 'en')} />);
    const warnings = screen.getByRole('heading', { name: 'Important warnings' });
    const sideEffects = screen.getByRole('heading', { name: 'Common side effects' });
    expect(warnings).not.toBe(sideEffects);
  });

  it('renders every verified warning', () => {
    withLocale(<MedicineDetail medicine={localiseMedicine(crocin, 'en')} />);
    for (const warning of crocin.importantWarnings) {
      expect(screen.getByText(warning)).toBeTruthy();
    }
  });

  it('names the source and its category', () => {
    withLocale(<MedicineDetail medicine={localiseMedicine(crocin, 'en')} />);
    expect(
      screen.getByText(/Demo seed data — not a verified medical source/),
    ).toBeTruthy();
  });

  it('renders Hindi content when Hindi is selected', () => {
    withLocale(<MedicineDetail medicine={localiseMedicine(crocin, 'hi')} />, 'hi');
    expect(screen.getByRole('heading', { name: 'यह दवा क्या है?' })).toBeTruthy();
  });

  it('warns when falling back to English', () => {
    const noTranslation = DEMO_MEDICINES.find((m) => m.id === 'med-amlodipine-5-tab')!;
    withLocale(<MedicineDetail medicine={localiseMedicine(noTranslation, 'mr')} />, 'mr');
    expect(screen.getByText(/अनुवाद अद्याप उपलब्ध नाही/)).toBeTruthy();
  });
});

describe('Badge', () => {
  it('renders its children', () => {
    const { container } = render(<Badge tone="brand">Verified</Badge>);
    expect(within(container).getByText('Verified')).toBeTruthy();
  });
});
