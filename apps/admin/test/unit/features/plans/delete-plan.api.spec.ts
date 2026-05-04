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

describe('delete-plan.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls adminRequest with DELETE and correct URL', async () => {
    const { deletePlan } = await import('@/features/plans/delete-plan/delete-plan.api');
    mockApiRequest.mockResolvedValue(undefined);

    await deletePlan({ planId: 'plan-88', reason: 'superseded' });

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/plans/plan-88', {
      method: 'DELETE',
      body: JSON.stringify({ reason: 'superseded' }),
    });
  });

  it('returns void', async () => {
    const { deletePlan } = await import('@/features/plans/delete-plan/delete-plan.api');
    mockApiRequest.mockResolvedValue(undefined);

    const result = await deletePlan({ planId: '1', reason: 'a' });

    expect(result).toBeUndefined();
  });
});
