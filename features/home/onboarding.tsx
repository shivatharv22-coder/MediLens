'use client';

import { useState } from 'react';
import { usePreferences } from '@/components/preferences-provider';
import { LanguageList } from '@/components/layout/language-switcher';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useDict } from '@/lib/i18n/client';

/**
 * First-run introduction: three short lines and a language choice (§40).
 * Nothing technical, and skippable at any point.
 */
export function Onboarding() {
  const dict = useDict();
  const { preferences, update } = usePreferences();
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Derived, not stored: the preference store already knows whether onboarding
  // has been completed, and `dismissed` covers the skip-without-saving case.
  const open = !preferences.onboardingDone && !dismissed;

  const finish = () => {
    update({ onboardingDone: true });
    setDismissed(true);
  };

  const slides = [dict.onboarding.slide1, dict.onboarding.slide2, dict.onboarding.slide3];
  const isLast = step === slides.length - 1;

  return (
    <Modal
      open={open}
      onClose={finish}
      title={dict.onboarding.title}
      closeLabel={dict.a11y.closeDialog}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={finish}>
            {dict.common.skip}
          </Button>
          <Button size="sm" onClick={() => (isLast ? finish() : setStep((s) => s + 1))}>
            {isLast ? dict.onboarding.getStarted : dict.common.next}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ol className="space-y-2" aria-label={dict.onboarding.title}>
          {slides.map((slide, index) => (
            <li
              key={slide}
              aria-current={index === step ? 'step' : undefined}
              className={
                index <= step
                  ? 'flex gap-2 text-ink-800'
                  : 'flex gap-2 text-ink-400'
              }
            >
              <span aria-hidden className="font-semibold">
                {index + 1}.
              </span>
              <span>{slide}</span>
            </li>
          ))}
        </ol>

        {isLast && (
          <div>
            <p className="mb-2 text-sm font-medium text-ink-800">
              {dict.onboarding.chooseLanguage}
            </p>
            <LanguageList />
          </div>
        )}

        <div className="flex gap-1.5" aria-hidden>
          {slides.map((_, index) => (
            <span
              key={index}
              className={
                index === step
                  ? 'h-1.5 flex-1 rounded-full bg-brand-600'
                  : 'h-1.5 flex-1 rounded-full bg-ink-200'
              }
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
