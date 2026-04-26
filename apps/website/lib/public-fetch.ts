import { getApiBase } from './api-base';

export class PublicFetchError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`PublicFetchError: ${status}`);
    this.name = 'PublicFetchError';
  }
}

/**
 * Utility for public website fetches:
 * 1. Prefixes the request with the API base (`/api/v1`).
 * 2. Resolves the active organization from `NEXT_PUBLIC_DEFAULT_ORG_ID`
 *    (single-tenant deployments) or an optional host→org map encoded in
 *    `NEXT_PUBLIC_HOST_ORG_MAP` JSON ({"host": "orgId"}).
 * 3. Injects the resolved orgId into the `X-Org-Id` header so the
 *    backend tenant resolver middleware can scope the public request.
 * 4. Throws `PublicFetchError(status, body)` on non-2xx so the caller
 *    surfaces the failure instead of swallowing it.
 *
 * Multi-tenant website hosting via a richer host map remains a P1
 * follow-up — `NEXT_PUBLIC_DEFAULT_ORG_ID` is the canonical single-tenant
 * override.
 */
export async function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();

  let orgId: string | undefined = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;

  const hostMapStr = process.env.NEXT_PUBLIC_HOST_ORG_MAP;
  if (hostMapStr && typeof window !== 'undefined') {
    try {
      const map = JSON.parse(hostMapStr) as Record<string, string>;
      const host = window.location.host;
      if (map[host]) {
        orgId = map[host];
      }
    } catch (e) {
      console.error('Failed to parse NEXT_PUBLIC_HOST_ORG_MAP', e);
    }
  }

  const headers = new Headers(init?.headers);
  if (orgId) headers.set('X-Org-Id', orgId);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const response = await fetch(url, { ...init, headers });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => ({}));
    throw new PublicFetchError(response.status, body);
  }

  return response.json() as Promise<T>;
}
