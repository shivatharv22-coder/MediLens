'use client';

import { useMemo } from 'react';
import { usePreferences } from '@/components/preferences-provider';
import { Button } from '@/components/ui/button';
import { PauseIcon, SpeakerIcon, StopIcon } from '@/components/ui/icons';
import { useSpeech } from '@/hooks/use-speech';
import { useDict, useLanguage } from '@/lib/i18n/client';
import { buildSpeechScript } from '@/services/tts/script';
import type { LocalisedMedicine } from '@/types/medicine';

/**
 * Play / pause / stop for the medicine information.
 *
 * The script comes from `buildSpeechScript`, which includes only user-facing
 * content — no ids, scores, or source URLs (§12).
 */
export function ListenButton({ medicine }: { medicine: LocalisedMedicine }) {
  const dict = useDict();
  const { locale } = useLanguage();
  const { preferences } = usePreferences();
  const speech = useSpeech();

  const script = useMemo(
    () => buildSpeechScript(medicine, medicine.contentLanguage || locale),
    [medicine, locale],
  );

  if (speech.state === 'unsupported' || !preferences.ttsEnabled) return null;

  if (speech.state === 'idle') {
    return (
      <Button variant="secondary" onClick={() => speech.play(script, preferences.ttsRate)}>
        <SpeakerIcon className="size-5" />
        {dict.medicine.listen}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {speech.state === 'playing' ? (
        <Button variant="secondary" onClick={speech.pause}>
          <PauseIcon className="size-5" />
          {dict.medicine.pause}
        </Button>
      ) : (
        <Button variant="secondary" onClick={speech.resume}>
          <SpeakerIcon className="size-5" />
          {dict.medicine.play}
        </Button>
      )}
      <Button variant="ghost" onClick={speech.stop}>
        <StopIcon className="size-5" />
        {dict.medicine.stop}
      </Button>
      {!speech.voiceAvailable && (
        <span role="status" className="text-xs text-warn-700">
          {dict.errors.unsupportedLanguage}
        </span>
      )}
    </div>
  );
}
