import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MoyasarRefundService } from '../moyasar-refund.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { MoyasarCheckoutService } from '../moyasar-checkout.service.js';
import {
  mockPaymentId,
  mockPayment,
  mockMoyasarPayment,
  createMockPrisma,
} from './payments.fixtures.js';

jest.mock('../../../common/helpers/resilient-fetch.helper.js', () => ({
  resilientFetch: jest.fn(),
}));
import { resilientFetch } from '../../../common/helpers/resilient-fetch.helper.js';
const mockResilientFetch = resilientFetch as jest.MockedFunction<typeof resilientFetch>;

jest.mock('../payments.helpers.js', () => ({
  paymentInclude: {},
}));

describe('MoyasarRefundService', () => {
  let service: MoyasarRefundService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  const mockCheckoutService = { buildCredentials: jest.fn().mockReturnValue('dGVzdDo=') };

  beforeEach(async () => {
    mockPrisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoyasarRefundService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: {} },
        { provide: MoyasarCheckoutService, useValue: mockCheckoutService },
      ],
    }).compile();

    service = module.get<MoyasarRefundService>(MoyasarRefundService);
    jest.clearAllMocks();
    mockCheckoutService.buildCredentials.mockReturnValue('dGVzdDo=');
  });

  describe('refund', () => {
    it('should throw NotFoundException when payment not found', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(service.refund(mockPaymentId)).rejects.toThrow(NotFoundException);
      await expect(service.refund(mockPaymentId)).rejects.toMatchObject({
        response: { statusCode: 404, error: 'NOT_FOUND' },
      });
    });

    it('should throw BadRequestException when payment status is pending', async () => {
      const pendingPayment = { ...mockPayment, status: 'pending' };
      mockPrisma.payment.findUnique.mockResolvedValue(pendingPayment);

      await expect(service.refund(mockPaymentId)).rejects.toThrow(BadRequestException);
      await expect(service.refund(mockPaymentId)).rejects.toMatchObject({
        response: { statusCode: 400, error: 'INVALID_PAYMENT_STATUS' },
      });
    });

    it('should throw BadRequestException when payment status is refunded', async () => {
      const refundedPayment = { ...mockPayment, status: 'refunded' };
      mockPrisma.payment.findUnique.mockResolvedValue(refundedPayment);

      await expect(service.refund(mockPaymentId)).rejects.toThrow(BadRequestException);
      await expect(service.refund(mockPaymentId)).rejects.toMatchObject({
        response: { statusCode: 400, error: 'INVALID_PAYMENT_STATUS' },
      });
    });

    it('should update payment status to refunded for bank_transfer without calling Moyasar API', async () => {
      const paidBankTransfer = { ...mockPayment, status: 'paid', method: 'bank_transfer', moyasarPaymentId: null };
      const updatedPayment = { ...paidBankTransfer, status: 'refunded' };
      mockPrisma.payment.findUnique.mockResolvedValue(paidBankTransfer);
      mockPrisma.booking.findUnique.mockResolvedValue({ status: 'cancelled' });
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payment.findUniqueOrThrow.mockResolvedValue(updatedPayment);

      const result = await service.refund(mockPaymentId);

      expect(mockResilientFetch).not.toHaveBeenCalled();
      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: mockPaymentId, status: 'paid' },
        data: expect.objectContaining({ status: 'refunded' }),
      });
      expect(result.status).toBe('refunded');
    });

    it('should throw BadRequestException when payment already claimed by concurrent request', async () => {
      const paidPayment = { ...mockPayment, status: 'paid', method: 'bank_transfer', moyasarPaymentId: null };
      mockPrisma.payment.findUnique.mockResolvedValue(paidPayment);
      mockPrisma.booking.findUnique.mockResolvedValue({ status: 'cancelled' });
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.refund(mockPaymentId)).rejects.toMatchObject({
        response: { statusCode: 400, error: 'ALREADY_REFUNDED' },
      });
    });

    it('should call Moyasar API and update status for moyasar payment', async () => {
      const updatedPayment = { ...mockMoyasarPayment, status: 'refunded' };
      mockPrisma.payment.findUnique.mockResolvedValue(mockMoyasarPayment);
      mockPrisma.booking.findUnique.mockResolvedValue({ status: 'cancelled' });
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payment.findUniqueOrThrow.mockResolvedValue(updatedPayment);
      mockResilientFetch.mockResolvedValue({ ok: true } as Response);

      const result = await service.refund(mockPaymentId);

      expect(mockResilientFetch).toHaveBeenCalledWith(
        `https://api.moyasar.com/v1/payments/${mockMoyasarPayment.moyasarPaymentId}/refund`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Basic dGVzdDo=' }),
        }),
        expect.any(Object),
      );
      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: mockPaymentId, status: 'paid' },
        data: expect.objectContaining({ status: 'refunded' }),
      });
      expect(result.status).toBe('refunded');
    });

    it('should use provided amount instead of totalAmount when specified', async () => {
      const updatedPayment = { ...mockMoyasarPayment, status: 'refunded' };
      mockPrisma.payment.findUnique.mockResolvedValue(mockMoyasarPayment);
      mockPrisma.booking.findUnique.mockResolvedValue({ status: 'cancelled' });
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payment.findUniqueOrThrow.mockResolvedValue(updatedPayment);
      mockResilientFetch.mockResolvedValue({ ok: true } as Response);

      await service.refund(mockPaymentId, 5000);

      expect(mockResilientFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ amount: 5000 }),
        }),
        expect.any(Object),
      );
    });

    it('should use totalAmount when no amount provided for moyasar payment', async () => {
      const updatedPayment = { ...mockMoyasarPayment, status: 'refunded' };
      mockPrisma.payment.findUnique.mockResolvedValue(mockMoyasarPayment);
      mockPrisma.booking.findUnique.mockResolvedValue({ status: 'cancelled' });
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payment.findUniqueOrThrow.mockResolvedValue(updatedPayment);
      mockResilientFetch.mockResolvedValue({ ok: true } as Response);

      await service.refund(mockPaymentId);

      expect(mockResilientFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ amount: mockMoyasarPayment.totalAmount }),
        }),
        expect.any(Object),
      );
    });

    it('should throw BadRequestException when Moyasar API returns non-ok response and revert DB', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockMoyasarPayment);
      mockPrisma.booking.findUnique.mockResolvedValue({ status: 'cancelled' });
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
      mockResilientFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({ message: 'Insufficient balance' }),
      } as unknown as Response);

      await expect(service.refund(mockPaymentId)).rejects.toThrow(BadRequestException);
      await expect(service.refund(mockPaymentId)).rejects.toMatchObject({
        response: { statusCode: 400, error: 'MOYASAR_REFUND_ERROR', message: 'Insufficient balance' },
      });
      // DB should be reverted after Moyasar failure
      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockPaymentId, status: 'refunded' },
          data: expect.objectContaining({ status: 'paid' }),
        }),
      );
    });

    it('should throw BadRequestException with fallback message when Moyasar error body has no message', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockMoyasarPayment);
      mockPrisma.booking.findUnique.mockResolvedValue({ status: 'cancelled' });
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
      mockResilientFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockRejectedValue(new Error('parse error')),
      } as unknown as Response);

      await expect(service.refund(mockPaymentId)).rejects.toThrow(BadRequestException);
      await expect(service.refund(mockPaymentId)).rejects.toMatchObject({
        response: { statusCode: 400, error: 'MOYASAR_REFUND_ERROR', message: 'Unknown error' },
      });
    });

    it('should skip Moyasar API call when moyasarPaymentId is null even if method is moyasar', async () => {
      const moyasarNoId = { ...mockMoyasarPayment, moyasarPaymentId: null };
      const updatedPayment = { ...moyasarNoId, status: 'refunded' };
      mockPrisma.payment.findUnique.mockResolvedValue(moyasarNoId);
      mockPrisma.booking.findUnique.mockResolvedValue({ status: 'cancelled' });
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payment.findUniqueOrThrow.mockResolvedValue(updatedPayment);

      const result = await service.refund(mockPaymentId);

      expect(mockResilientFetch).not.toHaveBeenCalled();
      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: mockPaymentId, status: 'paid' },
        data: expect.objectContaining({ status: 'refunded' }),
      });
      expect(result.status).toBe('refunded');
    });
  });
});
