import { apiPost, apiDelete, uid } from './seed-base';

export interface SeededCoupon {
  id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
}

export async function createCoupon(
  overrides: Partial<{
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    isActive: boolean;
    maxUses: number;
  }> = {},
): Promise<SeededCoupon> {
  const body = {
    code: overrides.code ?? `PW${uid()}`,
    discountType: overrides.discountType ?? 'PERCENTAGE',
    discountValue: overrides.discountValue ?? 10,
    isActive: overrides.isActive ?? true,
    ...(overrides.maxUses !== undefined && { maxUses: overrides.maxUses }),
  };
  const data = await apiPost<{ id: string }>('/dashboard/finance/coupons', body);
  return {
    id: data.id,
    code: body.code,
    discountType: body.discountType,
    discountValue: body.discountValue,
  };
}

export async function deleteCoupon(id: string): Promise<void> {
  await apiDelete(`/dashboard/finance/coupons/${id}`);
}
