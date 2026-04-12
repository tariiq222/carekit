import { BookingAutocompleteCron } from './booking-autocomplete.cron';
import { BookingExpiryCron } from './booking-expiry.cron';
import { BookingNoShowCron } from './booking-noshow.cron';
import { RefreshTokenCleanupCron } from './refresh-token-cleanup.cron';
import { AppointmentRemindersCron } from './appointment-reminders.cron';
import { BookingStatus } from '@prisma/client';

const buildPrisma = () => ({
  booking: {
    findMany: jest.fn().mockResolvedValue([{ tenantId: 'tenant-1' }]),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  refreshToken: {
    deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
  },
  waitlistEntry: {
    findMany: jest.fn().mockResolvedValue([]),
  },
});

const buildSettingsHandler = () => ({
  execute: jest.fn().mockResolvedValue({
    autoCompleteAfterHours: 24,
    autoNoShowAfterMinutes: 60,
  }),
});

describe('BookingAutocompleteCron', () => {
  it('executes without throwing', async () => {
    const prisma = buildPrisma();
    const cron = new BookingAutocompleteCron(prisma as never, buildSettingsHandler() as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('does not call updateMany when no bookings found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([]);
    const cron = new BookingAutocompleteCron(prisma as never, buildSettingsHandler() as never);
    await cron.execute();
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });
});

describe('BookingExpiryCron', () => {
  it('executes without throwing', async () => {
    const prisma = buildPrisma();
    const cron = new BookingExpiryCron(prisma as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('updates pending bookings that have expired', async () => {
    const prisma = buildPrisma();
    prisma.booking.updateMany = jest.fn().mockResolvedValue({ count: 3 });
    const cron = new BookingExpiryCron(prisma as never);
    await cron.execute();
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: BookingStatus.PENDING,
          expiresAt: expect.anything(),
        }),
      }),
    );
  });
});

describe('BookingNoShowCron', () => {
  it('executes without throwing', async () => {
    const prisma = buildPrisma();
    const cron = new BookingNoShowCron(prisma as never, buildSettingsHandler() as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('marks confirmed bookings past cutoff as NO_SHOW', async () => {
    const prisma = buildPrisma();
    prisma.booking.updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const cron = new BookingNoShowCron(prisma as never, buildSettingsHandler() as never);
    await cron.execute();
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: BookingStatus.CONFIRMED,
        }),
        data: expect.objectContaining({
          status: BookingStatus.NO_SHOW,
        }),
      }),
    );
  });
});

describe('RefreshTokenCleanupCron', () => {
  it('deletes expired tokens', async () => {
    const prisma = buildPrisma();
    const cron = new RefreshTokenCleanupCron(prisma as never);
    await cron.execute();
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ expiresAt: expect.anything() }),
          ]),
        }),
      }),
    );
  });

  it('executes without throwing when no tokens to delete', async () => {
    const prisma = buildPrisma();
    prisma.refreshToken.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const cron = new RefreshTokenCleanupCron(prisma as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });
});

describe('AppointmentRemindersCron', () => {
  it('executes without throwing', async () => {
    const prisma = buildPrisma();
    const cron = new AppointmentRemindersCron(prisma as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('checks waitlist entries', async () => {
    const prisma = buildPrisma();
    prisma.waitlistEntry.findMany = jest.fn().mockResolvedValue([{ id: 'w-1' }, { id: 'w-2' }]);
    const cron = new AppointmentRemindersCron(prisma as never);
    await cron.execute();
    expect(prisma.waitlistEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'WAITING' }),
        take: 50,
      }),
    );
  });
});