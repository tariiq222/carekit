/**
 * InvoicesController — Unit Tests (delegation)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from '../../../src/modules/invoices/invoices.controller.js';
import { InvoicesService } from '../../../src/modules/invoices/invoices.service.js';
import { InvoiceCreatorService } from '../../../src/modules/invoices/invoice-creator.service.js';
import { InvoiceStatsService } from '../../../src/modules/invoices/invoice-stats.service.js';

const mockInvoicesService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByPayment: jest.fn(),
  markAsSent: jest.fn(),
};
const mockCreatorService = {
  createInvoice: jest.fn(),
  generateInvoiceHtml: jest.fn(),
};
const mockStatsService = { getInvoiceStats: jest.fn() };

describe('InvoicesController', () => {
  let controller: InvoicesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        { provide: InvoicesService, useValue: mockInvoicesService },
        { provide: InvoiceCreatorService, useValue: mockCreatorService },
        { provide: InvoiceStatsService, useValue: mockStatsService },
      ],
    }).compile();
    controller = module.get(InvoicesController);
  });

  it('getStats → statsService.getInvoiceStats()', () => {
    mockStatsService.getInvoiceStats.mockResolvedValue({});
    controller.getStats();
    expect(mockStatsService.getInvoiceStats).toHaveBeenCalled();
  });

  it('findAll → invoicesService.findAll()', () => {
    mockInvoicesService.findAll.mockResolvedValue([]);
    controller.findAll({} as any);
    expect(mockInvoicesService.findAll).toHaveBeenCalled();
  });

  it('findOne → invoicesService.findOne()', () => {
    mockInvoicesService.findOne.mockResolvedValue({ id: '1' });
    controller.findOne('id-1');
    expect(mockInvoicesService.findOne).toHaveBeenCalledWith('id-1');
  });

  it('findByPayment → invoicesService.findByPayment()', () => {
    mockInvoicesService.findByPayment.mockResolvedValue([]);
    controller.findByPayment('pay-1');
    expect(mockInvoicesService.findByPayment).toHaveBeenCalledWith('pay-1');
  });

  it('createInvoice → creatorService.createInvoice()', () => {
    mockCreatorService.createInvoice.mockResolvedValue({ id: '1' });
    controller.createInvoice({} as any);
    expect(mockCreatorService.createInvoice).toHaveBeenCalled();
  });

  it('markAsSent → invoicesService.markAsSent()', () => {
    mockInvoicesService.markAsSent.mockResolvedValue({ id: '1' });
    controller.markAsSent('id-1');
    expect(mockInvoicesService.markAsSent).toHaveBeenCalledWith('id-1');
  });
});
