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

describe('GetChatbotConfigHandler', () => {
  it('returns all configs (no category filter)', async () => {
    const prisma = buildPrisma();
    const handler = new GetChatbotConfigHandler(prisma as never);
    await handler.execute({});
    expect(prisma.chatbotConfig.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'asc' },
    });
  });

  it('returns configs filtered by category', async () => {
    const prisma = buildPrisma();
    const handler = new GetChatbotConfigHandler(prisma as never);
    await handler.execute({ category: 'general' });
    expect(prisma.chatbotConfig.findMany).toHaveBeenCalledWith({
      where: { category: 'general' },
      orderBy: { createdAt: 'asc' },
    });
  });
});

describe('UpsertChatbotConfigHandler', () => {
  it('upserts multiple config entries using Promise.all', async () => {
    const prisma = buildPrisma();
    const handler = new UpsertChatbotConfigHandler(prisma as never);
    const configs = [
      { key: 'greeting', value: 'Hello', category: 'general' },
      { key: 'language', value: 'ar', category: 'general' },
    ];
    const result = await handler.execute({ configs });
    expect(prisma.chatbotConfig.upsert).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  it('upserts each entry by key', async () => {
    const prisma = buildPrisma();
    const handler = new UpsertChatbotConfigHandler(prisma as never);
    const configs = [{ key: 'greeting', value: 'Hi', category: 'general' }];
    await handler.execute({ configs });
    expect(prisma.chatbotConfig.upsert).toHaveBeenCalledWith({
      where: { key: 'greeting' },
      create: { key: 'greeting', value: 'Hi', category: 'general' },
      update: { value: 'Hi', category: 'general' },
    });
  });
});