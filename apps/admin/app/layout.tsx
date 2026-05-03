import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import { PostHogProvider } from './posthog-provider';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'Deqah Super-admin',
  description: 'Platform control plane for Deqah staff',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <PostHogProvider>
          <NextIntlClientProvider messages={messages}>
            <Providers dir={locale === 'ar' ? 'rtl' : 'ltr'}>{children}</Providers>
          </NextIntlClientProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
