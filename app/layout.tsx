import type { Metadata, Viewport } from 'next';
import { APP_NAME, APP_PURPOSE_STATEMENT } from '@/config/app';
import { getLanguage } from '@/config/languages';
import { getRequestDictionary, getRequestLocale } from '@/lib/i18n/server';
import { LanguageProvider } from '@/lib/i18n/client';
import { PreferencesProvider } from '@/components/preferences-provider';
import { ServiceWorkerRegistrar } from '@/components/service-worker';
import './globals.css';

/**
 * Resolved per request so the tab title and description follow the reader's
 * language. `APP_NAME` stays as-is: it is the product's name, not a phrase.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getRequestDictionary();
  return {
    ...baseMetadata,
    title: {
      default: `${APP_NAME} — ${dict.common.tagline}`,
      template: `%s · ${APP_NAME}`,
    },
  };
}

const baseMetadata: Metadata = {
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
