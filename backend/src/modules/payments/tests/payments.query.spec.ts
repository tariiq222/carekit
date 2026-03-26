/**
 * PaymentsService — Query Tests
 * Covers: findAll (pagination + filters), findOne, findPaymentByBooking, getPaymentStats
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PaymentsService } from '../payments.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { MoyasarPaymentService } from '../moyasar-payment.service.js';
import { BankTransferService } from '../bank-transfer.service.js';
import { BookingStatusService } from '../../bookings/booking-status.service.js';
import {
  createMockPrisma,
  createMockMoyasarService,
  createMockBankTransferService,
  mockPayment,
  mockPaymentId,
  mockBookingId,
} from './payments.fixtures.js';

const mockBookingStatusService = { confirm: jest.fn().mockResolvedValue(undefined) };

async function createModule(mockPrisma: ReturnType<typeof createMockPrisma>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PaymentsService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: MoyasarPaymentService, useValue: createMockMoyasarService() },
      { provide: BankTransferService, useValue: createMockBankTransferService() },
      { provide: BookingStatusService, useValue: mockBookingStatusService },
    ],
  }).compile();
  return module.get<PaymentsService>(PaymentsService);
}

describe('PaymentsService — findAll', () => {
  let service: PaymentsService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should return paginated results with default page=1, perPage=20', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([mockPayment]);
    mockPrisma.payment.count.mockResolvedValue(1);

    const result = await service.findAll({});

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('meta');
    expect(result.meta).toMatchObject({ page: 1, perPage: 20, total: 1 });
  });

  it('should apply pagination correctly', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.payment.count.mockResolvedValue(50);

    const result = await service.findAll({ page: 3, perPage: 10 });

    expect(result.meta.page).toBe(3);
    expect(result.meta.totalPages).toBe(5);
    expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it.each([
    [{ status: 'pending' }, { status: 'pending' }],
    [{ method: 'bank_transfer' }, { method: 'bank_transfer' }],
    [
      { dateFrom: '2026-01-01', dateTo: '2026-03-31' },
      { createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }) },
    ],
  ])('should filter by %o', async (filter, expectedWhere) => {
    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.payment.count.mockResolvedValue(0);

    await service.findAll(filter);

    expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining(expectedWhere) }),
    );
  });

  it('should include booking relations', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([mockPayment]);
    mockPrisma.payment.count.mockResolvedValue(1);

    await service.findAll({});

    expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.objectContaining({ booking: expect.anything() }) }),
    );
  });
});

describe('PaymentsService — findOne', () => {
  let service: PaymentsService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should return a payment with its relations', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

    const result = await service.findOne(mockPaymentId);

    expect(result.id).toBe(mockPaymentId);
  });

  it('should throw NotFoundException for non-existent payment', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(null);

    await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
  });

  it('should query with deletedAt: null filter', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

    await service.findOne(mockPaymentId);

    expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mockPaymentId, deletedAt: null } }),
    );
  });
});

describe('PaymentsService — findPaymentByBooking', () => {
  let service: PaymentsService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should return payment for a booking', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

    const result = await service.findPaymentByBooking(mockBookingId);

    expect(result.bookingId).toBe(mockBookingId);
    expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { bookingId: mockBookingId } }),
    );
  });

  it('should throw NotFoundException if no payment exists for booking', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(null);

    await expect(service.findPaymentByBooking('non-existent-id')).rejects.toThrow(NotFoundException);
  });
});

describe('PaymentsService — getPaymentStats', () => {
  let service: PaymentsService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma);
    jest.clearAllMocks();
  });

  it('should return correct stats structure', async () => {
    mockPrisma.payment.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(5);
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { totalAmount: 900000 } });

    const result = await service.getPaymentStats();

    expect(result).toMatchObject({ total: 100, paid: 60, pending: 25, failed: 10, refunded: 5, totalRevenue: 900000 });
  });

  it('should return 0 totalRevenue when no paid payments', async () => {
    mockPrisma.payment.count
      .mockResolvedValueOnce(5).mockResolvedValueOnce(0)
      .mockResolvedValueOnce(5).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { totalAmount: null } });

    const result = await service.getPaymentStats();

    expect(result.totalRevenue).toBe(0);
  });

  it('should aggregate totalRevenue only from paid payments', async () => {
    mockPrisma.payment.count
      .mockResolvedValueOnce(10).mockResolvedValueOnce(8)
      .mockResolvedValueOnce(2).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { totalAmount: 120000 } });

    await service.getPaymentStats();

    expect(mockPrisma.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'paid' }, _sum: { totalAmount: true } }),
    );
  });
});
