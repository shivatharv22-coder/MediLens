import { NextResponse } from 'next/server';

/**
 * Service worker.
 *
 * Caching policy is deliberately narrow (§54): the app shell and static assets
 * are cached so the interface opens offline, but **no medicine data, scan
 * result, or API response is ever cached**. MediLens must never show medicine
 * information offline that it cannot confirm is current.
 */
const SW = `
const SHELL_CACHE = 'medilens-shell-__BUILD_ID__';
// Deliberately does NOT include '/'. The home page is a real, session-dependent
// route; caching its HTML and later serving it as a fallback for a different
// URL produces a page whose markup belongs to one route and whose client data
// belongs to another — which renders as duplicated, overlapping content.
const SHELL_ASSETS = ['/offline', '/icons/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache anything that could contain medicine or user data.
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network first, and the ONLY offline fallback is the dedicated
  // offline page. Never substitute another route's cached HTML — the URL and
  // the markup must always describe the same page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/offline').then(
          (r) =>
            r ||
            new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><p>You are offline.</p>', {
              status: 503,
              headers: { 'content-type': 'text/html; charset=utf-8' },
            }),
        ),
      ),
    );
    return;
  }

  // Static assets: cache first.
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
`;

/**
 * Stamp the cache name with a per-deployment id.
 *
 * Without this the cache name is constant, so `activate` never evicts anything
 * and cache-first `/_next/static` entries from an older build can outlive the
 * HTML that referenced them. A changing id makes every deploy start clean.
 */
function buildId(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_BUILD_ID ??
    (process.env.NODE_ENV === 'production' ? 'prod' : 'dev')
  ).slice(0, 12);
}

export function GET() {
  return new NextResponse(SW.replace('__BUILD_ID__', buildId()), {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      // The worker script itself must never be cached, or a fixed worker can
      // never replace a broken one.
      'cache-control': 'no-store, must-revalidate',
      'service-worker-allowed': '/',
    },
  });
}
