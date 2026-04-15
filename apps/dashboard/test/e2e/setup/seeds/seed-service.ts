import { apiPost, apiDelete, uid } from './seed-base';

export interface SeededService {
  id: string;
  nameAr: string;
  price: number;
  durationMins: number;
}

export async function createService(
  overrides: Partial<{
    nameAr: string;
    nameEn: string;
    price: number;
    durationMins: number;
    isActive: boolean;
  }> = {},
): Promise<SeededService> {
  const body = {
    nameAr: overrides.nameAr ?? `خدمة ${uid()}`,
    nameEn: overrides.nameEn ?? `Service ${uid()}`,
    price: overrides.price ?? 100,
    durationMins: overrides.durationMins ?? 30,
    isActive: overrides.isActive ?? true,
  };
  const data = await apiPost<{ id: string }>('/dashboard/organization/services', body);
  return { id: data.id, nameAr: body.nameAr, price: body.price, durationMins: body.durationMins };
}

export async function deleteService(id: string): Promise<void> {
  await apiDelete(`/dashboard/organization/services/${id}`);
}
