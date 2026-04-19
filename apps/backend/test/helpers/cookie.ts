import type { Response } from 'supertest';

export type SetCookieHeader = string[];

/**
 * Extract all Set-Cookie header values from a supertest Response.
 * supertest exposes the header as a string[] when multiple cookies are set.
 */
export function parseSetCookie(res: Response): SetCookieHeader {
  const raw = res.headers['set-cookie'];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  return [raw as string];
}

/**
 * Find one named cookie's full Set-Cookie string from the response.
 * Returns undefined if the cookie is not present.
 */
export function extractCookie(res: Response, name: string): string | undefined {
  return parseSetCookie(res).find((c) => c.startsWith(`${name}=`));
}

/**
 * Return true if the cookie directive string contains a given flag (case-insensitive).
 */
export function hasCookieFlag(cookieStr: string, flag: string): boolean {
  return cookieStr.toLowerCase().includes(flag.toLowerCase());
}

/**
 * Extract the raw value of a cookie from a Set-Cookie string.
 * e.g. "client_access_token=abc123; HttpOnly; Path=/" → "abc123"
 */
export function getCookieValue(cookieStr: string): string {
  const valueSection = cookieStr.split(';')[0] ?? '';
  const eqIdx = valueSection.indexOf('=');
  return eqIdx >= 0 ? valueSection.slice(eqIdx + 1) : '';
}
