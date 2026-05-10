import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware — Deqah Dashboard
 *
 * Auth protection is handled entirely client-side by AuthGate (fetchMe + refresh).
 * The middleware only passes requests through without blocking navigation.
 *
 * NOTE: The refresh_token is an httpOnly cookie set by the backend on a different
 * origin (localhost:3100 in dev), so it is NOT visible to this middleware.
 * Blocking here would break all client-side navigation via router.push().
 *
 * For /api/proxy/* requests, the original Host header is forwarded via
 * x-forwarded-host so that the backend SubdomainResolverService can resolve
 * the tenant from the subdomain.
 */
export function middleware(req: NextRequest): NextResponse {
  const host = req.headers.get('host');
  if (host) {
    const headers = new Headers(req.headers);
    // Forward original host so backend SubdomainResolverService can read it
    if (!headers.has('x-forwarded-host')) headers.set('x-forwarded-host', host);
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
    '/api/proxy/:path*',
  ],
};
