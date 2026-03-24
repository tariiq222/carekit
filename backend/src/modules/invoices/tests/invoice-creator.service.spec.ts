import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InvoiceCreatorService } from '../invoice-creator.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { ZatcaService } from '../../zatca/zatca.service.js';

const mockPayment = {
  id: 'payment-1', bookingId: 'booking-1', amount: 15000,
  vatAmount: 2250, totalAmount: 17250, method: 'moyasar', status: 'paid',
  booking: {
    id: 'booking-1', patientId: 'patient-1',
    patient: { firstName: 'أحمد', lastName: 'الراشد' },
    service: { nameAr: 'استشارة عامة', nameEn: 'General Consultation' },
  },
};

const mockZatcaConfig = {
  phase: 'phase1', vatRate: 15, vatRegistrationNumber: '300000000000003',
  businessRegistration: '', sellerName: 'CareKit', sellerAddress: 'Riyadh', city: 'Riyadh',
};

const mockZatcaData = {
  vatAmount: 2250, vatRate: 15, totalAmount: 17250,
  invoiceHash: 'abc123hash', previousHash: 'prev123hash',
  qrCodeData: 'base64qrdata', xmlContent: null, status: 'not_applicable',
};

const mockCreatedInvoice = {
  id: 'invoice-1', paymentId: 'payment-1',
  invoiceNumber: 'INV-20260322-00001',
  zatcaStatus: 'not_applicable', vatAmount: 2250, vatRate: 15,
};

const mockPrismaService: any = {
  payment: { findUnique: jest.fn() },
  invoice: { findUnique: jest.fn(), create: jest.fn() },
  whiteLabelConfig: { findMany: jest.fn() },
};

const mockZatcaService: any = {
  loadConfig: jest.fn(),
  getPreviousInvoiceHash: jest.fn(),
  generateForInvoice: jest.fn(),
};

