import { renderHook, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { NextIntlClientProvider } from 'next-intl';
import { adminRequest } from '@/lib/api-client';
import { useSuspendOrganization } from '@/features/organizations/suspend-organization/use-suspend-organization';
import { SuspendDialog } from '@/features/organizations/suspend-organization/suspend-dialog';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const MESSAGES = { organizations: { update: {}, archive: {}, create: {} } };

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient, invalidateSpy };
}

function renderDialog(overrides?: { organizationId?: string }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <NextIntlClientProvider locale="en" messages={MESSAGES}>
      <QueryClientProvider client={qc}>
        <SuspendDialog organizationId={overrides?.organizationId ?? 'org-suspend-1'} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { queryClient: qc };
}

// ─── Hook tests ───────────────────────────────────────────────────────────────

describe('useSuspendOrganization hook', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('POSTs to /organizations/:id/suspend with reason body', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSuspendOrganization('org-1'), { wrapper });
    result.current.mutate('Non-payment past 60-day grace period');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/organizations/org-1/suspend', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Non-payment past 60-day grace period' }),
    });
  });

  it('calls toast.success("Organization suspended.") on success', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSuspendOrganization('org-1'), { wrapper });
    result.current.mutate('Non-payment past 60-day grace period');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Organization suspended.');
  });

  it('invalidates organization detail and list queries on success', async () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSuspendOrganization('org-inv'), { wrapper });
    result.current.mutate('Non-payment past 60-day grace period');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['organizations', 'detail', 'org-inv'] }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['organizations', 'list'] }),
    );
  });

  it('calls toast.error with error message on failure', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue(new Error('suspend_blocked'));

    const { result } = renderHook(() => useSuspendOrganization('org-err'), { wrapper });
    result.current.mutate('Non-payment past 60-day grace period');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('suspend_blocked');
  });

  it('calls toast.error with fallback when error is not an Error instance', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue('string error');

    const { result } = renderHook(() => useSuspendOrganization('org-err'), { wrapper });
    result.current.mutate('Non-payment past 60-day grace period');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Suspend failed');
  });
});

// ─── Dialog tests ─────────────────────────────────────────────────────────────

describe('SuspendDialog', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  async function openDialog() {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /suspend/i }));
    return { user };
  }

  it('opens the dialog when trigger is clicked', async () => {
    await openDialog();
    expect(screen.getByText(/suspend organization/i)).toBeInTheDocument();
  });

  it('confirm button is disabled when reason is empty', async () => {
    await openDialog();
    expect(screen.getByRole('button', { name: /confirm suspend/i })).toBeDisabled();
  });

  it('confirm button is disabled when reason has 9 chars', async () => {
    const { user } = await openDialog();
    await user.type(screen.getByLabelText(/reason/i), '123456789');
    expect(screen.getByRole('button', { name: /confirm suspend/i })).toBeDisabled();
  });

  it('confirm button is enabled when reason has 10+ chars', async () => {
    const { user } = await openDialog();
    await user.type(screen.getByLabelText(/reason/i), '1234567890');
    expect(screen.getByRole('button', { name: /confirm suspend/i })).toBeEnabled();
  });

  it('confirm button is disabled when reason is 10 whitespace chars', async () => {
    const { user } = await openDialog();
    await user.type(screen.getByLabelText(/reason/i), '          ');
    expect(screen.getByRole('button', { name: /confirm suspend/i })).toBeDisabled();
  });

  it('calls adminRequest on confirm click with valid reason', async () => {
    vi.mocked(adminRequest).mockResolvedValue(undefined);
    const { user } = await openDialog();
    await user.type(screen.getByLabelText(/reason/i), 'Non-payment past grace period');
    await user.click(screen.getByRole('button', { name: /confirm suspend/i }));

    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith('/organizations/org-suspend-1/suspend', {
        method: 'POST',
        body: JSON.stringify({ reason: 'Non-payment past grace period' }),
      });
    });
  });

  it('Cancel button closes the dialog', async () => {
    const { user } = await openDialog();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByText(/suspend organization/i)).not.toBeInTheDocument());
  });
});
