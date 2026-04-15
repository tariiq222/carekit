import { apiPost, apiDelete, uid } from './seed-base';

export interface SeededBranch {
  id: string;
  nameAr: string;
}

export async function createBranch(
  overrides: Partial<{
    nameAr: string;
    nameEn: string;
    city: string;
  }> = {},
): Promise<SeededBranch> {
  const body = {
    nameAr: overrides.nameAr ?? `فرع ${uid()}`,
    nameEn: overrides.nameEn ?? `Branch ${uid()}`,
    city: overrides.city ?? 'الرياض',
  };
  const data = await apiPost<{ id: string }>('/dashboard/organization/branches', body);
  return { id: data.id, nameAr: body.nameAr };
}

export async function deleteBranch(id: string): Promise<void> {
  await apiDelete(`/dashboard/organization/branches/${id}`);
}