describe('InvoiceCreatorService', () => {
  let service: InvoiceCreatorService;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
    mockPrismaService.invoice.findUnique.mockResolvedValue(null);
    mockPrismaService.invoice.create.mockResolvedValue(mockCreatedInvoice);
    mockZatcaService.loadConfig.mockResolvedValue(mockZatcaConfig);
    mockZatcaService.getPreviousInvoiceHash.mockResolvedValue('prevhash');
    mockZatcaService.generateForInvoice.mockResolvedValue(mockZatcaData);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceCreatorService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ZatcaService, useValue: mockZatcaService },
      ],
    }).compile();

    service = module.get<InvoiceCreatorService>(InvoiceCreatorService);
  });

  describe('createInvoice — validations', () => {
    it('throws NotFoundException when payment not found', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);
      await expect(service.createInvoice({ paymentId: 'missing' }))
        .rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when payment.status is pending', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue({ ...mockPayment, status: 'pending' });
      await expect(service.createInvoice({ paymentId: 'payment-1' }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when payment.status is failed', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue({ ...mockPayment, status: 'failed' });
      await expect(service.createInvoice({ paymentId: 'payment-1' }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when invoice already exists for paymentId', async () => {
      // Override: invoice.findUnique returns existing invoice (conflict)
      mockPrismaService.invoice.findUnique.mockResolvedValueOnce({ id: 'existing-invoice' });
      await expect(service.createInvoice({ paymentId: 'payment-1' }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('createInvoice — invoice number', () => {
    it('generated invoiceNumber matches pattern /^INV-\\d{8}-\\d{5}$/', async () => {
      let capturedInvoiceNumber: string | undefined;
      mockPrismaService.invoice.create.mockImplementation((args: any) => {
        capturedInvoiceNumber = args.data.invoiceNumber;
        return Promise.resolve(mockCreatedInvoice);
      });
      await service.createInvoice({ paymentId: 'payment-1' });
      expect(capturedInvoiceNumber).toMatch(/^INV-\d{8}-\d+$/);
    });

    it('two calls produce invoice numbers matching the pattern', async () => {
      const numbers: string[] = [];
      mockPrismaService.invoice.create.mockImplementation((args: any) => {
        numbers.push(args.data.invoiceNumber);
        return Promise.resolve(mockCreatedInvoice);
      });
      mockPrismaService.invoice.findUnique.mockResolvedValue(null);
      await service.createInvoice({ paymentId: 'payment-1' });
      await service.createInvoice({ paymentId: 'payment-1' });
      expect(numbers[0]).toMatch(/^INV-\d{8}-\d+$/);
      expect(numbers[1]).toMatch(/^INV-\d{8}-\d+$/);
    });
  });

  describe('createInvoice — ZATCA integration', () => {
    it('calls zatcaService.loadConfig()', async () => {
      await service.createInvoice({ paymentId: 'payment-1' });
      expect(mockZatcaService.loadConfig).toHaveBeenCalledTimes(1);
    });

    it('calls zatcaService.getPreviousInvoiceHash()', async () => {
      await service.createInvoice({ paymentId: 'payment-1' });
      expect(mockZatcaService.getPreviousInvoiceHash).toHaveBeenCalledTimes(1);
    });

    it('calls zatcaService.generateForInvoice with correct buyerName from patient firstName+lastName', async () => {
      await service.createInvoice({ paymentId: 'payment-1' });
      const call = mockZatcaService.generateForInvoice.mock.calls[0][0];
      expect(call.buyerName).toBe('أحمد الراشد');
    });

    it('uses مريض as buyerName when patient is null', async () => {
      const paymentNoPatient = {
        ...mockPayment,
        booking: { ...mockPayment.booking, patient: null },
      };
      mockPrismaService.payment.findUnique.mockResolvedValue(paymentNoPatient);
      await service.createInvoice({ paymentId: 'payment-1' });
      const call = mockZatcaService.generateForInvoice.mock.calls[0][0];
      expect(call.buyerName).toBe('مريض');
    });

    it('uses service.nameAr as serviceDescription', async () => {
      await service.createInvoice({ paymentId: 'payment-1' });
      const call = mockZatcaService.generateForInvoice.mock.calls[0][0];
      expect(call.serviceDescription).toBe('استشارة عامة');
    });

    it('falls back to service.nameEn when nameAr is null', async () => {
      const paymentNoNameAr = {
        ...mockPayment,
        booking: {
          ...mockPayment.booking,
          service: { nameAr: null, nameEn: 'General Consultation' },
        },
      };
      mockPrismaService.payment.findUnique.mockResolvedValue(paymentNoNameAr);
      await service.createInvoice({ paymentId: 'payment-1' });
      const call = mockZatcaService.generateForInvoice.mock.calls[0][0];
      expect(call.serviceDescription).toBe('General Consultation');
    });

    it('falls back to خدمة طبية when both service names are null', async () => {
      const paymentNoNames = {
        ...mockPayment,
        booking: {
          ...mockPayment.booking,
          service: { nameAr: null, nameEn: null },
        },
      };
      mockPrismaService.payment.findUnique.mockResolvedValue(paymentNoNames);
      await service.createInvoice({ paymentId: 'payment-1' });
      const call = mockZatcaService.generateForInvoice.mock.calls[0][0];
      expect(call.serviceDescription).toBe('خدمة طبية');
    });
  });

  describe('createInvoice — DB save', () => {
    it('calls prisma.invoice.create with zatcaData fields', async () => {
      await service.createInvoice({ paymentId: 'payment-1' });
      const createCall = mockPrismaService.invoice.create.mock.calls[0][0];
      expect(createCall.data).toMatchObject({
        vatAmount: mockZatcaData.vatAmount,
        vatRate: mockZatcaData.vatRate,
        invoiceHash: mockZatcaData.invoiceHash,
        qrCodeData: mockZatcaData.qrCodeData,
        zatcaStatus: mockZatcaData.status,
        xmlContent: mockZatcaData.xmlContent,
      });
    });

    it('returns the created invoice', async () => {
      const result = await service.createInvoice({ paymentId: 'payment-1' });
      expect(result).toEqual(mockCreatedInvoice);
    });
  });

  describe('generateInvoiceHtml', () => {
    const mockFullInvoice = {
      id: 'invoice-1',
      invoiceNumber: 'INV-20260322-00001',
      paymentId: 'payment-1',
      vatAmount: 2250,
      vatRate: 15,
      createdAt: new Date('2026-03-22'),
      payment: {
        amount: 15000,
        vatAmount: 2250,
        totalAmount: 17250,
        method: 'moyasar',
        status: 'paid',
        transactionRef: null,
        booking: {
          type: 'clinic_visit',
          date: new Date('2026-03-22'),
          startTime: '10:00',
          patient: { firstName: 'أحمد', lastName: 'الراشد', email: null, phone: null },
          practitioner: {
            user: { id: 'u1', firstName: 'خالد', lastName: 'الفهد' },
          },
          service: { nameAr: 'استشارة عامة', nameEn: 'General Consultation' },
        },
      },
    };

    beforeEach(() => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(mockFullInvoice);
      mockPrismaService.whiteLabelConfig.findMany.mockResolvedValue([
        { key: 'clinic_name', value: 'عيادة النور' },
        { key: 'contact_phone', value: '+966500000000' },
      ]);
    });

    it('throws NotFoundException when invoice not found', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(null);
      await expect(service.generateInvoiceHtml('missing-id'))
        .rejects.toThrow(NotFoundException);
    });

    it('returns HTML string containing invoiceNumber', async () => {
      const html = await service.generateInvoiceHtml('invoice-1');
      expect(typeof html).toBe('string');
      expect(html).toContain('INV-20260322-00001');
    });

    it('returns HTML containing clinicName from whiteLabelConfig', async () => {
      const html = await service.generateInvoiceHtml('invoice-1');
      expect(html).toContain('عيادة النور');
    });
  });
});
