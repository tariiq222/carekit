/**
 * CareKit — ZatcaService Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ZatcaService } from '../zatca.service.js';
import { InvoiceHashService } from '../services/invoice-hash.service.js';
import { QrGeneratorService } from '../services/qr-generator.service.js';
import { XmlBuilderService } from '../services/xml-builder.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

const ZERO_HASH = '0'.repeat(64);

const mockPrisma = {
  whiteLabelConfig: { findMany: jest.fn() },
  invoice: { findFirst: jest.fn() },
};
const mockHashService = {
  hashXml: jest.fn().mockReturnValue('deadbeef'),
  toBase64: jest.fn((v: string) => Buffer.from(v, 'hex').toString('base64')),
  buildHashInput: jest.fn().mockReturnValue('canonical|input'),
};
const mockQrService = { buildTlvBase64: jest.fn().mockReturnValue('base64qrdata==') };
const mockXmlBuilder = { buildSimplifiedInvoice: jest.fn().mockReturnValue('<Invoice/>') };

const makeConfig = (overrides = {}) => ({
  phase: 'phase1' as const,
  vatRate: 15,
  vatRegistrationNumber: '300000000000003',
  businessRegistration: 'CR-12345',
  sellerName: 'Test Clinic',
  sellerAddress: '123 Main St',
  city: 'Riyadh',
  ...overrides,
});

const makeInput = (overrides = {}) => ({
  invoiceNumber: 'INV-001',
  uuid: 'uuid-abc-123',
  issueDate: '2026-03-22',
  issueTime: '10:00:00',
  buyerName: 'Ahmed Ali',
  serviceDescription: 'Consultation',
  baseAmount: 15000,
  previousInvoiceHash: null,
  config: makeConfig(),
  ...overrides,
});

describe('ZatcaService', () => {
  let service: ZatcaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZatcaService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InvoiceHashService, useValue: mockHashService },
        { provide: QrGeneratorService, useValue: mockQrService },
        { provide: XmlBuilderService, useValue: mockXmlBuilder },
      ],
    }).compile();
    service = module.get<ZatcaService>(ZatcaService);
  });

  // ─── loadConfig ───────────────────────────────────────────────────────────

  describe('loadConfig', () => {
    it('returns correct config from DB keys', async () => {
      mockPrisma.whiteLabelConfig.findMany.mockResolvedValue([
        { key: 'zatca_phase', value: 'phase2' },
        { key: 'vat_rate', value: '15' },
        { key: 'vat_registration_number', value: '300000000000003' },
        { key: 'business_registration', value: 'CR-12345' },
        { key: 'clinic_name', value: 'Test Clinic' },
        { key: 'seller_address', value: '123 Main St' },
        { key: 'clinic_city', value: 'Riyadh' },
      ]);
      const config = await service.loadConfig();
      expect(config.phase).toBe('phase2');
      expect(config.vatRate).toBe(15);
      expect(config.vatRegistrationNumber).toBe('300000000000003');
      expect(config.businessRegistration).toBe('CR-12345');
      expect(config.sellerName).toBe('Test Clinic');
      expect(config.sellerAddress).toBe('123 Main St');
      expect(config.city).toBe('Riyadh');
    });

    it('defaults to phase1 when zatca_phase not set', async () => {
      mockPrisma.whiteLabelConfig.findMany.mockResolvedValue([
        { key: 'vat_rate', value: '15' },
      ]);
      const config = await service.loadConfig();
      expect(config.phase).toBe('phase1');
    });

    it('defaults vatRate to 0 when vat_rate not set', async () => {
      mockPrisma.whiteLabelConfig.findMany.mockResolvedValue([
        { key: 'zatca_phase', value: 'phase1' },
      ]);
      const config = await service.loadConfig();
      expect(config.vatRate).toBe(0);
    });

    it('uses empty string for missing vat_registration_number', async () => {
      mockPrisma.whiteLabelConfig.findMany.mockResolvedValue([
        { key: 'zatca_phase', value: 'phase1' },
      ]);
      const config = await service.loadConfig();
      expect(config.vatRegistrationNumber).toBe('');
    });
  });

  // ─── getPreviousInvoiceHash ────────────────────────────────────────────────

  describe('getPreviousInvoiceHash', () => {
    it('returns last invoice hash when an invoice exists', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({ invoiceHash: 'abc123hash' });
      const hash = await service.getPreviousInvoiceHash();
      expect(hash).toBe('abc123hash');
    });

    it('returns Base64 of zero hash when no invoices exist', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      const hash = await service.getPreviousInvoiceHash();
      expect(mockHashService.toBase64).toHaveBeenCalledWith(ZERO_HASH);
      expect(hash).toBeDefined();
    });
  });

  // ─── generateForInvoice — Phase 1 ─────────────────────────────────────────

  describe('generateForInvoice — Phase 1', () => {
    beforeEach(() => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
    });

    it('calculates vatAmount correctly (15000 * 15/100 = 2250)', async () => {
      const result = await service.generateForInvoice(makeInput());
      expect(result.vatAmount).toBe(2250);
    });

    it('sets vatAmount = 0 when vatRate = 0', async () => {
      const result = await service.generateForInvoice(
        makeInput({ config: makeConfig({ vatRate: 0 }) }),
      );
      expect(result.vatAmount).toBe(0);
    });

    it('sets totalAmount = baseAmount + vatAmount', async () => {
      const result = await service.generateForInvoice(makeInput());
      expect(result.totalAmount).toBe(15000 + 2250);
    });

    it('sets status = not_applicable', async () => {
      const result = await service.generateForInvoice(makeInput());
      expect(result.status).toBe('not_applicable');
    });

    it('sets xmlContent = null', async () => {
      const result = await service.generateForInvoice(makeInput());
      expect(result.xmlContent).toBeNull();
    });

    it('sets qrCodeData from qrService', async () => {
      const result = await service.generateForInvoice(makeInput());
      expect(mockQrService.buildTlvBase64).toHaveBeenCalled();
      expect(result.qrCodeData).toBe('base64qrdata==');
    });

    it('sets invoiceHash from hashService', async () => {
      const result = await service.generateForInvoice(makeInput());
      expect(mockHashService.hashXml).toHaveBeenCalled();
      expect(result.invoiceHash).toBeDefined();
    });

    it('uses vatRegistrationNumber when set', async () => {
      await service.generateForInvoice(makeInput());
      const qrArg = mockQrService.buildTlvBase64.mock.calls[0][0] as { vatNumber: string };
      expect(qrArg.vatNumber).toBe('300000000000003');
    });

    it('falls back to businessRegistration when vatRegistrationNumber is empty', async () => {
      const input = makeInput({
        config: makeConfig({ vatRegistrationNumber: '', businessRegistration: 'CR-99999' }),
      });
      await service.generateForInvoice(input);
      const qrArg = mockQrService.buildTlvBase64.mock.calls[0][0] as { vatNumber: string };
      expect(qrArg.vatNumber).toBe('CR-99999');
    });

    it('uses provided previousInvoiceHash without calling getPreviousInvoiceHash', async () => {
      const spy = jest.spyOn(service, 'getPreviousInvoiceHash');
      const result = await service.generateForInvoice(
        makeInput({ previousInvoiceHash: 'PREV_HASH_PROVIDED' }),
      );
      expect(spy).not.toHaveBeenCalled();
      expect(result.previousHash).toBe('PREV_HASH_PROVIDED');
    });
  });

  // ─── generateForInvoice — Phase 2 ─────────────────────────────────────────

  describe('generateForInvoice — Phase 2', () => {
    beforeEach(() => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      mockXmlBuilder.buildSimplifiedInvoice.mockReturnValue('<Invoice>phase2xml</Invoice>');
    });

    const phase2Input = () => makeInput({ config: makeConfig({ phase: 'phase2' }) });

    it('sets status = pending', async () => {
      const result = await service.generateForInvoice(phase2Input());
      expect(result.status).toBe('pending');
    });

    it('sets xmlContent from xmlBuilder', async () => {
      const result = await service.generateForInvoice(phase2Input());
      expect(mockXmlBuilder.buildSimplifiedInvoice).toHaveBeenCalled();
      expect(result.xmlContent).toBe('<Invoice>phase2xml</Invoice>');
    });

    it('hashes the XML and sets invoiceHash', async () => {
      const result = await service.generateForInvoice(phase2Input());
      expect(mockHashService.hashXml).toHaveBeenCalledWith('<Invoice>phase2xml</Invoice>');
      expect(result.invoiceHash).toBeDefined();
    });

    it('sets qrCodeData from qrService', async () => {
      const result = await service.generateForInvoice(phase2Input());
      expect(mockQrService.buildTlvBase64).toHaveBeenCalled();
      expect(result.qrCodeData).toBe('base64qrdata==');
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    beforeEach(() => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
    });

    it('vatAmount = 0 and totalAmount = 0 when baseAmount = 0', async () => {
      const result = await service.generateForInvoice(makeInput({ baseAmount: 0 }));
      expect(result.vatAmount).toBe(0);
      expect(result.totalAmount).toBe(0);
    });

    it('rounds VAT: 10001 * 15/100 = 1500.15 → 1500', async () => {
      const result = await service.generateForInvoice(makeInput({ baseAmount: 10001 }));
      expect(result.vatAmount).toBe(1500);
    });
  });
});
