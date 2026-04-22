import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReinstateOrganizationHandler } from './reinstate-organization.handler';
import { PrismaService } from '../../../../infrastructure/database';
import { RedisService } from '../../../../infrastructure/cache';

describe('ReinstateOrganizationHandler', () => {
  let handler: ReinstateOrganizationHandler;
  let orgFindUnique: jest.Mock;
  let orgUpdate: jest.Mock;
  let logCreate: jest.Mock;
  let redisDel: jest.Mock;

  beforeEach(async () => {
    orgFindUnique = jest.fn();
    orgUpdate = jest.fn();
    logCreate = jest.fn();
    redisDel = jest.fn().mockResolvedValue(1);

    const tx = {
      organization: { findUnique: orgFindUnique, update: orgUpdate },
      superAdminActionLog: { create: logCreate },
    };

    const prismaMock = {
      $allTenants: {
        $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      },
    } as unknown as PrismaService;

    const redisMock = {
      getClient: () => ({ del: redisDel }),
    } as unknown as RedisService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReinstateOrganizationHandler,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    handler = moduleRef.get(ReinstateOrganizationHandler);
  });

  const cmd = {
    organizationId: 'o1',
    superAdminUserId: 'sa1',
    reason: 'Payment received',
    ipAddress: '1.2.3.4',
    userAgent: 'jest',
  };

  it('reinstates a suspended org and writes audit log', async () => {
    orgFindUnique.mockResolvedValue({ id: 'o1', suspendedAt: new Date() });
    orgUpdate.mockResolvedValue({});
    logCreate.mockResolvedValue({});

    await handler.execute(cmd);

    expect(orgUpdate).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { suspendedAt: null, suspendedReason: null, status: 'ACTIVE' },
    });
    expect(logCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionType: 'REINSTATE_ORG',
        organizationId: 'o1',
        reason: cmd.reason,
      }),
    });
  });

  it('invalidates suspension cache after commit', async () => {
    orgFindUnique.mockResolvedValue({ id: 'o1', suspendedAt: new Date() });

    await handler.execute(cmd);

    expect(redisDel).toHaveBeenCalledWith('org-suspension:o1');
  });

  it('throws NotFoundException when org does not exist', async () => {
    orgFindUnique.mockResolvedValue(null);

    await expect(handler.execute(cmd)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ConflictException when org is not suspended', async () => {
    orgFindUnique.mockResolvedValue({ id: 'o1', suspendedAt: null });

    await expect(handler.execute(cmd)).rejects.toBeInstanceOf(ConflictException);
    expect(orgUpdate).not.toHaveBeenCalled();
    expect(redisDel).not.toHaveBeenCalled();
  });

  it('uses default reason when caller omits it', async () => {
    orgFindUnique.mockResolvedValue({ id: 'o1', suspendedAt: new Date() });

    await handler.execute({ ...cmd, reason: undefined });

    expect(logCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ reason: 'Reinstated by super-admin' }),
    });
  });
});
