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

describe('cancel-scheduled.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls adminRequest with POST and correct URL', async () => {
    const { cancelScheduledCancellation } = await import('@/features/billing/cancel-scheduled/cancel-scheduled.api');
    mockApiRequest.mockResolvedValue({ id: 'sub-1', status: 'ACTIVE' });

    await cancelScheduledCancellation('org-7');

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/billing/subscriptions/org-7/cancel-scheduled', { method: 'POST' });
  });

  it('returns typed SubscriptionRow', async () => {
    const { cancelScheduledCancellation } = await import('@/features/billing/cancel-scheduled/cancel-scheduled.api');
    const mockRow = { id: 'sub-2', status: 'ACTIVE' as const, organizationId: 'org-x' };
    mockApiRequest.mockResolvedValue(mockRow);

    const result = await cancelScheduledCancellation('org-x');

    expect(result.status).toBe('ACTIVE');
  });
});
