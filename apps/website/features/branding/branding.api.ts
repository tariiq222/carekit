import type { PublicBranding } from '@carekit/shared';

export async function getPublicBrandingForSsr(): Promise<PublicBranding> {
  const base =
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:5100';
  const response = await fetch(
    `${base}/api/v1/public/branding`,
    {
      next: { revalidate: 60, tags: ['branding'] },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch public branding: ${response.status}`);
  }

  return response.json() as Promise<PublicBranding>;
}
