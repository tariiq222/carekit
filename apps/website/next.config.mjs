/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  transpilePackages: ['@deqah/api-client', '@deqah/shared'],
  typedRoutes: false,
};

export default nextConfig;
