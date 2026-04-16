import { SendNotificationHandler } from './send-notification.handler';
import { SendPushHandler } from '../send-push/send-push.handler';
import { SendEmailHandler } from '../send-email/send-email.handler';
import { SendSmsHandler } from '../send-sms/send-sms.handler';
import type { PrismaService } from '../../../infrastructure/database';
import { NotificationType, RecipientType } from '@prisma/client';

const buildPrisma = () => ({
  notification: { create: jest.fn().mockResolvedValue({ id: 'notif-1' }) },
});

const buildPush = () => ({ execute: jest.fn().mockResolvedValue(undefined) });
const buildEmail = () => ({ execute: jest.fn().mockResolvedValue(undefined) });
const buildSms = () => ({ execute: jest.fn().mockResolvedValue(undefined) });

const baseDto = {
  recipientId: 'client-1',
  recipientType: RecipientType.CLIENT,
  type: NotificationType.BOOKING_CONFIRMED,
  title: 'Confirmed',
  body: 'Your booking is confirmed.',
  channels: ['in-app'] as Array<'push' | 'email' | 'sms' | 'in-app'>,
};

describe('SendNotificationHandler', () => {
  it('persists in-app notification to DB', async () => {
    const prisma = buildPrisma();
    const handler = new SendNotificationHandler(prisma as never, buildPush() as never, buildEmail() as never, buildSms() as never);
    await handler.execute(baseDto);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recipientId: 'client-1' }),
      }),
    );
  });

  it('dispatches push when channel is "push" and fcmToken provided', async () => {
    const push = buildPush();
    const handler = new SendNotificationHandler(buildPrisma() as never, push as never, buildEmail() as never, buildSms() as never);
    await handler.execute({ ...baseDto, channels: ['in-app', 'push'], fcmToken: 'tok-1' });
    expect(push.execute).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok-1', title: 'Confirmed' }));
  });

  it('skips push when fcmToken is missing', async () => {
    const push = buildPush();
    const handler = new SendNotificationHandler(buildPrisma() as never, push as never, buildEmail() as never, buildSms() as never);
    await handler.execute({ ...baseDto, channels: ['push'] });
    expect(push.execute).not.toHaveBeenCalled();
  });

  it('dispatches email when channel is "email" and email + templateSlug provided', async () => {
    const email = buildEmail();
    const handler = new SendNotificationHandler(buildPrisma() as never, buildPush() as never, email as never, buildSms() as never);
    await handler.execute({
      ...baseDto,
      channels: ['email'],
      recipientEmail: 'client@example.sa',
      emailTemplateSlug: 'booking-confirmed',
    });
    expect(email.execute).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'client@example.sa', templateSlug: 'booking-confirmed' }),
    );
  });

  it('skips email when recipientEmail is missing', async () => {
    const email = buildEmail();
    const handler = new SendNotificationHandler(buildPrisma() as never, buildPush() as never, email as never, buildSms() as never);
    await handler.execute({ ...baseDto, channels: ['email'], emailTemplateSlug: 'booking-confirmed' });
    expect(email.execute).not.toHaveBeenCalled();
  });

  it('dispatches SMS when channel is "sms" and phone provided', async () => {
    const sms = buildSms();
    const handler = new SendNotificationHandler(buildPrisma() as never, buildPush() as never, buildEmail() as never, sms as never);
    await handler.execute({ ...baseDto, channels: ['sms'], recipientPhone: '+966500000000' });
    expect(sms.execute).toHaveBeenCalledWith({ phone: '+966500000000', body: baseDto.body });
  });

  it('skips SMS when recipientPhone is missing', async () => {
    const sms = buildSms();
    const handler = new SendNotificationHandler(buildPrisma() as never, buildPush() as never, buildEmail() as never, sms as never);
    await handler.execute({ ...baseDto, channels: ['sms'] });
    expect(sms.execute).not.toHaveBeenCalled();
  });

  it('continues channel dispatches even when DB persist fails', async () => {
    const prisma = buildPrisma();
    prisma.notification.create = jest.fn().mockRejectedValue(new Error('DB error'));
    const push = buildPush();
    const handler = new SendNotificationHandler(prisma as never, push as never, buildEmail() as never, buildSms() as never);
    await handler.execute({ ...baseDto, channels: ['in-app', 'push'], fcmToken: 'tok' });
    expect(push.execute).toHaveBeenCalled();
  });

  it('dispatches multiple channels in one call', async () => {
    const push = buildPush();
    const sms = buildSms();
    const handler = new SendNotificationHandler(buildPrisma() as never, push as never, buildEmail() as never, sms as never);
    await handler.execute({
      ...baseDto,
      channels: ['in-app', 'push', 'sms'],
      fcmToken: 'tok',
      recipientPhone: '+966500000000',
    });
    expect(push.execute).toHaveBeenCalled();
    expect(sms.execute).toHaveBeenCalled();
  });
});
