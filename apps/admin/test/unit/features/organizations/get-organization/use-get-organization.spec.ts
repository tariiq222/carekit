import { describe, expect, it, vi } from 'vitest';
import { useGetOrganization, organizationDetailKey } from '@/features/organizations/get-organization/use-get-organization';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: undefined,
    isLoading: true,
    error: null,
  })),
}));

describe('useGetOrganization', () => {
  it('exports correct organizationDetailKey', () => {
    const key = organizationDetailKey('org-123');

    expect(key).toEqual(['organizations', 'detail', 'org-123']);
  });
});
