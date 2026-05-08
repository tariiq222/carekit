import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'Deqah Super-admin',
  description: 'Platform control plane for Deqah staff',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const messages = await getMessages();

  return (
    <html lang="en" dir="ltr">
      <body className="min-h-screen bg-background text-foreground antialiased">
          <NextIntlClientProvider messages={messages}>
            <Providers>{children}</Providers>
          </NextIntlClientProvider>
      </body>
    </html>
  );
}
