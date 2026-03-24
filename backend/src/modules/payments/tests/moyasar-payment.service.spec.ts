/**
 * MoyasarPaymentService Unit Tests
 *
 * PrismaService, InvoiceCreatorService, ConfigService mocked.
 * Global fetch mocked for Moyasar API calls.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { MoyasarPaymentService } from '../moyasar-payment.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { InvoiceCreatorService } from '../../invoices/invoice-creator.service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  booking: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  payment: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockInvoicesService: any = { createInvoice: jest.fn() };
const configMap: Record<string, string> = {
  MOYASAR_API_KEY: 'test-api-key',
  BACKEND_URL: 'http://localhost:3000',
  MOYASAR_WEBHOOK_SECRET: 'webhook-secret-123',
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockConfigService: any = {
  get: jest.fn((key: string, fallback?: string) => configMap[key] ?? fallback ?? ''),
};
const mockFetch = jest.fn() as jest.Mock;
global.fetch = mockFetch;

// Test data
const bookingId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const paymentId = 'b2c3d4e5-f6a7-8901-bcde-f01234567891';
const userId = 'e5f6a7b8-c9d0-1234-efab-234567890124';
const moyasarPayId = 'moyasar-pay-id-001';

const mockBooking = {
  id: bookingId, type: 'clinic_visit', deletedAt: null,
  practitioner: { priceClinic: 20000, pricePhone: 15000, priceVideo: 18000 },
  service: { price: 10000 }, practitionerService: null,
};
// clinic_visit -> priceClinic=20000, VAT 15%=3000, total=23000
const mockPayment = {
  id: paymentId, bookingId, amount: 20000, vatAmount: 3000, totalAmount: 23000,
  method: 'moyasar' as const, status: 'pending' as const, moyasarPaymentId: moyasarPayId,
};
const createDto = {
  bookingId,
  source: { type: 'creditcard', number: '4111111111111111', name: 'Test', cvc: '123', month: '12', year: '2030' },
};

describe('MoyasarPaymentService', () => {
  let service: MoyasarPaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoyasarPaymentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InvoiceCreatorService, useValue: mockInvoicesService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<MoyasarPaymentService>(MoyasarPaymentService);
    jest.clearAllMocks();
  });

  describe('createMoyasarPayment', () => {
    it('should create payment with correct VAT and return redirect URL', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({ ...mockPayment, status: 'pending' });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: moyasarPayId, status: 'initiated',
          source: { transaction_url: 'https://checkout.moyasar.com/pay/abc' },
        }),
      });

      const result = await service.createMoyasarPayment(userId, createDto);

      expect(result.redirectUrl).toBe('https://checkout.moyasar.com/pay/abc');
      expect(result.payment).toBeDefined();
      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody.amount).toBe(23000);
      expect(fetchBody.currency).toBe('SAR');
      expect(fetchBody.metadata.bookingId).toBe(bookingId);
      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 20000, vatAmount: 3000, totalAmount: 23000,
            method: 'moyasar', status: 'pending', moyasarPaymentId: moyasarPayId,
          }),
        }),
      );
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      await expect(service.createMoyasarPayment(userId, createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when payment already exists', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      await expect(service.createMoyasarPayment(userId, createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when Moyasar API returns error', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockFetch.mockResolvedValue({ ok: false, json: async () => ({ message: 'Invalid card' }) });
      await expect(service.createMoyasarPayment(userId, createDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle no transaction_url from Moyasar', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue(mockPayment);
      mockFetch.mockResolvedValue({
        ok: true, json: async () => ({ id: moyasarPayId, status: 'paid', source: {} }),
      });
      const result = await service.createMoyasarPayment(userId, createDto);
      expect(result.redirectUrl).toBeNull();
    });
  });

  describe('handleMoyasarWebhook', () => {
    const webhookDto = {
      id: moyasarPayId, status: 'paid', amount: 23000, currency: 'SAR',
      description: `Booking #${bookingId}`, metadata: { bookingId },
    };

    function validSig(body: Buffer): string {
      return crypto.createHmac('sha256', 'webhook-secret-123').update(body).digest('hex');
    }

    it('should update payment to paid, auto-confirm booking, and create invoice', async () => {
      const rawBody = Buffer.from(JSON.stringify(webhookDto));
      mockPrisma.payment.findFirst.mockResolvedValue({ ...mockPayment, status: 'pending' });
      mockPrisma.payment.update.mockResolvedValue({ ...mockPayment, status: 'paid' });
      mockPrisma.booking.findUnique.mockResolvedValue({ id: bookingId, status: 'pending' });
      mockPrisma.booking.update.mockResolvedValue({});
      mockInvoicesService.createInvoice.mockResolvedValue({});

      const result = await service.handleMoyasarWebhook(validSig(rawBody), rawBody, webhookDto);

      expect(result).toEqual({ success: true });
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'paid' } }),
      );
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'confirmed' } }),
      );
      expect(mockInvoicesService.createInvoice).toHaveBeenCalledWith({ paymentId: mockPayment.id });
    });

    it('should throw UnauthorizedException for invalid HMAC signature', async () => {
      const rawBody = Buffer.from(JSON.stringify(webhookDto));
      await expect(
        service.handleMoyasarWebhook('invalid-sig', rawBody, webhookDto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when webhook secret is empty', async () => {
      const rawBody = Buffer.from(JSON.stringify(webhookDto));
      mockConfigService.get.mockImplementation((key: string, fb?: string) => {
        if (key === 'MOYASAR_WEBHOOK_SECRET') return '';
        return fb ?? '';
      });
      await expect(
        service.handleMoyasarWebhook('any-sig', rawBody, webhookDto),
      ).rejects.toThrow(UnauthorizedException);
      // Restore
      mockConfigService.get.mockImplementation(
        (key: string, fb?: string) => configMap[key] ?? fb ?? '',
      );
    });

    it('should return success silently when payment not found', async () => {
      const rawBody = Buffer.from(JSON.stringify(webhookDto));
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      const result = await service.handleMoyasarWebhook(validSig(rawBody), rawBody, webhookDto);
      expect(result).toEqual({ success: true });
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('should skip update when already paid (idempotency)', async () => {
      const rawBody = Buffer.from(JSON.stringify(webhookDto));
      mockPrisma.payment.findFirst.mockResolvedValue({ ...mockPayment, status: 'paid' });
      const result = await service.handleMoyasarWebhook(validSig(rawBody), rawBody, webhookDto);
      expect(result).toEqual({ success: true });
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
      expect(mockInvoicesService.createInvoice).not.toHaveBeenCalled();
    });

    it('should update payment to failed on failed status', async () => {
      const failedDto = { ...webhookDto, status: 'failed' };
      const rawBody = Buffer.from(JSON.stringify(failedDto));
      mockPrisma.payment.findFirst.mockResolvedValue({ ...mockPayment, status: 'pending' });
      mockPrisma.payment.update.mockResolvedValue({ ...mockPayment, status: 'failed' });

      const result = await service.handleMoyasarWebhook(validSig(rawBody), rawBody, failedDto);

      expect(result).toEqual({ success: true });
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'failed' } }),
      );
      expect(mockInvoicesService.createInvoice).not.toHaveBeenCalled();
    });

    it('should not fail if invoice creation throws ConflictException', async () => {
      const rawBody = Buffer.from(JSON.stringify(webhookDto));
      mockPrisma.payment.findFirst.mockResolvedValue({ ...mockPayment, status: 'pending' });
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.booking.findUnique.mockResolvedValue({ id: bookingId, status: 'confirmed' });
      mockInvoicesService.createInvoice.mockRejectedValue(new ConflictException('exists'));

      const result = await service.handleMoyasarWebhook(validSig(rawBody), rawBody, webhookDto);
      expect(result).toEqual({ success: true });
    });
  });

  describe('refund', () => {
    const paidPayment = {
      ...mockPayment, status: 'paid' as const, method: 'moyasar' as const,
      moyasarPaymentId: moyasarPayId, totalAmount: 23000,
    };

    it('should call Moyasar refund API and update status to refunded', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(paidPayment);
      mockPrisma.payment.update.mockResolvedValue({ ...paidPayment, status: 'refunded' });
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: moyasarPayId }) });

      const result = await service.refund(paymentId);

      expect(result.status).toBe('refunded');
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.moyasar.com/v1/payments/${moyasarPayId}/refund`,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(JSON.parse(mockFetch.mock.calls[0][1].body).amount).toBe(23000);
    });

    it('should throw NotFoundException when payment not found', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      await expect(service.refund('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when payment is not paid', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({ ...mockPayment, status: 'pending' });
      await expect(service.refund(paymentId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when Moyasar refund API fails', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(paidPayment);
      mockFetch.mockResolvedValue({ ok: false, json: async () => ({ message: 'Refund failed' }) });
      await expect(service.refund(paymentId)).rejects.toThrow(BadRequestException);
    });

    it('should use custom amount when provided', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(paidPayment);
      mockPrisma.payment.update.mockResolvedValue({ ...paidPayment, status: 'refunded' });
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: moyasarPayId }) });

      await service.refund(paymentId, 10000);

      expect(JSON.parse(mockFetch.mock.calls[0][1].body).amount).toBe(10000);
    });
  });
});
