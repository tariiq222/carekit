import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateZoomMeetingHandler } from './create-zoom-meeting.handler';
import { buildPrisma, mockBooking } from '../testing/booking-test-helpers';
import { ZoomMeetingStatus } from '@prisma/client';

const onlineBooking = {
  ...mockBooking,
  bookingType: 'ONLINE' as const,
  organizationId: 'org-1',
};
const zoomIntegration = {
  isActive: true,
  config: { ciphertext: 'cipher' },
};

function buildMocks() {
  const prisma = buildPrisma();
  prisma.booking.findFirst = jest.fn().mockResolvedValue(onlineBooking);
  (prisma as unknown as { integration: { findFirst: jest.Mock } }).integration = {
    findFirst: jest.fn().mockResolvedValue(zoomIntegration),
  };
  (prisma as unknown as { organizationSettings: { findFirst: jest.Mock } }).organizationSettings = {
    findFirst: jest.fn().mockResolvedValue({ timezone: 'Asia/Riyadh' }),
  };
  prisma.booking.update = jest
    .fn()
    .mockImplementation(({ data }) => Promise.resolve({ ...onlineBooking, ...data }));

  const zoomApi = {
    getAccessToken: jest.fn().mockResolvedValue('token'),
    createMeeting: jest
      .fn()
      .mockResolvedValue({ id: 99, join_url: 'join', start_url: 'start' }),
  };

  const zoomCredentials = {
    decrypt: jest.fn().mockReturnValue({
      zoomClientId: 'cid',
      zoomClientSecret: 'csec',
      zoomAccountId: 'acct',
    }),
  };

  return { prisma, zoomApi, zoomCredentials };
}

describe('CreateZoomMeetingHandler', () => {
  it('throws NotFoundException when booking not found', async () => {
    const { prisma, zoomApi, zoomCredentials } = buildMocks();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new CreateZoomMeetingHandler(
      prisma as never,
      zoomApi as never,
      zoomCredentials as never,
    );

    await expect(handler.execute({ bookingId: 'bad' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('skips if already CREATED (idempotency)', async () => {
    const { prisma, zoomApi, zoomCredentials } = buildMocks();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({
      ...onlineBooking,
      zoomMeetingId: '99',
      zoomMeetingStatus: ZoomMeetingStatus.CREATED,
    });
    const handler = new CreateZoomMeetingHandler(
      prisma as never,
      zoomApi as never,
      zoomCredentials as never,
    );

    await handler.execute({ bookingId: 'book-1' });

    expect(zoomApi.createMeeting).not.toHaveBeenCalled();
  });

  it('sets FAILED status when Zoom integration not configured', async () => {
    const { prisma, zoomApi, zoomCredentials } = buildMocks();
    (prisma as unknown as { integration: { findFirst: jest.Mock } }).integration.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new CreateZoomMeetingHandler(
      prisma as never,
      zoomApi as never,
      zoomCredentials as never,
    );

    await handler.execute({ bookingId: 'book-1' });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          zoomMeetingStatus: ZoomMeetingStatus.FAILED,
        }),
      }),
    );
  });

  it('calls Zoom API and updates booking with meeting details on success', async () => {
    const { prisma, zoomApi, zoomCredentials } = buildMocks();
    const handler = new CreateZoomMeetingHandler(
      prisma as never,
      zoomApi as never,
      zoomCredentials as never,
    );

    await handler.execute({ bookingId: 'book-1' });

    expect(zoomApi.createMeeting).toHaveBeenCalled();
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          zoomMeetingId: '99',
          zoomMeetingStatus: ZoomMeetingStatus.CREATED,
          zoomStartUrl: 'start',
        }),
      }),
    );
  });

  it('sets FAILED status when Zoom API fails', async () => {
    const { prisma, zoomApi, zoomCredentials } = buildMocks();
    zoomApi.createMeeting.mockRejectedValue(new Error('Zoom Outage'));
    const handler = new CreateZoomMeetingHandler(
      prisma as never,
      zoomApi as never,
      zoomCredentials as never,
    );

    await handler.execute({ bookingId: 'book-1' });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          zoomMeetingStatus: ZoomMeetingStatus.FAILED,
          zoomMeetingError: 'Zoom Outage',
        }),
      }),
    );
  });
});
