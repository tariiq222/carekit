/**
 * CareKit — PaymentsService Unit Tests
 *
 * Tests the PaymentsService business logic in isolation:
 *   - findAll returns paginated results
 *   - findOne throws NotFoundException for invalid id
 *   - createPayment throws if booking not found
 *   - createPayment throws if payment already exists for booking
 *   - uploadReceipt delegates to BankTransferService
 *   - reviewReceipt delegates to BankTransferService
 *   - getPaymentStats returns correct structure
 *   - createMoyasarPayment delegates to MoyasarPaymentService
 *   - handleMoyasarWebhook delegates to MoyasarPaymentService
 *   - uploadBankTransferReceipt delegates to BankTransferService
 *   - verifyBankTransfer delegates to BankTransferService
 *
 * PrismaService, MoyasarPaymentService, and BankTransferService are mocked
 * so tests run without external services.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PaymentsService } from '../payments.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { MoyasarPaymentService } from '../moyasar-payment.service.js';
import { BankTransferService } from '../bank-transfer.service.js';

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
// Mock MoyasarPaymentService
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMoyasarPaymentService: any = {
  createMoyasarPayment: jest.fn(),
  handleMoyasarWebhook: jest.fn(),
  refund: jest.fn(),
};

// ---------------------------------------------------------------------------
// Mock BankTransferService
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockBankTransferService: any = {
  uploadReceipt: jest.fn(),
  reviewReceipt: jest.fn(),
  uploadBankTransferReceipt: jest.fn(),
  verifyBankTransfer: jest.fn(),
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
        { provide: MoyasarPaymentService, useValue: mockMoyasarPaymentService },
        { provide: BankTransferService, useValue: mockBankTransferService },
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
  // uploadReceipt — Delegates to BankTransferService
  // ─────────────────────────────────────────────────────────────

  describe('uploadReceipt', () => {
    const uploadDto = { receiptUrl: 'https://example.com/receipt.jpg' };

    it('should delegate to BankTransferService.uploadReceipt', async () => {
      mockBankTransferService.uploadReceipt.mockResolvedValue(mockReceipt);

      const result = await service.uploadReceipt(mockPaymentId, uploadDto);

      expect(mockBankTransferService.uploadReceipt).toHaveBeenCalledWith(
        mockPaymentId,
        uploadDto,
      );
      expect(result).toBeDefined();
      expect(result.id).toBe(mockReceiptId);
    });

    it('should propagate BadRequestException from BankTransferService', async () => {
      mockBankTransferService.uploadReceipt.mockRejectedValue(
        new BadRequestException('Receipts can only be uploaded for bank transfer payments'),
      );

      await expect(
        service.uploadReceipt(mockPaymentId, uploadDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate NotFoundException from BankTransferService', async () => {
      mockBankTransferService.uploadReceipt.mockRejectedValue(
        new NotFoundException('Payment not found'),
      );

      await expect(
        service.uploadReceipt('non-existent-id', uploadDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // reviewReceipt — Delegates to BankTransferService
  // ─────────────────────────────────────────────────────────────

  describe('reviewReceipt', () => {
    it('should delegate to BankTransferService.reviewReceipt with approve', async () => {
      const approvedReceipt = {
        ...mockReceipt,
        aiVerificationStatus: 'approved',
        reviewedById: mockReviewerId,
        reviewedAt: new Date(),
        adminNotes: 'Looks good',
      };
      mockBankTransferService.reviewReceipt.mockResolvedValue(approvedReceipt);

      const dto = { approved: true, adminNotes: 'Looks good' };
      const result = await service.reviewReceipt(mockReceiptId, mockReviewerId, dto);

      expect(mockBankTransferService.reviewReceipt).toHaveBeenCalledWith(
        mockReceiptId,
        mockReviewerId,
        dto,
      );
      expect(result.aiVerificationStatus).toBe('approved');
    });

    it('should delegate to BankTransferService.reviewReceipt with reject', async () => {
      const rejectedReceipt = {
        ...mockReceipt,
        aiVerificationStatus: 'rejected',
        reviewedById: mockReviewerId,
        reviewedAt: new Date(),
        adminNotes: 'Amount mismatch',
      };
      mockBankTransferService.reviewReceipt.mockResolvedValue(rejectedReceipt);

      const dto = { approved: false, adminNotes: 'Amount mismatch' };
      const result = await service.reviewReceipt(mockReceiptId, mockReviewerId, dto);

      expect(mockBankTransferService.reviewReceipt).toHaveBeenCalledWith(
        mockReceiptId,
        mockReviewerId,
        dto,
      );
      expect(result.aiVerificationStatus).toBe('rejected');
    });

    it('should propagate NotFoundException from BankTransferService', async () => {
      mockBankTransferService.reviewReceipt.mockRejectedValue(
        new NotFoundException('Receipt not found'),
      );

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
  // createMoyasarPayment — Delegates to MoyasarPaymentService
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

    it('should delegate to MoyasarPaymentService and return payment + redirectUrl', async () => {
      const moyasarResult = {
        payment: { ...mockPayment, method: 'moyasar', moyasarPaymentId: 'moyasar-id-abc' },
        redirectUrl: 'https://checkout.moyasar.com/pay/abc',
      };
      mockMoyasarPaymentService.createMoyasarPayment.mockResolvedValue(moyasarResult);

      const result = await service.createMoyasarPayment(mockUserId, createMoyasarDto);

      expect(mockMoyasarPaymentService.createMoyasarPayment).toHaveBeenCalledWith(
        mockUserId,
        createMoyasarDto,
      );
      expect(result).toHaveProperty('payment');
      expect(result).toHaveProperty('redirectUrl');
      expect(result.redirectUrl).toBe('https://checkout.moyasar.com/pay/abc');
    });

    it('should propagate NotFoundException from MoyasarPaymentService', async () => {
      mockMoyasarPaymentService.createMoyasarPayment.mockRejectedValue(
        new NotFoundException('Booking not found'),
      );

      await expect(
        service.createMoyasarPayment(mockUserId, createMoyasarDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException from MoyasarPaymentService', async () => {
      mockMoyasarPaymentService.createMoyasarPayment.mockRejectedValue(
        new BadRequestException('Payment already exists for this booking'),
      );

      await expect(
        service.createMoyasarPayment(mockUserId, createMoyasarDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // handleMoyasarWebhook — Delegates to MoyasarPaymentService
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

    it('should delegate to MoyasarPaymentService.handleMoyasarWebhook', async () => {
      const rawBody = Buffer.from(JSON.stringify(webhookDto));
      const signature = 'valid-signature';

      mockMoyasarPaymentService.handleMoyasarWebhook.mockResolvedValue({ success: true });

      const result = await service.handleMoyasarWebhook(signature, rawBody, webhookDto);

      expect(mockMoyasarPaymentService.handleMoyasarWebhook).toHaveBeenCalledWith(
        signature,
        rawBody,
        webhookDto,
      );
      expect(result).toEqual({ success: true });
    });

    it('should propagate errors from MoyasarPaymentService', async () => {
      const rawBody = Buffer.from(JSON.stringify(webhookDto));
      const invalidSig = 'invalid-signature-hex';

      mockMoyasarPaymentService.handleMoyasarWebhook.mockRejectedValue(
        new BadRequestException('Invalid webhook signature'),
      );

      await expect(
        service.handleMoyasarWebhook(invalidSig, rawBody, webhookDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // uploadBankTransferReceipt — Delegates to BankTransferService
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

    it('should delegate to BankTransferService and return payment + receipt', async () => {
      const bankTransferResult = {
        payment: { ...mockPayment, method: 'bank_transfer', amount: 20000, vatAmount: 3000, totalAmount: 23000 },
        receipt: { ...mockReceipt, receiptUrl: 'http://localhost:9000/carekit/receipts/uuid.jpg' },
      };
      mockBankTransferService.uploadBankTransferReceipt.mockResolvedValue(bankTransferResult);

      const result = await service.uploadBankTransferReceipt(
        mockUserId,
        mockBookingId,
        mockFile,
      );

      expect(mockBankTransferService.uploadBankTransferReceipt).toHaveBeenCalledWith(
        mockUserId,
        mockBookingId,
        mockFile,
      );
      expect(result).toHaveProperty('payment');
      expect(result).toHaveProperty('receipt');
    });

    it('should propagate NotFoundException from BankTransferService', async () => {
      mockBankTransferService.uploadBankTransferReceipt.mockRejectedValue(
        new NotFoundException('Booking not found'),
      );

      await expect(
        service.uploadBankTransferReceipt(mockUserId, mockBookingId, mockFile),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException from BankTransferService', async () => {
      mockBankTransferService.uploadBankTransferReceipt.mockRejectedValue(
        new BadRequestException('Payment already exists for this booking'),
      );

      await expect(
        service.uploadBankTransferReceipt(mockUserId, mockBookingId, mockFile),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // verifyBankTransfer — Delegates to BankTransferService
  // ─────────────────────────────────────────────────────────────

  describe('verifyBankTransfer', () => {
    it('should delegate approve to BankTransferService.verifyBankTransfer', async () => {
      const approvedPayment = { ...mockPayment, status: 'paid' };
      mockBankTransferService.verifyBankTransfer.mockResolvedValue(approvedPayment);

      const dto = { action: 'approve' as const, adminNotes: 'Valid receipt' };
      const result = await service.verifyBankTransfer(
        mockReceiptId,
        mockReviewerId,
        dto,
      );

      expect(mockBankTransferService.verifyBankTransfer).toHaveBeenCalledWith(
        mockReceiptId,
        mockReviewerId,
        dto,
      );
      expect(result).toBeDefined();
      expect(result!.status).toBe('paid');
    });

    it('should delegate reject to BankTransferService.verifyBankTransfer', async () => {
      const rejectedPayment = { ...mockPayment, status: 'pending' };
      mockBankTransferService.verifyBankTransfer.mockResolvedValue(rejectedPayment);

      const dto = { action: 'reject' as const, adminNotes: 'Receipt is invalid' };
      await service.verifyBankTransfer(mockReceiptId, mockReviewerId, dto);

      expect(mockBankTransferService.verifyBankTransfer).toHaveBeenCalledWith(
        mockReceiptId,
        mockReviewerId,
        dto,
      );
    });

    it('should propagate NotFoundException from BankTransferService', async () => {
      mockBankTransferService.verifyBankTransfer.mockRejectedValue(
        new NotFoundException('Receipt not found'),
      );

      await expect(
        service.verifyBankTransfer('non-existent-id', mockReviewerId, {
          action: 'approve',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
