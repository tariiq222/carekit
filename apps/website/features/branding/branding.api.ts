import type { PublicBranding } from '@carekit/shared';

export async function getPublicBrandingForSsr(): Promise<PublicBranding> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5100'}/api/v1/public/branding`,
    {
      next: { revalidate: 60, tags: ['branding'] },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch public branding: ${response.status}`);
  }

  return response.json() as Promise<PublicBranding>;
}
