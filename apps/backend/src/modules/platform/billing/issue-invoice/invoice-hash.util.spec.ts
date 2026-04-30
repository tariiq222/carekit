import {
  canonicalize,
  computeInvoiceHash,
  type InvoiceHashInput,
} from './invoice-hash.util';

const baseInput: InvoiceHashInput = {
  invoiceNumber: 'INV-2026-000001',
  organizationId: 'org_a',
  amount: '115.00',
  currency: 'SAR',
  issuedAt: '2026-04-30T12:00:00.000Z',
  periodStart: '2026-04-01T00:00:00.000Z',
  periodEnd: '2026-04-30T23:59:59.999Z',
  previousHash: '0',
};

describe('canonicalize', () => {
  it('produces identical output regardless of key insertion order', () => {
    const a = { z: 1, a: { y: 2, x: 3 } };
    const b = { a: { x: 3, y: 2 }, z: 1 };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it('handles primitives, arrays, and nested objects', () => {
    expect(canonicalize(null)).toBe('null');
    expect(canonicalize(42)).toBe('42');
    expect(canonicalize('s')).toBe('"s"');
    expect(canonicalize([2, 1, { b: 1, a: 0 }])).toBe('[2,1,{"a":0,"b":1}]');
  });
});

describe('computeInvoiceHash', () => {
  it('returns a deterministic 64-char hex digest', () => {
    const h1 = computeInvoiceHash(baseInput);
    const h2 = computeInvoiceHash({ ...baseInput });
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
    expect(h1).toBe(h2);
  });

  it('flips the hash when any field changes', () => {
    const h0 = computeInvoiceHash(baseInput);
    const fields: (keyof InvoiceHashInput)[] = [
      'invoiceNumber',
      'organizationId',
      'amount',
      'currency',
      'issuedAt',
      'periodStart',
      'periodEnd',
      'previousHash',
    ];
    for (const f of fields) {
      const mutated: InvoiceHashInput = { ...baseInput, [f]: 'mutated' };
      expect(computeInvoiceHash(mutated)).not.toBe(h0);
    }
  });

  it('uses "0" as the previousHash sentinel for the first invoice', () => {
    expect(baseInput.previousHash).toBe('0');
    const h = computeInvoiceHash(baseInput);
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });
});
