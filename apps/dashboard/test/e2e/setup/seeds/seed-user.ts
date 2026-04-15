import { apiPost, apiDelete, apiPatch, uid, uniqueSaudiPhone } from './seed-base';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'RECEPTIONIST'
  | 'ACCOUNTANT'
  | 'EMPLOYEE'
  | 'CLIENT';

export interface SeededUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export async function createUser(
  overrides: Partial<{
    email: string;
    password: string;
    name: string;
    role: UserRole;
    phone: string;
  }> = {},
): Promise<SeededUser> {
  const suffix = uid();
  const role: UserRole = overrides.role ?? 'RECEPTIONIST';
  const body = {
    email: overrides.email ?? `pwtest.${suffix.toLowerCase()}@carekit-test.com`,
    password: overrides.password ?? 'Test@12345',
    name: overrides.name ?? `PWUser ${suffix}`,
    role,
    phone: overrides.phone ?? uniqueSaudiPhone(),
  };
  const data = await apiPost<{ id: string }>('/dashboard/identity/users', body);
  return { id: data.id, email: body.email, name: body.name, role: body.role };
}

export async function deleteUser(id: string): Promise<void> {
  await apiDelete(`/dashboard/identity/users/${id}`);
}

export async function deactivateUser(id: string): Promise<void> {
  await apiPatch(`/dashboard/identity/users/${id}/deactivate`, {});
}

export async function activateUser(id: string): Promise<void> {
  await apiPatch(`/dashboard/identity/users/${id}/activate`, {});
}
