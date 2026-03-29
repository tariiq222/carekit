import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware — CareKit Dashboard
 *
 * Auth protection is handled entirely client-side by AuthGate (fetchMe + refresh).
 * The middleware only passes requests through without blocking navigation.
 *
 * NOTE: The refresh_token is an httpOnly cookie set by the backend on a different
 * origin (localhost:3100 in dev), so it is NOT visible to this middleware.
 * Blocking here would break all client-side navigation via router.push().
 *
 * Widget routes (/widget/*) allow iframe embedding on external sites by
 * removing X-Frame-Options and setting permissive frame-ancestors CSP.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  if (pathname.startsWith('/widget')) {
    response.headers.delete('X-Frame-Options');
    response.headers.set(
      'Content-Security-Policy',
      "frame-ancestors *",
    );
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
  ],
};
