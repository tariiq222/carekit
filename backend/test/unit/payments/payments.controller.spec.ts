/**
 * CareKit — PaymentsController Unit Tests (delegation tests)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentsController } from '../../../src/modules/payments/payments.controller.js';
import { PaymentsService } from '../../../src/modules/payments/payments.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockPaymentsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  getPaymentStats: jest.fn(),
  getMyPayments: jest.fn(),
  createMoyasarPayment: jest.fn(),
  handleMoyasarWebhook: jest.fn(),
  uploadBankTransferReceipt: jest.fn(),
  verifyBankTransfer: jest.fn(),
  refund: jest.fn(),
  updateStatus: jest.fn(),
  findPaymentByBooking: jest.fn(),
};

// ── Tests ────────────────────────────────────────────────────────────────

describe('PaymentsController', () => {
  let controller: PaymentsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockPaymentsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  // ─── findAll ────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should delegate to paymentsService.findAll', async () => {
      const query = { page: 1, perPage: 20 };
      const payments = [{ id: 'pay-1', amount: 15000 }];
      mockPaymentsService.findAll.mockResolvedValue(payments);

      const result = await controller.findAll(query as any);

      expect(mockPaymentsService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(payments);
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should delegate to paymentsService.findOne', async () => {
      const payment = { id: 'pay-1', amount: 15000, status: 'paid' };
      mockPaymentsService.findOne.mockResolvedValue(payment);

      const result = await controller.findOne('pay-1');

      expect(mockPaymentsService.findOne).toHaveBeenCalledWith('pay-1');
      expect(result).toEqual(payment);
    });
  });

  // ─── getPaymentStats ────────────────────────────────────────────────

  describe('getPaymentStats', () => {
    it('should delegate to paymentsService.getPaymentStats', async () => {
      const stats = { total: 500000, paid: 400000, pending: 100000 };
      mockPaymentsService.getPaymentStats.mockResolvedValue(stats);

      const result = await controller.getPaymentStats();

      expect(mockPaymentsService.getPaymentStats).toHaveBeenCalled();
      expect(result).toEqual(stats);
    });
  });

  // ─── getMyPayments ──────────────────────────────────────────────────

  describe('getMyPayments', () => {
    it('should delegate to paymentsService.getMyPayments', async () => {
      const user = { id: 'user-1' };
      const query = { page: 1, perPage: 10 };
      const payments = [{ id: 'pay-1', amount: 5000 }];
      mockPaymentsService.getMyPayments.mockResolvedValue(payments);

      const result = await controller.getMyPayments(user, query as any);

      expect(mockPaymentsService.getMyPayments).toHaveBeenCalledWith(
        'user-1',
        query,
      );
      expect(result).toEqual(payments);
    });
  });

  // ─── createMoyasarPayment ───────────────────────────────────────────

  describe('createMoyasarPayment', () => {
    it('should delegate to paymentsService.createMoyasarPayment', async () => {
      const user = { id: 'user-1' };
      const dto = { bookingId: 'bk-1', amount: 15000 };
      const payment = { id: 'pay-1', status: 'initiated' };
      mockPaymentsService.createMoyasarPayment.mockResolvedValue(payment);

      const result = await controller.createMoyasarPayment(user, dto as any);

      expect(mockPaymentsService.createMoyasarPayment).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(payment);
    });
  });

  // ─── handleMoyasarWebhook ───────────────────────────────────────────

  describe('handleMoyasarWebhook', () => {
    it('should delegate to paymentsService.handleMoyasarWebhook', async () => {
      const req = {
        headers: { 'x-moyasar-signature': 'sig-123' },
        rawBody: Buffer.from('{"id":"pay-1"}'),
      };
      const dto = { id: 'pay-1', status: 'paid' };
      const result = { processed: true };
      mockPaymentsService.handleMoyasarWebhook.mockResolvedValue(result);

      const response = await controller.handleMoyasarWebhook(
        req as any,
        dto as any,
      );

      expect(mockPaymentsService.handleMoyasarWebhook).toHaveBeenCalledWith(
        'sig-123',
        req.rawBody,
        dto,
      );
      expect(response).toEqual(result);
    });

    it('should throw BadRequestException when rawBody is missing', async () => {
      const req = {
        headers: { 'x-moyasar-signature': 'sig-123' },
        rawBody: undefined,
      };
      const dto = { id: 'pay-1', status: 'paid' };

      await expect(
        controller.handleMoyasarWebhook(req as any, dto as any),
      ).rejects.toThrow('Raw request body is required');
    });
  });

  // ─── refund ─────────────────────────────────────────────────────────

  describe('refund', () => {
    it('should delegate to paymentsService.refund', async () => {
      const dto = { amount: 5000, reason: 'Service cancelled' };
      const result = { id: 'pay-1', status: 'refunded' };
      mockPaymentsService.refund.mockResolvedValue(result);

      const response = await controller.refund('pay-1', dto as any);

      expect(mockPaymentsService.refund).toHaveBeenCalledWith('pay-1', dto);
      expect(response).toEqual(result);
    });
  });

  // ─── updateStatus ───────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should delegate to paymentsService.updateStatus', async () => {
      const dto = { status: 'paid' };
      const result = { id: 'pay-1', status: 'paid' };
      mockPaymentsService.updateStatus.mockResolvedValue(result);

      const response = await controller.updateStatus('pay-1', dto as any);

      expect(mockPaymentsService.updateStatus).toHaveBeenCalledWith(
        'pay-1',
        dto,
      );
      expect(response).toEqual(result);
    });
  });

  // ─── findPaymentByBooking ───────────────────────────────────────────

  describe('findPaymentByBooking', () => {
    it('should delegate to paymentsService.findPaymentByBooking', async () => {
      const payment = { id: 'pay-1', bookingId: 'bk-1' };
      mockPaymentsService.findPaymentByBooking.mockResolvedValue(payment);

      const result = await controller.findPaymentByBooking('bk-1');

      expect(mockPaymentsService.findPaymentByBooking).toHaveBeenCalledWith(
        'bk-1',
      );
      expect(result).toEqual(payment);
    });
  });

  // ─── verifyBankTransfer ─────────────────────────────────────────────

  describe('verifyBankTransfer', () => {
    it('should delegate to paymentsService.verifyBankTransfer', async () => {
      const user = { id: 'admin-1' };
      const dto = { status: 'approved', notes: 'Looks good' };
      const result = { id: 'receipt-1', status: 'verified' };
      mockPaymentsService.verifyBankTransfer.mockResolvedValue(result);

      const response = await controller.verifyBankTransfer(
        'receipt-1',
        user,
        dto as any,
      );

      expect(mockPaymentsService.verifyBankTransfer).toHaveBeenCalledWith(
        'receipt-1',
        'admin-1',
        dto,
      );
      expect(response).toEqual(result);
    });
  });
});
