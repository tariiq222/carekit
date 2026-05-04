import { renderHook, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { adminRequest } from '@/lib/api-client';
import { useRefundInvoice } from '@/features/billing/refund-invoice/use-refund-invoice';
import { RefundInvoiceDialog } from '@/features/billing/refund-invoice/refund-invoice-dialog';
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
  id: 'inv-refund-001',
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
  amount: '500.00',
  flatAmount: '500.00',
  overageAmount: '0.00',
  currency: 'SAR',
  status: 'PAID',
  billingCycle: 'MONTHLY',
  periodStart: '2026-05-01T00:00:00Z',
  periodEnd: '2026-05-31T00:00:00Z',
  dueDate: '2026-05-05T00:00:00Z',
  issuedAt: '2026-05-01T00:00:00Z',
  paidAt: '2026-05-02T00:00:00Z',
  refundedAmount: null,
  refundedAt: null,
  voidedReason: null,
  createdAt: '2026-05-01T00:00:00Z',
};

const PARTIAL_REFUNDED_INVOICE: SubscriptionInvoiceRow = {
  ...MOCK_INVOICE,
  refundedAmount: '100.00',
};

function renderDialog(overrides?: Partial<Parameters<typeof RefundInvoiceDialog>[0]>) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = overrides?.onOpenChange ?? vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <RefundInvoiceDialog
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
describe('useRefundInvoice hook', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('posts to /billing/invoices/:id/refund with full refund body (no amount)', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue({ ...MOCK_INVOICE });

    const { result } = renderHook(() => useRefundInvoice('org-1'), { wrapper });
    result.current.mutate({ invoiceId: 'inv-refund-001', reason: 'Full refund requested by client' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/billing/invoices/inv-refund-001/refund', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Full refund requested by client' }),
    });
  });

  it('posts to /billing/invoices/:id/refund with partial refund body (with amount)', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue({ ...MOCK_INVOICE });

    const { result } = renderHook(() => useRefundInvoice('org-1'), { wrapper });
    result.current.mutate({ invoiceId: 'inv-refund-001', amount: 150, reason: 'Partial refund for service issue' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/billing/invoices/inv-refund-001/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 150, reason: 'Partial refund for service issue' }),
    });
  });

  it('calls toast.success("Refund processed via Moyasar.") on success', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue({ ...MOCK_INVOICE });

    const { result } = renderHook(() => useRefundInvoice('org-1'), { wrapper });
    result.current.mutate({ invoiceId: 'inv-1', reason: 'Refund for valid reason here' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Refund processed via Moyasar.');
  });

  it('invalidates org billing, invoices, and metrics queries on success', async () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue({ ...MOCK_INVOICE });

    const { result } = renderHook(() => useRefundInvoice('org-rf'), { wrapper });
    result.current.mutate({ invoiceId: 'inv-1', reason: 'Testing all invalidations here' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['billing', 'org', 'org-rf'] }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['billing', 'invoices'] }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['billing', 'metrics'] }),
    );
  });

  it('calls toast.error with error message on failure', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue(new Error('moyasar_refund_failed'));

    const { result } = renderHook(() => useRefundInvoice('org-err'), { wrapper });
    result.current.mutate({ invoiceId: 'inv-bad', reason: 'Testing error propagation' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('moyasar_refund_failed');
  });

  it('calls toast.error with fallback when error is not an Error instance', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue('raw string');

    const { result } = renderHook(() => useRefundInvoice('org-str'), { wrapper });
    result.current.mutate({ invoiceId: 'inv-bad', reason: 'Testing fallback error here' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Refund failed');
  });
});

// ──────────────────────────────────────────────
// Dialog tests
// ──────────────────────────────────────────────
describe('RefundInvoiceDialog', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('submit button is disabled when reason is empty', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /refund via moyasar/i })).toBeDisabled();
  });

  it('submit button is disabled when reason < 10 chars', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/reason/i), 'too short');
    expect(screen.getByRole('button', { name: /refund via moyasar/i })).toBeDisabled();
  });

  it('submit button is enabled in full mode with valid reason', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/reason/i), 'A valid reason for refund');
    expect(screen.getByRole('button', { name: /refund via moyasar/i })).toBeEnabled();
  });

  it('full mode sends body WITHOUT amount field', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ ...MOCK_INVOICE });
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/reason/i), 'Full refund for service failure');
    await user.click(screen.getByRole('button', { name: /refund via moyasar/i }));

    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith(
        `/billing/invoices/${MOCK_INVOICE.id}/refund`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'Full refund for service failure' }),
        },
      );
    });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('partial mode shows amount input when selected', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/partial/i));
    expect(screen.getByPlaceholderText(/up to/i)).toBeInTheDocument();
  });

  it('partial mode: amount < 0.01 shows error and disables submit', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/partial/i));
    const amountInput = screen.getByPlaceholderText(/up to/i);
    await user.type(amountInput, '0');
    await user.type(screen.getByLabelText(/reason/i), 'A valid reason for partial refund');

    expect(await screen.findByText(/between 0.01/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refund via moyasar/i })).toBeDisabled();
  });

  it('partial mode: amount > remaining shows error and disables submit', async () => {
    renderDialog(); // total=500, no previous refund so remaining=500
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/partial/i));
    const amountInput = screen.getByPlaceholderText(/up to/i);
    await user.type(amountInput, '501');
    await user.type(screen.getByLabelText(/reason/i), 'A valid reason for partial refund');

    expect(await screen.findByText(/between 0.01/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refund via moyasar/i })).toBeDisabled();
  });

  it('partial mode sends body WITH amount field', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ ...MOCK_INVOICE });
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByLabelText(/partial/i));
    const amountInput = screen.getByPlaceholderText(/up to/i);
    await user.type(amountInput, '200');
    await user.type(screen.getByLabelText(/reason/i), 'Partial refund for partial service');
    await user.click(screen.getByRole('button', { name: /refund via moyasar/i }));

    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith(
        `/billing/invoices/${MOCK_INVOICE.id}/refund`,
        {
          method: 'POST',
          body: JSON.stringify({ amount: 200, reason: 'Partial refund for partial service' }),
        },
      );
    });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('shows already-refunded amount correctly for partial-refunded invoice', () => {
    renderDialog({ invoice: PARTIAL_REFUNDED_INVOICE });
    // total=500, refunded=100, remaining=400
    // "Already refunded" row shows 100.00
    expect(screen.getByText(/already refunded/i)).toBeInTheDocument();
    // Multiple elements show 400.00 (summary + label) — just verify at least one exists
    expect(screen.getAllByText(/400.00/i).length).toBeGreaterThan(0);
    // The "Refundable now" section should show 400.00
    expect(screen.getByText(/refundable now/i)).toBeInTheDocument();
  });

  it('does not close dialog on API error', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('moyasar_error'));
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/reason/i), 'A valid reason for this refund');
    await user.click(screen.getByRole('button', { name: /refund via moyasar/i }));

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
