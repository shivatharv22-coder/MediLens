'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { SpeechScript } from '@/services/tts/types';

export type SpeechState = 'idle' | 'playing' | 'paused' | 'unsupported';

/**
 * Whether this device can speak at all.
 *
 * Read through `useSyncExternalStore` rather than an on-mount effect: the
 * server snapshot is always `false`, so the Listen button is absent in the
 * server HTML and appears once the client confirms support — no hydration
 * mismatch and no cascading render.
 */
const SPEECH_SUPPORT_STORE = {
  subscribe: () => () => undefined,
  getSnapshot: () => typeof window !== 'undefined' && 'speechSynthesis' in window,
  getServerSnapshot: () => false,
};

/**
 * Web Speech API wrapper for the Listen button.
 *
 * Speaks segment by segment rather than as one long utterance: several mobile
 * engines truncate long strings, and per-segment utterances also give a natural
 * pause between sections.
 */
export function useSpeech() {
  const supported = useSyncExternalStore(
    SPEECH_SUPPORT_STORE.subscribe,
    SPEECH_SUPPORT_STORE.getSnapshot,
    SPEECH_SUPPORT_STORE.getServerSnapshot,
  );
  const [playbackState, setPlaybackState] = useState<Exclude<SpeechState, 'unsupported'>>('idle');
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const queueRef = useRef<SpeechSynthesisUtterance[]>([]);
  const cancelledRef = useRef(false);

  const state: SpeechState = supported ? playbackState : 'unsupported';

  // Stop speaking when the component goes away — a voice continuing to read a
  // page the user has left is both confusing and a privacy problem.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const pickVoice = useCallback((locale: string): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const exact = voices.find((v) => v.lang.toLowerCase() === locale.toLowerCase());
    if (exact) return exact;
    const base = locale.split('-')[0].toLowerCase();
    return voices.find((v) => v.lang.toLowerCase().startsWith(base)) ?? null;
  }, []);

  const stop = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    cancelledRef.current = true;
    queueRef.current = [];
    window.speechSynthesis.cancel();
    setPlaybackState('idle');
  }, []);

  const play = useCallback(
    (script: SpeechScript, rate = 1) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      window.speechSynthesis.cancel();
      cancelledRef.current = false;

      const voice = pickVoice(script.speechLocale);
      // Report a missing voice rather than reading Marathi text with an English
      // voice, which is unintelligible.
      setVoiceAvailable(Boolean(voice) || script.speechLocale.startsWith('en'));

      const utterances = script.segments.map((segment) => {
        const utterance = new SpeechSynthesisUtterance(
          segment.heading ? `${segment.heading}. ${segment.body}` : segment.body,
        );
        utterance.lang = script.speechLocale;
        utterance.rate = rate;
        if (voice) utterance.voice = voice;
        return utterance;
      });

      const last = utterances.at(-1);
      if (last) {
        last.onend = () => {
          if (!cancelledRef.current) setPlaybackState('idle');
        };
      }
      utterances.forEach((u) => {
        u.onerror = () => setPlaybackState('idle');
      });

      queueRef.current = utterances;
      utterances.forEach((u) => window.speechSynthesis.speak(u));
      setPlaybackState('playing');
    },
    [pickVoice],
  );

  const pause = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.pause();
    setPlaybackState('paused');
  }, []);

  const resume = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.resume();
    setPlaybackState('playing');
  }, []);

  return { state, voiceAvailable, play, pause, resume, stop };
}
