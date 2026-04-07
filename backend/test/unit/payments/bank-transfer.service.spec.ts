/**
 * BankTransferService Unit Tests
 *
 * PrismaService, MinioService, InvoiceCreatorService, ActivityLogService mocked.
 * $transaction executes callback inline with mockTx.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { BankTransferService } from '../../../src/modules/payments/bank-transfer.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { MinioService } from '../../../src/common/services/minio.service.js';
import { InvoiceCreatorService } from '../../../src/modules/invoices/invoice-creator.service.js';
import { BookingStatusService } from '../../../src/modules/bookings/booking-status.service.js';
import { ActivityLogService } from '../../../src/modules/activity-log/activity-log.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';

// Mock transaction proxy
const mockTx = {
  payment: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  booking: { updateMany: jest.fn() },
  bankTransferReceipt: { create: jest.fn(), update: jest.fn() },
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  booking: { findFirst: jest.fn() },
  payment: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
  bankTransferReceipt: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMinio: any = {
  uploadFile: jest.fn().mockResolvedValue('http://localhost:9000/carekit/receipts/test.jpg'),
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockInvoices: any = { createInvoice: jest.fn() };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockBookingStatusService: any = { confirm: jest.fn() };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockActivityLog: any = { log: jest.fn().mockResolvedValue(undefined) };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockNotifications: any = { createNotification: jest.fn().mockResolvedValue(undefined) };

// Test data
const bookingId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const paymentId = 'b2c3d4e5-f6a7-8901-bcde-f01234567891';
const receiptId = 'c3d4e5f6-a7b8-9012-cdef-012345678902';
const adminId = 'd4e5f6a7-b8c9-0123-defa-123456789013';
const userId = 'e5f6a7b8-c9d0-1234-efab-234567890124';

const mockBooking = {
  id: bookingId, type: 'in_person', deletedAt: null,
  bookedPrice: 20000,
  service: { price: 10000 }, practitionerService: null,
};
// bookedPrice=20000, VAT 15%=3000, total=23000
const mockPayment = {
  id: paymentId, bookingId, amount: 20000, vatAmount: 3000, totalAmount: 23000,
  method: 'bank_transfer' as const, status: 'pending' as const,
};
const mockReceipt = {
  id: receiptId, paymentId,
  receiptUrl: 'http://localhost:9000/carekit/receipts/test.jpg',
  aiVerificationStatus: 'pending' as const,
  reviewedById: null, reviewedAt: null, adminNotes: null,
};
const mockFile: Express.Multer.File = {
  fieldname: 'receipt', originalname: 'receipt.jpg', encoding: '7bit',
  mimetype: 'image/jpeg', buffer: Buffer.from('fake-image'), size: 10,
  destination: '', filename: '', path: '',
  stream: null as unknown as NodeJS.ReadableStream,
};

describe('BankTransferService', () => {
  let service: BankTransferService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankTransferService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MinioService, useValue: mockMinio },
        { provide: InvoiceCreatorService, useValue: mockInvoices },
        { provide: BookingStatusService, useValue: mockBookingStatusService },
        { provide: ActivityLogService, useValue: mockActivityLog },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = module.get<BankTransferService>(BankTransferService);
    jest.clearAllMocks();
    // Restore $transaction after clearAllMocks
    mockPrisma.$transaction.mockImplementation(
      (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    );
  });

  describe('uploadBankTransferReceipt', () => {
    it('should upload to MinIO and create payment + receipt in transaction', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockTx.payment.create.mockResolvedValue(mockPayment);
      mockTx.bankTransferReceipt.create.mockResolvedValue(mockReceipt);

      const result = await service.uploadBankTransferReceipt(userId, bookingId, mockFile);

      expect(result.payment).toBeDefined();
      expect(result.receipt).toBeDefined();
      expect(mockMinio.uploadFile).toHaveBeenCalledWith(
        'carekit', expect.stringContaining('receipts/'), mockFile.buffer, 'image/jpeg',
      );
      expect(mockTx.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingId, amount: 20000, vatAmount: 3000, totalAmount: 23000,
            method: 'bank_transfer', status: 'pending',
          }),
        }),
      );
      expect(mockTx.bankTransferReceipt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentId, aiVerificationStatus: 'pending',
          }),
        }),
      );
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      await expect(
        service.uploadBankTransferReceipt(userId, bookingId, mockFile),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when payment already exists with paid status', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrisma.payment.findUnique.mockResolvedValue({ ...mockPayment, status: 'paid' });
      await expect(
        service.uploadBankTransferReceipt(userId, bookingId, mockFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete MinIO file if Prisma transaction fails', async () => {
      const mockFile: Express.Multer.File = {
        originalname: 'receipt.jpg',
        buffer: Buffer.from('fake-image'),
        mimetype: 'image/jpeg',
        fieldname: 'file',
        encoding: '7bit',
        size: 10,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      // Setup booking mock
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        service: { price: 1000, vatPercent: 15 },
        coupon: null,
        giftCard: null,
      });
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockMinio.uploadFile.mockResolvedValue('https://minio/receipts/uuid.jpg');
      mockMinio.deleteFile = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$transaction.mockRejectedValue(new Error('DB constraint error'));

      await expect(
        service.uploadBankTransferReceipt('user-1', 'booking-1', mockFile),
      ).rejects.toThrow('DB constraint error');

      expect(mockMinio.deleteFile).toHaveBeenCalledWith(
        'carekit',
        expect.stringMatching(/^receipts\/.+\.jpg$/),
      );
    });

    it('should calculate correct VAT (15% of base amount)', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockTx.payment.create.mockResolvedValue(mockPayment);
      mockTx.bankTransferReceipt.create.mockResolvedValue(mockReceipt);

      await service.uploadBankTransferReceipt(userId, bookingId, mockFile);

      const { amount, vatAmount, totalAmount } = mockTx.payment.create.mock.calls[0][0].data;
      expect(vatAmount).toBe(Math.round(amount * 0.15));
      expect(totalAmount).toBe(amount + vatAmount);
    });
  });

  describe('verifyBankTransfer', () => {
    it('should approve: update receipt + payment, confirm booking, create invoice, log activity', async () => {
      mockPrisma.bankTransferReceipt.findUnique.mockResolvedValue(mockReceipt);
      mockTx.bankTransferReceipt.update.mockResolvedValue({ ...mockReceipt, aiVerificationStatus: 'approved' });
      mockTx.payment.update.mockResolvedValue({ ...mockPayment, status: 'paid' });
      mockPrisma.payment.findUnique.mockResolvedValue({ ...mockPayment, status: 'paid', booking: { patientId: userId } });
      mockBookingStatusService.confirm.mockResolvedValue({});
      mockInvoices.createInvoice.mockResolvedValue({});

      const result = await service.verifyBankTransfer(receiptId, adminId, {
        action: 'approve', adminNotes: 'Valid receipt',
      });

      expect(result).toBeDefined();
      expect(mockTx.bankTransferReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            aiVerificationStatus: 'approved', reviewedById: adminId, adminNotes: 'Valid receipt',
          }),
        }),
      );
      expect(mockTx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'paid' } }),
      );
      expect(mockBookingStatusService.confirm).toHaveBeenCalledWith(bookingId);
      expect(mockInvoices.createInvoice).toHaveBeenCalledWith({ paymentId });
      expect(mockActivityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: adminId, action: 'receipt_approved', module: 'payments', resourceId: receiptId,
        }),
      );
    });

    it('should reject: update receipt, notify patient, clean up payment, log activity', async () => {
      mockPrisma.bankTransferReceipt.findUnique.mockResolvedValue(mockReceipt);
      mockTx.bankTransferReceipt.update.mockResolvedValue({ ...mockReceipt, aiVerificationStatus: 'rejected' });
      mockPrisma.payment.findUnique.mockResolvedValue({ ...mockPayment, booking: { patientId: userId } });

      await service.verifyBankTransfer(receiptId, adminId, {
        action: 'reject', adminNotes: 'Amount mismatch',
      });

      expect(mockTx.payment.update).not.toHaveBeenCalled();
      expect(mockBookingStatusService.confirm).not.toHaveBeenCalled();
      expect(mockInvoices.createInvoice).not.toHaveBeenCalled();
      expect(mockTx.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { bookingId, status: { in: ['pending', 'failed'] } } }),
      );
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'receipt_rejected', userId }),
      );
      expect(mockActivityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'receipt_rejected' }),
      );
    });

    it('should throw NotFoundException when receipt not found', async () => {
      mockPrisma.bankTransferReceipt.findUnique.mockResolvedValue(null);
      await expect(
        service.verifyBankTransfer('non-existent', adminId, { action: 'approve' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not fail if invoice throws ConflictException', async () => {
      mockPrisma.bankTransferReceipt.findUnique.mockResolvedValue(mockReceipt);
      mockTx.bankTransferReceipt.update.mockResolvedValue({});
      mockTx.payment.update.mockResolvedValue({});
      mockPrisma.payment.findUnique.mockResolvedValue({ ...mockPayment, status: 'paid', booking: { patientId: userId } });
      mockBookingStatusService.confirm.mockResolvedValue({});
      mockInvoices.createInvoice.mockRejectedValue(new ConflictException('exists'));

      const result = await service.verifyBankTransfer(receiptId, adminId, { action: 'approve' });
      expect(result).toBeDefined();
    });
  });

  describe('verifyBankTransfer (approve/reject via action field)', () => {
    it('should approve receipt, update payment to paid, and confirm booking', async () => {
      mockPrisma.bankTransferReceipt.findUnique.mockResolvedValue(mockReceipt);
      mockTx.bankTransferReceipt.update.mockResolvedValue({
        ...mockReceipt, aiVerificationStatus: 'approved', reviewedById: adminId,
      });
      mockTx.payment.update.mockResolvedValue({ ...mockPayment, status: 'paid' });
      mockPrisma.payment.findUnique.mockResolvedValue({ ...mockPayment, status: 'paid', booking: { patientId: userId } });
      mockBookingStatusService.confirm.mockResolvedValue({});
      mockInvoices.createInvoice.mockResolvedValue({});

      const result = await service.verifyBankTransfer(receiptId, adminId, {
        action: 'approve', adminNotes: 'Looks good',
      });

      expect(result).toBeDefined();
      expect(mockTx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'paid' } }),
      );
      expect(mockBookingStatusService.confirm).toHaveBeenCalledWith(bookingId);
    });

    it('should reject receipt, notify patient, and mark payment rejected', async () => {
      mockPrisma.bankTransferReceipt.findUnique.mockResolvedValue(mockReceipt);
      mockTx.bankTransferReceipt.update.mockResolvedValue({
        ...mockReceipt, aiVerificationStatus: 'rejected',
      });
      mockPrisma.payment.findUnique.mockResolvedValue({ ...mockPayment, booking: { patientId: userId } });

      await service.verifyBankTransfer(receiptId, adminId, {
        action: 'reject', adminNotes: 'Fake receipt',
      });

      expect(mockTx.payment.update).not.toHaveBeenCalled();
      expect(mockBookingStatusService.confirm).not.toHaveBeenCalled();
      expect(mockTx.payment.updateMany).toHaveBeenCalled();
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'receipt_rejected' }),
      );
    });

    it('should throw NotFoundException when receipt not found', async () => {
      mockPrisma.bankTransferReceipt.findUnique.mockResolvedValue(null);
      await expect(
        service.verifyBankTransfer('non-existent', adminId, { action: 'approve' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadReceipt', () => {
    it('should create receipt for a bank_transfer payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.bankTransferReceipt.create.mockResolvedValue(mockReceipt);

      const result = await service.uploadReceipt(paymentId, {
        receiptUrl: 'https://example.com/receipt.jpg',
      });

      expect(result.id).toBe(receiptId);
      expect(mockPrisma.bankTransferReceipt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentId, receiptUrl: 'https://example.com/receipt.jpg',
            aiVerificationStatus: 'pending',
          }),
        }),
      );
    });

    it('should throw NotFoundException when payment not found', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      await expect(
        service.uploadReceipt('non-existent', { receiptUrl: 'https://example.com/r.jpg' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for non-bank_transfer payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({ ...mockPayment, method: 'moyasar' });
      await expect(
        service.uploadReceipt(paymentId, { receiptUrl: 'https://example.com/r.jpg' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
