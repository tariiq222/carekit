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
 */
export function middleware(_request: NextRequest): NextResponse {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
  ],
};
