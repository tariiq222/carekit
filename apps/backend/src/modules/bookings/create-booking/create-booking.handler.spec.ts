import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateBookingHandler } from './create-booking.handler';
import { DEFAULT_BOOKING_SETTINGS } from '../get-booking-settings/get-booking-settings.handler';

const buildSettingsHandler = (overrides = {}) => ({
  execute: jest.fn().mockResolvedValue({ ...DEFAULT_BOOKING_SETTINGS, ...overrides }),
});

const futureDate = new Date(Date.now() + 86400_000);

const mockBooking = {
  id: 'book-1', tenantId: 'tenant-1', branchId: 'branch-1',
  clientId: 'client-1', employeeId: 'emp-1', serviceId: 'svc-1',
  scheduledAt: futureDate, durationMins: 60, price: 200,
  currency: 'SAR', status: 'PENDING',
};

const mockService = {
  id: 'svc-1', tenantId: 'tenant-1', durationMins: 60, price: 200, currency: 'SAR',
};

const buildPrisma = () => {
  const prisma = {
    booking: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockBooking),
    },
    branch: {
      findFirst: jest.fn().mockResolvedValue({ id: 'branch-1' }),
    },
    client: {
      findFirst: jest.fn().mockResolvedValue({ id: 'client-1' }),
    },
    service: {
      findFirst: jest.fn().mockResolvedValue(mockService),
    },
    employee: {
      findFirst: jest.fn().mockResolvedValue({ id: 'emp-1' }),
    },
    employeeService: {
      findUnique: jest.fn().mockResolvedValue({ id: 'es-1', employeeId: 'emp-1', serviceId: 'svc-1' }),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction = jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb(prisma));
  return prisma;
};

const buildPriceResolver = () => ({
  resolve: jest.fn().mockResolvedValue({
    price: 200, durationMins: 60, durationOptionId: '', currency: 'SAR', isEmployeeOverride: false,
  }),
});

const dto = {
  tenantId: 'tenant-1', branchId: 'branch-1', clientId: 'client-1',
  employeeId: 'emp-1', serviceId: 'svc-1',
  scheduledAt: futureDate,
};

