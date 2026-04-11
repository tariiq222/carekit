import { ChatCompletionHandler } from './chat-completion.handler';

const mockSearchResult = {
  chunkId: 'c1', documentId: 'd1', content: 'CareKit supports online booking.', chunkIndex: 0, similarity: 0.9,
};

const mockPrisma = () => ({
  chatSession: {
    create: jest.fn().mockResolvedValue({ id: 'session-1' }),
  },
  chatMessage: {
    createMany: jest.fn().mockResolvedValue({ count: 2 }),
  },
});

const mockSearch = () => ({
  execute: jest.fn().mockResolvedValue([mockSearchResult]),
});

const mockChat = () => ({
  isAvailable: jest.fn().mockReturnValue(true),
  complete: jest.fn().mockResolvedValue('You can book online through CareKit.'),
});

const dto = {
  tenantId: 't1',
  userMessage: 'How do I book an appointment?',
};

describe('ChatCompletionHandler', () => {
  it('returns assistant reply and sessionId', async () => {
    const prisma = mockPrisma();
    const search = mockSearch();
    const chat = mockChat();
    const handler = new ChatCompletionHandler(prisma as never, search as never, chat as never);
    const result = await handler.execute(dto);
    expect(result.reply).toBe('You can book online through CareKit.');
    expect(result.sessionId).toBe('session-1');
  });

  it('uses retrieved chunks as system context', async () => {
    const prisma = mockPrisma();
    const search = mockSearch();
    const chat = mockChat();
    const handler = new ChatCompletionHandler(prisma as never, search as never, chat as never);
    await handler.execute(dto);
    const messages = chat.complete.mock.calls[0][0];
    const systemMsg = messages.find((m: { role: string }) => m.role === 'system');
    expect(systemMsg.content).toContain('CareKit supports online booking.');
  });

  it('persists user + assistant messages', async () => {
    const prisma = mockPrisma();
    const search = mockSearch();
    const chat = mockChat();
    const handler = new ChatCompletionHandler(prisma as never, search as never, chat as never);
    await handler.execute(dto);
    expect(prisma.chatMessage.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ role: 'user' }),
          expect.objectContaining({ role: 'assistant' }),
        ]),
      }),
    );
  });

  it('throws if ChatAdapter is not available', async () => {
    const prisma = mockPrisma();
    const search = mockSearch();
    const chat = { isAvailable: jest.fn().mockReturnValue(false), complete: jest.fn() };
    const handler = new ChatCompletionHandler(prisma as never, search as never, chat as never);
    await expect(handler.execute(dto)).rejects.toThrow('ChatAdapter is not available');
  });
});
