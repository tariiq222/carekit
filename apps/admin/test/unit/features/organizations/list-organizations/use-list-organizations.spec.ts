import { describe, expect, it, vi } from 'vitest';
import { useListOrganizations, organizationsListKey } from '@/features/organizations/list-organizations/use-list-organizations';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: undefined,
    isLoading: true,
    error: null,
  })),
}));

describe('useListOrganizations', () => {
  it('exports correct queryKey function', () => {
    const params = { page: 1, perPage: 20 };
    const key = organizationsListKey(params);

    expect(key).toEqual([
      'organizations',
      'list',
      1,
      '',
      '',
      '',
      '',
      '',
    ]);
  });

  it('queryKey includes page and search params', () => {
    const params = { page: 2, perPage: 10, search: 'clinic' };
    const key = organizationsListKey(params);

    expect(key).toContain(2);
    expect(key).toContain('clinic');
  });
});
