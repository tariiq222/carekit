import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateZoomMeetingHandler } from './create-zoom-meeting.handler';
import { buildPrisma, mockBooking } from '../testing/booking-test-helpers';

const onlineBooking = { ...mockBooking, bookingType: 'ONLINE' as const };
const zoomIntegration = {
  isActive: true,
  config: { zoomClientId: 'cid', zoomClientSecret: 'csec', zoomAccountId: 'acct' },
};

function buildPrismaWithZoom(bookingOverride = onlineBooking, integrationOverride = zoomIntegration) {
  const prisma = buildPrisma();
  prisma.booking.findFirst = jest.fn().mockResolvedValue(bookingOverride);
  (prisma as unknown as Record<string, unknown>).integration = {
    findUnique: jest.fn().mockResolvedValue(integrationOverride),
  };
  prisma.booking.update = jest.fn().mockResolvedValue({ ...bookingOverride, zoomMeetingId: '12345' });
  return prisma;
}

describe('CreateZoomMeetingHandler', () => {
  it('throws NotFoundException when booking not found', async () => {
    const prisma = buildPrismaWithZoom();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new CreateZoomMeetingHandler(prisma as never);

    await expect(handler.execute({ bookingId: 'bad' })).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for non-ONLINE booking', async () => {
    const prisma = buildPrismaWithZoom({ ...mockBooking, bookingType: 'INDIVIDUAL' as const });
    const handler = new CreateZoomMeetingHandler(prisma as never);

    await expect(handler.execute({ bookingId: 'book-1' })).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when Zoom integration not configured', async () => {
    const prisma = buildPrismaWithZoom(onlineBooking, null as never);
    const handler = new CreateZoomMeetingHandler(prisma as never);

    await expect(handler.execute({ bookingId: 'book-1' })).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when Zoom integration is inactive', async () => {
    const prisma = buildPrismaWithZoom(onlineBooking, { ...zoomIntegration, isActive: false });
    const handler = new CreateZoomMeetingHandler(prisma as never);

    await expect(handler.execute({ bookingId: 'book-1' })).rejects.toThrow(BadRequestException);
  });

  it('calls Zoom API and updates booking with meeting details', async () => {
    const prisma = buildPrismaWithZoom();
    const handler = new CreateZoomMeetingHandler(prisma as never);

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', token_type: 'Bearer', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 99, join_url: 'https://zoom.us/j/99', start_url: 'https://zoom.us/s/99' }) });

    await handler.execute({ bookingId: 'book-1' });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ zoomMeetingId: '99', zoomJoinUrl: 'https://zoom.us/j/99' }),
      }),
    );
  });

  it('throws BadRequestException when Zoom token request fails', async () => {
    const prisma = buildPrismaWithZoom();
    const handler = new CreateZoomMeetingHandler(prisma as never);

    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, statusText: 'Unauthorized' });

    await expect(handler.execute({ bookingId: 'book-1' })).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when Zoom meeting creation fails', async () => {
    const prisma = buildPrismaWithZoom();
    const handler = new CreateZoomMeetingHandler(prisma as never);

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', token_type: 'Bearer', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: false, statusText: 'Bad Request' });

    await expect(handler.execute({ bookingId: 'book-1' })).rejects.toThrow(BadRequestException);
  });
});
