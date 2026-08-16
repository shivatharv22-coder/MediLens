import { env } from '@/config/env';
import type { TtsProvider } from './types';

/** Web Speech API in the client. Default; requires no credentials. */
export class BrowserTtsProvider implements TtsProvider {
  readonly name = 'browser';
  readonly mode = 'client' as const;
  isConfigured(): boolean {
    return true;
  }
}

/**
 * Placeholder for a hosted engine (Google/Azure/ElevenLabs).
 * NOT IMPLEMENTED IN v1 — `isConfigured()` returns false so the factory always
 * falls back to browser synthesis rather than failing at play time.
 */
export class ServerTtsProvider implements TtsProvider {
  readonly name = 'server';
  readonly mode = 'server' as const;
  isConfigured(): boolean {
    return false;
  }
}

export function getTtsProvider(): TtsProvider {
  if (env.TTS_PROVIDER === 'server') {
    const server = new ServerTtsProvider();
    if (server.isConfigured()) return server;
  }
  return new BrowserTtsProvider();
}

export * from './types';
export { buildSpeechScript } from './script';
