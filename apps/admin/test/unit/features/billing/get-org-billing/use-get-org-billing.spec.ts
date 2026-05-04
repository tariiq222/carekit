import { describe, expect, it, vi } from 'vitest';
import { useGetOrgBilling, orgBillingKey } from '@/features/billing/get-org-billing/use-get-org-billing';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: undefined,
    isLoading: true,
    error: null,
  })),
}));

describe('useGetOrgBilling', () => {
  it('exports correct orgBillingKey function', () => {
    const key = orgBillingKey('org-123');

    expect(key).toEqual(['billing', 'org', 'org-123']);
  });

  it('orgBillingKey uses correct prefix', () => {
    const key = orgBillingKey('my-org');

    expect(key[0]).toBe('billing');
    expect(key[1]).toBe('org');
  });
});
