import { describe, expect, it, vi } from 'vitest';
import { useListImpersonationSessions, impersonationSessionsKey } from '@/features/impersonation/list-impersonation-sessions/use-list-impersonation-sessions';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: undefined,
    isLoading: true,
    error: null,
  })),
}));

describe('useListImpersonationSessions', () => {
  it('exports correct impersonationSessionsKey function', () => {
    const params = { page: 1, active: 'true' };
    const key = impersonationSessionsKey(params);

    expect(key).toEqual(['impersonation-sessions', 1, 'true']);
  });

  it('impersonationSessionsKey handles empty active filter', () => {
    const params = { page: 1 };
    const key = impersonationSessionsKey(params);

    expect(key).toContain(1);
    expect(key).toContain('');
  });
});
