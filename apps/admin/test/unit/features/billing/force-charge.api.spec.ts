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

describe('force-charge.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls adminRequest with POST and correct URL', async () => {
    const { forceCharge } = await import('@/features/billing/force-charge/force-charge.api');
    mockApiRequest.mockResolvedValue({ success: true, message: 'charged', result: { ok: true, status: 'captured', attemptNumber: 1 } });

    await forceCharge('org-99');

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/billing/subscriptions/org-99/force-charge', { method: 'POST' });
  });

  it('returns typed ForceChargeResult', async () => {
    const { forceCharge } = await import('@/features/billing/force-charge/force-charge.api');
    const mockResult = { success: true, message: 'Captured', result: { ok: true, status: 'captured', attemptNumber: 2 } };
    mockApiRequest.mockResolvedValue(mockResult);

    const result = await forceCharge('org-1');

    expect(result.success).toBe(true);
    expect(result.result.attemptNumber).toBe(2);
  });
});
