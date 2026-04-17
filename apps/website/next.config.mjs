/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@carekit/api-client', '@carekit/shared'],
  typedRoutes: false,
};

export default nextConfig;
