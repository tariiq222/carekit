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

describe('list-subscription-invoices.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs URL with page and perPage', async () => {
    const { listSubscriptionInvoices } = await import('@/features/billing/list-subscription-invoices/list-subscription-invoices.api');
    mockApiRequest.mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0 } });

    await listSubscriptionInvoices({ page: 1, perPage: 20 });

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/billing/invoices?page=1&perPage=20', {});
  });

  it('adds optional status, organizationId, fromDate, toDate, includeDrafts filters', async () => {
    const { listSubscriptionInvoices } = await import('@/features/billing/list-subscription-invoices/list-subscription-invoices.api');
    mockApiRequest.mockResolvedValue({ items: [], meta: { page: 2, perPage: 10, total: 0 } });

    await listSubscriptionInvoices({
      page: 2,
      perPage: 10,
      status: 'PAID',
      organizationId: 'org-5',
      fromDate: '2025-01-01',
      toDate: '2025-12-31',
      includeDrafts: true,
    });

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/admin/billing/invoices?page=2&perPage=10&status=PAID&organizationId=org-5&fromDate=2025-01-01&toDate=2025-12-31&includeDrafts=true',
      {},
    );
  });

  it('omits optional filters when not provided', async () => {
    const { listSubscriptionInvoices } = await import('@/features/billing/list-subscription-invoices/list-subscription-invoices.api');
    mockApiRequest.mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0 } });

    await listSubscriptionInvoices({ page: 1, perPage: 20 });

    const call = mockApiRequest.mock.calls[0] as [string, unknown];
    expect(call[0]).not.toContain('status');
    expect(call[0]).not.toContain('includeDrafts');
  });

  it('returns typed ListSubscriptionInvoicesResponse', async () => {
    const { listSubscriptionInvoices } = await import('@/features/billing/list-subscription-invoices/list-subscription-invoices.api');
    const mockRow = { id: 'inv-1', status: 'PAID' as const, amount: 990 };
    const mockResponse = { items: [mockRow], meta: { page: 1, perPage: 20, total: 1 } };
    mockApiRequest.mockResolvedValue(mockResponse);

    const result = await listSubscriptionInvoices({ page: 1, perPage: 20 });

    expect(result.items[0].amount).toBe(990);
  });
});
