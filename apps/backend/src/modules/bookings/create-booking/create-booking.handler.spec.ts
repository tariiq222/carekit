import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateBookingHandler } from './create-booking.handler';
import { DEFAULT_BOOKING_SETTINGS } from '../get-booking-settings/get-booking-settings.handler';

const mockTenant = { requireOrganizationIdOrDefault: jest.fn().mockReturnValue('00000000-0000-0000-0000-000000000001') };

const buildSettingsHandler = (overrides = {}) => ({
  execute: jest.fn().mockResolvedValue({ ...DEFAULT_BOOKING_SETTINGS, ...overrides }),
});

const futureDate = new Date(Date.now() + 86400_000);

const mockBooking = {
  id: 'book-1', branchId: 'branch-1',
  clientId: 'client-1', employeeId: 'emp-1', serviceId: 'svc-1',
  scheduledAt: futureDate, durationMins: 60, price: 200,
  currency: 'SAR', status: 'PENDING',
};

const mockInvoice = {
  id: 'invoice-1',
};

const mockService = {
  id: 'svc-1', durationMins: 60, price: 200, currency: 'SAR',
};

const buildPrisma = () => {
  const prisma = {
    booking: {
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(mockBooking),
    },
    invoice: {
      create: jest.fn().mockResolvedValue(mockInvoice),
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
  branchId: 'branch-1', clientId: 'client-1',
  employeeId: 'emp-1', serviceId: 'svc-1',
  scheduledAt: futureDate,
};

describe('CreateBookingHandler', () => {
  it('creates booking and invoice with price and duration derived from Service', async () => {
    const prisma = buildPrisma();
    const result = await new CreateBookingHandler(prisma as never, mockTenant as never, buildPriceResolver() as never, buildSettingsHandler() as never, {} as never).execute(dto);
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING', employeeId: 'emp-1' }) }),
    );
    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: '00000000-0000-0000-0000-000000000001',
          bookingId: 'book-1',
          clientId: 'client-1',
          branchId: 'branch-1',
          employeeId: 'emp-1',
          subtotal: 200,
          vatRate: 0.15,
          vatAmt: 30,
          total: 230,
          currency: 'SAR',
          status: 'ISSUED',
        }),
        select: { id: true },
      }),
    );
    expect(result.id).toBe('book-1');
    expect(result.invoiceId).toBe('invoice-1');
  });

  it('does not create an invoice when pay-at-clinic is selected', async () => {
    const prisma = buildPrisma();
    const result = await new CreateBookingHandler(
      prisma as never,
      mockTenant as never,
      buildPriceResolver() as never,
      buildSettingsHandler({ payAtClinicEnabled: true }) as never,
      {} as never,
    ).execute({ ...dto, payAtClinic: true });

    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(result.invoiceId).toBeNull();
  });

  it('does not create an invoice for a pending group session', async () => {
    const prisma = buildPrisma();
    prisma.service.findFirst = jest.fn()
      .mockResolvedValueOnce(mockService)
      .mockResolvedValueOnce({
        id: 'svc-1',
        minParticipants: 2,
        maxParticipants: 5,
        reserveWithoutPayment: true,
      });
    prisma.booking.create = jest.fn().mockResolvedValue({
      ...mockBooking,
      bookingType: 'GROUP',
      status: 'PENDING_GROUP_FILL',
    });

    const result = await new CreateBookingHandler(
      prisma as never,
      mockTenant as never,
      buildPriceResolver() as never,
      buildSettingsHandler() as never,
      { execute: jest.fn().mockResolvedValue(undefined) } as never,
    ).execute(dto);

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING_GROUP_FILL', bookingType: 'GROUP' }) }),
    );
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(result.invoiceId).toBeNull();
  });

  it('throws ConflictException when employee has overlapping booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(mockBooking);
    await expect(new CreateBookingHandler(prisma as never, mockTenant as never, buildPriceResolver() as never, buildSettingsHandler() as never, {} as never).execute(dto)).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException when scheduledAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 86400_000);
    await expect(
      new CreateBookingHandler(buildPrisma() as never, mockTenant as never, buildPriceResolver() as never, buildSettingsHandler() as never, {} as never).execute({ ...dto, scheduledAt: pastDate }),
    ).rejects.toThrow(BadRequestException);
  });

  it('defaults currency to SAR and type to INDIVIDUAL from Service', async () => {
    const prisma = buildPrisma();
    await new CreateBookingHandler(prisma as never, mockTenant as never, buildPriceResolver() as never, buildSettingsHandler() as never, {} as never).execute(dto);
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currency: 'SAR', bookingType: 'INDIVIDUAL' }) }),
    );
  });

  it('accepts mapped bookingType INDIVIDUAL (from in_person)', async () => {
    const prisma = buildPrisma();
    await new CreateBookingHandler(prisma as never, mockTenant as never, buildPriceResolver() as never, buildSettingsHandler() as never, {} as never).execute({
      ...dto,
      bookingType: 'INDIVIDUAL' as any,
    });
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bookingType: 'INDIVIDUAL' }) }),
    );
  });

  it('accepts uppercase passthrough for bookingType (e.g. WALK_IN)', async () => {
    const prisma = buildPrisma();
    await new CreateBookingHandler(prisma as never, mockTenant as never, buildPriceResolver() as never, buildSettingsHandler() as never, {} as never).execute({
      ...dto,
      bookingType: 'WALK_IN' as any,
    });
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bookingType: 'WALK_IN' }) }),
    );
  });

  it('throws NotFoundException when branch not found', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(null);
    await expect(new CreateBookingHandler(prisma as never, mockTenant as never, buildPriceResolver() as never, buildSettingsHandler() as never, {} as never).execute(dto)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when client not found', async () => {
    const prisma = buildPrisma();
    prisma.client.findFirst = jest.fn().mockResolvedValue(null);
    await expect(new CreateBookingHandler(prisma as never, mockTenant as never, buildPriceResolver() as never, buildSettingsHandler() as never, {} as never).execute(dto)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when service does not exist', async () => {
    const prisma = buildPrisma();
    prisma.service.findFirst = jest.fn().mockResolvedValue(null);
    await expect(new CreateBookingHandler(prisma as never, mockTenant as never, buildPriceResolver() as never, buildSettingsHandler() as never, {} as never).execute(dto)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when employee does not exist', async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst = jest.fn().mockResolvedValue(null);
    await expect(new CreateBookingHandler(prisma as never, mockTenant as never, buildPriceResolver() as never, buildSettingsHandler() as never, {} as never).execute(dto)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when employee does not provide the service', async () => {
    const prisma = buildPrisma();
    prisma.employeeService.findUnique = jest.fn().mockResolvedValue(null);
    await expect(new CreateBookingHandler(prisma as never, mockTenant as never, buildPriceResolver() as never, buildSettingsHandler() as never, {} as never).execute(dto)).rejects.toThrow(BadRequestException);
  });
});

describe('CreateBookingHandler — validation guards', () => {
  it('throws BadRequestException for past scheduledAt', async () => {
    const prisma = buildPrisma();
    const priceResolver = { resolve: jest.fn().mockResolvedValue({ price: 200, durationMins: 60, durationOptionId: 'opt-1', currency: 'SAR', isEmployeeOverride: false }) };
    const settings = { execute: jest.fn().mockResolvedValue({ maxAdvanceBookingDays: 60, payAtClinicEnabled: false }) };
    const handler = new CreateBookingHandler(prisma as never, mockTenant as never, priceResolver as never, settings as never, {} as never);

    await expect(handler.execute({
      scheduledAt: new Date(Date.now() - 86400_000),
      clientId: 'c-1', employeeId: 'e-1', serviceId: 'svc-1',
      branchId: 'branch-1', bookingType: 'INDIVIDUAL' as never,
    })).rejects.toThrow('future');
  });

  it('throws NotFoundException when branch not found', async () => {
    const prisma = buildPrisma();
    prisma.branch = { findFirst: jest.fn().mockResolvedValue(null) };
    const priceResolver = { resolve: jest.fn() };
    const settings = { execute: jest.fn().mockResolvedValue({ payAtClinicEnabled: false }) };
    const handler = new CreateBookingHandler(prisma as never, mockTenant as never, priceResolver as never, settings as never, {} as never);

    await expect(handler.execute({
      scheduledAt: new Date(Date.now() + 86400_000),
      clientId: 'c-1', employeeId: 'e-1', serviceId: 'svc-1',
      branchId: 'bad-branch', bookingType: 'INDIVIDUAL' as never,
    })).rejects.toThrow('Branch not found');
  });

  it('throws NotFoundException when client not found', async () => {
    const prisma = buildPrisma();
    prisma.branch = { findFirst: jest.fn().mockResolvedValue({ id: 'branch-1' }) };
    prisma.client = { findFirst: jest.fn().mockResolvedValue(null) };
    const priceResolver = { resolve: jest.fn() };
    const settings = { execute: jest.fn().mockResolvedValue({ payAtClinicEnabled: false }) };
    const handler = new CreateBookingHandler(prisma as never, mockTenant as never, priceResolver as never, settings as never, {} as never);

    await expect(handler.execute({
      scheduledAt: new Date(Date.now() + 86400_000),
      clientId: 'bad-client', employeeId: 'e-1', serviceId: 'svc-1',
      branchId: 'branch-1', bookingType: 'INDIVIDUAL' as never,
    })).rejects.toThrow('Client not found');
  });

  it('throws BadRequestException when pay-at-clinic is disabled', async () => {
    const prisma = buildPrisma();
    const settings = { execute: jest.fn().mockResolvedValue({ payAtClinicEnabled: false }) };
    const handler = new CreateBookingHandler(prisma as never, mockTenant as never, { resolve: jest.fn() } as never, settings as never, {} as never);

    await expect(handler.execute({
      scheduledAt: new Date(Date.now() + 86400_000),
      clientId: 'c-1', employeeId: 'e-1', serviceId: 'svc-1',
      branchId: 'branch-1', bookingType: 'INDIVIDUAL' as never,
      payAtClinic: true,
    })).rejects.toThrow('Pay at clinic');
  });
});
