import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SetBusinessHoursHandler } from './set-business-hours.handler';
import { GetBusinessHoursHandler } from './get-business-hours.handler';
import { AddHolidayHandler } from './add-holiday.handler';
import { RemoveHolidayHandler } from './remove-holiday.handler';
import { ListHolidaysHandler } from './list-holidays.handler';

const mockBranch = { id: 'branch-1', tenantId: 'tenant-1' };
const mockHour = { id: 'hour-1', tenantId: 'tenant-1', branchId: 'branch-1', dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isOpen: true };
const mockHoliday = { id: 'hol-1', tenantId: 'tenant-1', branchId: 'branch-1', date: new Date('2026-01-01'), nameAr: 'رأس السنة', nameEn: null };

const schedule = [{ dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isOpen: true }];

const buildPrisma = () => ({
  branch: { findFirst: jest.fn().mockResolvedValue(mockBranch) },
  businessHour: {
    upsert: jest.fn().mockResolvedValue(mockHour),
    findMany: jest.fn().mockResolvedValue([mockHour]),
  },
  holiday: {
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(mockHoliday),
    findMany: jest.fn().mockResolvedValue([mockHoliday]),
    delete: jest.fn().mockResolvedValue(mockHoliday),
  },
  $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
});

describe('SetBusinessHoursHandler', () => {
  it('upserts schedule and returns hours', async () => {
    const prisma = buildPrisma();
    const handler = new SetBusinessHoursHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', branchId: 'branch-1', schedule });
    expect(result).toEqual([mockHour]);
  });

  it('throws NotFoundException when branch not found', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new SetBusinessHoursHandler(prisma as never);
    await expect(handler.execute({ tenantId: 'tenant-1', branchId: 'missing', schedule })).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for invalid dayOfWeek', async () => {
    const prisma = buildPrisma();
    const handler = new SetBusinessHoursHandler(prisma as never);
    await expect(
      handler.execute({ tenantId: 'tenant-1', branchId: 'branch-1', schedule: [{ dayOfWeek: 9, startTime: '09:00', endTime: '17:00', isOpen: true }] }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('GetBusinessHoursHandler', () => {
  it('returns hours for branch', async () => {
    const prisma = buildPrisma();
    const handler = new GetBusinessHoursHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', branchId: 'branch-1' });
    expect(result).toEqual([mockHour]);
  });

  it('throws NotFoundException when branch not found', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new GetBusinessHoursHandler(prisma as never);
    await expect(handler.execute({ tenantId: 'tenant-1', branchId: 'missing' })).rejects.toThrow(NotFoundException);
  });
});

describe('AddHolidayHandler', () => {
  it('creates holiday', async () => {
    const prisma = buildPrisma();
    const handler = new AddHolidayHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', branchId: 'branch-1', date: '2026-01-01', nameAr: 'رأس السنة' });
    expect(result.id).toBe('hol-1');
  });

  it('throws ConflictException when holiday exists on same date', async () => {
    const prisma = buildPrisma();
    prisma.holiday.findUnique = jest.fn().mockResolvedValue(mockHoliday);
    const handler = new AddHolidayHandler(prisma as never);
    await expect(
      handler.execute({ tenantId: 'tenant-1', branchId: 'branch-1', date: '2026-01-01', nameAr: 'رأس السنة' }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('RemoveHolidayHandler', () => {
  it('deletes holiday when found', async () => {
    const prisma = buildPrisma();
    prisma.holiday.findFirst = jest.fn().mockResolvedValue(mockHoliday);
    const handler = new RemoveHolidayHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', holidayId: 'hol-1' });
    expect(result.deleted).toBe(true);
  });

  it('throws NotFoundException when holiday not found', async () => {
    const prisma = buildPrisma();
    const handler = new RemoveHolidayHandler(prisma as never);
    await expect(handler.execute({ tenantId: 'tenant-1', holidayId: 'missing' })).rejects.toThrow(NotFoundException);
  });
});

describe('ListHolidaysHandler', () => {
  it('returns holidays for branch', async () => {
    const prisma = buildPrisma();
    const handler = new ListHolidaysHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', branchId: 'branch-1' });
    expect(result).toHaveLength(1);
  });
});
