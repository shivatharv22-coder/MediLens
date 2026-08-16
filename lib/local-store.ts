'use client';

/**
 * A tiny observable wrapper over `localStorage`.
 *
 * Exists so React can read device-local preferences through
 * `useSyncExternalStore` instead of an effect that calls `setState` on mount.
 * That avoids a cascading render on every page load and, more importantly, gets
 * server and client snapshots right: the server always sees the defaults, so
 * hydration is consistent.
 */
export interface LocalStore<T> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  set: (patch: Partial<T>) => T;
  reset: () => void;
}

export function createLocalStore<T extends object>(key: string, defaults: T): LocalStore<T> {
  const listeners = new Set<() => void>();
  // Cached so `getSnapshot` returns a stable reference; returning a fresh
  // object each call would make React re-render forever.
  let snapshot: T = defaults;
  let hydrated = false;

  const read = (): T => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<T>) } : defaults;
    } catch {
      // Storage disabled or corrupt: defaults are a fine outcome.
      return defaults;
    }
  };

  const emit = () => listeners.forEach((listener) => listener());

  return {
    subscribe(listener) {
      listeners.add(listener);
      // Another tab changing the same key should update this one.
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) {
          snapshot = read();
          emit();
        }
      };
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', onStorage);
      };
    },

    getSnapshot() {
      if (!hydrated) {
        snapshot = read();
        hydrated = true;
      }
      return snapshot;
    },

    getServerSnapshot() {
      return defaults;
    },

    set(patch) {
      snapshot = { ...snapshot, ...patch };
      hydrated = true;
      try {
        window.localStorage.setItem(key, JSON.stringify(snapshot));
      } catch {
        // Non-fatal: the value still applies for this session.
      }
      emit();
      return snapshot;
    },

    reset() {
      snapshot = defaults;
      hydrated = true;
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nothing more to do.
      }
      emit();
    },
  };
}
