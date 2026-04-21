import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { InvoiceView } from './invoice-view';
import type { InvoiceDetail } from './invoice.api';

const paid: InvoiceDetail = {
  id: 'abcdef1234',
  branchId: 'b1',
  clientId: 'c1',
  employeeId: 'e1',
  bookingId: 'bk1',
  subtotal: 100,
  discountAmt: 10,
  vatRate: 0.15,
  vatAmt: 13.5,
  total: 103.5,
  currency: 'SAR',
  status: 'PAID',
  issuedAt: '2026-04-17T10:00:00Z',
  dueAt: null,
  paidAt: '2026-04-17T10:05:00Z',
  createdAt: '2026-04-17T10:00:00Z',
  qrCode: null,
  zatcaStatus: null,
};

describe('InvoiceView', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the proxy endpoint with Bearer token and credentials:include', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(paid) });
    render(<InvoiceView invoiceId="abcdef1234" accessToken="tok" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/proxy/public/invoices/abcdef1234');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok' });
    expect(init.credentials).toBe('include');
  });

  it('renders the short invoice id, totals breakdown, and PAID status', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(paid) });
    render(<InvoiceView invoiceId="abcdef1234" accessToken="tok" />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /invoice/i })).toBeTruthy());
    expect(screen.getByText('#abcdef12')).toBeTruthy();
    expect(screen.getByText('PAID')).toBeTruthy();
    expect(screen.getByText(/VAT \(15%\)/)).toBeTruthy();
    expect(screen.getByText('Subtotal')).toBeTruthy();
    expect(screen.getByText('Discount')).toBeTruthy();
  });

  it('hides the discount row when discountAmt is zero', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...paid, discountAmt: 0 }),
    });
    render(<InvoiceView invoiceId="abcdef1234" accessToken="tok" />);
    await waitFor(() => expect(screen.getByText('PAID')).toBeTruthy());
    expect(screen.queryByText('Discount')).toBeNull();
  });

  it('renders the ZATCA QR image when qrCode is present', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...paid, qrCode: 'data:image/png;base64,xxx' }),
    });
    render(<InvoiceView invoiceId="abcdef1234" accessToken="tok" />);
    await waitFor(() => expect(screen.getByAltText('ZATCA QR Code')).toBeTruthy());
  });

  it('surfaces the error message when fetch fails', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    render(<InvoiceView invoiceId="abcdef1234" accessToken="tok" />);
    await waitFor(() => expect(screen.getByText(/Failed to fetch invoice/i)).toBeTruthy());
  });

  it('calls window.print when the Print button is clicked', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(paid) });
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<InvoiceView invoiceId="abcdef1234" accessToken="tok" />);
    await waitFor(() => expect(screen.getByRole('button', { name: /print invoice/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /print invoice/i }));
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('unwraps { data } envelope shape', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: paid }) });
    render(<InvoiceView invoiceId="abcdef1234" accessToken="tok" />);
    await waitFor(() => expect(screen.getByText('PAID')).toBeTruthy());
  });
});
