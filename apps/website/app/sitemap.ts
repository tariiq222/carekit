import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'https://example.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '',
    '/therapists',
    '/booking',
    '/support-groups',
    '/subscriptions',
    '/contact',
    '/burnout-test',
    '/login',
    '/register',
  ];

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1.0 : route === '/booking' ? 0.9 : 0.7,
  }));
}