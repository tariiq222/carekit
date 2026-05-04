import { renderHook, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { NextIntlClientProvider } from 'next-intl';
import { adminRequest } from '@/lib/api-client';
import { useListImpersonationSessions } from '@/features/impersonation/list-impersonation-sessions/use-list-impersonation-sessions';
import { SessionsTable } from '@/features/impersonation/list-impersonation-sessions/sessions-table';
import type { ImpersonationSession } from '@/features/impersonation/types';
import type { ListImpersonationSessionsParams } from '@/features/impersonation/list-impersonation-sessions/list-impersonation-sessions.api';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const MESSAGES = { organizations: { update: {}, archive: {}, create: {} } };

const MOCK_RESPONSE = {
  items: [],
  meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
};

const ACTIVE_SESSION: ImpersonationSession = {
  id: 'sess-active-1',
  superAdminUserId: 'admin-user-1',
  targetUserId: 'target-user-1',
  organizationId: 'org-1',
  reason: 'Support ticket investigation',
  startedAt: new Date(Date.now() - 60_000).toISOString(), // 1 min ago
  endedAt: null,
  expiresAt: new Date(Date.now() + 900_000).toISOString(), // 15 min from now
  endedReason: null,
};

const ENDED_SESSION: ImpersonationSession = {
  id: 'sess-ended-1',
  superAdminUserId: 'admin-user-2',
  targetUserId: 'target-user-2',
  organizationId: 'org-2',
  reason: 'Billing dispute review',
  startedAt: new Date(Date.now() - 7200_000).toISOString(), // 2 hours ago
  endedAt: new Date(Date.now() - 3600_000).toISOString(), // 1 hour ago
  expiresAt: new Date(Date.now() - 3600_000).toISOString(),
  endedReason: 'manual',
};

const EXPIRED_SESSION: ImpersonationSession = {
  id: 'sess-expired-1',
  superAdminUserId: 'admin-user-3',
  targetUserId: 'target-user-3',
  organizationId: 'org-3',
  reason: 'Expired session test',
  startedAt: new Date(Date.now() - 3600_000).toISOString(), // 1 hour ago
  endedAt: null,
  expiresAt: new Date(Date.now() - 1800_000).toISOString(), // expired 30 min ago
  endedReason: null,
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

function renderTable(
  items: ImpersonationSession[] | undefined,
  isLoading = false,
) {
  render(
    <NextIntlClientProvider locale="en" messages={MESSAGES}>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        <SessionsTable items={items} isLoading={isLoading} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

// ─── Hook tests ───────────────────────────────────────────────────────────────

describe('useListImpersonationSessions', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('fetches with page and perPage params', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const params: ListImpersonationSessionsParams = { page: 1, perPage: 20 };
    const { result } = renderHook(() => useListImpersonationSessions(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRequest).toHaveBeenCalledWith(
      '/impersonation/sessions?page=1&perPage=20',
    );
  });

  it('includes active=true param when provided', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => useListImpersonationSessions({ page: 1, perPage: 10, active: 'true' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRequest).toHaveBeenCalledWith(
      expect.stringContaining('active=true'),
    );
  });

  it('includes active=false param when provided', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => useListImpersonationSessions({ page: 1, perPage: 10, active: 'false' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRequest).toHaveBeenCalledWith(
      expect.stringContaining('active=false'),
    );
  });

  it('omits active param when not provided', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => useListImpersonationSessions({ page: 1, perPage: 10 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRequest).not.toHaveBeenCalledWith(
      expect.stringContaining('active='),
    );
  });

  it('uses correct queryKey structure', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper, queryClient } = makeWrapper();

    const { result } = renderHook(
      () => useListImpersonationSessions({ page: 2, perPage: 10, active: 'true' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cache = queryClient.getQueryCache();
    const query = cache.find({
      queryKey: ['impersonation-sessions', 2, 'true'],
    });
    expect(query).toBeDefined();
  });

  it('returns items and meta on success', async () => {
    const response = {
      items: [ACTIVE_SESSION],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    };
    vi.mocked(adminRequest).mockResolvedValue(response);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => useListImpersonationSessions({ page: 1, perPage: 20 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.meta.total).toBe(1);
  });
});

// ─── SessionsTable tests ──────────────────────────────────────────────────────

describe('SessionsTable', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('renders skeleton rows while loading', () => {
    renderTable(undefined, true);
    const skeletons = document.querySelectorAll('[class*="h-6"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state message when items is empty array', () => {
    renderTable([]);
    expect(screen.getByText(/no impersonation sessions match/i)).toBeInTheDocument();
  });

  it('renders active session with Active badge (success class)', () => {
    renderTable([ACTIVE_SESSION]);
    const badge = screen.getByText('Active');
    expect(badge.className).toContain('text-success');
  });

  it('renders active session with End now button', () => {
    renderTable([ACTIVE_SESSION]);
    expect(screen.getByRole('button', { name: /end now/i })).toBeInTheDocument();
  });

  it('renders ended session with Ended badge (no End button)', () => {
    renderTable([ENDED_SESSION]);
    expect(screen.getByText(/ended/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /end now/i })).not.toBeInTheDocument();
  });

  it('renders expired session with Expired badge (warning class)', () => {
    renderTable([EXPIRED_SESSION]);
    const badge = screen.getByText('Expired');
    expect(badge.className).toContain('text-warning');
  });

  it('renders expired session with no End button', () => {
    renderTable([EXPIRED_SESSION]);
    expect(screen.queryByRole('button', { name: /end now/i })).not.toBeInTheDocument();
  });

  it('shows superAdminUserId and targetUserId in table cells', () => {
    renderTable([ACTIVE_SESSION]);
    expect(screen.getByText('admin-user-1')).toBeInTheDocument();
    expect(screen.getByText('target-user-1')).toBeInTheDocument();
  });

  it('shows organizationId in table', () => {
    renderTable([ACTIVE_SESSION]);
    expect(screen.getByText('org-1')).toBeInTheDocument();
  });

  it('calls endImpersonation when End now is clicked for active session', async () => {
    vi.mocked(adminRequest).mockResolvedValue(undefined);
    renderTable([ACTIVE_SESSION]);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /end now/i }));

    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith(
        `/impersonation/${ACTIVE_SESSION.id}/end`,
        { method: 'POST' },
      );
    });
  });

  it('renders multiple sessions correctly', () => {
    renderTable([ACTIVE_SESSION, ENDED_SESSION, EXPIRED_SESSION]);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText(/ended/i)).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });
});
