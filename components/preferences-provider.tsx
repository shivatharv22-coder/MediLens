'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { createLocalStore } from '@/lib/local-store';

/**
 * Local accessibility and speech preferences.
 *
 * Kept on the device so they apply instantly and work for guests. When the user
 * is signed in they are also mirrored to the server by `/api/preferences`;
 * the local copy stays authoritative for rendering.
 */

export interface Preferences {
  highContrast: boolean;
  largeText: boolean;
  ttsEnabled: boolean;
  ttsRate: number;
  saveScanImages: boolean;
  onboardingDone: boolean;
}

const DEFAULTS: Preferences = {
  highContrast: false,
  largeText: false,
  ttsEnabled: true,
  // Off by default: MediLens keeps medical images only on an explicit opt-in.
  saveScanImages: false,
  ttsRate: 1,
  onboardingDone: false,
};

const store = createLocalStore<Preferences>('medilens.preferences', DEFAULTS);

interface PreferencesContextValue {
  preferences: Preferences;
  update: (patch: Partial<Preferences>) => void;
  clearLocalData: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  // Read through the store rather than an on-mount effect, so there is no
  // cascading render and the server snapshot is always the defaults.
  const preferences = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  // Accessibility preferences are applied as data attributes on <html>, which
  // the design tokens in globals.css read.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.contrast = preferences.highContrast ? 'high' : 'normal';
    root.dataset.textSize = preferences.largeText ? 'large' : 'normal';
  }, [preferences.highContrast, preferences.largeText]);

  const update = useCallback((patch: Partial<Preferences>) => {
    store.set(patch);
    // Mirrored to the account when there is one; failure is silent because the
    // device copy is what actually drives the UI.
    void fetch('/api/preferences', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => undefined);
  }, []);

  const clearLocalData = useCallback(() => {
    store.reset();
    try {
      window.sessionStorage.clear();
    } catch {
      // Nothing more we can do; the reset above still applied.
    }
  }, []);

  const value = useMemo(
    () => ({ preferences, update, clearLocalData }),
    [preferences, update, clearLocalData],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    return { preferences: DEFAULTS, update: () => undefined, clearLocalData: () => undefined };
  }
  return ctx;
}
