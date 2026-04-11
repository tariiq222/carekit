import { SendPushHandler } from './send-push/send-push.handler';
import { SendSmsHandler } from './send-sms/send-sms.handler';
import { SendEmailHandler } from './send-email/send-email.handler';
import { SendNotificationHandler } from './send-notification/send-notification.handler';
import type { FcmService } from '../../infrastructure/mail';
import type { SmtpService } from '../../infrastructure/mail';
import type { PrismaService } from '../../infrastructure/database';
import { NotificationType, RecipientType } from '@prisma/client';

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
  },
  emailTemplate: {
    findUnique: jest.fn().mockResolvedValue(mockTemplate),
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
