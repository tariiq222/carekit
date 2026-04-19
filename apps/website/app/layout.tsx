import type { Metadata } from 'next';
import { BrandingProvider, BrandingStyle, getPublicBrandingForSsr } from '@/features/branding/public';
import './globals.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const branding = await getPublicBrandingForSsr();
    return {
      title: branding.organizationNameAr,
      description: branding.productTagline ?? undefined,
      icons: branding.faviconUrl ? { icon: branding.faviconUrl } : undefined,
    };
  } catch {
    return {
      title: 'CareKit',
      description: 'CareKit website',
    };
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getPublicBrandingForSsr();

  return (
    <html lang="ar" dir="rtl">
      <head>
        <BrandingStyle branding={branding} />
        {branding.fontUrl ? (
          <link rel="stylesheet" href={branding.fontUrl} />
        ) : (
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap"
          />
        )}
      </head>
      <body>
        <BrandingProvider branding={branding}>{children}</BrandingProvider>
      </body>
    </html>
  );
}
