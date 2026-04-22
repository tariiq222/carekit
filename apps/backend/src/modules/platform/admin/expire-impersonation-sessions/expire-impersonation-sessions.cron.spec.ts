import { Test } from '@nestjs/testing';
import { ExpireImpersonationSessionsCron } from './expire-impersonation-sessions.cron';
import { PrismaService } from '../../../../infrastructure/database';
import { RedisService } from '../../../../infrastructure/cache/redis.service';

describe('ExpireImpersonationSessionsCron', () => {
  let cron: ExpireImpersonationSessionsCron;
  let findMany: jest.Mock;
  let update: jest.Mock;
  let logCreate: jest.Mock;
  let redisSet: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn();
    update = jest.fn();
    logCreate = jest.fn();
    redisSet = jest.fn().mockResolvedValue('OK');

    const prismaMock = {
      impersonationSession: { findMany, update },
      superAdminActionLog: { create: logCreate },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExpireImpersonationSessionsCron,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: { getClient: () => ({ set: redisSet }) } },
      ],
    }).compile();
    cron = moduleRef.get(ExpireImpersonationSessionsCron);
  });

  it('returns ended=0 when no stale sessions', async () => {
    findMany.mockResolvedValue([]);
    const result = await cron.execute();
    expect(result.ended).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it('expires stale sessions, logs each, and revokes JWTs', async () => {
    findMany.mockResolvedValue([
      { id: 's1', organizationId: 'o1', superAdminUserId: 'sa1' },
      { id: 's2', organizationId: 'o2', superAdminUserId: 'sa1' },
    ]);

    const result = await cron.execute();

    expect(result.ended).toBe(2);
    expect(update).toHaveBeenCalledTimes(2);
    expect(logCreate).toHaveBeenCalledTimes(2);
    expect(redisSet).toHaveBeenCalledTimes(2);
    expect(redisSet).toHaveBeenCalledWith(
      'impersonation-revoked:s1',
      '1',
      'EX',
      16 * 60,
    );
  });
});
