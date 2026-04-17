/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  transpilePackages: ['@carekit/api-client', '@carekit/shared'],
  typedRoutes: false,
};

export default nextConfig;
