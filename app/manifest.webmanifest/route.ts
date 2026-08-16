import { NextResponse } from 'next/server';
import { APP_NAME, APP_PURPOSE_STATEMENT, APP_TAGLINE } from '@/config/app';

/** PWA manifest, served from a route so the copy stays in one place. */
export function GET() {
  return NextResponse.json(
    {
      name: `${APP_NAME} — ${APP_TAGLINE}`,
      short_name: APP_NAME,
      description: APP_PURPOSE_STATEMENT,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#f6f8f8',
      theme_color: '#0f7f6c',
      lang: 'en',
      categories: ['health', 'education', 'medical'],
      // A single scalable icon. Add rasterised PNGs (192/512 plus a maskable
      // variant) before store submission — see docs/README.md, "PWA assets".
      icons: [
        { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: '/icons/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      ],
      shortcuts: [
        { name: 'Scan Medicine', url: '/scan' },
        { name: 'Search Medicine', url: '/search' },
      ],
    },
    { headers: { 'content-type': 'application/manifest+json' } },
  );
}
