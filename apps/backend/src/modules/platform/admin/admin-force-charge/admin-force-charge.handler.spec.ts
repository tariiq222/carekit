import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminForceChargeHandler } from './admin-force-charge.handler';

const CMD = {
  organizationId: 'org-1',
  superAdminUserId: 'admin-1',
  ipAddress: '1.1.1.1',
  userAgent: 'jest',
};

const PAST_DUE_SUB = {
  id: 'sub-1',
  organizationId: 'org-1',
  status: 'PAST_DUE',
  dunningRetryCount: 1,
  invoices: [{ id: 'inv-1', amount: 299 }],
};

const buildPrisma = (
  subscription: unknown = PAST_DUE_SUB,
  card: unknown = { id: 'card-1' },
) => ({
  $allTenants: {
    subscription: { findUnique: jest.fn().mockResolvedValue(subscription) },
    savedCard: { findFirst: jest.fn().mockResolvedValue(card) },
    superAdminActionLog: { create: jest.fn().mockResolvedValue({}) },
  },
});

const buildDunning = () => ({
  retryInvoice: jest.fn().mockResolvedValue({ ok: true, status: 'PAID', attemptNumber: 2 }),
});

const build = (prisma = buildPrisma(), dunning = buildDunning()) =>
  new AdminForceChargeHandler(prisma as never, dunning as never);

describe('AdminForceChargeHandler', () => {
  it('returns success when subscription is PAST_DUE and card exists', async () => {
    const handler = build();
    const result = await handler.execute(CMD);
    expect(result).toEqual({
      success: true,
      message: 'Retry initiated',
      result: { ok: true, status: 'PAID', attemptNumber: 2 },
    });
  });

  it('throws NotFoundException when no subscription exists', async () => {
    const handler = build(buildPrisma(null));
    await expect(handler.execute(CMD)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when subscription is not PAST_DUE', async () => {
    const handler = build(buildPrisma({ ...PAST_DUE_SUB, status: 'ACTIVE' }));
    await expect(handler.execute(CMD)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when no default card is on file', async () => {
    const handler = build(buildPrisma(PAST_DUE_SUB, null));
    await expect(handler.execute(CMD)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when no failed or due invoice exists', async () => {
    const subNoInvoice = { ...PAST_DUE_SUB, invoices: [] };
    const handler = build(buildPrisma(subNoInvoice));
    await expect(handler.execute(CMD)).rejects.toThrow(BadRequestException);
  });

  it('writes audit log with FORCE_CHARGE_ATTEMPTED metadata (no result/attemptNumber)', async () => {
    const mockPrisma = buildPrisma();
    const handler = build(mockPrisma);
    await handler.execute(CMD);

    expect(mockPrisma.$allTenants.superAdminActionLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$allTenants.superAdminActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          superAdminUserId: CMD.superAdminUserId,
          actionType: 'BILLING_FORCE_CHARGE',
          organizationId: CMD.organizationId,
          metadata: expect.objectContaining({
            subscriptionId: PAST_DUE_SUB.id,
            invoiceId: PAST_DUE_SUB.invoices[0].id,
            action: 'FORCE_CHARGE_ATTEMPTED',
          }),
        }),
      }),
    );
  });

  it('writes the audit-log row even when dunning.retryInvoice throws (logged before dunning)', async () => {
    const mockPrisma = buildPrisma();
    const mockDunning = {
      retryInvoice: jest.fn().mockRejectedValue(new Error('moyasar 503')),
    };
    const handler = build(mockPrisma, mockDunning);

    await expect(handler.execute(CMD)).rejects.toThrow('moyasar 503');

    expect(mockPrisma.$allTenants.superAdminActionLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$allTenants.superAdminActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: 'BILLING_FORCE_CHARGE',
          metadata: expect.objectContaining({ action: 'FORCE_CHARGE_ATTEMPTED' }),
        }),
      }),
    );
  });

  it('writes audit log BEFORE calling dunning (call ordering)', async () => {
    const order: string[] = [];
    const mockPrisma = buildPrisma();
    mockPrisma.$allTenants.superAdminActionLog.create.mockImplementation(async () => {
      order.push('log');
      return {};
    });
    const mockDunning = {
      retryInvoice: jest.fn().mockImplementation(async () => {
        order.push('dunning');
        return { ok: true, status: 'PAID', attemptNumber: 2 };
      }),
    };
    const handler = build(mockPrisma, mockDunning);

    await handler.execute(CMD);

    expect(order).toEqual(['log', 'dunning']);
  });
});
