import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@deqah/ui', '@deqah/api-client', '@deqah/shared'],
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5100/api/v1';
    const backendBase = apiUrl.replace(/\/api\/v\d+$/, '');
    return [
      {
        source: '/api/proxy/:path*',
        destination: `${backendBase}/api/v1/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
