import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UpdatePlanHandler } from './update-plan.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('UpdatePlanHandler', () => {
  let handler: UpdatePlanHandler;
  let planFindUnique: jest.Mock;
  let planUpdate: jest.Mock;
  let logCreate: jest.Mock;

  beforeEach(async () => {
    planFindUnique = jest.fn();
    planUpdate = jest.fn();
    logCreate = jest.fn();

    const tx = {
      plan: { findUnique: planFindUnique, update: planUpdate },
      superAdminActionLog: { create: logCreate },
    };
    const prismaMock = {
      $allTenants: {
        $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [UpdatePlanHandler, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    handler = moduleRef.get(UpdatePlanHandler);
  });

  const cmd = {
    planId: 'p1',
    superAdminUserId: 'sa1',
    reason: 'Adjusting BASIC pricing for Q3',
    ipAddress: '1.2.3.4',
    userAgent: 'jest',
    data: { priceMonthly: 149, isActive: false },
  };

  it('updates a plan and writes audit log with changedFields', async () => {
    planFindUnique.mockResolvedValue({ id: 'p1' });
    planUpdate.mockResolvedValue({ id: 'p1', priceMonthly: 149 });

    await handler.execute(cmd);

    expect(planUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: expect.objectContaining({ isActive: false }),
    });
    expect(logCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionType: 'PLAN_UPDATE',
        metadata: expect.objectContaining({
          planId: 'p1',
          changedFields: expect.arrayContaining(['priceMonthly', 'isActive']),
        }),
      }),
    });
  });

  it('throws NotFoundException when plan missing', async () => {
    planFindUnique.mockResolvedValue(null);

    await expect(handler.execute(cmd)).rejects.toBeInstanceOf(NotFoundException);
    expect(planUpdate).not.toHaveBeenCalled();
  });
});
