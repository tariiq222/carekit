import { SendPushHandler } from './send-push/send-push.handler';
import { SendSmsHandler } from './send-sms/send-sms.handler';
import { SendEmailHandler } from './send-email/send-email.handler';
import { SendNotificationHandler } from './send-notification/send-notification.handler';
import { CreateNotificationHandler } from './notifications/create-notification.handler';
import { ListNotificationsHandler } from './notifications/list-notifications.handler';
import { MarkReadHandler } from './notifications/mark-read.handler';
import { CreateConversationHandler } from './chat/create-conversation.handler';
import { CreateChatMessageHandler } from './chat/create-chat-message.handler';
import { ListConversationsHandler } from './chat/list-conversations.handler';
import { ListMessagesHandler } from './chat/list-messages.handler';
import { NotFoundException } from '@nestjs/common';
import type { FcmService } from '../../infrastructure/mail';
import type { SmtpService } from '../../infrastructure/mail';
import type { PrismaService } from '../../infrastructure/database';
import { MessageSenderType, NotificationType, RecipientType } from '@prisma/client';

const mockTemplate = {
  id: 'tpl-1',
  slug: 'welcome',
  subjectAr: 'مرحباً',
  htmlBody: '<p>{{client_name}}</p>',
  isActive: true,
};

const buildPrisma = () => ({
  notification: {
    create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  emailTemplate: {
    findUnique: jest.fn().mockResolvedValue(mockTemplate),
  },
  chatConversation: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'conv-1' }),
    update: jest.fn().mockResolvedValue({ id: 'conv-1' }),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  commsChatMessage: {
    create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
    findMany: jest.fn().mockResolvedValue([]),
  },
});

// ─── SendPushHandler ──────────────────────────────────────────────────────────
describe('SendPushHandler', () => {
  it('sends push via FCM', async () => {
    const fcm = {
      isAvailable: jest.fn().mockReturnValue(true),
      sendPush: jest.fn().mockResolvedValue('msg-id'),
    };
    await new SendPushHandler(fcm as unknown as FcmService).execute({
      token: 'tok-1',
      title: 'Hello',
      body: 'World',
    });
    expect(fcm.sendPush).toHaveBeenCalledWith('tok-1', 'Hello', 'World', undefined);
  });

  it('skips when FCM unavailable', async () => {
    const fcm = {
      isAvailable: jest.fn().mockReturnValue(false),
      sendPush: jest.fn(),
    };
    await new SendPushHandler(fcm as unknown as FcmService).execute({
      token: 'tok-1',
      title: 'Hello',
      body: 'World',
    });
    expect(fcm.sendPush).not.toHaveBeenCalled();
  });
});

// ─── SendSmsHandler ───────────────────────────────────────────────────────────
describe('SendSmsHandler', () => {
  it('logs SMS send (stub)', async () => {
    await expect(
      new SendSmsHandler().execute({ phone: '+966500000000', body: 'Test message' }),
    ).resolves.toBeUndefined();
  });
});

// ─── SendEmailHandler ─────────────────────────────────────────────────────────
describe('SendEmailHandler', () => {
  it('substitutes template variables and sends email', async () => {
    const prisma = buildPrisma();
    const smtp = {
      isAvailable: jest.fn().mockReturnValue(true),
      sendMail: jest.fn().mockResolvedValue(undefined),
    };
    await new SendEmailHandler(smtp as unknown as SmtpService, prisma as unknown as PrismaService).execute({
      tenantId: 'tenant-1',
      to: 'client@example.com',
      templateSlug: 'welcome',
      vars: { client_name: 'أحمد' },
    });
    expect(smtp.sendMail).toHaveBeenCalledWith(
      'client@example.com',
      'مرحباً',
      '<p>أحمد</p>',
    );
  });

  it('skips when SMTP unavailable', async () => {
    const prisma = buildPrisma();
    const smtp = {
      isAvailable: jest.fn().mockReturnValue(false),
      sendMail: jest.fn(),
    };
    await new SendEmailHandler(smtp as unknown as SmtpService, prisma as unknown as PrismaService).execute({
      tenantId: 'tenant-1',
      to: 'client@example.com',
      templateSlug: 'welcome',
      vars: {},
    });
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });

  it('skips when template not found', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findUnique.mockResolvedValue(null);
    const smtp = {
      isAvailable: jest.fn().mockReturnValue(true),
      sendMail: jest.fn(),
    };
    await new SendEmailHandler(smtp as unknown as SmtpService, prisma as unknown as PrismaService).execute({
      tenantId: 'tenant-1',
      to: 'client@example.com',
      templateSlug: 'missing',
      vars: {},
    });
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });
});

