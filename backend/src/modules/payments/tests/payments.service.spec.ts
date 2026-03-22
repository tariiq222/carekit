/**
 * CareKit — PaymentsService Unit Tests
 *
 * Tests the PaymentsService business logic in isolation:
 *   - findAll returns paginated results
 *   - findOne throws NotFoundException for invalid id
 *   - createPayment throws if booking not found
 *   - createPayment throws if payment already exists for booking
 *   - uploadReceipt throws if payment method is not bank_transfer
 *   - reviewReceipt sets payment to paid when approved=true
 *   - getPaymentStats returns correct structure
 *   - createMoyasarPayment mocks fetch, verifies Moyasar API called, Payment record created
 *   - handleMoyasarWebhook invalid signature throws UnauthorizedException, valid 'paid' webhook updates status
 *   - uploadBankTransferReceipt mocks MinioService, creates payment + receipt
 *   - verifyBankTransfer approve sets status to 'paid', reject sets 'rejected'
 *
 * PrismaService, MinioService, InvoicesService, and ConfigService are mocked
 * so tests run without external services.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PaymentsService } from '../payments.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { MinioService } from '../../../common/services/minio.service.js';
import { InvoiceCreatorService } from '../../invoices/invoice-creator.service.js';

// ---------------------------------------------------------------------------
// Mock PrismaService
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaService: any = {
  payment: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
  },
  booking: {
    findFirst: jest.fn(),
  },
  bankTransferReceipt: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Mock MinioService
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMinioService: any = {
  uploadFile: jest.fn(),
  ensureBucket: jest.fn(),
};

// ---------------------------------------------------------------------------
// Mock InvoicesService
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockInvoicesService: any = {
  createInvoice: jest.fn(),
};

// ---------------------------------------------------------------------------
// Mock ConfigService
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockConfigService: any = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const values: Record<string, string> = {
      MOYASAR_API_KEY: 'sk_test_mock_key',
      MOYASAR_WEBHOOK_SECRET: 'webhook_secret_mock',
      BACKEND_URL: 'http://localhost:3000',
      MINIO_ENDPOINT: 'localhost',
      MINIO_PORT: '9000',
      MINIO_USE_SSL: 'false',
      MINIO_ACCESS_KEY: 'minioadmin',
      MINIO_SECRET_KEY: 'minioadmin',
    };
    return values[key] ?? defaultValue;
  }),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockBookingId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const mockPaymentId = 'b2c3d4e5-f6a7-8901-bcde-f01234567891';
const mockReceiptId = 'c3d4e5f6-a7b8-9012-cdef-012345678902';
const mockReviewerId = 'd4e5f6a7-b8c9-0123-defa-123456789013';
const mockUserId = 'e5f6a7b8-c9d0-1234-efab-234567890124';

const mockBooking = {
  id: mockBookingId,
  patientId: mockUserId,
  practitionerId: 'practitioner-uuid-1',
  serviceId: 'service-uuid-1',
  type: 'clinic_visit',
  status: 'confirmed',
  deletedAt: null,
  practitioner: {
    priceClinic: 20000,
    pricePhone: 15000,
    priceVideo: 18000,
  },
  service: {
    price: 10000,
  },
};

const mockPayment = {
  id: mockPaymentId,
  bookingId: mockBookingId,
  amount: 15000,
  vatAmount: 0,
  totalAmount: 15000,
  method: 'bank_transfer' as const,
  status: 'pending' as const,
  moyasarPaymentId: null,
  transactionRef: null,
  createdAt: new Date('2026-03-20'),
  updatedAt: new Date('2026-03-20'),
  booking: {
    id: mockBookingId,
    patient: {
      id: mockUserId,
      firstName: 'أحمد',
      lastName: 'الراشد',
      email: 'ahmed@example.com',
      phone: null,
    },
    practitioner: {
      id: 'practitioner-uuid-1',
      user: { id: 'user-uuid-1', firstName: 'خالد', lastName: 'الفهد' },
      specialty: { nameEn: 'Cardiology', nameAr: 'أمراض القلب' },
    },
  },
  receipt: null,
  invoice: null,
};

const mockMoyasarPayment = {
  ...mockPayment,
  method: 'moyasar' as const,
  moyasarPaymentId: 'moyasar-pay-id-001',
  status: 'paid' as const,
};

const mockReceipt = {
  id: mockReceiptId,
  paymentId: mockPaymentId,
  receiptUrl: 'https://example.com/receipt.jpg',
  aiVerificationStatus: 'pending' as const,
  aiConfidence: null,
  aiNotes: null,
  extractedAmount: null,
  extractedDate: null,
  reviewedById: null,
  reviewedAt: null,
  adminNotes: null,
  createdAt: new Date('2026-03-20'),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MinioService, useValue: mockMinioService },
        { provide: InvoiceCreatorService, useValue: mockInvoicesService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);

    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // findAll — Paginated Payments
  // ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated results with default page=1, perPage=20', async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
      mockPrismaService.payment.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toMatchObject({
        page: 1,
        perPage: 20,
        total: 1,
      });
    });

    it('should apply pagination correctly', async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([]);
      mockPrismaService.payment.count.mockResolvedValue(50);

      const result = await service.findAll({ page: 3, perPage: 10 });

      expect(result.meta.page).toBe(3);
      expect(result.meta.totalPages).toBe(5);
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
      mockPrismaService.payment.count.mockResolvedValue(1);

      await service.findAll({ status: 'pending' });

      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'pending',
          }),
        }),
      );
    });

    it('should filter by method', async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([]);
      mockPrismaService.payment.count.mockResolvedValue(0);

      await service.findAll({ method: 'bank_transfer' });

      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            method: 'bank_transfer',
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([]);
      mockPrismaService.payment.count.mockResolvedValue(0);

      await service.findAll({ dateFrom: '2026-01-01', dateTo: '2026-03-31' });

      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should include booking with patient and practitioner', async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
      mockPrismaService.payment.count.mockResolvedValue(1);

      await service.findAll({});

      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            booking: expect.anything(),
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne — Get Payment by ID
  // ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a payment with its relations', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

      const result = await service.findOne(mockPaymentId);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockPaymentId);
    });

    it('should throw NotFoundException for non-existent payment', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should call findUnique with correct id', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

      await service.findOne(mockPaymentId);

      expect(mockPrismaService.payment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockPaymentId },
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // createPayment — Create Payment
  // ─────────────────────────────────────────────────────────────

  describe('createPayment', () => {
    const createDto = {
      bookingId: mockBookingId,
      amount: 15000,
      method: 'bank_transfer' as const,
    };

    it('should create a payment for a valid booking', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrismaService.payment.findUnique.mockResolvedValue(null);
      mockPrismaService.payment.create.mockResolvedValue(mockPayment);

      const result = await service.createPayment(createDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockPaymentId);
      expect(mockPrismaService.payment.create).toHaveBeenCalledWith(
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
      mockPrismaService.booking.findFirst.mockResolvedValue(null);

      await expect(service.createPayment(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if payment already exists for booking', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

      await expect(service.createPayment(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should set initial status to pending', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrismaService.payment.findUnique.mockResolvedValue(null);
      mockPrismaService.payment.create.mockResolvedValue(mockPayment);

      await service.createPayment(createDto);

      expect(mockPrismaService.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending',
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // updateStatus — Update Payment Status
  // ─────────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update the payment status', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'paid',
      });

      const result = await service.updateStatus(mockPaymentId, {
        status: 'paid',
      });

      expect(result.status).toBe('paid');
    });

    it('should throw NotFoundException if payment not found', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('non-existent-id', { status: 'paid' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // uploadReceipt — Upload Bank Transfer Receipt (legacy)
  // ─────────────────────────────────────────────────────────────

  describe('uploadReceipt', () => {
    const uploadDto = { receiptUrl: 'https://example.com/receipt.jpg' };

    it('should create a receipt for a bank_transfer payment', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment); // method: bank_transfer
      mockPrismaService.bankTransferReceipt.create.mockResolvedValue(
        mockReceipt,
      );

      const result = await service.uploadReceipt(mockPaymentId, uploadDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockReceiptId);
      expect(
        mockPrismaService.bankTransferReceipt.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentId: mockPaymentId,
            receiptUrl: uploadDto.receiptUrl,
            aiVerificationStatus: 'pending',
          }),
        }),
      );
    });

    it('should throw BadRequestException if payment method is not bank_transfer', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(
        mockMoyasarPayment,
      ); // method: moyasar

      await expect(
        service.uploadReceipt(mockPaymentId, uploadDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if payment not found', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadReceipt('non-existent-id', uploadDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // reviewReceipt — Admin Reviews Receipt (legacy)
  // ─────────────────────────────────────────────────────────────

  describe('reviewReceipt', () => {
    it('should approve receipt and set payment status to paid', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue(
        mockReceipt,
      );
      mockPrismaService.bankTransferReceipt.update.mockResolvedValue({
        ...mockReceipt,
        aiVerificationStatus: 'approved',
        reviewedById: mockReviewerId,
        reviewedAt: new Date(),
        adminNotes: 'Looks good',
      });
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'paid',
      });

      const result = await service.reviewReceipt(mockReceiptId, mockReviewerId, {
        approved: true,
        adminNotes: 'Looks good',
      });

      expect(result.aiVerificationStatus).toBe('approved');
      expect(
        mockPrismaService.bankTransferReceipt.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockReceiptId },
          data: expect.objectContaining({
            aiVerificationStatus: 'approved',
            reviewedById: mockReviewerId,
            reviewedAt: expect.any(Date),
            adminNotes: 'Looks good',
          }),
        }),
      );
      // Payment should be updated to paid
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockPaymentId },
          data: { status: 'paid' },
        }),
      );
    });

    it('should reject receipt and NOT set payment to paid', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue(
        mockReceipt,
      );
      mockPrismaService.bankTransferReceipt.update.mockResolvedValue({
        ...mockReceipt,
        aiVerificationStatus: 'rejected',
        reviewedById: mockReviewerId,
        reviewedAt: new Date(),
        adminNotes: 'Amount mismatch',
      });

      const result = await service.reviewReceipt(mockReceiptId, mockReviewerId, {
        approved: false,
        adminNotes: 'Amount mismatch',
      });

      expect(result.aiVerificationStatus).toBe('rejected');
      // Payment should NOT be updated when rejected
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if receipt not found', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue(null);

      await expect(
        service.reviewReceipt('non-existent-id', mockReviewerId, {
          approved: true,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findPaymentByBooking — Get Payment by Booking ID
  // ─────────────────────────────────────────────────────────────

  describe('findPaymentByBooking', () => {
    it('should return payment for a booking', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

      const result = await service.findPaymentByBooking(mockBookingId);

      expect(result).toBeDefined();
      expect(result.bookingId).toBe(mockBookingId);
      expect(mockPrismaService.payment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bookingId: mockBookingId },
        }),
      );
    });

    it('should throw NotFoundException if no payment exists for booking', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      await expect(
        service.findPaymentByBooking('non-existent-booking-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getPaymentStats — Payment Statistics
  // ─────────────────────────────────────────────────────────────

  describe('getPaymentStats', () => {
    it('should return correct stats structure', async () => {
      mockPrismaService.payment.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(60)  // paid
        .mockResolvedValueOnce(25)  // pending
        .mockResolvedValueOnce(10)  // failed
        .mockResolvedValueOnce(5);  // refunded
      mockPrismaService.payment.aggregate.mockResolvedValue({
        _sum: { totalAmount: 900000 },
      });

      const result = await service.getPaymentStats();

      expect(result).toMatchObject({
        total: 100,
        paid: 60,
        pending: 25,
        failed: 10,
        refunded: 5,
        totalRevenue: 900000,
      });
    });

    it('should return 0 totalRevenue when no paid payments', async () => {
      mockPrismaService.payment.count
        .mockResolvedValueOnce(5)  // total
        .mockResolvedValueOnce(0)  // paid
        .mockResolvedValueOnce(5)  // pending
        .mockResolvedValueOnce(0)  // failed
        .mockResolvedValueOnce(0); // refunded
      mockPrismaService.payment.aggregate.mockResolvedValue({
        _sum: { totalAmount: null },
      });

      const result = await service.getPaymentStats();

      expect(result.totalRevenue).toBe(0);
    });

    it('should aggregate totalRevenue only from paid payments', async () => {
      mockPrismaService.payment.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrismaService.payment.aggregate.mockResolvedValue({
        _sum: { totalAmount: 120000 },
      });

      await service.getPaymentStats();

      expect(mockPrismaService.payment.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'paid' },
          _sum: { totalAmount: true },
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // createMoyasarPayment — Moyasar Payment Flow
  // ─────────────────────────────────────────────────────────────

  describe('createMoyasarPayment', () => {
    const createMoyasarDto = {
      bookingId: mockBookingId,
      source: {
        type: 'creditcard',
        number: '4111111111111111',
        name: 'Test User',
        cvc: '123',
        month: '12',
        year: '2030',
      },
    };

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should call Moyasar API and create a payment record', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrismaService.payment.findUnique.mockResolvedValue(null);
      mockPrismaService.payment.create.mockResolvedValue({
        ...mockPayment,
        method: 'moyasar',
        moyasarPaymentId: 'moyasar-id-abc',
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'moyasar-id-abc',
          status: 'initiated',
          source: { transaction_url: 'https://checkout.moyasar.com/pay/abc' },
        }),
      });

      const result = await service.createMoyasarPayment(
        mockUserId,
        createMoyasarDto,
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.moyasar.com/v1/payments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic '),
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining(mockBookingId),
        }),
      );

      expect(mockPrismaService.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingId: mockBookingId,
            method: 'moyasar',
            status: 'pending',
            moyasarPaymentId: 'moyasar-id-abc',
          }),
        }),
      );

      expect(result).toHaveProperty('payment');
      expect(result).toHaveProperty('redirectUrl');
      expect(result.redirectUrl).toBe(
        'https://checkout.moyasar.com/pay/abc',
      );
    });

    it('should throw NotFoundException if booking not found', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(null);

      await expect(
        service.createMoyasarPayment(mockUserId, createMoyasarDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if payment already exists', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

      await expect(
        service.createMoyasarPayment(mockUserId, createMoyasarDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when Moyasar API returns error', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid card number' }),
      });

      await expect(
        service.createMoyasarPayment(mockUserId, createMoyasarDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should calculate VAT correctly (15%) for clinic_visit', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        type: 'clinic_visit',
      });
      mockPrismaService.payment.findUnique.mockResolvedValue(null);
      mockPrismaService.payment.create.mockResolvedValue({
        ...mockPayment,
        method: 'moyasar',
        amount: 20000,
        vatAmount: 3000,
        totalAmount: 23000,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'moyasar-id-xyz',
          status: 'initiated',
          source: {},
        }),
      });

      await service.createMoyasarPayment(mockUserId, createMoyasarDto);

      // priceClinic=20000, vat=3000, total=23000
      expect(mockPrismaService.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 20000,
            vatAmount: 3000,
            totalAmount: 23000,
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // handleMoyasarWebhook — Webhook Processing
  // ─────────────────────────────────────────────────────────────

  describe('handleMoyasarWebhook', () => {
    const webhookDto = {
      id: 'moyasar-pay-id-001',
      status: 'paid',
      amount: 23000,
      currency: 'SAR',
      description: `Booking #${mockBookingId}`,
      metadata: { bookingId: mockBookingId },
    };

    const buildSignature = (body: Buffer, secret: string): string =>
      crypto.createHmac('sha256', secret).update(body).digest('hex');

    it('should throw UnauthorizedException for invalid signature', async () => {
      const rawBody = Buffer.from(JSON.stringify(webhookDto));
      const invalidSig = 'invalid-signature-hex';

      await expect(
        service.handleMoyasarWebhook(invalidSig, rawBody, webhookDto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update payment status to paid for valid paid webhook', async () => {
      const rawBody = Buffer.from(JSON.stringify(webhookDto));
      const signature = buildSignature(rawBody, 'webhook_secret_mock');

      mockPrismaService.payment.findFirst.mockResolvedValue({
        ...mockMoyasarPayment,
        status: 'pending',
      });
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockMoyasarPayment,
        status: 'paid',
      });
      mockInvoicesService.createInvoice.mockResolvedValue({ id: 'invoice-1' });

      const result = await service.handleMoyasarWebhook(
        signature,
        rawBody,
        webhookDto,
      );

      expect(mockPrismaService.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockMoyasarPayment.id },
          data: { status: 'paid' },
        }),
      );
      expect(mockInvoicesService.createInvoice).toHaveBeenCalledWith({
        paymentId: mockMoyasarPayment.id,
      });
      expect(result).toEqual({ success: true });
    });

    it('should update payment status to failed for failed webhook', async () => {
      const failedDto = { ...webhookDto, status: 'failed' };
      const rawBody = Buffer.from(JSON.stringify(failedDto));
      const signature = buildSignature(rawBody, 'webhook_secret_mock');

      mockPrismaService.payment.findFirst.mockResolvedValue({
        ...mockMoyasarPayment,
        status: 'pending',
      });
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockMoyasarPayment,
        status: 'failed',
      });

      const result = await service.handleMoyasarWebhook(
        signature,
        rawBody,
        failedDto,
      );

      expect(mockPrismaService.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'failed' },
        }),
      );
      expect(result).toEqual({ success: true });
    });

    it('should return success even if no matching payment found', async () => {
      const rawBody = Buffer.from(JSON.stringify(webhookDto));
      const signature = buildSignature(rawBody, 'webhook_secret_mock');

      mockPrismaService.payment.findFirst.mockResolvedValue(null);

      const result = await service.handleMoyasarWebhook(
        signature,
        rawBody,
        webhookDto,
      );

      expect(result).toEqual({ success: true });
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // uploadBankTransferReceipt — MinIO file upload flow
  // ─────────────────────────────────────────────────────────────

  describe('uploadBankTransferReceipt', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'receipt',
      originalname: 'receipt.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
      size: 15,
      destination: '',
      filename: '',
      path: '',
      stream: null as unknown as NodeJS.ReadableStream,
    };

    it('should upload file to MinIO and create payment + receipt', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrismaService.payment.findUnique.mockResolvedValue(null);
      mockPrismaService.payment.create.mockResolvedValue({
        ...mockPayment,
        method: 'bank_transfer',
        amount: 20000,
        vatAmount: 3000,
        totalAmount: 23000,
      });
      mockPrismaService.bankTransferReceipt.create.mockResolvedValue({
        ...mockReceipt,
        receiptUrl: 'http://localhost:9000/carekit/receipts/uuid.jpg',
      });
      mockMinioService.uploadFile.mockResolvedValue(
        'http://localhost:9000/carekit/receipts/uuid.jpg',
      );

      const result = await service.uploadBankTransferReceipt(
        mockUserId,
        mockBookingId,
        mockFile,
      );

      expect(mockMinioService.uploadFile).toHaveBeenCalledWith(
        'carekit',
        expect.stringMatching(/^receipts\/.+\.jpg$/),
        mockFile.buffer,
        'image/jpeg',
      );
      expect(mockPrismaService.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingId: mockBookingId,
            method: 'bank_transfer',
            status: 'pending',
          }),
        }),
      );
      expect(mockPrismaService.bankTransferReceipt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            receiptUrl: 'http://localhost:9000/carekit/receipts/uuid.jpg',
            aiVerificationStatus: 'pending',
          }),
        }),
      );
      expect(result).toHaveProperty('payment');
      expect(result).toHaveProperty('receipt');
    });

    it('should throw NotFoundException if booking not found', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(null);

      await expect(
        service.uploadBankTransferReceipt(mockUserId, mockBookingId, mockFile),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if payment already exists', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

      await expect(
        service.uploadBankTransferReceipt(mockUserId, mockBookingId, mockFile),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // verifyBankTransfer — Admin approve / reject receipt
  // ─────────────────────────────────────────────────────────────

  describe('verifyBankTransfer', () => {
    it('should approve receipt and set payment status to paid', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue(
        mockReceipt,
      );
      mockPrismaService.bankTransferReceipt.update.mockResolvedValue({
        ...mockReceipt,
        aiVerificationStatus: 'approved',
        reviewedById: mockReviewerId,
        reviewedAt: new Date(),
      });
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'paid',
      });
      mockPrismaService.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        status: 'paid',
      });
      mockInvoicesService.createInvoice.mockResolvedValue({ id: 'invoice-1' });

      const result = await service.verifyBankTransfer(
        mockReceiptId,
        mockReviewerId,
        { action: 'approve', adminNotes: 'Valid receipt' },
      );

      expect(mockPrismaService.bankTransferReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockReceiptId },
          data: expect.objectContaining({
            aiVerificationStatus: 'approved',
            reviewedById: mockReviewerId,
            reviewedAt: expect.any(Date),
            adminNotes: 'Valid receipt',
          }),
        }),
      );
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockPaymentId },
          data: { status: 'paid' },
        }),
      );
      expect(mockInvoicesService.createInvoice).toHaveBeenCalledWith({
        paymentId: mockPaymentId,
      });
      expect(result).toBeDefined();
    });

    it('should reject receipt and NOT update payment to paid', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue(
        mockReceipt,
      );
      mockPrismaService.bankTransferReceipt.update.mockResolvedValue({
        ...mockReceipt,
        aiVerificationStatus: 'rejected',
        reviewedById: mockReviewerId,
        reviewedAt: new Date(),
      });
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

      await service.verifyBankTransfer(mockReceiptId, mockReviewerId, {
        action: 'reject',
        adminNotes: 'Receipt is invalid',
      });

      expect(mockPrismaService.bankTransferReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            aiVerificationStatus: 'rejected',
          }),
        }),
      );
      // payment.update should NOT be called for rejected receipts
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockInvoicesService.createInvoice).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if receipt not found', async () => {
      mockPrismaService.bankTransferReceipt.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyBankTransfer('non-existent-id', mockReviewerId, {
          action: 'approve',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
