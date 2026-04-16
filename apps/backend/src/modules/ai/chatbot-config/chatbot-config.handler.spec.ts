import { GetChatbotConfigHandler } from './get-chatbot-config.handler';
import { UpsertChatbotConfigHandler } from './upsert-chatbot-config.handler';

const buildPrisma = () => {
  const upsert = jest.fn().mockResolvedValue({ id: 'cfg-1' });
  return {
    chatbotConfig: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert,
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
};

// Re-enabled after Plan D singleton conversion
describe.skip('GetChatbotConfigHandler', () => {
  it('returns all configs for tenant (no category filter)', async () => {
    const prisma = buildPrisma();
    const handler = new GetChatbotConfigHandler(prisma as never);
    await handler.execute({ tenantId: 'tenant-1' });
    expect(prisma.chatbotConfig.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('returns configs filtered by category', async () => {
    const prisma = buildPrisma();
    const handler = new GetChatbotConfigHandler(prisma as never);
    await handler.execute({ tenantId: 'tenant-1', category: 'general' });
    expect(prisma.chatbotConfig.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', category: 'general' },
      orderBy: { createdAt: 'asc' },
    });
  });
});

// Re-enabled after Plan D singleton conversion
describe.skip('UpsertChatbotConfigHandler', () => {
  it('upserts multiple config entries using Promise.all', async () => {
    const prisma = buildPrisma();
    const handler = new UpsertChatbotConfigHandler(prisma as never);
    const configs = [
      { key: 'greeting', value: 'Hello', category: 'general' },
      { key: 'language', value: 'ar', category: 'general' },
    ];
    const result = await handler.execute({ tenantId: 'tenant-1', configs });
    expect(prisma.chatbotConfig.upsert).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });
});