// ─── SendNotificationHandler ──────────────────────────────────────────────────
describe('SendNotificationHandler', () => {
  it('persists in-app notification and calls push channel', async () => {
    const prisma = buildPrisma();
    const push = { execute: jest.fn().mockResolvedValue(undefined) };
    const email = { execute: jest.fn().mockResolvedValue(undefined) };
    const sms = { execute: jest.fn().mockResolvedValue(undefined) };

    await new SendNotificationHandler(
      prisma as unknown as PrismaService,
      push as unknown as SendPushHandler,
      email as unknown as SendEmailHandler,
      sms as unknown as SendSmsHandler,
    ).execute({
      tenantId: 'tenant-1',
      recipientId: 'client-1',
      recipientType: RecipientType.CLIENT,
      type: NotificationType.BOOKING_CONFIRMED,
      title: 'تم تأكيد الحجز',
      body: 'تم تأكيد موعدك',
      channels: ['push', 'in-app'],
      fcmToken: 'tok-abc',
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(push.execute).toHaveBeenCalledWith({
      token: 'tok-abc',
      title: 'تم تأكيد الحجز',
      body: 'تم تأكيد موعدك',
    });
    expect(email.execute).not.toHaveBeenCalled();
    expect(sms.execute).not.toHaveBeenCalled();
  });
});

// ─── CreateNotificationHandler ───────────────────────────────────────────────
describe('CreateNotificationHandler', () => {
  it('creates a notification record', async () => {
    const prisma = buildPrisma();
    const handler = new CreateNotificationHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({
      tenantId: 'tenant-1',
      recipientId: 'client-1',
      recipientType: RecipientType.CLIENT,
      type: NotificationType.GENERAL,
      title: 'Test',
      body: 'Hello',
    });
    expect(result.id).toBe('notif-1');
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'tenant-1', recipientId: 'client-1' }),
    });
  });
});

// ─── ListNotificationsHandler ────────────────────────────────────────────────
describe('ListNotificationsHandler', () => {
  it('returns paginated notifications', async () => {
    const prisma = buildPrisma();
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([{ id: 'notif-1', isRead: false }]);
    (prisma.notification.count as jest.Mock).mockResolvedValue(1);
    const handler = new ListNotificationsHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ tenantId: 'tenant-1', recipientId: 'client-1', page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('filters unread when unreadOnly=true', async () => {
    const prisma = buildPrisma();
    const handler = new ListNotificationsHandler(prisma as unknown as PrismaService);
    await handler.execute({ tenantId: 'tenant-1', recipientId: 'client-1', unreadOnly: true, page: 1, limit: 20 });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isRead: false }) }),
    );
  });
});

// ─── MarkReadHandler ─────────────────────────────────────────────────────────
describe('MarkReadHandler', () => {
  it('marks all notifications read for a recipient', async () => {
    const prisma = buildPrisma();
    const handler = new MarkReadHandler(prisma as unknown as PrismaService);
    await handler.execute({ tenantId: 'tenant-1', recipientId: 'client-1' });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', recipientId: 'client-1', isRead: false },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });

  it('marks single notification read when notificationId provided', async () => {
    const prisma = buildPrisma();
    const handler = new MarkReadHandler(prisma as unknown as PrismaService);
    await handler.execute({ tenantId: 'tenant-1', recipientId: 'client-1', notificationId: 'notif-1' });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', recipientId: 'client-1', isRead: false, id: 'notif-1' },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });
});

// ─── CreateConversationHandler ───────────────────────────────────────────────
describe('CreateConversationHandler', () => {
  it('returns existing open conversation instead of creating duplicate', async () => {
    const prisma = buildPrisma();
    prisma.chatConversation.findFirst.mockResolvedValue({ id: 'conv-existing', status: 'OPEN' });
    const handler = new CreateConversationHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ tenantId: 'tenant-1', clientId: 'client-1', employeeId: 'emp-1' });
    expect(result.id).toBe('conv-existing');
    expect(prisma.chatConversation.create).not.toHaveBeenCalled();
  });

  it('creates new conversation when none exists', async () => {
    const prisma = buildPrisma();
    const handler = new CreateConversationHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ tenantId: 'tenant-1', clientId: 'client-1', employeeId: 'emp-1' });
    expect(result.id).toBe('conv-1');
    expect(prisma.chatConversation.create).toHaveBeenCalled();
  });

  it('creates AI conversation when no employeeId', async () => {
    const prisma = buildPrisma();
    const handler = new CreateConversationHandler(prisma as unknown as PrismaService);
    await handler.execute({ tenantId: 'tenant-1', clientId: 'client-1' });
    expect(prisma.chatConversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isAiChat: true, employeeId: null }),
    });
  });
});

