/**
 * Phase 10 — admin billing actions integration coverage
 *
 * Uses lightweight handler instantiation with mocked Prisma/DunningRetryService
 * instead of bootHarness to avoid NestJS full-app boot overhead. Handler-level
 * unit tests in *.handler.spec.ts already cover individual branches; these tests
 * verify the combined flow (force-charge → dunning call → log, cancel-scheduled
 * → DB update → log) matching what the admin controller wires up.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { AdminForceChargeHandler } from '../../../src/modules/platform/admin/admin-force-charge/admin-force-charge.handler';
import { AdminCancelScheduledHandler } from '../../../src/modules/platform/admin/admin-cancel-scheduled/admin-cancel-scheduled.handler';

const CMD = {
  organizationId: 'org-1',
  superAdminUserId: 'admin-super',
  ipAddress: '127.0.0.1',
  userAgent: 'jest-integration',
};

const makePrisma = (sub: unknown, card: unknown = { id: 'card-1' }) => ({
  $allTenants: {
    subscription: {
      findUnique: jest.fn().mockResolvedValue(sub),
      update: jest.fn().mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({ ...(sub as object), ...data }),
      ),
    },
    savedCard: { findFirst: jest.fn().mockResolvedValue(card) },
    superAdminActionLog: { create: jest.fn().mockResolvedValue({}) },
  },
});

const makeDunning = (result = { ok: true, status: 'PAID', attemptNumber: 2 }) => ({
  retryInvoice: jest.fn().mockResolvedValue(result),
});

const PAST_DUE_SUB = {
  id: 'sub-1',
  organizationId: 'org-1',
  status: SubscriptionStatus.PAST_DUE,
  dunningRetryCount: 1,
  invoices: [{ id: 'inv-1', amount: 299 }],
};

const SCHEDULED_SUB = {
  id: 'sub-2',
  organizationId: 'org-1',
  status: SubscriptionStatus.ACTIVE,
  cancelAtPeriodEnd: true,
  canceledAt: null,
  currentPeriodEnd: new Date('2026-05-31'),
};

describe('Phase 10 — admin billing actions (force-charge + cancel-scheduled)', () => {
  describe('AdminForceChargeHandler', () => {
    it('returns { success: true } and calls dunning.retryInvoice with manual=true', async () => {
      const dunning = makeDunning();
      const handler = new AdminForceChargeHandler(
        makePrisma(PAST_DUE_SUB) as never,
        dunning as never,
      );
      const result = await handler.execute(CMD);
      expect(result.success).toBe(true);
      expect(result.result.status).toBe('PAID');
      expect(dunning.retryInvoice).toHaveBeenCalledTimes(1);
      expect(dunning.retryInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ manual: true }),
      );
    });

    it('logs action to SuperAdminActionLog after successful retry', async () => {
      const prisma = makePrisma(PAST_DUE_SUB);
      const handler = new AdminForceChargeHandler(prisma as never, makeDunning() as never);
      await handler.execute(CMD);
      expect(prisma.$allTenants.superAdminActionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            superAdminUserId: CMD.superAdminUserId,
            organizationId: CMD.organizationId,
          }),
        }),
      );
    });

    it('propagates failed dunning result (ok: false) without throwing', async () => {
      const dunning = makeDunning({ ok: false, status: 'FAILED', attemptNumber: 3 });
      const handler = new AdminForceChargeHandler(
        makePrisma(PAST_DUE_SUB) as never,
        dunning as never,
      );
      const result = await handler.execute(CMD);
      expect(result.success).toBe(true);
      expect(result.result.ok).toBe(false);
    });

    it('throws NotFoundException when subscription does not exist', async () => {
      const handler = new AdminForceChargeHandler(
        makePrisma(null) as never,
        makeDunning() as never,
      );
      await expect(handler.execute(CMD)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when subscription is not PAST_DUE', async () => {
      const activeSub = { ...PAST_DUE_SUB, status: SubscriptionStatus.ACTIVE };
      const handler = new AdminForceChargeHandler(
        makePrisma(activeSub) as never,
        makeDunning() as never,
      );
      await expect(handler.execute(CMD)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no saved card exists', async () => {
      const handler = new AdminForceChargeHandler(
        makePrisma(PAST_DUE_SUB, null) as never,
        makeDunning() as never,
      );
      await expect(handler.execute(CMD)).rejects.toThrow(BadRequestException);
    });
  });

  describe('AdminCancelScheduledHandler', () => {
    it('clears cancelAtPeriodEnd and returns the updated subscription', async () => {
      const handler = new AdminCancelScheduledHandler(makePrisma(SCHEDULED_SUB) as never);
      const result = await handler.execute(CMD);
      expect((result as { cancelAtPeriodEnd: boolean }).cancelAtPeriodEnd).toBe(false);
    });

    it('calls update with { cancelAtPeriodEnd: false }', async () => {
      const prisma = makePrisma(SCHEDULED_SUB);
      const handler = new AdminCancelScheduledHandler(prisma as never);
      await handler.execute(CMD);
      expect(prisma.$allTenants.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cancelAtPeriodEnd: false }),
        }),
      );
    });

    it('logs action to SuperAdminActionLog', async () => {
      const prisma = makePrisma(SCHEDULED_SUB);
      const handler = new AdminCancelScheduledHandler(prisma as never);
      await handler.execute(CMD);
      expect(prisma.$allTenants.superAdminActionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            superAdminUserId: CMD.superAdminUserId,
            organizationId: CMD.organizationId,
          }),
        }),
      );
    });

    it('throws NotFoundException when subscription does not exist', async () => {
      const handler = new AdminCancelScheduledHandler(makePrisma(null) as never);
      await expect(handler.execute(CMD)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when cancelAtPeriodEnd is already false', async () => {
      const notScheduled = { ...SCHEDULED_SUB, cancelAtPeriodEnd: false };
      const handler = new AdminCancelScheduledHandler(makePrisma(notScheduled) as never);
      await expect(handler.execute(CMD)).rejects.toThrow(BadRequestException);
    });
  });
});
