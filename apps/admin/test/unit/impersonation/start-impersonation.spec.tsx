import { renderHook, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { NextIntlClientProvider } from 'next-intl';
import { adminRequest } from '@/lib/api-client';
import { useStartImpersonation } from '@/features/impersonation/start-impersonation/use-start-impersonation';
import { ImpersonateDialog } from '@/features/impersonation/start-impersonation/impersonate-dialog';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const MESSAGES = { organizations: { update: {}, archive: {}, create: {} } };

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

const MOCK_RESPONSE = {
  sessionId: 'session-1',
  shadowAccessToken: 'shadow-jwt-token',
  expiresAt: '2026-05-04T02:00:00Z',
  redirectUrl: 'https://dashboard.deqah.app/impersonate?token=xxx',
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient, invalidateSpy };
}

function renderDialog(overrides?: { organizationId?: string; organizationName?: string }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <NextIntlClientProvider locale="en" messages={MESSAGES}>
      <QueryClientProvider client={qc}>
        <ImpersonateDialog
          organizationId={overrides?.organizationId ?? 'org-imp-1'}
          organizationName={overrides?.organizationName ?? 'Test Clinic'}
        />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { queryClient: qc };
}

// ─── Hook tests ───────────────────────────────────────────────────────────────

describe('useStartImpersonation hook', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('POSTs to /impersonation with correct body', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);

    const { result } = renderHook(() => useStartImpersonation(), { wrapper });
    result.current.mutate({
      organizationId: 'org-1',
      targetUserId: VALID_UUID,
      reason: 'Support ticket #1234 investigation',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/impersonation', {
      method: 'POST',
      body: JSON.stringify({
        organizationId: 'org-1',
        targetUserId: VALID_UUID,
        reason: 'Support ticket #1234 investigation',
      }),
    });
  });

  it('calls toast.success("Impersonation session started.") on success', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);

    const { result } = renderHook(() => useStartImpersonation(), { wrapper });
    result.current.mutate({ organizationId: 'org-1', targetUserId: VALID_UUID, reason: 'Valid reason here' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Impersonation session started.');
  });

  it('invalidates ["impersonation-sessions"] query on success', async () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);

    const { result } = renderHook(() => useStartImpersonation(), { wrapper });
    result.current.mutate({ organizationId: 'org-1', targetUserId: VALID_UUID, reason: 'Valid reason here' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['impersonation-sessions'] }),
    );
  });

  it('calls toast.error with error message on failure', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue(new Error('cannot_impersonate_super_admin'));

    const { result } = renderHook(() => useStartImpersonation(), { wrapper });
    result.current.mutate({ organizationId: 'org-1', targetUserId: VALID_UUID, reason: 'Valid reason here' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('cannot_impersonate_super_admin');
  });

  it('calls toast.error with fallback when error is not an Error instance', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue('string error');

    const { result } = renderHook(() => useStartImpersonation(), { wrapper });
    result.current.mutate({ organizationId: 'org-1', targetUserId: VALID_UUID, reason: 'Valid reason here' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Failed to start impersonation');
  });

  it('returns redirectUrl in success response', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);

    const { result } = renderHook(() => useStartImpersonation(), { wrapper });
    result.current.mutate({ organizationId: 'org-1', targetUserId: VALID_UUID, reason: 'Valid reason here' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.redirectUrl).toBe(MOCK_RESPONSE.redirectUrl);
  });
});

// ─── Dialog tests ─────────────────────────────────────────────────────────────

describe('ImpersonateDialog', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  async function openDialog(overrides?: { organizationId?: string; organizationName?: string }) {
    renderDialog(overrides);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /impersonate user/i }));
    return { user };
  }

  it('opens dialog when trigger is clicked', async () => {
    await openDialog();
    expect(screen.getByText(/impersonate a user in test clinic/i)).toBeInTheDocument();
  });

  it('submit button is disabled when targetUserId is empty', async () => {
    await openDialog();
    expect(screen.getByRole('button', { name: /start session/i })).toBeDisabled();
  });

  it('submit button is disabled when targetUserId is not a valid UUID', async () => {
    const { user } = await openDialog();
    await user.type(screen.getByLabelText(/target user id/i), 'not-a-uuid');
    await user.type(screen.getByLabelText(/reason/i), 'Valid reason for impersonation');
    expect(screen.getByRole('button', { name: /start session/i })).toBeDisabled();
  });

  it('submit button is disabled when reason is fewer than 10 chars', async () => {
    const { user } = await openDialog();
    await user.type(screen.getByLabelText(/target user id/i), VALID_UUID);
    await user.type(screen.getByLabelText(/reason/i), 'too short');
    expect(screen.getByRole('button', { name: /start session/i })).toBeDisabled();
  });

  it('submit button is disabled when reason is 10 whitespace chars', async () => {
    const { user } = await openDialog();
    await user.type(screen.getByLabelText(/target user id/i), VALID_UUID);
    await user.type(screen.getByLabelText(/reason/i), '          ');
    expect(screen.getByRole('button', { name: /start session/i })).toBeDisabled();
  });

  it('submit button is enabled when UUID is valid and reason >= 10 chars', async () => {
    const { user } = await openDialog();
    await user.type(screen.getByLabelText(/target user id/i), VALID_UUID);
    await user.type(screen.getByLabelText(/reason/i), 'Support ticket investigation');
    expect(screen.getByRole('button', { name: /start session/i })).toBeEnabled();
  });

  it('calls adminRequest on submit click', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    // Mock window.location.href assignment
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });

    const { user } = await openDialog({ organizationId: 'org-imp-1' });
    await user.type(screen.getByLabelText(/target user id/i), VALID_UUID);
    await user.type(screen.getByLabelText(/reason/i), 'Support ticket investigation here');
    await user.click(screen.getByRole('button', { name: /start session/i }));

    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith('/impersonation', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: 'org-imp-1',
          targetUserId: VALID_UUID,
          reason: 'Support ticket investigation here',
        }),
      });
    });
  });

  it('Cancel button closes the dialog', async () => {
    const { user } = await openDialog();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() =>
      expect(screen.queryByText(/impersonate a user in/i)).not.toBeInTheDocument(),
    );
  });
});