describe('CreateChatMessageHandler', () => {
  it('creates message and updates lastMessageAt on conversation', async () => {
    const prisma = buildPrisma();
    prisma.chatConversation.findFirst.mockResolvedValue({ id: 'conv-1', status: 'OPEN', tenantId: 'tenant-1' });
    const handler = new CreateChatMessageHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({
      tenantId: 'tenant-1',
      conversationId: 'conv-1',
      senderType: MessageSenderType.CLIENT,
      senderId: 'client-1',
      body: 'Hello',
    });
    expect(result.id).toBe('msg-1');
    expect(prisma.chatConversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { lastMessageAt: expect.any(Date) },
    });
  });
});

describe('ListConversationsHandler', () => {
  it('returns paginated conversations for a client', async () => {
    const prisma = buildPrisma();
    prisma.chatConversation.findMany.mockResolvedValue([{ id: 'conv-1' }]);
    prisma.chatConversation.count.mockResolvedValue(1);
    const handler = new ListConversationsHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ tenantId: 'tenant-1', clientId: 'client-1', page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });
});

describe('ListMessagesHandler', () => {
  it('throws NotFoundException when conversation does not exist', async () => {
    const prisma = buildPrisma();
    prisma.chatConversation.findFirst.mockResolvedValue(null);
    const handler = new ListMessagesHandler(prisma as unknown as PrismaService);
    await expect(
      handler.execute({ tenantId: 'tenant-1', conversationId: 'missing', limit: 20 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns messages newest-first without cursor on first load', async () => {
    const prisma = buildPrisma();
    prisma.chatConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
    prisma.commsChatMessage.findMany.mockResolvedValue([
      { id: 'msg-3' }, { id: 'msg-2' }, { id: 'msg-1' },
    ]);
    const handler = new ListMessagesHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ tenantId: 'tenant-1', conversationId: 'conv-1', limit: 20 });
    expect(result.data).toHaveLength(3);
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.nextCursor).toBeNull();
    expect(prisma.commsChatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, take: 21 }),
    );
  });

  it('sets hasMore and nextCursor when more messages exist', async () => {
    const prisma = buildPrisma();
    prisma.chatConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
    // Return limit+1 items to signal hasMore
    prisma.commsChatMessage.findMany.mockResolvedValue([
      { id: 'msg-3' }, { id: 'msg-2' }, { id: 'msg-1' },
    ]);
    const handler = new ListMessagesHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ tenantId: 'tenant-1', conversationId: 'conv-1', limit: 2 });
    expect(result.data).toHaveLength(2);
    expect(result.meta.hasMore).toBe(true);
    expect(result.meta.nextCursor).toBe('msg-2');
  });

  it('applies cursor pagination to load older messages', async () => {
    const prisma = buildPrisma();
    prisma.chatConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
    prisma.commsChatMessage.findMany.mockResolvedValue([]);
    const handler = new ListMessagesHandler(prisma as unknown as PrismaService);
    await handler.execute({ tenantId: 'tenant-1', conversationId: 'conv-1', cursor: 'msg-5', limit: 20 });
    expect(prisma.commsChatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'msg-5' }, skip: 1 }),
    );
  });
});

