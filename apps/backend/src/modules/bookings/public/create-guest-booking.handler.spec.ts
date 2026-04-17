import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateGuestBookingHandler } from './create-guest-booking.handler';
import { PriceResolverService } from '../../org-experience/services/price-resolver.service';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { PrismaService } from '../../../infrastructure/database';
import { ClientGender } from '@prisma/client';

describe('CreateGuestBookingHandler', () => {
  let handler: CreateGuestBookingHandler;

  const mockPrisma = {
    $transaction: jest.fn(),
    branch: { findFirst: jest.fn() },
    employee: { findFirst: jest.fn() },
    service: { findFirst: jest.fn() },
    employeeService: { findUnique: jest.fn() },
    client: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    booking: { create: jest.fn(), findFirst: jest.fn() },
    invoice: { create: jest.fn() },
  };

  const mockPriceResolver = {
    resolve: jest.fn().mockResolvedValue({ price: 100, durationMins: 30, currency: 'SAR', durationOptionId: null }),
  };

  const mockSettingsHandler = {
    execute: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateGuestBookingHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PriceResolverService, useValue: mockPriceResolver },
        { provide: GetBookingSettingsHandler, useValue: mockSettingsHandler },
      ],
    }).compile();

    handler = module.get<CreateGuestBookingHandler>(CreateGuestBookingHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw BadRequestException for past booking time', async () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    await expect(handler.execute({
      serviceId: 'service-1',
      employeeId: 'emp-1',
      branchId: 'branch-1',
      startsAt: pastDate,
      client: { name: 'Test', phone: '+966501234567', email: 'test@example.com' },
      identifier: 'test@example.com',
    })).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException when branch not found', async () => {
    mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
    mockPrisma.branch.findFirst.mockResolvedValue(null);

    const futureDate = new Date(Date.now() + 86400000).toISOString();
    await expect(handler.execute({
      serviceId: 'service-1',
      employeeId: 'emp-1',
      branchId: 'non-existent',
      startsAt: futureDate,
      client: { name: 'Test', phone: '+966501234567', email: 'test@example.com' },
      identifier: 'test@example.com',
    })).rejects.toThrow(NotFoundException);
  });

  it('should create guest booking successfully', async () => {
    const futureDate = new Date(Date.now() + 86400000);

    mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    mockPrisma.service.findFirst.mockResolvedValue({ id: 'service-1' });
    mockPrisma.employeeService.findUnique.mockResolvedValue({ id: 'es-1' });
    mockPrisma.client.findFirst.mockResolvedValue(null);
    mockPrisma.client.create.mockResolvedValue({ id: 'client-1' });
    mockPrisma.booking.create.mockResolvedValue({ id: 'booking-1' });
    mockPrisma.invoice.create.mockResolvedValue({ id: 'invoice-1' });

    mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));

    const result = await handler.execute({
      serviceId: 'service-1',
      employeeId: 'emp-1',
      branchId: 'branch-1',
      startsAt: futureDate.toISOString(),
      client: { name: 'Test', phone: '+966501234567', email: 'test@example.com' },
      identifier: 'test@example.com',
    });

    expect(result).toEqual({ bookingId: 'booking-1', invoiceId: 'invoice-1', totalHalalat: 11500 });
    expect(mockPrisma.client.create).toHaveBeenCalled();
    expect(mockPrisma.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'AWAITING_PAYMENT' }),
    }));
  });
});
