import { IssueInvoiceHandler } from './issue-invoice.handler';
import { InvoiceNumberingService } from './invoice-numbering.service';
import { computeInvoiceHash } from './invoice-hash.util';

interface InvoiceRow {
  id: string;
  organizationId: string;
  amount: { toFixed(p: number): string };
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  issuedAt: Date | null;
  invoiceNumber: string | null;
  invoiceHash: string | null;
  previousHash: string | null;
  status: string;
}

const buildInvoice = (overrides: Partial<InvoiceRow> = {}): InvoiceRow => ({
  id: 'inv_1',
  organizationId: 'org_a',
  amount: { toFixed: (_p: number) => '115.00' },
  currency: 'SAR',
  periodStart: new Date('2026-04-01T00:00:00.000Z'),
  periodEnd: new Date('2026-04-30T23:59:59.999Z'),
  issuedAt: null,
  invoiceNumber: null,
  invoiceHash: null,
  previousHash: null,
  status: 'DUE',
  ...overrides,
});

const buildTxClient = (rows: Map<string, InvoiceRow>) => ({
  subscriptionInvoice: {
    findUniqueOrThrow: jest.fn(({ where }: { where: { id: string } }) => {
      const row = rows.get(where.id);
      if (!row) throw new Error('not found');
      return Promise.resolve(row);
    }),
    findFirst: jest.fn(({ where }: { where: { organizationId: string; id: { not: string } } }) => {
      const found = Array.from(rows.values())
        .filter(
          r =>
            r.organizationId === where.organizationId &&
            r.id !== where.id.not &&
            r.issuedAt !== null,
        )
        .sort((a, b) => (b.issuedAt!.getTime() - a.issuedAt!.getTime()))[0];
      return Promise.resolve(found ? { invoiceHash: found.invoiceHash } : null);
    }),
    update: jest.fn(
      ({ where, data }: { where: { id: string }; data: Partial<InvoiceRow> }) => {
        const row = rows.get(where.id)!;
        Object.assign(row, data);
        return Promise.resolve(row);
      },
    ),
  },
});

const buildPrisma = (rows: Map<string, InvoiceRow>) => {
  const tx = buildTxClient(rows);
  return {
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    _tx: tx,
  };
};

describe('IssueInvoiceHandler', () => {
  it('first invoice receives previousHash="0" and issuedAt+invoiceNumber become non-null', async () => {
    const rows = new Map<string, InvoiceRow>();
    rows.set('inv_1', buildInvoice({ id: 'inv_1' }));
    const prisma = buildPrisma(rows);
    const numbering = new InvoiceNumberingService({} as never);
    jest.spyOn(numbering, 'allocate').mockResolvedValue('INV-2026-000001');

    const handler = new IssueInvoiceHandler(prisma as never, numbering);
    const now = new Date('2026-04-30T12:00:00.000Z');

    const result = await handler.execute('inv_1', now);

    expect(result.invoiceNumber).toBe('INV-2026-000001');
    expect(result.previousHash).toBe('0');
    expect(result.issuedAt).toEqual(now);
    expect(result.status).toBe('DUE'); // unchanged
    expect(result.invoiceHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('second invoice chains previousHash to the prior issued invoice', async () => {
    const priorHash = computeInvoiceHash({
      invoiceNumber: 'INV-2026-000001',
      organizationId: 'org_a',
      amount: '115.00',
      currency: 'SAR',
      issuedAt: '2026-04-01T00:00:00.000Z',
      periodStart: '2026-03-01T00:00:00.000Z',
      periodEnd: '2026-03-31T23:59:59.999Z',
      previousHash: '0',
    });

    const rows = new Map<string, InvoiceRow>();
    rows.set(
      'inv_1',
      buildInvoice({
        id: 'inv_1',
        issuedAt: new Date('2026-04-01T00:00:00.000Z'),
        invoiceNumber: 'INV-2026-000001',
        invoiceHash: priorHash,
        previousHash: '0',
      }),
    );
    rows.set('inv_2', buildInvoice({ id: 'inv_2' }));

    const prisma = buildPrisma(rows);
    const numbering = new InvoiceNumberingService({} as never);
    jest.spyOn(numbering, 'allocate').mockResolvedValue('INV-2026-000002');

    const handler = new IssueInvoiceHandler(prisma as never, numbering);
    const result = await handler.execute('inv_2', new Date('2026-04-30T12:00:00.000Z'));

    expect(result.invoiceNumber).toBe('INV-2026-000002');
    expect(result.previousHash).toBe(priorHash);
  });

  it('is idempotent — second call returns the already-issued invoice unchanged', async () => {
    const rows = new Map<string, InvoiceRow>();
    rows.set(
      'inv_1',
      buildInvoice({
        id: 'inv_1',
        issuedAt: new Date('2026-04-01T00:00:00.000Z'),
        invoiceNumber: 'INV-2026-000001',
        invoiceHash: 'a'.repeat(64),
        previousHash: '0',
        status: 'PAID',
      }),
    );
    const prisma = buildPrisma(rows);
    const numbering = new InvoiceNumberingService({} as never);
    const allocSpy = jest.spyOn(numbering, 'allocate');

    const handler = new IssueInvoiceHandler(prisma as never, numbering);
    const result = await handler.execute('inv_1', new Date('2026-05-01T00:00:00.000Z'));

    expect(allocSpy).not.toHaveBeenCalled();
    expect(result.invoiceNumber).toBe('INV-2026-000001');
    expect(result.invoiceHash).toBe('a'.repeat(64));
    expect(result.status).toBe('PAID');
  });

  it('does not mutate the invoice status', async () => {
    const rows = new Map<string, InvoiceRow>();
    rows.set('inv_paid', buildInvoice({ id: 'inv_paid', status: 'PAID' }));
    const prisma = buildPrisma(rows);
    const numbering = new InvoiceNumberingService({} as never);
    jest.spyOn(numbering, 'allocate').mockResolvedValue('INV-2026-000001');

    const handler = new IssueInvoiceHandler(prisma as never, numbering);
    const result = await handler.execute('inv_paid', new Date('2026-04-30T00:00:00.000Z'));

    expect(result.status).toBe('PAID');
    expect(result.issuedAt).not.toBeNull();
  });
});
