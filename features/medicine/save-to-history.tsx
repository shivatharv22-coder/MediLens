'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckIcon, HistoryIcon } from '@/components/ui/icons';
import { apiFetch, translateError } from '@/hooks/use-api';
import { useDict, useLanguage } from '@/lib/i18n/client';

/**
 * Explicit opt-in save (§10).
 *
 * Viewing a medicine does not create a history entry — the user has to ask for
 * it. Signing in is required, and a guest is told that rather than silently
 * failing.
 */
export function SaveToHistory({ medicineId }: { medicineId: string }) {
  const dict = useDict();
  const { locale } = useLanguage();
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    setState('saving');
    setMessage(null);
    try {
      await apiFetch('/api/history', {
        method: 'POST',
        body: JSON.stringify({ medicineId, languageCode: locale, source: 'SEARCH' }),
      });
      setState('saved');
    } catch (e) {
      const code = (e as { code?: string }).code;
      setState('idle');
      setMessage(code === 'UNAUTHORIZED' ? dict.history.emptyStateGuest : translateError(code, dict));
    }
  };

  if (state === 'saved') {
    return (
      <span className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-50 px-4 text-sm font-medium text-brand-800">
        <CheckIcon className="size-5" />
        {dict.result.savedToHistory}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="secondary" onClick={() => void save()} disabled={state === 'saving'}>
        <HistoryIcon className="size-5" />
        {dict.result.saveToHistory}
      </Button>
      {message && (
        <p role="status" className="text-xs text-ink-600">
          {message}
        </p>
      )}
    </div>
  );
}
