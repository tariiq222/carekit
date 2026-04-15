/**
 * Seed helpers — create/delete clients via backend API before/after tests.
 *
 * Used by Playwright specs that need pre-existing clients in the dashboard
 * (e.g. toggle active, delete dialog, status badge scenarios).
 */

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:5100/api/v1';
const TENANT_ID =
  process.env['NEXT_PUBLIC_TENANT_ID'] ?? 'b46accb4-dd8a-4f34-a2fd-1bac26119e1c';
const ADMIN_EMAIL = process.env['TEST_ADMIN_EMAIL'] ?? 'admin@carekit-test.com';
const ADMIN_PASSWORD = process.env['TEST_ADMIN_PASSWORD'] ?? 'Admin@1234';

let cachedToken: string | null = null;

async function getAdminToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': TENANT_ID,
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = (await res.json()) as { accessToken: string };
  cachedToken = data.accessToken;
  return cachedToken;
}

function uniqueSaudiPhone(): string {
  const rand = Math.floor(Math.random() * 99999999)
    .toString()
    .padStart(8, '0');
  return `+9665${rand}`;
}

export interface SeededClient {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  isActive: boolean;
}

export async function createClient(
  overrides: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    isActive: boolean;
  }> = {},
): Promise<SeededClient> {
  const token = await getAdminToken();
  const body = {
    firstName: overrides.firstName ?? 'PWTest',
    lastName: overrides.lastName ?? `User${Date.now().toString().slice(-4)}`,
    phone: overrides.phone ?? uniqueSaudiPhone(),
    isActive: overrides.isActive ?? true,
  };
  const res = await fetch(`${API_URL}/dashboard/people/clients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': TENANT_ID,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`createClient failed: ${res.status} — ${txt}`);
  }
  const data = (await res.json()) as { id: string };
  return { id: data.id, ...body };
}

export async function deleteClient(id: string): Promise<void> {
  const token = await getAdminToken();
  await fetch(`${API_URL}/dashboard/people/clients/${id}`, {
    method: 'DELETE',
    headers: {
      'X-Tenant-ID': TENANT_ID,
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => {
    // swallow — cleanup is best-effort
  });
}
