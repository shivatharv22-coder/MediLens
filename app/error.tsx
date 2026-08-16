'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/states';
import { useDict } from '@/lib/i18n/client';

/**
 * Application error boundary.
 *
 * Shows only the generic message (§26). The technical detail stays in the
 * server log; `digest` is the handle an operator uses to correlate the two.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const dict = useDict();

  useEffect(() => {
    // Reported to the console only; the server has already logged the cause.
    console.error('Unhandled UI error', error.digest ?? '');
  }, [error]);

  return (
    <main className="container-page py-16">
      <ErrorState
        message={dict.errors.generic}
        action={
          <Button size="sm" variant="secondary" onClick={reset}>
            {dict.errors.tryAgain}
          </Button>
        }
      />
      {error.digest && (
        <p className="mt-3 text-center text-2xs text-ink-400">Reference: {error.digest}</p>
      )}
    </main>
  );
}
