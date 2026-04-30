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
});
