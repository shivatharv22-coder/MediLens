import type { Metadata, Viewport } from 'next';
import { APP_NAME, APP_PURPOSE_STATEMENT, APP_TAGLINE } from '@/config/app';
import { getLanguage } from '@/config/languages';
import { getRequestLocale } from '@/lib/i18n/server';
import { LanguageProvider } from '@/lib/i18n/client';
import { PreferencesProvider } from '@/components/preferences-provider';
import { ServiceWorkerRegistrar } from '@/components/service-worker';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_PURPOSE_STATEMENT,
  applicationName: APP_NAME,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
  },
  // Educational tool, not a medical device: keep it out of medical search
  // aggregation until the regulatory review in §32 is complete.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f7f6c',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale();
  const language = getLanguage(locale);

  return (
    <html lang={locale} dir={language.isRtl ? 'rtl' : 'ltr'}>
      <body>
        <LanguageProvider initialLocale={locale}>
          <PreferencesProvider>
            {children}
            <ServiceWorkerRegistrar />
          </PreferencesProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
