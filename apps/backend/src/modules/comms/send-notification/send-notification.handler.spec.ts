import { SendNotificationHandler } from './send-notification.handler';
import { NotificationType, RecipientType } from '@prisma/client';

const buildPrisma = () => ({
  notification: { create: jest.fn().mockResolvedValue({ id: 'notif-1' }) },
});

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
});

const buildPush = () => ({ execute: jest.fn().mockResolvedValue(undefined) });
const buildEmail = () => ({ execute: jest.fn().mockResolvedValue(undefined) });
const buildSms = () => ({ execute: jest.fn().mockResolvedValue(undefined) });

const make = () => {
  const prisma = buildPrisma();
  const tenant = buildTenant('org-A');
  const push = buildPush();
  const email = buildEmail();
  const sms = buildSms();
  const handler = new SendNotificationHandler(
    prisma as never,
    tenant as never,
    push as never,
    email as never,
    sms as never,
  );
  return { handler, prisma, tenant, push, email, sms };
};

const baseDto = {
  recipientId: 'client-1',
  recipientType: RecipientType.CLIENT,
  type: NotificationType.BOOKING_CONFIRMED,
  title: 'Confirmed',
  body: 'Your booking is confirmed.',
  channels: ['in-app'] as Array<'push' | 'email' | 'sms' | 'in-app'>,
};

describe('SendNotificationHandler', () => {
  it('persists in-app notification with organizationId from tenant context', async () => {
    const { handler, prisma } = make();
    await handler.execute(baseDto);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recipientId: 'client-1', organizationId: 'org-A' }),
      }),
    );
  });

  it('uses explicit organizationId override (event-bus path) over CLS', async () => {
    const { handler, prisma, tenant } = make();
    await handler.execute({ ...baseDto, organizationId: 'org-Event' });
    expect(tenant.requireOrganizationIdOrDefault).not.toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-Event' }),
      }),
    );
  });

  it('dispatches push when channel is "push" and fcmToken provided', async () => {
    const { handler, push } = make();
    await handler.execute({ ...baseDto, channels: ['in-app', 'push'], fcmToken: 'tok-1' });
    expect(push.execute).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok-1', title: 'Confirmed' }));
  });

  it('skips push when fcmToken is missing', async () => {
    const { handler, push } = make();
    await handler.execute({ ...baseDto, channels: ['push'] });
    expect(push.execute).not.toHaveBeenCalled();
  });

  it('dispatches email when channel is "email" and email + templateSlug provided', async () => {
    const { handler, email } = make();
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
    const { handler, email } = make();
    await handler.execute({ ...baseDto, channels: ['email'], emailTemplateSlug: 'booking-confirmed' });
    expect(email.execute).not.toHaveBeenCalled();
  });

  it('dispatches SMS when channel is "sms" and phone provided', async () => {
    const { handler, sms } = make();
    await handler.execute({ ...baseDto, channels: ['sms'], recipientPhone: '+966500000000' });
    expect(sms.execute).toHaveBeenCalledWith({ phone: '+966500000000', body: baseDto.body });
  });

  it('skips SMS when recipientPhone is missing', async () => {
    const { handler, sms } = make();
    await handler.execute({ ...baseDto, channels: ['sms'] });
    expect(sms.execute).not.toHaveBeenCalled();
  });

  it('continues channel dispatches even when DB persist fails', async () => {
    const { handler, prisma, push } = make();
    prisma.notification.create = jest.fn().mockRejectedValue(new Error('DB error'));
    await handler.execute({ ...baseDto, channels: ['in-app', 'push'], fcmToken: 'tok' });
    expect(push.execute).toHaveBeenCalled();
  });

  it('dispatches multiple channels in one call', async () => {
    const { handler, push, sms } = make();
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
