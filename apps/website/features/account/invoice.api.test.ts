import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getInvoice, type InvoiceDetail } from './invoice.api';

const sample: InvoiceDetail = {
  id: 'inv_abc',
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

describe('invoice.api — getInvoice', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends Bearer token and credentials:include to the backend', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(sample) });
    await getInvoice('inv_abc', 'tok-xyz');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/public\/invoices\/inv_abc$/);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok-xyz' });
    expect(init.credentials).toBe('include');
  });

  it('URL-encodes the invoice id', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(sample) });
    await getInvoice('a/b c', 'tok');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain(encodeURIComponent('a/b c'));
  });

  it('unwraps { data: ... } envelopes and passes bare payloads through', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: sample }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(sample) });
    expect(await getInvoice('i', 'tok')).toEqual(sample);
    expect(await getInvoice('i', 'tok')).toEqual(sample);
  });

  it('throws the backend-provided message on non-ok response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ message: 'Invoice not found' }),
    });
    await expect(getInvoice('i', 'tok')).rejects.toThrow('Invoice not found');
  });

  it('falls back to statusText when the error body has no message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: 'Gateway Timeout',
      json: () => Promise.reject(new Error('not json')),
    });
    await expect(getInvoice('i', 'tok')).rejects.toThrow('Gateway Timeout');
  });
});
