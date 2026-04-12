import { SendNotificationHandler } from './send-notification.handler';
import { SendPushHandler } from '../send-push/send-push.handler';
import { SendEmailHandler } from '../send-email/send-email.handler';
import { SendSmsHandler } from '../send-sms/send-sms.handler';
import type { PrismaService } from '../../../infrastructure/database';
import { NotificationType, RecipientType } from '@prisma/client';

const buildPrisma = () => ({
  notification: {
    create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  },
});

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
