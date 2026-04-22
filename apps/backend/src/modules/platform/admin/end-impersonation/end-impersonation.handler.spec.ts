import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EndImpersonationHandler } from './end-impersonation.handler';
import { PrismaService } from '../../../../infrastructure/database';
import { RedisService } from '../../../../infrastructure/cache/redis.service';

describe('EndImpersonationHandler', () => {
  let handler: EndImpersonationHandler;
  let findUnique: jest.Mock;
  let update: jest.Mock;
  let logCreate: jest.Mock;
  let redisSet: jest.Mock;

  beforeEach(async () => {
    findUnique = jest.fn();
    update = jest.fn();
    logCreate = jest.fn();
    redisSet = jest.fn().mockResolvedValue('OK');

    const tx = {
      impersonationSession: { findUnique, update },
      superAdminActionLog: { create: logCreate },
    };
    const prismaMock = {
      $allTenants: {
        $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      },
    } as unknown as PrismaService;
    const redisMock = {
      getClient: () => ({ set: redisSet }),
    } as unknown as RedisService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        EndImpersonationHandler,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();
    handler = moduleRef.get(EndImpersonationHandler);
  });

  const cmd = {
    sessionId: 'sess1',
    superAdminUserId: 'sa1',
    endedReason: 'manual' as const,
    ipAddress: '1.2.3.4',
    userAgent: 'jest',
  };

  it('ends session, writes audit log, blacklists JWT', async () => {
    findUnique.mockResolvedValue({
      id: 'sess1',
      endedAt: null,
      organizationId: 'o1',
      superAdminUserId: 'sa1',
    });

    await handler.execute(cmd);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'sess1' },
      data: { endedAt: expect.any(Date), endedReason: 'manual' },
    });
    expect(logCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionType: 'IMPERSONATE_END',
        impersonationSessionId: 'sess1',
        organizationId: 'o1',
      }),
    });
    expect(redisSet).toHaveBeenCalledWith(
      'impersonation-revoked:sess1',
      '1',
      'EX',
      16 * 60,
    );
  });

  it('throws NotFoundException when session missing', async () => {
    findUnique.mockResolvedValue(null);
    await expect(handler.execute(cmd)).rejects.toBeInstanceOf(NotFoundException);
    expect(redisSet).not.toHaveBeenCalled();
  });

  it('throws ConflictException when session already ended', async () => {
    findUnique.mockResolvedValue({
      id: 'sess1',
      endedAt: new Date(),
      organizationId: 'o1',
      superAdminUserId: 'sa1',
    });
    await expect(handler.execute(cmd)).rejects.toBeInstanceOf(ConflictException);
    expect(redisSet).not.toHaveBeenCalled();
  });
});
