/**
 * Shared auth + fetch helpers for all seed factories.
 * Import from this file only within seeds/ — do not expose outside.
 */

export const API_URL =
  process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:5100/api/v1';
export const TENANT_ID =
  process.env['NEXT_PUBLIC_TENANT_ID'] ?? 'b46accb4-dd8a-4f34-a2fd-1bac26119e1c';
export const ADMIN_EMAIL =
  process.env['TEST_ADMIN_EMAIL'] ?? 'admin@carekit-test.com';
export const ADMIN_PASSWORD =
  process.env['TEST_ADMIN_PASSWORD'] ?? 'Admin@1234';

let cachedToken: string | null = null;
let cachedAt = 0;
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10m — أقل من expiry الـ JWT (15m)

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function getAdminToken(): Promise<string> {
  const fresh = cachedToken && Date.now() - cachedAt < TOKEN_TTL_MS;
  if (fresh && cachedToken) return cachedToken;

  // retry مع backoff لتجنب rate limit (429)
  let lastStatus = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    if (res.ok) {
      const data = (await res.json()) as { accessToken: string };
      cachedToken = data.accessToken;
      cachedAt = Date.now();
      return cachedToken;
    }
    lastStatus = res.status;
    if (res.status === 429) {
      await sleep(2000 * (attempt + 1)); // 2s, 4s, 6s, 8s, 10s
      continue;
    }
    break;
  }
  throw new Error(`Seed login failed: ${lastStatus}`);
}

/** Reset cached token (call if 401 is received) */
export function resetToken(): void {
  cachedToken = null;
}

export function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Tenant-ID': TENANT_ID,
    Authorization: `Bearer ${token}`,
  };
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getAdminToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`POST ${path} failed: ${res.status} — ${txt}`);
  }
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const token = await getAdminToken();
  await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  }).catch(() => {
    // cleanup is best-effort
  });
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const token = await getAdminToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PATCH ${path} failed: ${res.status} — ${txt}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Unique suffix based on timestamp + random to avoid collisions */
export function uid(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

export function uniqueSaudiPhone(): string {
  const rand = Math.floor(Math.random() * 99999999)
    .toString()
    .padStart(8, '0');
  return `+9665${rand}`;
}
