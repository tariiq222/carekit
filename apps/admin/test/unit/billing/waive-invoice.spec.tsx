import { renderHook, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { adminRequest } from '@/lib/api-client';
import { useWaiveInvoice } from '@/features/billing/waive-invoice/use-waive-invoice';
import { WaiveInvoiceDialog } from '@/features/billing/waive-invoice/waive-invoice-dialog';
import type { SubscriptionInvoiceRow } from '@/features/billing/types';

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

const MOCK_INVOICE: SubscriptionInvoiceRow = {
  id: 'inv-abc123def456',
  subscriptionId: 'sub-1',
  organizationId: 'org-1',
  organization: {
    id: 'org-1',
    slug: 'test-clinic',
    nameAr: 'عيادة',
    nameEn: null,
    status: 'ACTIVE',
    suspendedAt: null,
  },
  amount: '299.00',
  flatAmount: '299.00',
  overageAmount: '0.00',
  currency: 'SAR',
  status: 'DUE',
  billingCycle: 'MONTHLY',
  periodStart: '2026-05-01T00:00:00Z',
  periodEnd: '2026-05-31T00:00:00Z',
  dueDate: '2026-05-05T00:00:00Z',
  issuedAt: '2026-05-01T00:00:00Z',
  paidAt: null,
  refundedAmount: null,
  refundedAt: null,
  voidedReason: null,
  createdAt: '2026-05-01T00:00:00Z',
};

function renderDialog(overrides?: Partial<Parameters<typeof WaiveInvoiceDialog>[0]>) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = overrides?.onOpenChange ?? vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <WaiveInvoiceDialog
        open={overrides?.open ?? true}
        onOpenChange={onOpenChange}
        invoice={overrides?.invoice ?? MOCK_INVOICE}
        orgId={overrides?.orgId ?? 'org-1'}
      />
    </QueryClientProvider>,
  );
  return { onOpenChange, queryClient: qc };
}

// ──────────────────────────────────────────────
// Hook tests
// ──────────────────────────────────────────────
describe('useWaiveInvoice hook', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('posts to /billing/invoices/:id/waive with correct body', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue({ ...MOCK_INVOICE, status: 'VOID' });

    const { result } = renderHook(() => useWaiveInvoice('org-1'), { wrapper });
    result.current.mutate({ invoiceId: 'inv-abc', reason: 'Waiving for goodwill reasons here' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/billing/invoices/inv-abc/waive', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Waiving for goodwill reasons here' }),
    });
  });

  it('calls toast.success("Invoice waived.") on success', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue({ ...MOCK_INVOICE, status: 'VOID' });

    const { result } = renderHook(() => useWaiveInvoice('org-1'), { wrapper });
    result.current.mutate({ invoiceId: 'inv-abc', reason: 'Ten char reason here' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Invoice waived.');
  });

  it('invalidates org billing, invoices and metrics queries on success', async () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue({ ...MOCK_INVOICE, status: 'VOID' });

    const { result } = renderHook(() => useWaiveInvoice('org-wv'), { wrapper });
    result.current.mutate({ invoiceId: 'inv-abc', reason: 'A valid reason for waiving' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['billing', 'org', 'org-wv'] }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['billing', 'invoices'] }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['billing', 'metrics'] }),
    );
  });

  it('calls toast.error with the error message on failure', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue(new Error('invoice_not_waivable'));

    const { result } = renderHook(() => useWaiveInvoice('org-err'), { wrapper });
    result.current.mutate({ invoiceId: 'inv-bad', reason: 'Some reason here' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('invoice_not_waivable');
  });

  it('calls toast.error with fallback when error is not an Error instance', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue('raw string');

    const { result } = renderHook(() => useWaiveInvoice('org-str'), { wrapper });
    result.current.mutate({ invoiceId: 'inv-bad', reason: 'Some valid reason here' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Failed to waive invoice');
  });
});

// ──────────────────────────────────────────────
// Dialog tests
// ──────────────────────────────────────────────
describe('WaiveInvoiceDialog', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('submit button is disabled when reason is empty', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /waive invoice/i })).toBeDisabled();
  });

  it('submit button is disabled when reason < 10 chars', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/reason/i), 'short');
    expect(screen.getByRole('button', { name: /waive invoice/i })).toBeDisabled();
  });

  it('submit button is enabled when reason >= 10 chars', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/reason/i), 'Ten chars reason valid');
    expect(screen.getByRole('button', { name: /waive invoice/i })).toBeEnabled();
  });

  it('calls adminRequest with correct body on submit', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ ...MOCK_INVOICE, status: 'VOID' });
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/reason/i), 'Waiving for client goodwill');
    await user.click(screen.getByRole('button', { name: /waive invoice/i }));

    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith(
        `/billing/invoices/${MOCK_INVOICE.id}/waive`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'Waiving for client goodwill' }),
        },
      );
    });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('does not close dialog on API error', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('forbidden'));
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/reason/i), 'A valid waiving reason');
    await user.click(screen.getByRole('button', { name: /waive invoice/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('Cancel button calls onOpenChange(false)', async () => {
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows invoice id in the dialog description', () => {
    renderDialog();
    // The dialog shows slice of invoice id
    expect(screen.getByText(/inv-abc/i)).toBeInTheDocument();
  });
});
