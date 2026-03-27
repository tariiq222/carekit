/**
 * PaymentsService — Create & Status Tests
 * Covers: createPayment, updateStatus, createMoyasarPayment, handleMoyasarWebhook
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentsService } from '../../../src/modules/payments/payments.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { MoyasarPaymentService } from '../../../src/modules/payments/moyasar-payment.service.js';
import { BankTransferService } from '../../../src/modules/payments/bank-transfer.service.js';
import { BookingStatusService } from '../../../src/modules/bookings/booking-status.service.js';
import {
  createMockPrisma,
  createMockMoyasarService,
  createMockBankTransferService,
  mockBooking,
  mockPayment,
  mockPaymentId,
  mockBookingId,
  mockUserId,
} from './payments.fixtures.js';

const mockBookingStatusService = { confirm: jest.fn().mockResolvedValue(undefined) };

async function createModule(
  mockPrisma: ReturnType<typeof createMockPrisma>,
  mockMoyasar: ReturnType<typeof createMockMoyasarService>,
  mockBankTransfer: ReturnType<typeof createMockBankTransferService>,
) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PaymentsService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: MoyasarPaymentService, useValue: mockMoyasar },
      { provide: BankTransferService, useValue: mockBankTransfer },
      { provide: BookingStatusService, useValue: mockBookingStatusService },
    ],
  }).compile();
  return module.get<PaymentsService>(PaymentsService);
}

describe('PaymentsService — createPayment', () => {
  let service: PaymentsService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  const createDto = { bookingId: mockBookingId, amount: 15000, method: 'bank_transfer' as const };

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma, createMockMoyasarService(), createMockBankTransferService());
    jest.clearAllMocks();
  });

  it('should create a payment with status pending', async () => {
    mockPrisma.booking.findFirst.mockResolvedValue(mockBooking);
    mockPrisma.payment.findUnique.mockResolvedValue(null);
    mockPrisma.payment.create.mockResolvedValue(mockPayment);

    const result = await service.createPayment(createDto);

    expect(result.id).toBe(mockPaymentId);
    expect(mockPrisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: mockBookingId,
          amount: 15000,
          method: 'bank_transfer',
          status: 'pending',
        }),
      }),
    );
  });

  it('should throw NotFoundException if booking not found', async () => {
    mockPrisma.booking.findFirst.mockResolvedValue(null);

    await expect(service.createPayment(createDto)).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if payment already exists', async () => {
    mockPrisma.booking.findFirst.mockResolvedValue(mockBooking);
    mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

    await expect(service.createPayment(createDto)).rejects.toThrow(BadRequestException);
  });
});

describe('PaymentsService — updateStatus', () => {
  let service: PaymentsService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    service = await createModule(mockPrisma, createMockMoyasarService(), createMockBankTransferService());
    jest.clearAllMocks();
  });

  it('should update the payment status', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
    mockPrisma.payment.update.mockResolvedValue({ ...mockPayment, status: 'paid' });

    const result = await service.updateStatus(mockPaymentId, { status: 'paid' });

    expect(result.status).toBe('paid');
  });

  it('should throw NotFoundException if payment not found', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(null);

    await expect(service.updateStatus('non-existent-id', { status: 'paid' })).rejects.toThrow(NotFoundException);
  });
});

describe('PaymentsService — createMoyasarPayment', () => {
  let service: PaymentsService;
  let mockMoyasar: ReturnType<typeof createMockMoyasarService>;

  const createMoyasarDto = {
    bookingId: mockBookingId,
    source: { type: 'creditcard', number: '4111111111111111', name: 'Test User', cvc: '123', month: '12', year: '2030' },
  };

  beforeEach(async () => {
    mockMoyasar = createMockMoyasarService();
    service = await createModule(createMockPrisma(), mockMoyasar, createMockBankTransferService());
    jest.clearAllMocks();
  });

  it('should delegate to MoyasarPaymentService and return payment + redirectUrl', async () => {
    const moyasarResult = {
      payment: { ...mockPayment, method: 'moyasar', moyasarPaymentId: 'moyasar-id-abc' },
      redirectUrl: 'https://checkout.moyasar.com/pay/abc',
    };
    mockMoyasar.createMoyasarPayment.mockResolvedValue(moyasarResult);

    const result = await service.createMoyasarPayment(mockUserId, createMoyasarDto);

    expect(mockMoyasar.createMoyasarPayment).toHaveBeenCalledWith(mockUserId, createMoyasarDto);
    expect(result).toHaveProperty('payment');
    expect(result.redirectUrl).toBe('https://checkout.moyasar.com/pay/abc');
  });

  it.each([
    ['NotFoundException', NotFoundException, 'Booking not found'],
    ['BadRequestException', BadRequestException, 'Payment already exists'],
  ])('should propagate %s from MoyasarPaymentService', async (_label, Exception, message) => {
    mockMoyasar.createMoyasarPayment.mockRejectedValue(new Exception(message));

    await expect(service.createMoyasarPayment(mockUserId, createMoyasarDto)).rejects.toThrow(Exception);
  });
});

describe('PaymentsService — handleMoyasarWebhook', () => {
  let service: PaymentsService;
  let mockMoyasar: ReturnType<typeof createMockMoyasarService>;

  const webhookDto = {
    id: 'moyasar-pay-id-001',
    status: 'paid',
    amount: 23000,
    currency: 'SAR',
    description: `Booking #${mockBookingId}`,
    metadata: { bookingId: mockBookingId },
  };

  beforeEach(async () => {
    mockMoyasar = createMockMoyasarService();
    service = await createModule(createMockPrisma(), mockMoyasar, createMockBankTransferService());
    jest.clearAllMocks();
  });

  it('should delegate to MoyasarPaymentService', async () => {
    const rawBody = Buffer.from(JSON.stringify(webhookDto));
    mockMoyasar.handleMoyasarWebhook.mockResolvedValue({ success: true });

    const result = await service.handleMoyasarWebhook('valid-sig', rawBody, webhookDto);

    expect(mockMoyasar.handleMoyasarWebhook).toHaveBeenCalledWith('valid-sig', rawBody, webhookDto);
    expect(result).toEqual({ success: true });
  });

  it('should propagate errors from MoyasarPaymentService', async () => {
    const rawBody = Buffer.from(JSON.stringify(webhookDto));
    mockMoyasar.handleMoyasarWebhook.mockRejectedValue(new BadRequestException('Invalid signature'));

    await expect(
      service.handleMoyasarWebhook('invalid-sig', rawBody, webhookDto),
    ).rejects.toThrow(BadRequestException);
  });
});
