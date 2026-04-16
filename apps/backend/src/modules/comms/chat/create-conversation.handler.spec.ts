import { CreateConversationHandler } from './create-conversation.handler';
import type { PrismaService } from '../../../infrastructure/database';

const buildPrisma = () => ({
  chatConversation: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'conv-1' }),
  },
});

describe('CreateConversationHandler', () => {
  it('returns existing open conversation instead of creating duplicate', async () => {
    const prisma = buildPrisma();
    prisma.chatConversation.findFirst.mockResolvedValue({ id: 'conv-existing', status: 'OPEN' });
    const handler = new CreateConversationHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ clientId: 'client-1', employeeId: 'emp-1' });
    expect(result.id).toBe('conv-existing');
    expect(prisma.chatConversation.create).not.toHaveBeenCalled();
  });

  it('creates new conversation when none exists', async () => {
    const prisma = buildPrisma();
    const handler = new CreateConversationHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ clientId: 'client-1', employeeId: 'emp-1' });
    expect(result.id).toBe('conv-1');
    expect(prisma.chatConversation.create).toHaveBeenCalled();
  });

  it('creates AI conversation when no employeeId', async () => {
    const prisma = buildPrisma();
    const handler = new CreateConversationHandler(prisma as unknown as PrismaService);
    await handler.execute({ clientId: 'client-1' });
    expect(prisma.chatConversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isAiChat: true, employeeId: null }),
    });
  });
});
