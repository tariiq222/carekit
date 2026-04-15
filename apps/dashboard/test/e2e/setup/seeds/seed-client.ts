/**
 * Client seed factory — moved from setup/seed-client.ts.
 * Old path re-exports from here for backwards compatibility.
 */

import { apiPost, apiDelete, uid, uniqueSaudiPhone } from './seed-base';

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
  const body = {
    firstName: overrides.firstName ?? 'PWClient',
    lastName: overrides.lastName ?? uid(),
    phone: overrides.phone ?? uniqueSaudiPhone(),
    isActive: overrides.isActive ?? true,
  };
  const data = await apiPost<{ id: string }>('/dashboard/people/clients', body);
  return { id: data.id, ...body };
}

export async function deleteClient(id: string): Promise<void> {
  await apiDelete(`/dashboard/people/clients/${id}`);
}
