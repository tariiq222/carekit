/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === "production"

const nextConfig = {
  // Strip dev-only credentials from production builds regardless of what is set in .env
  env: {
    NEXT_PUBLIC_DEV_EMAIL: isProduction ? "" : (process.env.NEXT_PUBLIC_DEV_EMAIL ?? ""),
    NEXT_PUBLIC_DEV_PASSWORD: isProduction ? "" : (process.env.NEXT_PUBLIC_DEV_PASSWORD ?? ""),
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

export default nextConfig
