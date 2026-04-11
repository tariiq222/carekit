/**
 * CareKit — InvoicesService Unit Tests
 *
 * Tests InvoicesService (list/find) and InvoiceStatsService in isolation.
 * createInvoice tests are in invoice-creator.service.spec.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InvoicesService } from '../../../src/modules/invoices/invoices.service.js';
import { InvoiceStatsService } from '../../../src/modules/invoices/invoice-stats.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockPrismaService: any = {
  invoice: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  payment: {
    findUnique: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockPaymentId = 'payment-uuid-1';
const mockInvoiceId = 'invoice-uuid-1';
const mockBookingId = 'booking-uuid-1';
const mockPatientId = 'patient-uuid-1';

const mockPayment = {
  id: mockPaymentId,
  bookingId: mockBookingId,
  amount: 15000,
  vatAmount: 2250,
  totalAmount: 17250,
  method: 'moyasar',
  status: 'paid',
  createdAt: new Date('2026-03-20'),
  updatedAt: new Date('2026-03-20'),
};

const mockInvoice = {
  id: mockInvoiceId,
  paymentId: mockPaymentId,
  invoiceNumber: 'INV-20260322-48291',
  pdfUrl: null,
  sentAt: null,
  vatAmount: 2250,
  vatRate: 15,
  zatcaStatus: 'not_applicable',
  createdAt: new Date('2026-03-22'),
  payment: {
    ...mockPayment,
    booking: {
      id: mockBookingId,
      patientId: mockPatientId,
      patient: {
        id: mockPatientId,
        firstName: 'أحمد',
        lastName: 'الراشد',
      },
      practitioner: {
        id: 'practitioner-uuid-1',
        user: { id: 'user-uuid-1', firstName: 'خالد', lastName: 'الفهد' },
      },
      service: {
        id: 'service-uuid-1',
        nameEn: 'General Consultation',
        nameAr: 'استشارة عامة',
        price: 15000,
      },
    },
  },
};

// ---------------------------------------------------------------------------
// InvoicesService
// ---------------------------------------------------------------------------

describe('InvoicesService', () => {
  let service: InvoicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated invoices with default page=1, perPage=20', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValue([mockInvoice]);
      mockPrismaService.invoice.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toMatchObject({
        page: 1,
        perPage: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(mockInvoiceId);
    });

    it('should apply pagination correctly', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValue([]);
      mockPrismaService.invoice.count.mockResolvedValue(50);

      const result = await service.findAll({ page: 3, perPage: 10 });

      expect(result.meta.page).toBe(3);
      expect(result.meta.perPage).toBe(10);
      expect(result.meta.totalPages).toBe(5);
      expect(mockPrismaService.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('should filter by dateFrom and dateTo', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValue([]);
      mockPrismaService.invoice.count.mockResolvedValue(0);

      await service.findAll({ dateFrom: '2026-03-01', dateTo: '2026-03-31' });

      expect(mockPrismaService.invoice.findMany).toHaveBeenCalledWith(
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

    it('should order results by createdAt descending', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValue([]);
      mockPrismaService.invoice.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockPrismaService.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('findOne', () => {
    it('should return invoice with relations when found', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await service.findOne(mockInvoiceId);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockInvoiceId);
      expect(result.payment).toBeDefined();
    });

    it('should throw NotFoundException for non-existent id', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByPayment', () => {
    it('should return invoice for a valid paymentId', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await service.findByPayment(mockPaymentId);

      expect(result).toBeDefined();
      expect(result.paymentId).toBe(mockPaymentId);
    });

    it('should throw NotFoundException if no invoice exists for payment', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(null);

      await expect(
        service.findByPayment('no-invoice-payment-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsSent', () => {
    it('should set sentAt timestamp', async () => {
      const updatedInvoice = { ...mockInvoice, sentAt: new Date() };
      mockPrismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrismaService.invoice.update.mockResolvedValue(updatedInvoice);

      const result = await service.markAsSent(mockInvoiceId);

      expect(result.sentAt).toBeDefined();
      expect(mockPrismaService.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockInvoiceId },
          data: expect.objectContaining({ sentAt: expect.any(Date) }),
        }),
      );
    });

    it('should throw NotFoundException if invoice does not exist', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(null);

      await expect(service.markAsSent('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// InvoiceStatsService
// ---------------------------------------------------------------------------

describe('InvoiceStatsService', () => {
  let statsService: InvoiceStatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceStatsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    statsService = module.get<InvoiceStatsService>(InvoiceStatsService);
    jest.clearAllMocks();
  });

  describe('getInvoiceStats', () => {
    it('should return total, sent, pending and zatca breakdown', async () => {
      mockPrismaService.invoice.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(6);
      mockPrismaService.invoice.groupBy.mockResolvedValue([
        { zatcaStatus: 'not_applicable', _count: { _all: 8 } },
        { zatcaStatus: 'pending', _count: { _all: 2 } },
      ]);

      const result = await statsService.getInvoiceStats();

      expect(result.total).toBe(10);
      expect(result.sent).toBe(6);
      expect(result.pending).toBe(4);
      expect(result.zatca).toHaveProperty('not_applicable', 8);
    });

    it('should return pending as 0 when all are sent', async () => {
      mockPrismaService.invoice.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5);
      mockPrismaService.invoice.groupBy.mockResolvedValue([]);

      const result = await statsService.getInvoiceStats();

      expect(result.pending).toBe(0);
    });
  });
});