describe('CreateBookingHandler', () => {
  it('creates booking with price and duration derived from Service', async () => {
    const prisma = buildPrisma();
    const result = await new CreateBookingHandler(prisma as never, buildPriceResolver() as never, buildSettingsHandler() as never).execute(dto);
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING', employeeId: 'emp-1' }) }),
    );
    expect(result.id).toBe('book-1');
  });

  it('throws ConflictException when employee has overlapping booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(mockBooking);
    await expect(new CreateBookingHandler(prisma as never, buildPriceResolver() as never, buildSettingsHandler() as never).execute(dto)).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException when scheduledAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 86400_000);
    await expect(
      new CreateBookingHandler(buildPrisma() as never, buildPriceResolver() as never, buildSettingsHandler() as never).execute({ ...dto, scheduledAt: pastDate }),
    ).rejects.toThrow(BadRequestException);
  });

  it('defaults currency to SAR and type to INDIVIDUAL from Service', async () => {
    const prisma = buildPrisma();
    await new CreateBookingHandler(prisma as never, buildPriceResolver() as never, buildSettingsHandler() as never).execute(dto);
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currency: 'SAR', bookingType: 'INDIVIDUAL' }) }),
    );
  });

  it('throws NotFoundException when branch belongs to different tenant', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(null);
    await expect(new CreateBookingHandler(prisma as never, buildPriceResolver() as never, buildSettingsHandler() as never).execute(dto)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when client belongs to different tenant', async () => {
    const prisma = buildPrisma();
    prisma.client.findFirst = jest.fn().mockResolvedValue(null);
    await expect(new CreateBookingHandler(prisma as never, buildPriceResolver() as never, buildSettingsHandler() as never).execute(dto)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when service does not exist or belongs to different tenant', async () => {
    const prisma = buildPrisma();
    prisma.service.findFirst = jest.fn().mockResolvedValue(null);
    await expect(new CreateBookingHandler(prisma as never, buildPriceResolver() as never, buildSettingsHandler() as never).execute(dto)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when employee does not exist or belongs to different tenant', async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst = jest.fn().mockResolvedValue(null);
    await expect(new CreateBookingHandler(prisma as never, buildPriceResolver() as never, buildSettingsHandler() as never).execute(dto)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when employee does not provide the service', async () => {
    const prisma = buildPrisma();
    prisma.employeeService.findUnique = jest.fn().mockResolvedValue(null);
    await expect(new CreateBookingHandler(prisma as never, buildPriceResolver() as never, buildSettingsHandler() as never).execute(dto)).rejects.toThrow(BadRequestException);
  });
});

describe('CreateBookingHandler — validation guards', () => {
  it('throws BadRequestException for past scheduledAt', async () => {
    const prisma = buildPrisma();
    const priceResolver = { resolve: jest.fn().mockResolvedValue({ price: 200, durationMins: 60, durationOptionId: 'opt-1', currency: 'SAR', isEmployeeOverride: false }) };
    const settings = { execute: jest.fn().mockResolvedValue({ maxAdvanceBookingDays: 60, payAtClinicEnabled: false }) };
    const handler = new CreateBookingHandler(prisma as never, priceResolver as never, settings as never);

    await expect(handler.execute({
      tenantId: 'tenant-1',
      scheduledAt: new Date(Date.now() - 86400_000),
      clientId: 'c-1', employeeId: 'e-1', serviceId: 'svc-1',
      branchId: 'branch-1', durationMins: 60, bookingType: 'INDIVIDUAL' as never,
    })).rejects.toThrow('future');
  });

  it('throws NotFoundException when branch not found', async () => {
    const prisma = buildPrisma();
    prisma.branch = { findFirst: jest.fn().mockResolvedValue(null) };
    const priceResolver = { resolve: jest.fn() };
    const settings = { execute: jest.fn().mockResolvedValue({ payAtClinicEnabled: false }) };
    const handler = new CreateBookingHandler(prisma as never, priceResolver as never, settings as never);

    await expect(handler.execute({
      tenantId: 'tenant-1',
      scheduledAt: new Date(Date.now() + 86400_000),
      clientId: 'c-1', employeeId: 'e-1', serviceId: 'svc-1',
      branchId: 'bad-branch', durationMins: 60, bookingType: 'INDIVIDUAL' as never,
    })).rejects.toThrow('Branch not found');
  });

  it('throws NotFoundException when client not found', async () => {
    const prisma = buildPrisma();
    prisma.branch = { findFirst: jest.fn().mockResolvedValue({ id: 'branch-1' }) };
    prisma.client = { findFirst: jest.fn().mockResolvedValue(null) };
    const priceResolver = { resolve: jest.fn() };
    const settings = { execute: jest.fn().mockResolvedValue({ payAtClinicEnabled: false }) };
    const handler = new CreateBookingHandler(prisma as never, priceResolver as never, settings as never);

    await expect(handler.execute({
      tenantId: 'tenant-1',
      scheduledAt: new Date(Date.now() + 86400_000),
      clientId: 'bad-client', employeeId: 'e-1', serviceId: 'svc-1',
      branchId: 'branch-1', durationMins: 60, bookingType: 'INDIVIDUAL' as never,
    })).rejects.toThrow('Client not found');
  });

  it('throws BadRequestException when pay-at-clinic is disabled', async () => {
    const prisma = buildPrisma();
    const settings = { execute: jest.fn().mockResolvedValue({ payAtClinicEnabled: false }) };
    const handler = new CreateBookingHandler(prisma as never, { resolve: jest.fn() } as never, settings as never);

    await expect(handler.execute({
      tenantId: 'tenant-1',
      scheduledAt: new Date(Date.now() + 86400_000),
      clientId: 'c-1', employeeId: 'e-1', serviceId: 'svc-1',
      branchId: 'branch-1', durationMins: 60, bookingType: 'INDIVIDUAL' as never,
      payAtClinic: true,
    })).rejects.toThrow('Pay at clinic');
  });
});
