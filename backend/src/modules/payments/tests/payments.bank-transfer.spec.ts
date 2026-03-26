/**
 * PaymentsService — Bank Transfer Tests
 * Covers: uploadReceipt, reviewReceipt, uploadBankTransferReceipt, verifyBankTransfer
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
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
  mockReceiptId,
  mockReviewerId,
  mockUserId,
  mockBookingId,
  mockReceipt,
} from './payments.fixtures.js';

async function createModule(
  mockBankTransfer: ReturnType<typeof createMockBankTransferService>,
) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PaymentsService,
      { provide: PrismaService, useValue: createMockPrisma() },
      { provide: MoyasarPaymentService, useValue: createMockMoyasarService() },
      { provide: BankTransferService, useValue: mockBankTransfer },
      { provide: BookingStatusService, useValue: { confirm: jest.fn() } },
    ],
  }).compile();
  return module.get<PaymentsService>(PaymentsService);
}

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

describe('PaymentsService — uploadReceipt', () => {
  let service: PaymentsService;
  let mockBankTransfer: ReturnType<typeof createMockBankTransferService>;

  beforeEach(async () => {
    mockBankTransfer = createMockBankTransferService();
    service = await createModule(mockBankTransfer);
    jest.clearAllMocks();
  });

  it('should delegate to BankTransferService.uploadReceipt', async () => {
    mockBankTransfer.uploadReceipt.mockResolvedValue(mockReceipt);

    const result = await service.uploadReceipt(mockPaymentId, { receiptUrl: 'https://example.com/receipt.jpg' });

    expect(mockBankTransfer.uploadReceipt).toHaveBeenCalledWith(mockPaymentId, { receiptUrl: 'https://example.com/receipt.jpg' });
    expect(result.id).toBe(mockReceiptId);
  });

  it.each([
    ['BadRequestException', BadRequestException, 'Receipts can only be uploaded for bank transfer payments'],
    ['NotFoundException', NotFoundException, 'Payment not found'],
  ])('should propagate %s', async (_label, Exception, message) => {
    mockBankTransfer.uploadReceipt.mockRejectedValue(new Exception(message));

    await expect(service.uploadReceipt(mockPaymentId, { receiptUrl: '' })).rejects.toThrow(Exception);
  });
});

describe('PaymentsService — reviewReceipt (via verifyBankTransfer)', () => {
  let service: PaymentsService;
  let mockBankTransfer: ReturnType<typeof createMockBankTransferService>;

  beforeEach(async () => {
    mockBankTransfer = createMockBankTransferService();
    service = await createModule(mockBankTransfer);
    jest.clearAllMocks();
  });

  it.each([
    ['approve', 'paid'],
    ['reject', 'pending'],
  ])('should delegate %s to BankTransferService', async (action, expectedStatus) => {
    mockBankTransfer.verifyBankTransfer.mockResolvedValue({ ...mockPayment, status: expectedStatus });

    const dto = { action: action as 'approve' | 'reject', adminNotes: 'Notes' };
    const result = await service.verifyBankTransfer(mockReceiptId, mockReviewerId, dto);

    expect(mockBankTransfer.verifyBankTransfer).toHaveBeenCalledWith(mockReceiptId, mockReviewerId, dto);
    expect(result!.status).toBe(expectedStatus);
  });

  it('should propagate NotFoundException', async () => {
    mockBankTransfer.verifyBankTransfer.mockRejectedValue(new NotFoundException('Receipt not found'));

    await expect(
      service.verifyBankTransfer('non-existent-id', mockReviewerId, { action: 'approve' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('PaymentsService — uploadBankTransferReceipt', () => {
  let service: PaymentsService;
  let mockBankTransfer: ReturnType<typeof createMockBankTransferService>;

  beforeEach(async () => {
    mockBankTransfer = createMockBankTransferService();
    service = await createModule(mockBankTransfer);
    jest.clearAllMocks();
  });

  it('should delegate to BankTransferService and return payment + receipt', async () => {
    const bankTransferResult = {
      payment: { ...mockPayment, method: 'bank_transfer', amount: 20000, vatAmount: 3000, totalAmount: 23000 },
      receipt: { ...mockReceipt, receiptUrl: 'http://localhost:9000/carekit/receipts/uuid.jpg' },
    };
    mockBankTransfer.uploadBankTransferReceipt.mockResolvedValue(bankTransferResult);

    const result = await service.uploadBankTransferReceipt(mockUserId, mockBookingId, mockFile);

    expect(mockBankTransfer.uploadBankTransferReceipt).toHaveBeenCalledWith(mockUserId, mockBookingId, mockFile);
    expect(result).toHaveProperty('payment');
    expect(result).toHaveProperty('receipt');
  });

  it.each([
    ['NotFoundException', NotFoundException, 'Booking not found'],
    ['BadRequestException', BadRequestException, 'Payment already exists'],
  ])('should propagate %s', async (_label, Exception, message) => {
    mockBankTransfer.uploadBankTransferReceipt.mockRejectedValue(new Exception(message));

    await expect(service.uploadBankTransferReceipt(mockUserId, mockBookingId, mockFile)).rejects.toThrow(Exception);
  });
});

describe('PaymentsService — verifyBankTransfer', () => {
  let service: PaymentsService;
  let mockBankTransfer: ReturnType<typeof createMockBankTransferService>;

  beforeEach(async () => {
    mockBankTransfer = createMockBankTransferService();
    service = await createModule(mockBankTransfer);
    jest.clearAllMocks();
  });

  it.each([
    ['approve', 'paid'],
    ['reject', 'pending'],
  ])('should delegate %s to BankTransferService', async (action, expectedStatus) => {
    mockBankTransfer.verifyBankTransfer.mockResolvedValue({ ...mockPayment, status: expectedStatus });

    const dto = { action: action as 'approve' | 'reject', adminNotes: 'Notes' };
    const result = await service.verifyBankTransfer(mockReceiptId, mockReviewerId, dto);

    expect(mockBankTransfer.verifyBankTransfer).toHaveBeenCalledWith(mockReceiptId, mockReviewerId, dto);
    expect(result!.status).toBe(expectedStatus);
  });

  it('should propagate NotFoundException', async () => {
    mockBankTransfer.verifyBankTransfer.mockRejectedValue(new NotFoundException('Receipt not found'));

    await expect(
      service.verifyBankTransfer('non-existent-id', mockReviewerId, { action: 'approve' }),
    ).rejects.toThrow(NotFoundException);
  });
});
