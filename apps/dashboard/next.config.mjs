import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === "production"

const nextConfig = {
  transpilePackages: ["@deqah/ui", "@deqah/shared", "@deqah/api-client"],
  skipTrailingSlashRedirect: true,
  // Strip dev-only credentials from production builds regardless of what is set in .env
  env: {
    NEXT_PUBLIC_DEV_EMAIL: isProduction ? "" : (process.env.NEXT_PUBLIC_DEV_EMAIL ?? ""),
    NEXT_PUBLIC_DEV_PASSWORD: isProduction ? "" : (process.env.NEXT_PUBLIC_DEV_PASSWORD ?? ""),
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/_next/image",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ]
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100/api/v1"
    // Strip /api/proxy prefix then forward to backend
    const backendBase = apiUrl.replace(/\/api\/v\d+$/, "")
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${backendBase}/api/v1/:path*`,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: 'webvue',
  project: 'deqah-dashboard',
  url: 'http://100.124.231.44:8000/',
  silent: true,
  disableLogger: true,
  // Source-map upload only runs when SENTRY_AUTH_TOKEN is present
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
