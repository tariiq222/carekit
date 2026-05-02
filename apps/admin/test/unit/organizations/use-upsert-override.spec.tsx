import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useUpsertOverride } from '@/features/organizations/entitlements/use-upsert-override';

vi.mock('@/features/organizations/entitlements/upsert-override.api', () => ({
  upsertOverride: vi.fn().mockResolvedValue({ success: true }),
}));

describe('useUpsertOverride', () => {
  let qc: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('invalidates entitlements + feature-flags queries on success', async () => {
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpsertOverride(), { wrapper });

    result.current.mutate({
      organizationId: 'org-1',
      key: 'coupons' as never,
      mode: 'FORCE_ON',
      reason: 'Pilot customer',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'org', 'org-1', 'entitlements'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'org', 'org-1', 'feature-flags'] });
  });
});
