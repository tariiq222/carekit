import { renderHook, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { NextIntlClientProvider } from 'next-intl';
import { adminRequest } from '@/lib/api-client';
import { useReinstateOrganization } from '@/features/organizations/reinstate-organization/use-reinstate-organization';
import { ReinstateDialog } from '@/features/organizations/reinstate-organization/reinstate-dialog';

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
        <ReinstateDialog organizationId={overrides?.organizationId ?? 'org-reinstate-1'} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { queryClient: qc };
}

// ─── Hook tests ───────────────────────────────────────────────────────────────

describe('useReinstateOrganization hook', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('POSTs to /organizations/:id/reinstate with reason body', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(undefined);

    const { result } = renderHook(() => useReinstateOrganization('org-1'), { wrapper });
    result.current.mutate('Payment received — reinstating account');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/organizations/org-1/reinstate', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Payment received — reinstating account' }),
    });
  });

  it('uses fallback reason "Reinstated by super-admin" when reason is empty', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(undefined);

    const { result } = renderHook(() => useReinstateOrganization('org-1'), { wrapper });
    result.current.mutate('');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/organizations/org-1/reinstate', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Reinstated by super-admin' }),
    });
  });

  it('uses fallback reason when reason is whitespace-only', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(undefined);

    const { result } = renderHook(() => useReinstateOrganization('org-1'), { wrapper });
    result.current.mutate('   ');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/organizations/org-1/reinstate', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Reinstated by super-admin' }),
    });
  });

  it('calls toast.success("Organization reinstated.") on success', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(undefined);

    const { result } = renderHook(() => useReinstateOrganization('org-1'), { wrapper });
    result.current.mutate('Payment received');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Organization reinstated.');
  });

  it('invalidates organization detail and list queries on success', async () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(undefined);

    const { result } = renderHook(() => useReinstateOrganization('org-inv'), { wrapper });
    result.current.mutate('Payment received');

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
    vi.mocked(adminRequest).mockRejectedValue(new Error('reinstate_error'));

    const { result } = renderHook(() => useReinstateOrganization('org-err'), { wrapper });
    result.current.mutate('Payment received');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('reinstate_error');
  });

  it('calls toast.error with fallback when error is not an Error instance', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue('string error');

    const { result } = renderHook(() => useReinstateOrganization('org-err'), { wrapper });
    result.current.mutate('Payment received');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Reinstate failed');
  });
});

// ─── Dialog tests ─────────────────────────────────────────────────────────────

describe('ReinstateDialog', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  async function openDialog() {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /reinstate/i }));
    return { user };
  }

  it('opens the dialog when trigger is clicked', async () => {
    await openDialog();
    expect(screen.getByText(/reinstate organization/i)).toBeInTheDocument();
  });

  it('confirm button is enabled even with empty reason (reason is optional)', async () => {
    await openDialog();
    expect(screen.getByRole('button', { name: /confirm reinstate/i })).toBeEnabled();
  });

  it('confirm button calls adminRequest on click', async () => {
    vi.mocked(adminRequest).mockResolvedValue(undefined);
    const { user } = await openDialog();
    await user.type(screen.getByRole('textbox'), 'Payment received for account');
    await user.click(screen.getByRole('button', { name: /confirm reinstate/i }));

    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith('/organizations/org-reinstate-1/reinstate', {
        method: 'POST',
        body: expect.any(String),
      });
    });
  });

  it('closes dialog on success', async () => {
    vi.mocked(adminRequest).mockResolvedValue(undefined);
    const { user } = await openDialog();
    await user.click(screen.getByRole('button', { name: /confirm reinstate/i }));

    await waitFor(() =>
      expect(screen.queryByText(/reinstate organization/i)).not.toBeInTheDocument(),
    );
  });

  it('Cancel button closes the dialog', async () => {
    const { user } = await openDialog();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() =>
      expect(screen.queryByText(/reinstate organization/i)).not.toBeInTheDocument(),
    );
  });
});
