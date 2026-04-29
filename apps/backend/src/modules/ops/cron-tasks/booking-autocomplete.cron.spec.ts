import { BookingAutocompleteCron } from './booking-autocomplete.cron';
import { BookingExpiryCron } from './booking-expiry.cron';
import { BookingNoShowCron } from './booking-noshow.cron';
import { RefreshTokenCleanupCron } from './refresh-token-cleanup.cron';
import { AppointmentRemindersCron } from './appointment-reminders.cron';
import { BookingStatus } from '@prisma/client';

const buildPrisma = (orgIds: string[] = ['org-1']) => ({
  organization: {
    findMany: jest
      .fn()
      .mockResolvedValue(orgIds.map((id) => ({ id }))),
  },
  booking: {
    findMany: jest.fn().mockResolvedValue([{}]),
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

const buildCls = () => ({
  run: jest.fn().mockImplementation(async (fn: () => unknown) => fn()),
  set: jest.fn(),
});

describe('BookingAutocompleteCron', () => {
  it('executes without throwing', async () => {
    const prisma = buildPrisma();
    const cron = new BookingAutocompleteCron(
      prisma as never,
      buildSettingsHandler() as never,
      buildCls() as never,
    );
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('calls updateMany with CONFIRMED status and cutoff for each active org', async () => {
    const prisma = buildPrisma(['org-1', 'org-2']);
    const cron = new BookingAutocompleteCron(
      prisma as never,
      buildSettingsHandler() as never,
      buildCls() as never,
    );
    await cron.execute();
    expect(prisma.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { suspendedAt: null } }),
    );
    expect(prisma.booking.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: BookingStatus.CONFIRMED }),
        data: expect.objectContaining({ status: BookingStatus.COMPLETED }),
      }),
    );
  });

  it('continues iterating when one org fails', async () => {
    const prisma = buildPrisma(['org-1', 'org-2', 'org-3']);
    let calls = 0;
    prisma.booking.updateMany = jest.fn().mockImplementation(() => {
      calls += 1;
      if (calls === 2) throw new Error('boom');
      return { count: 0 };
    });
    const cron = new BookingAutocompleteCron(
      prisma as never,
      buildSettingsHandler() as never,
      buildCls() as never,
    );
    await expect(cron.execute()).resolves.not.toThrow();
    expect(prisma.booking.updateMany).toHaveBeenCalledTimes(3);
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
    const cron = new AppointmentRemindersCron(prisma as never, buildCls() as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('lists active orgs and checks waitlist per org', async () => {
    const prisma = buildPrisma(['org-1', 'org-2']);
    prisma.waitlistEntry.findMany = jest.fn().mockResolvedValue([{ id: 'w-1' }, { id: 'w-2' }]);
    const cron = new AppointmentRemindersCron(prisma as never, buildCls() as never);
    await cron.execute();
    expect(prisma.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { suspendedAt: null } }),
    );
    expect(prisma.waitlistEntry.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.waitlistEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'WAITING' }),
        take: 50,
      }),
    );
  });

  it('continues iterating when one org fails', async () => {
    const prisma = buildPrisma(['org-1', 'org-2', 'org-3']);
    let calls = 0;
    prisma.waitlistEntry.findMany = jest.fn().mockImplementation(() => {
      calls += 1;
      if (calls === 2) throw new Error('boom');
      return [];
    });
    const cron = new AppointmentRemindersCron(prisma as never, buildCls() as never);
    await expect(cron.execute()).resolves.not.toThrow();
    expect(prisma.waitlistEntry.findMany).toHaveBeenCalledTimes(3);
  });
});