'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeading } from '@/components/ui/card';
import { Field, TextInput } from '@/components/ui/form';
import { Spinner } from '@/components/ui/states';
import { apiFetch, translateError } from '@/hooks/use-api';
import { useDict, useLanguage } from '@/lib/i18n/client';

interface AskResponse {
  text: string;
  refused: boolean;
  refusalReason: string | null;
  groundedIn: string[];
  provider: string;
}

/**
 * Ask a question about this medicine.
 *
 * Answers come from the verified record only. A refusal is rendered as a calm
 * referral, not as an error — declining a personalised question is the correct
 * behaviour, not a failure (§21).
 */
export function AskPanel({ medicineId }: { medicineId: string }) {
  const dict = useDict();
  const { locale } = useLanguage();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 2) return;
    setLoading(true);
    setErrorCode(null);
    setAnswer(null);
    try {
      const result = await apiFetch<AskResponse>('/api/ai/ask', {
        method: 'POST',
        body: JSON.stringify({ medicineId, question: trimmed, language: locale }),
      });
      setAnswer(result);
    } catch (e) {
      setErrorCode((e as { code?: string }).code ?? 'INTERNAL');
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [dict.ai.suggestion1, dict.ai.suggestion2, dict.ai.suggestion3];

  return (
    <Card as="section">
      <CardHeading>{dict.ai.askTitle}</CardHeading>
      <p className="mb-3 text-xs text-ink-500">{dict.ai.askHelp}</p>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <Field label={dict.ai.askTitle}>
          {(props) => (
            <TextInput
              {...props}
              value={question}
              maxLength={500}
              placeholder={dict.ai.askPlaceholder}
              onChange={(e) => setQuestion(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" size="sm" disabled={loading || question.trim().length < 2}>
          {dict.ai.send}
        </Button>
      </form>

      <ul className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion}>
            <button
              type="button"
              className="min-h-11 rounded-full border border-[var(--border)] bg-white px-3.5 text-sm text-ink-700 hover:bg-ink-50"
              onClick={() => {
                setQuestion(suggestion);
                void ask(suggestion);
              }}
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4" aria-live="polite">
        {loading && <Spinner label={dict.ai.thinking} />}

        {errorCode && (
          <Alert tone="danger" role="alert">
            {translateError(errorCode, dict)}
          </Alert>
        )}

        {answer && (
          <Alert tone={answer.refused ? 'warning' : 'neutral'}>
            <p className="whitespace-pre-line">{answer.text}</p>
            {!answer.refused && answer.groundedIn.length > 0 && (
              <p className="mt-2 text-2xs text-ink-500">
                {dict.ai.disclaimerShort} · {dict.medicine.source}: {answer.groundedIn.join(', ')}
              </p>
            )}
          </Alert>
        )}
      </div>
    </Card>
  );
}
