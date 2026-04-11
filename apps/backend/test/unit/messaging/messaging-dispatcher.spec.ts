import { Test } from '@nestjs/testing';
import { MessagingDispatcherService } from '../../../src/modules/messaging/core/messaging-dispatcher.service.js';
import { MessagingPreferencesService } from '../../../src/modules/messaging/core/messaging-preferences.service.js';
import { MessagingEvent } from '../../../src/modules/messaging/core/messaging-events.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const mockPrisma = {
  notification: { create: jest.fn().mockResolvedValue({ id: 'notif-1' }) },
  user: { findUnique: jest.fn() },
};
const mockPrefs = { isChannelEnabled: jest.fn().mockResolvedValue(true) };
const mockPushChannel = { name: 'push', isEnabled: jest.fn().mockReturnValue(true), send: jest.fn().mockResolvedValue({ ok: true }) };
const mockEmailChannel = { name: 'email', isEnabled: jest.fn().mockReturnValue(true), send: jest.fn().mockResolvedValue({ ok: true }) };
const mockSmsChannel = { name: 'sms', isEnabled: jest.fn().mockReturnValue(true), send: jest.fn().mockResolvedValue({ ok: true }) };

describe('MessagingDispatcherService', () => {
  let service: MessagingDispatcherService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MessagingDispatcherService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MessagingPreferencesService, useValue: mockPrefs },
        { provide: 'PUSH_CHANNEL', useValue: mockPushChannel },
        { provide: 'EMAIL_CHANNEL', useValue: mockEmailChannel },
        { provide: 'SMS_CHANNEL', useValue: mockSmsChannel },
      ],
    }).compile();
    service = module.get(MessagingDispatcherService);
    jest.clearAllMocks();
    mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });
    mockPrefs.isChannelEnabled.mockResolvedValue(true);
    mockPushChannel.send.mockResolvedValue({ ok: true });
    mockEmailChannel.send.mockResolvedValue({ ok: true });
    mockSmsChannel.send.mockResolvedValue({ ok: true });
  });

  it('persists inbox row unconditionally', async () => {
    await service.dispatch({
      event: MessagingEvent.BOOKING_CONFIRMED,
      recipientUserId: 'user-1',
      context: { date: '2026-05-01', time: '10:00', practitionerName: 'أحمد', serviceName: 'استشارة' },
    });
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
  });

  it('sends push and sms for BOOKING_CONFIRMED (default channels)', async () => {
    await service.dispatch({
      event: MessagingEvent.BOOKING_CONFIRMED,
      recipientUserId: 'user-1',
      context: { date: '2026-05-01', time: '10:00', practitionerName: 'أحمد', serviceName: 'استشارة' },
    });
    expect(mockPushChannel.send).toHaveBeenCalledTimes(1);
    expect(mockSmsChannel.send).toHaveBeenCalledTimes(1);
    expect(mockEmailChannel.send).not.toHaveBeenCalled();
  });

  it('bypasses preferences for OTP_REQUESTED', async () => {
    mockPrefs.isChannelEnabled.mockResolvedValue(false);
    await service.dispatch({
      event: MessagingEvent.OTP_REQUESTED,
      recipientUserId: 'user-1',
      context: { code: '1234' },
    });
    expect(mockEmailChannel.send).toHaveBeenCalledTimes(1);
    expect(mockSmsChannel.send).toHaveBeenCalledTimes(1);
  });

  it('skips sms channel when user preference disables it', async () => {
    mockPrefs.isChannelEnabled.mockImplementation((_userId: string, channel: string) =>
      Promise.resolve(channel !== 'sms'),
    );
    await service.dispatch({
      event: MessagingEvent.BOOKING_CONFIRMED,
      recipientUserId: 'user-1',
      context: { date: '2026-05-01', time: '10:00', practitionerName: 'أحمد', serviceName: 'استشارة' },
    });
    expect(mockSmsChannel.send).not.toHaveBeenCalled();
    expect(mockPushChannel.send).toHaveBeenCalledTimes(1);
  });

  it('does not throw if a channel fails', async () => {
    mockPushChannel.send.mockRejectedValue(new Error('FCM down'));
    await expect(
      service.dispatch({
        event: MessagingEvent.BOOKING_CONFIRMED,
        recipientUserId: 'user-1',
        context: { date: '2026-05-01', time: '10:00', practitionerName: 'أحمد', serviceName: 'استشارة' },
      }),
    ).resolves.not.toThrow();
  });
});
