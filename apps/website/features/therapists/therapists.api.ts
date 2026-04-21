import type { PublicEmployee } from '@carekit/api-client';

import { getApiBase } from '@/lib/api-base';

export async function listPublicEmployees(): Promise<PublicEmployee[]> {
  const res = await fetch(`${getApiBase()}/public/employees`, {
    next: { revalidate: 60, tags: ['public-employees'] },
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json() as Promise<PublicEmployee[]>;
}

export async function getPublicEmployee(slug: string): Promise<PublicEmployee> {
  const res = await fetch(`${getApiBase()}/public/employees/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60, tags: ['public-employees', `employee-${slug}`] },
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json() as Promise<PublicEmployee>;
}
