'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker in production only.
 *
 * In development an active worker makes cache behaviour confusing and hides
 * code changes, so registration is skipped and any existing worker removed.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((r) => r.unregister()))
        .catch(() => undefined);
      return;
    }

    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // A failed registration only costs offline support; the app still works.
    });
  }, []);

  return null;
}
