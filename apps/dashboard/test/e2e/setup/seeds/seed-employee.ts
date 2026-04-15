import { apiPost, apiDelete, uid, uniqueSaudiPhone } from './seed-base';

export interface SeededEmployee {
  id: string;
  name: string;
  phone: string;
}

export async function createEmployee(
  overrides: Partial<{
    name: string;
    phone: string;
    email: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
  }> = {},
): Promise<SeededEmployee> {
  const body = {
    name: overrides.name ?? `PWEmp ${uid()}`,
    phone: overrides.phone ?? uniqueSaudiPhone(),
    ...(overrides.email && { email: overrides.email }),
    ...(overrides.gender && { gender: overrides.gender }),
  };
  const data = await apiPost<{ id: string }>('/dashboard/people/employees', body);
  return { id: data.id, name: body.name, phone: body.phone };
}

export async function deleteEmployee(id: string): Promise<void> {
  await apiDelete(`/dashboard/people/employees/${id}`);
}
