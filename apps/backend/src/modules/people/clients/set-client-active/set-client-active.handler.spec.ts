import { NotFoundException } from '@nestjs/common';
import { SetClientActiveHandler } from './set-client-active.handler';

const makeClient = (overrides: Partial<{ id: string; isActive: boolean; deletedAt: Date | null }> = {}) => ({
  id: 'client-1',
  isActive: true,
  deletedAt: null,
  ...overrides,
});

const buildPrisma = (client: ReturnType<typeof makeClient> | null) => {
  const txFn = jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      client: {
        update: jest.fn().mockResolvedValue({ id: client?.id ?? 'client-1', isActive: false }),
      },
      clientRefreshToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    return cb(tx);
  });

  return {
    _tx: txFn,
    client: {
      findFirst: jest.fn().mockResolvedValue(client),
    },
    $transaction: txFn,
  };
};

const buildEventBus = () => ({ publish: jest.fn().mockResolvedValue(undefined) });
const buildLogActivity = () => ({ execute: jest.fn().mockResolvedValue(undefined) });

describe('SetClientActiveHandler', () => {
  it('enables a client (happy path — isActive: true)', async () => {
    const disabledClient = makeClient({ isActive: false });
    const prisma = buildPrisma(disabledClient);
    // When enabling, transaction updates client but does NOT revoke tokens
    prisma.$transaction = jest.fn().mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          client: {
            update: jest.fn().mockResolvedValue({ id: 'client-1', isActive: true }),
          },
          clientRefreshToken: { updateMany: jest.fn() },
        };
        const result = await cb(tx);
        // Verify no revoke when enabling
        expect(tx.clientRefreshToken.updateMany).not.toHaveBeenCalled();
        return result;
      },
    );

    const eventBus = buildEventBus();
    const logActivity = buildLogActivity();
    const handler = new SetClientActiveHandler(
      prisma as never,
      eventBus as never,
      logActivity as never,
    );

    const result = await handler.execute({
      clientId: 'client-1',
      isActive: true,
      actorUserId: 'admin-1',
    });

    expect(result).toEqual({ id: 'client-1', isActive: true });
    expect(eventBus.publish).toHaveBeenCalledWith(
      'people.client.account_toggled',
      expect.objectContaining({ payload: expect.objectContaining({ isActive: true }) }),
    );
    expect(logActivity.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'Client',
        entityId: 'client-1',
        description: 'Client account enabled',
        metadata: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  it('disables a client + revokes refresh tokens (happy path — isActive: false)', async () => {
    const activeClient = makeClient({ isActive: true });
    const prisma = buildPrisma(activeClient);

    const revokeMany = jest.fn().mockResolvedValue({ count: 2 });
    prisma.$transaction = jest.fn().mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          client: {
            update: jest.fn().mockResolvedValue({ id: 'client-1', isActive: false }),
          },
          clientRefreshToken: { updateMany: revokeMany },
        };
        return cb(tx);
      },
    );

    const eventBus = buildEventBus();
    const logActivity = buildLogActivity();
    const handler = new SetClientActiveHandler(
      prisma as never,
      eventBus as never,
      logActivity as never,
    );

    const result = await handler.execute({
      clientId: 'client-1',
      isActive: false,
      reason: 'Policy violation',
      actorUserId: 'admin-1',
    });

    expect(result).toEqual({ id: 'client-1', isActive: false });
    expect(revokeMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: 'client-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      }),
    );
    expect(logActivity.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Client account disabled',
        metadata: expect.objectContaining({ reason: 'Policy violation' }),
      }),
    );
  });

  it('throws 404 when client does not exist', async () => {
    const prisma = buildPrisma(null);
    const handler = new SetClientActiveHandler(
      prisma as never,
      buildEventBus() as never,
      buildLogActivity() as never,
    );

    await expect(
      handler.execute({ clientId: 'missing', isActive: false }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns current state without side-effects when isActive is already the requested value', async () => {
    // Client is already active; requesting isActive=true is a no-op
    const activeClient = makeClient({ isActive: true });
    const prisma = buildPrisma(activeClient);
    const eventBus = buildEventBus();
    const logActivity = buildLogActivity();
    const handler = new SetClientActiveHandler(
      prisma as never,
      eventBus as never,
      logActivity as never,
    );

    const result = await handler.execute({ clientId: 'client-1', isActive: true });

    expect(result).toEqual({ id: 'client-1', isActive: true });
    // No transaction, no event, no log
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(logActivity.execute).not.toHaveBeenCalled();
  });
});
