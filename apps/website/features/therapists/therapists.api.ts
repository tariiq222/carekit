import type { PublicEmployee } from '@carekit/api-client';

const API_BASE =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:5100';

export async function listPublicEmployees(): Promise<PublicEmployee[]> {
  const res = await fetch(`${API_BASE}/api/v1/public/employees`, {
    next: { revalidate: 60, tags: ['public-employees'] },
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json() as Promise<PublicEmployee[]>;
}

export async function getPublicEmployee(slug: string): Promise<PublicEmployee> {
  const res = await fetch(`${API_BASE}/api/v1/public/employees/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60, tags: ['public-employees', `employee-${slug}`] },
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json() as Promise<PublicEmployee>;
}
