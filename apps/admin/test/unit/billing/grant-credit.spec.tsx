import { renderHook, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { adminRequest } from '@/lib/api-client';
import { useGrantCredit } from '@/features/billing/grant-credit/use-grant-credit';
import { GrantCreditDialog } from '@/features/billing/grant-credit/grant-credit-dialog';

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

function renderDialog(props?: Partial<{ open: boolean; onOpenChange: (v: boolean) => void; organizationId: string }>) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = props?.onOpenChange ?? vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <GrantCreditDialog
        open={props?.open ?? true}
        onOpenChange={onOpenChange}
        organizationId={props?.organizationId ?? 'org-gc'}
      />
    </QueryClientProvider>,
  );
  return { onOpenChange, queryClient: qc };
}

// ──────────────────────────────────────────────
// Hook tests
// ──────────────────────────────────────────────
describe('useGrantCredit hook', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('posts to /billing/credits with correct body', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue({ id: 'credit-1' });

    const { result } = renderHook(() => useGrantCredit('org-1'), { wrapper });
    result.current.mutate({ organizationId: 'org-1', amount: 500, currency: 'SAR', reason: 'Goodwill credit for downtime' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/billing/credits', {
      method: 'POST',
      body: JSON.stringify({
        organizationId: 'org-1',
        amount: 500,
        currency: 'SAR',
        reason: 'Goodwill credit for downtime',
      }),
    });
  });

  it('calls toast.success with "Credit granted." on success', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue({ id: 'credit-1' });

    const { result } = renderHook(() => useGrantCredit('org-1'), { wrapper });
    result.current.mutate({ organizationId: 'org-1', amount: 100, currency: 'SAR', reason: 'Testing credit grant' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Credit granted.');
  });

  it('invalidates the org billing query on success', async () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue({ id: 'credit-2' });

    const { result } = renderHook(() => useGrantCredit('org-inv'), { wrapper });
    result.current.mutate({ organizationId: 'org-inv', amount: 50, reason: 'Testing invalidation here' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['billing', 'org', 'org-inv'] }),
    );
  });

  it('calls toast.error with the error message on failure', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue(new Error('insufficient_permissions'));

    const { result } = renderHook(() => useGrantCredit('org-fail'), { wrapper });
    result.current.mutate({ organizationId: 'org-fail', amount: 100, reason: 'Should fail gracefully' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('insufficient_permissions');
  });

  it('calls toast.error with fallback message when error is not an Error instance', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue('string error');

    const { result } = renderHook(() => useGrantCredit('org-str'), { wrapper });
    result.current.mutate({ organizationId: 'org-str', amount: 100, reason: 'Testing fallback error' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Failed to grant credit');
  });
});

// ──────────────────────────────────────────────
// Dialog tests
// ──────────────────────────────────────────────
describe('GrantCreditDialog', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('submit button is disabled when both fields are empty', () => {
    renderDialog();
    const btn = screen.getByRole('button', { name: /grant credit/i });
    expect(btn).toBeDisabled();
  });

  it('submit button is disabled when amount is valid but reason < 10 chars', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/amount/i), '500');
    await user.type(screen.getByLabelText(/reason/i), 'short');
    expect(screen.getByRole('button', { name: /grant credit/i })).toBeDisabled();
  });

  it('submit button is disabled when reason is valid but amount < 1', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/amount/i), '0');
    await user.type(screen.getByLabelText(/reason/i), 'A valid ten char reason');
    expect(screen.getByRole('button', { name: /grant credit/i })).toBeDisabled();
  });

  it('submit button is disabled when amount > 100000', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/amount/i), '100001');
    await user.type(screen.getByLabelText(/reason/i), 'A valid ten char reason');
    expect(screen.getByRole('button', { name: /grant credit/i })).toBeDisabled();
  });

  it('shows amount validation message when amount is out of range', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/amount/i), '0');
    expect(await screen.findByText(/between 1 and 100,000/i)).toBeInTheDocument();
  });

  it('submit button is enabled when amount and reason are both valid', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/amount/i), '500');
    await user.type(screen.getByLabelText(/reason/i), 'A valid ten char reason');
    expect(screen.getByRole('button', { name: /grant credit/i })).toBeEnabled();
  });

  it('calls adminRequest with correct payload on submit', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ id: 'credit-new' });
    const { onOpenChange } = renderDialog({ organizationId: 'org-dialog' });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/amount/i), '1000');
    await user.type(screen.getByLabelText(/reason/i), 'Testing dialog submit path');
    await user.click(screen.getByRole('button', { name: /grant credit/i }));

    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith('/billing/credits', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: 'org-dialog',
          amount: 1000,
          currency: 'SAR',
          reason: 'Testing dialog submit path',
        }),
      });
    });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('does not close dialog on API error', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('server_error'));
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/amount/i), '500');
    await user.type(screen.getByLabelText(/reason/i), 'A valid ten char reason');
    await user.click(screen.getByRole('button', { name: /grant credit/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('Cancel button calls onOpenChange(false)', async () => {
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
