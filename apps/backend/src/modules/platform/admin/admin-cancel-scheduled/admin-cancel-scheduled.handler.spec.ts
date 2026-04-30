import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminCancelScheduledHandler } from './admin-cancel-scheduled.handler';

const CMD = {
  organizationId: 'org-1',
  superAdminUserId: 'admin-1',
  ipAddress: '1.1.1.1',
  userAgent: 'jest',
};

const SCHEDULED_SUB = {
  id: 'sub-1',
  organizationId: 'org-1',
  status: 'ACTIVE',
  cancelAtPeriodEnd: true,
  canceledAt: null,
  currentPeriodEnd: '2026-05-31T00:00:00Z',
};

const UPDATED_SUB = { ...SCHEDULED_SUB, cancelAtPeriodEnd: false };

const buildPrisma = (subscription: unknown = SCHEDULED_SUB) => ({
  $allTenants: {
    subscription: {
      findUnique: jest.fn().mockResolvedValue(subscription),
      update: jest.fn().mockResolvedValue(UPDATED_SUB),
    },
    superAdminActionLog: { create: jest.fn().mockResolvedValue({}) },
  },
});

const build = (prisma = buildPrisma()) =>
  new AdminCancelScheduledHandler(prisma as never);

describe('AdminCancelScheduledHandler', () => {
  it('clears cancelAtPeriodEnd and returns updated subscription', async () => {
    const handler = build();
    const result = await handler.execute(CMD);
    expect(result).toEqual(UPDATED_SUB);
  });

  it('throws NotFoundException when no subscription exists', async () => {
    const handler = build(buildPrisma(null));
    await expect(handler.execute(CMD)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when cancelAtPeriodEnd is false', async () => {
    const handler = build(buildPrisma({ ...SCHEDULED_SUB, cancelAtPeriodEnd: false }));
    await expect(handler.execute(CMD)).rejects.toThrow(BadRequestException);
  });
});
