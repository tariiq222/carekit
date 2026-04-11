import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UpdateAvailabilityHandler } from './update-availability.handler';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

const makeCmd = (overrides = {}) => ({
  employeeId: 'emp-1',
  tenantId: 'tenant-1',
  windows: [
    { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
  ],
  exceptions: [],
  ...overrides,
});

describe('UpdateAvailabilityHandler', () => {
  let handler: UpdateAvailabilityHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      employee: { findUnique: jest.fn() },
      employeeAvailability: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
      employeeAvailabilityException: { upsert: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateAvailabilityHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(UpdateAvailabilityHandler);
  });

  it('throws NotFoundException when employee does not exist', async () => {
    prisma.employee.findUnique.mockResolvedValue(null);
    await expect(handler.execute(makeCmd())).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when tenant does not match', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1', tenantId: 'other-tenant' });
    await expect(handler.execute(makeCmd())).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for invalid dayOfWeek', async () => {
    await expect(handler.execute(makeCmd({ windows: [{ dayOfWeek: 7, startTime: '09:00', endTime: '17:00' }] }))).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when startTime is not before endTime', async () => {
    await expect(handler.execute(makeCmd({ windows: [{ dayOfWeek: 1, startTime: '17:00', endTime: '09:00' }] }))).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for duplicate dayOfWeek', async () => {
    await expect(
      handler.execute(makeCmd({ windows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }, { dayOfWeek: 1, startTime: '13:00', endTime: '17:00' }] })),
    ).rejects.toThrow(BadRequestException);
  });

  it('deletes existing windows and creates new ones', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1', tenantId: 'tenant-1' });
    prisma.employeeAvailability.deleteMany.mockResolvedValue({ count: 3 });
    prisma.employeeAvailability.createMany.mockResolvedValue({ count: 2 });
    const windowRows = [
      { id: 'w1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { id: 'w2', dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
    ];
    prisma.employeeAvailability.findMany.mockResolvedValue(windowRows);

    const result = await handler.execute(makeCmd());

    expect(prisma.employeeAvailability.deleteMany).toHaveBeenCalledWith({
      where: { employeeId: 'emp-1' },
    });
    expect(prisma.employeeAvailability.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ dayOfWeek: 1, tenantId: 'tenant-1', employeeId: 'emp-1' }),
      ]),
    });
    expect(result.windows).toEqual(windowRows);
    expect(result.exceptions).toEqual([]);
  });

  it('upserts exceptions when provided', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1', tenantId: 'tenant-1' });
    prisma.employeeAvailability.deleteMany.mockResolvedValue({ count: 0 });
    prisma.employeeAvailability.createMany.mockResolvedValue({ count: 0 });
    prisma.employeeAvailability.findMany.mockResolvedValue([]);
    const exceptionRow = { id: 'ex-1', date: new Date('2026-04-15'), isOff: true };
    prisma.employeeAvailabilityException.upsert.mockResolvedValue(exceptionRow);

    const result = await handler.execute(
      makeCmd({
        windows: [],
        exceptions: [{ date: '2026-04-15', isOff: true, reason: 'holiday' }],
      }),
    );

    expect(prisma.employeeAvailabilityException.upsert).toHaveBeenCalledTimes(1);
    expect(result.exceptions).toEqual([exceptionRow]);
  });

  it('handles empty exceptions array without calling upsert', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1', tenantId: 'tenant-1' });
    prisma.employeeAvailability.deleteMany.mockResolvedValue({ count: 0 });
    prisma.employeeAvailability.createMany.mockResolvedValue({ count: 0 });
    prisma.employeeAvailability.findMany.mockResolvedValue([]);

    await handler.execute(makeCmd({ windows: [], exceptions: [] }));

    expect(prisma.employeeAvailabilityException.upsert).not.toHaveBeenCalled();
  });
});
