import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware — Deqah Dashboard
 *
 * The dashboard runs on a single unified domain (e.g. app.deqah.net).
 * Tenant resolution happens entirely from the JWT after login — no subdomain
 * logic is needed here.
 *
 * This middleware only handles one concern:
 *   /api/proxy/* — reverse-proxied to the backend so that custom headers
 *   survive the Next.js layer (next.config.mjs rewrites do NOT forward
 *   headers mutated in middleware to external destinations).
 *
 * All other paths pass through without mutation.
 */

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5100/api/v1';

  // --------------------------------------------------------------------------
  // Proxy /api/proxy/* directly to the backend so that custom headers survive.
  // --------------------------------------------------------------------------
  if (req.nextUrl.pathname.startsWith('/api/proxy/')) {
    const path = req.nextUrl.pathname.replace('/api/proxy', '');
    const search = req.nextUrl.search;
    const destination = `${apiBase}${path}${search}`;

    const proxyHeaders = new Headers(req.headers);
    // Let fetch manage hop-by-hop headers; preserve the rest.
    proxyHeaders.delete('content-length');
    proxyHeaders.delete('host');

    const init: RequestInit = {
      method: req.method,
      headers: proxyHeaders,
      body: req.body,
      // @ts-expect-error — duplex required for streaming body proxy in Node 18+
      duplex: 'half',
    };

    try {
      const proxyRes = await fetch(destination, init);
      return new Response(proxyRes.body, {
        status: proxyRes.status,
        statusText: proxyRes.statusText,
        headers: proxyRes.headers,
      }) as unknown as NextResponse;
    } catch (err) {
      console.error(
        `[middleware] proxy fetch failed for ${destination}: ${String(err)}`,
      );
      return new Response(
        JSON.stringify({ error: 'proxy_error', message: 'Backend unreachable' }),
        { status: 502, headers: { 'content-type': 'application/json' } },
      ) as unknown as NextResponse;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
    '/api/proxy/:path*',
  ],
};
