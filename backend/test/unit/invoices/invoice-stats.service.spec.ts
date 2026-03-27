/**
 * InvoiceStatsService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceStatsService } from '../../../src/modules/invoices/invoice-stats.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  invoice: {
    count: jest.fn(),
    groupBy: jest.fn(),
  },
};

describe('InvoiceStatsService', () => {
  let service: InvoiceStatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceStatsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<InvoiceStatsService>(InvoiceStatsService);
    jest.clearAllMocks();
  });

  describe('getInvoiceStats', () => {
    it('should return total, sent, pending and zatca breakdown', async () => {
      mockPrisma.invoice.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(7);  // sent
      mockPrisma.invoice.groupBy.mockResolvedValue([
        { zatcaStatus: 'reported', _count: { _all: 6 } },
        { zatcaStatus: 'pending', _count: { _all: 4 } },
      ]);

      const result = await service.getInvoiceStats();

      expect(result.total).toBe(10);
      expect(result.sent).toBe(7);
      expect(result.pending).toBe(3);
      expect(result.zatca).toEqual({ reported: 6, pending: 4 });
    });

    it('should return zeros when no invoices exist', async () => {
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.invoice.groupBy.mockResolvedValue([]);

      const result = await service.getInvoiceStats();

      expect(result.total).toBe(0);
      expect(result.sent).toBe(0);
      expect(result.pending).toBe(0);
      expect(result.zatca).toEqual({});
    });

    it('should call count twice and groupBy once', async () => {
      mockPrisma.invoice.count.mockResolvedValue(5);
      mockPrisma.invoice.groupBy.mockResolvedValue([]);

      await service.getInvoiceStats();

      expect(mockPrisma.invoice.count).toHaveBeenCalledTimes(2);
      expect(mockPrisma.invoice.groupBy).toHaveBeenCalledTimes(1);
      expect(mockPrisma.invoice.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sentAt: { not: null } } }),
      );
    });
  });
});
