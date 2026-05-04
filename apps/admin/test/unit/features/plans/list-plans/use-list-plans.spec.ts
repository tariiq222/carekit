import { describe, expect, it, vi } from 'vitest';
import { useListPlans, plansListKey } from '@/features/plans/list-plans/use-list-plans';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: undefined,
    isLoading: true,
    error: null,
  })),
}));

describe('useListPlans', () => {
  it('exports correct plansListKey', () => {
    const key = plansListKey;

    expect(key).toEqual(['plans', 'list']);
  });
});
