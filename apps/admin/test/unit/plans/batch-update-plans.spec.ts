import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import { useBatchUpdatePlans } from '@/features/plans/update-plan/use-batch-update-plans';
import { DEFAULT_PLAN_LIMITS } from '@/features/plans/plan-limits';
import type { PlanRow } from '@/features/plans/types';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient, invalidateSpy };
}

function makePlanRow(overrides: Partial<PlanRow> = {}): PlanRow {
  return {
    id: 'plan-001',
    slug: 'basic',
    nameAr: 'أساسي',
    nameEn: 'Basic',
    priceMonthly: '99',
    priceAnnual: '999',
    currency: 'SAR',
    isActive: true,
    isVisible: true,
    sortOrder: 1,
    limits: {},
    createdAt: '2026-01-01T00:00:00Z',
    _count: { subscriptions: 0 },
    ...overrides,
  };
}

const MOCK_PLAN_RESPONSE = makePlanRow();

describe('useBatchUpdatePlans', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('returns batchUpdate function', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchUpdatePlans(), { wrapper });
    expect(typeof result.current.batchUpdate).toBe('function');
  });

  it('calls updatePlan for single item and returns succeeded array', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_PLAN_RESPONSE);

    const { result } = renderHook(() => useBatchUpdatePlans(), { wrapper });
    const plan = makePlanRow();
    const { succeeded, failed } = await result.current.batchUpdate([
      { plan, limits: DEFAULT_PLAN_LIMITS, reason: 'Updating single plan limits' },
    ]);

    expect(succeeded).toEqual(['plan-001']);
    expect(failed).toHaveLength(0);
    expect(adminRequest).toHaveBeenCalledTimes(1);
    expect(adminRequest).toHaveBeenCalledWith('/plans/plan-001', expect.objectContaining({ method: 'PATCH' }));
  });

  it('calls updatePlan for each item in parallel (multiple plans)', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_PLAN_RESPONSE);

    const plan1 = makePlanRow({ id: 'plan-001', slug: 'basic' });
    const plan2 = makePlanRow({ id: 'plan-002', slug: 'pro' });
    const plan3 = makePlanRow({ id: 'plan-003', slug: 'enterprise' });

    const { result } = renderHook(() => useBatchUpdatePlans(), { wrapper });
    const { succeeded, failed } = await result.current.batchUpdate([
      { plan: plan1, limits: DEFAULT_PLAN_LIMITS, reason: 'Batch update three plans reason' },
      { plan: plan2, limits: { ...DEFAULT_PLAN_LIMITS, maxBranches: 5 }, reason: 'Batch update three plans reason' },
      { plan: plan3, limits: { ...DEFAULT_PLAN_LIMITS, maxBranches: -1 }, reason: 'Batch update three plans reason' },
    ]);

    expect(succeeded).toHaveLength(3);
    expect(succeeded).toContain('plan-001');
    expect(succeeded).toContain('plan-002');
    expect(succeeded).toContain('plan-003');
    expect(failed).toHaveLength(0);
    expect(adminRequest).toHaveBeenCalledTimes(3);
  });

  it('reports failed plan when API rejects for one item', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(MOCK_PLAN_RESPONSE)   // plan-001 succeeds
      .mockRejectedValueOnce(new Error('plan_002_error'));  // plan-002 fails

    const plan1 = makePlanRow({ id: 'plan-001' });
    const plan2 = makePlanRow({ id: 'plan-002' });

    const { result } = renderHook(() => useBatchUpdatePlans(), { wrapper });
    const { succeeded, failed } = await result.current.batchUpdate([
      { plan: plan1, limits: DEFAULT_PLAN_LIMITS, reason: 'Partial failure test reason' },
      { plan: plan2, limits: DEFAULT_PLAN_LIMITS, reason: 'Partial failure test reason' },
    ]);

    expect(succeeded).toEqual(['plan-001']);
    expect(failed).toHaveLength(1);
    expect(failed[0].planId).toBe('plan-002');
    expect(failed[0].error).toBe('plan_002_error');
  });

  it('handles non-Error rejection and stores string error', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue('unexpected_string_error');

    const plan = makePlanRow();
    const { result } = renderHook(() => useBatchUpdatePlans(), { wrapper });
    const { succeeded, failed } = await result.current.batchUpdate([
      { plan, limits: DEFAULT_PLAN_LIMITS, reason: 'Non-Error rejection test' },
    ]);

    expect(succeeded).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toBe('unexpected_string_error');
  });

  it('invalidates plans list query after batch', async () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_PLAN_RESPONSE);

    const plan = makePlanRow();
    const { result } = renderHook(() => useBatchUpdatePlans(), { wrapper });
    await result.current.batchUpdate([
      { plan, limits: DEFAULT_PLAN_LIMITS, reason: 'Invalidation check reason' },
    ]);

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['plans', 'list'] }),
    );
  });

  it('still invalidates even when all items fail', async () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue(new Error('all_fail'));

    const plan = makePlanRow();
    const { result } = renderHook(() => useBatchUpdatePlans(), { wrapper });
    await result.current.batchUpdate([
      { plan, limits: DEFAULT_PLAN_LIMITS, reason: 'All fail invalidation test' },
    ]);

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['plans', 'list'] }),
    );
  });

  it('passes trimmed reason in request body', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_PLAN_RESPONSE);

    const plan = makePlanRow();
    const { result } = renderHook(() => useBatchUpdatePlans(), { wrapper });
    await result.current.batchUpdate([
      { plan, limits: DEFAULT_PLAN_LIMITS, reason: '  trimmed reason  ' },
    ]);

    const call = vi.mocked(adminRequest).mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.reason).toBe('trimmed reason');
  });

  it('passes merged limits (plan.limits + edited limits) in body', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_PLAN_RESPONSE);

    const plan = makePlanRow({ limits: { legacyKey: 'old' } });
    const editedLimits = { ...DEFAULT_PLAN_LIMITS, maxBranches: 10 };
    const { result } = renderHook(() => useBatchUpdatePlans(), { wrapper });
    await result.current.batchUpdate([
      { plan, limits: editedLimits, reason: 'Merge limits test reason' },
    ]);

    const call = vi.mocked(adminRequest).mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.limits.maxBranches).toBe(10);
    expect(body.limits.legacyKey).toBe('old');
  });

  it('returns empty succeeded and failed for empty batch', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBatchUpdatePlans(), { wrapper });
    const { succeeded, failed } = await result.current.batchUpdate([]);

    expect(succeeded).toHaveLength(0);
    expect(failed).toHaveLength(0);
    expect(adminRequest).not.toHaveBeenCalled();
  });
});
