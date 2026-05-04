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

describe('list-subscriptions.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs URL with page and perPage', async () => {
    const { listSubscriptions } = await import('@/features/billing/list-subscriptions/list-subscriptions.api');
    mockApiRequest.mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0 } });

    await listSubscriptions({ page: 1, perPage: 20 });

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/billing/subscriptions?page=1&perPage=20', {});
  });

  it('adds optional status and planId filters', async () => {
    const { listSubscriptions } = await import('@/features/billing/list-subscriptions/list-subscriptions.api');
    mockApiRequest.mockResolvedValue({ items: [], meta: { page: 2, perPage: 10, total: 0 } });

    await listSubscriptions({ page: 2, perPage: 10, status: 'ACTIVE', planId: 'plan-pro' });

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/billing/subscriptions?page=2&perPage=10&status=ACTIVE&planId=plan-pro', {});
  });

  it('returns typed ListSubscriptionsResponse', async () => {
    const { listSubscriptions } = await import('@/features/billing/list-subscriptions/list-subscriptions.api');
    const mockRow = { id: 'sub-1', status: 'ACTIVE' as const, organizationId: 'org-1' };
    const mockResponse = { items: [mockRow], meta: { page: 1, perPage: 20, total: 1 } };
    mockApiRequest.mockResolvedValue(mockResponse);

    const result = await listSubscriptions({ page: 1, perPage: 20 });

    expect(result.items[0].status).toBe('ACTIVE');
  });
});
