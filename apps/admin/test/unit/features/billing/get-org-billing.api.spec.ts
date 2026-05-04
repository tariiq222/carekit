import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiRequest = vi.hoisted(() => vi.fn());

vi.mock('@deqah/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deqah/api-client')>();
  return {
    ...actual,
    apiRequest: mockApiRequest,
    ApiError: actual.ApiError,
  };
});

describe('get-org-billing.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls adminRequest with correct URL path', async () => {
    const { getOrgBilling } = await import('@/features/billing/get-org-billing/get-org-billing.api');
    mockApiRequest.mockResolvedValue({ subscription: null, invoices: [] });

    await getOrgBilling('org-42');

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/billing/subscriptions/org-42', {});
  });

  it('uses default GET method', async () => {
    const { getOrgBilling } = await import('@/features/billing/get-org-billing/get-org-billing.api');
    mockApiRequest.mockResolvedValue({ subscription: null, invoices: [] });

    await getOrgBilling('org-1');

    const call = mockApiRequest.mock.calls[0] as [string, RequestInit?];
    expect(call[1]).toEqual({});
  });

  it('returns typed OrgBillingDetail', async () => {
    const { getOrgBilling } = await import('@/features/billing/get-org-billing/get-org-billing.api');
    const mockDetail = { subscription: { id: 'sub-1' }, invoices: [], credits: 0 };
    mockApiRequest.mockResolvedValue(mockDetail);

    const result = await getOrgBilling('org-1');

    expect(result.subscription?.id).toBe('sub-1');
  });
});
