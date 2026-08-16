/**
 * Text-to-speech abstraction.
 *
 * v1 speaks in the browser with the Web Speech API: no credentials, no audio
 * leaves the device, and no medical text is sent to a third party. A hosted
 * engine can be added behind `ServerTtsProvider` without touching the UI.
 */

export interface SpeechSegment {
  /** Section label, e.g. "Common side effects". Spoken before the body. */
  heading: string | null;
  body: string;
}

export interface SpeechScript {
  languageCode: string;
  /** BCP-47 tag for the synthesiser, e.g. "mr-IN". */
  speechLocale: string;
  segments: SpeechSegment[];
  /** The whole script as one string, for engines that take plain text. */
  plainText: string;
}

export interface TtsProvider {
  readonly name: string;
  /** 'client' means the UI drives synthesis; 'server' returns audio. */
  readonly mode: 'client' | 'server';
  isConfigured(): boolean;
}
