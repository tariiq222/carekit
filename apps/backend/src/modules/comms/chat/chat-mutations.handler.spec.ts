import { NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { GetConversationHandler } from './get-conversation.handler';
import { CloseConversationHandler } from './close-conversation.handler';
import { SendStaffMessageHandler } from './send-staff-message.handler';

const buildPrisma = () => ({
  chatConversation: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  commsChatMessage: {
    create: jest.fn(),
  },
});

const tenantId = 'tenant-1';
const conversationId = 'conv-1';

describe('GetConversationHandler', () => {
  let handler: GetConversationHandler;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
    handler = new GetConversationHandler(prisma as never);
  });

  it('returns conversation with messages', async () => {
    const conv = { id: conversationId, tenantId, messages: [{ id: 'msg-1' }] };
    prisma.chatConversation.findFirst.mockResolvedValue(conv);

    const result = await handler.execute({ tenantId, conversationId });

    expect(result).toEqual(conv);
    expect(prisma.chatConversation.findFirst).toHaveBeenCalledWith({
      where: { id: conversationId, tenantId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  });

  it('throws NotFoundException when not found', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ tenantId, conversationId })).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('CloseConversationHandler', () => {
  let handler: CloseConversationHandler;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
    handler = new CloseConversationHandler(prisma as never);
  });

  it('closes an open conversation', async () => {
    const conv = { id: conversationId, tenantId, status: ConversationStatus.OPEN };
    const updated = { ...conv, status: ConversationStatus.CLOSED };
    prisma.chatConversation.findFirst.mockResolvedValue(conv);
    prisma.chatConversation.update.mockResolvedValue(updated);

    const result = await handler.execute({ tenantId, conversationId });

    expect(result).toEqual(updated);
    expect(prisma.chatConversation.update).toHaveBeenCalledWith({
      where: { id: conversationId },
      data: { status: ConversationStatus.CLOSED },
    });
  });

  it('returns existing when already closed (idempotent)', async () => {
    const conv = { id: conversationId, tenantId, status: ConversationStatus.CLOSED };
    prisma.chatConversation.findFirst.mockResolvedValue(conv);

    const result = await handler.execute({ tenantId, conversationId });

    expect(result).toEqual(conv);
    expect(prisma.chatConversation.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when not found', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ tenantId, conversationId })).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('SendStaffMessageHandler', () => {
  let handler: SendStaffMessageHandler;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
    handler = new SendStaffMessageHandler(prisma as never);
  });

  it('creates a staff message and updates lastMessageAt', async () => {
    const conv = { id: conversationId, tenantId, status: ConversationStatus.OPEN };
    const message = { id: 'msg-1', body: 'Hello', senderType: MessageSenderType.EMPLOYEE };
    prisma.chatConversation.findFirst.mockResolvedValue(conv);
    prisma.commsChatMessage.create.mockResolvedValue(message);
    prisma.chatConversation.update.mockResolvedValue({ ...conv });

    const result = await handler.execute({
      tenantId,
      conversationId,
      staffId: 'staff-1',
      body: 'Hello',
    });

    expect(result).toEqual(message);
    expect(prisma.commsChatMessage.create).toHaveBeenCalledWith({
      data: {
        tenantId,
        conversationId,
        senderType: MessageSenderType.EMPLOYEE,
        senderId: 'staff-1',
        body: 'Hello',
      },
    });
    expect(prisma.chatConversation.update).toHaveBeenCalledWith({
      where: { id: conversationId },
      data: { lastMessageAt: expect.any(Date) },
    });
  });

  it('throws NotFoundException when conversation not found', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute({ tenantId, conversationId, staffId: 'staff-1', body: 'Hello' }),
    ).rejects.toThrow(NotFoundException);
  });
});
