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
const buildDispatcher = () => ({ dispatch: jest.fn().mockResolvedValue(undefined) });

const make = () => {
  const prisma = buildPrisma();
  const tenant = buildTenant('org-A');
  const push = buildPush();
  const email = buildEmail();
  const sms = buildSms();
  const dispatcher = buildDispatcher();
  const handler = new SendNotificationHandler(
    prisma as never,
    tenant as never,
    push as never,
    email as never,
    sms as never,
    dispatcher as never,
  );
  return { handler, prisma, tenant, push, email, sms, dispatcher };
};

// GENERAL is a STANDARD (non-critical) type — uses best-effort path
const standardDto = {
  recipientId: 'client-1',
  recipientType: RecipientType.CLIENT,
  type: NotificationType.GENERAL,
  title: 'Info',
  body: 'A general notification.',
  channels: ['in-app'] as Array<'push' | 'email' | 'sms' | 'in-app'>,
};

// BOOKING_CONFIRMED is a CRITICAL type — uses resilient dispatcher
const criticalDto = {
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
    await handler.execute(standardDto);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recipientId: 'client-1', organizationId: 'org-A' }),
      }),
    );
  });

  it('uses explicit organizationId override (event-bus path) over CLS', async () => {
    const { handler, prisma, tenant } = make();
    await handler.execute({ ...standardDto, organizationId: 'org-Event' });
    expect(tenant.requireOrganizationIdOrDefault).not.toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-Event' }),
      }),
    );
  });

  it('dispatches push (STANDARD) when channel is "push" and fcmToken provided', async () => {
    const { handler, push } = make();
    await handler.execute({ ...standardDto, channels: ['in-app', 'push'], fcmToken: 'tok-1' });
    expect(push.execute).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok-1', title: 'Info' }));
  });

  it('skips push (STANDARD) when fcmToken is missing', async () => {
    const { handler, push } = make();
    await handler.execute({ ...standardDto, channels: ['push'] });
    expect(push.execute).not.toHaveBeenCalled();
  });

  it('dispatches email (STANDARD) when channel is "email" and email + templateSlug provided', async () => {
    const { handler, email } = make();
    await handler.execute({
      ...standardDto,
      channels: ['email'],
      recipientEmail: 'client@example.sa',
      emailTemplateSlug: 'booking-confirmed',
    });
    expect(email.execute).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'client@example.sa', templateSlug: 'booking-confirmed' }),
    );
  });

  it('skips email (STANDARD) when recipientEmail is missing', async () => {
    const { handler, email } = make();
    await handler.execute({ ...standardDto, channels: ['email'], emailTemplateSlug: 'booking-confirmed' });
    expect(email.execute).not.toHaveBeenCalled();
  });

  it('dispatches SMS (STANDARD) when channel is "sms" and phone provided', async () => {
    const { handler, sms } = make();
    await handler.execute({ ...standardDto, channels: ['sms'], recipientPhone: '+966500000000' });
    expect(sms.execute).toHaveBeenCalledWith({ phone: '+966500000000', body: standardDto.body });
  });

  it('skips SMS (STANDARD) when recipientPhone is missing', async () => {
    const { handler, sms } = make();
    await handler.execute({ ...standardDto, channels: ['sms'] });
    expect(sms.execute).not.toHaveBeenCalled();
  });

  it('continues channel dispatches even when DB persist fails', async () => {
    const { handler, prisma, push } = make();
    prisma.notification.create = jest.fn().mockRejectedValue(new Error('DB error'));
    await handler.execute({ ...standardDto, channels: ['in-app', 'push'], fcmToken: 'tok' });
    expect(push.execute).toHaveBeenCalled();
  });

  it('dispatches multiple channels (STANDARD) in one call', async () => {
    const { handler, push, sms } = make();
    await handler.execute({
      ...standardDto,
      channels: ['in-app', 'push', 'sms'],
      fcmToken: 'tok',
      recipientPhone: '+966500000000',
    });
    expect(push.execute).toHaveBeenCalled();
    expect(sms.execute).toHaveBeenCalled();
  });

  it('routes CRITICAL notifications to the resilient dispatcher', async () => {
    const { handler, dispatcher, push, email, sms } = make();
    await handler.execute({
      ...criticalDto,
      channels: ['push', 'sms', 'email'],
      fcmToken: 'tok',
      recipientPhone: '+966500000000',
      recipientEmail: 'client@example.sa',
      emailTemplateSlug: 'booking-confirmed',
    });
    expect(dispatcher.dispatch).toHaveBeenCalled();
    // Direct handlers must NOT be called for critical path
    expect(push.execute).not.toHaveBeenCalled();
    expect(email.execute).not.toHaveBeenCalled();
    expect(sms.execute).not.toHaveBeenCalled();
  });

  it('does not call dispatcher for STANDARD notifications', async () => {
    const { handler, dispatcher } = make();
    await handler.execute({ ...standardDto, channels: ['in-app'] });
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });
});
