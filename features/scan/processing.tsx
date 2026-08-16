'use client';

import { useEffect, useState } from 'react';
import { useDict } from '@/lib/i18n/client';

/**
 * Progress messaging while a scan runs.
 *
 * The wording describes reading and checking — never deciding — so the user is
 * not led to believe a medical judgment is being made (§43).
 */
export function ProcessingState() {
  const dict = useDict();
  const [step, setStep] = useState(0);

  const messages = [
    dict.scan.processingRead,
    dict.scan.processingCheck,
    dict.scan.processingVerify,
    dict.scan.processingExplain,
  ];

  useEffect(() => {
    // Advances on a timer, and stops on the last message rather than looping,
    // so it never implies more progress than has actually happened.
    const timer = window.setInterval(() => {
      setStep((current) => Math.min(current + 1, messages.length - 1));
    }, 2200);
    return () => window.clearInterval(timer);
  }, [messages.length]);

  return (
    <div
      className="card flex flex-col items-center gap-4 p-10 text-center"
      role="status"
      aria-live="polite"
      aria-label={dict.a11y.loadingRegion}
    >
      <span
        aria-hidden
        className="size-10 rounded-full border-[3px] border-ink-200 border-t-brand-600 animate-spin"
      />
      <p className="text-base font-medium text-ink-900">{messages[step]}</p>
      <ol className="w-full max-w-xs space-y-1.5 text-left text-xs text-ink-500">
        {messages.map((message, index) => (
          <li
            key={message}
            className={index <= step ? 'text-ink-700' : 'text-ink-400'}
            aria-current={index === step ? 'step' : undefined}
          >
            <span aria-hidden>{index < step ? '✓' : index === step ? '•' : '○'}</span> {message}
          </li>
        ))}
      </ol>
    </div>
  );
}
