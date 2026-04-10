/**
 * CareKit — ZatcaService Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ZatcaService } from '../../../src/modules/zatca/zatca.service.js';
import { InvoiceHashService } from '../../../src/modules/zatca/services/invoice-hash.service.js';
import { QrGeneratorService } from '../../../src/modules/zatca/services/qr-generator.service.js';
import { XmlBuilderService } from '../../../src/modules/zatca/services/xml-builder.service.js';
import { ClinicSettingsService } from '../../../src/modules/clinic-settings/clinic-settings.service.js';
import { ClinicIntegrationsService } from '../../../src/modules/clinic-integrations/clinic-integrations.service.js';

const ZERO_HASH = '0'.repeat(64);

const mockClinicSettingsService = {
  get: jest.fn().mockResolvedValue({
    vatRate: 15,
    vatRegistrationNumber: '300000000000003',
    businessRegistration: 'CR-12345',
    companyNameAr: 'Test Clinic',
    sellerAddress: '123 Main St',
    clinicCity: 'Riyadh',
  }),
};

const mockClinicIntegrationsService = {
  getRaw: jest.fn().mockResolvedValue({
    zatcaPhase: 'phase1',
    zatcaCsid: null,
    zatcaSecret: null,
    zatcaPrivateKey: null,
  }),
};
const mockHashService = {
  hashXml: jest.fn().mockReturnValue('deadbeef'),
  toBase64: jest.fn((v: string) => Buffer.from(v, 'hex').toString('base64')),
  buildHashInput: jest.fn().mockReturnValue('canonical|input'),
};
const mockQrService = {
  buildTlvBase64: jest.fn().mockReturnValue('base64qrdata=='),
};
const mockXmlBuilder = {
  buildSimplifiedInvoice: jest.fn().mockReturnValue('<Invoice/>'),
};

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
  previousInvoiceHash: 'PREV_HASH_BASE64',
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
        { provide: ClinicSettingsService, useValue: mockClinicSettingsService },
        {
          provide: ClinicIntegrationsService,
          useValue: mockClinicIntegrationsService,
        },
        { provide: InvoiceHashService, useValue: mockHashService },
        { provide: QrGeneratorService, useValue: mockQrService },
        { provide: XmlBuilderService, useValue: mockXmlBuilder },
      ],
    }).compile();
    service = module.get<ZatcaService>(ZatcaService);
  });

  // ─── loadConfig ───────────────────────────────────────────────────────────

  describe('loadConfig', () => {
    it('returns correct config from ClinicSettings + ClinicIntegrations', async () => {
      mockClinicSettingsService.get.mockResolvedValue({
        vatRate: 15,
        vatRegistrationNumber: '300000000000003',
        businessRegistration: 'CR-12345',
        companyNameAr: 'Test Clinic',
        sellerAddress: '123 Main St',
        clinicCity: 'Riyadh',
      });
      mockClinicIntegrationsService.getRaw.mockResolvedValue({
        zatcaPhase: 'phase2',
        zatcaCsid: null,
        zatcaSecret: null,
        zatcaPrivateKey: null,
      });
      const config = await service.loadConfig();
      expect(config.phase).toBe('phase2');
      expect(config.vatRate).toBe(15);
      expect(config.vatRegistrationNumber).toBe('300000000000003');
      expect(config.businessRegistration).toBe('CR-12345');
      expect(config.sellerName).toBe('Test Clinic');
      expect(config.sellerAddress).toBe('123 Main St');
      expect(config.city).toBe('Riyadh');
    });

    it('defaults to phase1 when zatcaPhase not set', async () => {
      mockClinicIntegrationsService.getRaw.mockResolvedValue({
        zatcaPhase: null,
        zatcaCsid: null,
        zatcaSecret: null,
        zatcaPrivateKey: null,
      });
      const config = await service.loadConfig();
      expect(config.phase).toBe('phase1');
    });

    it('defaults vatRate to 0 when vatRate not set', async () => {
      mockClinicSettingsService.get.mockResolvedValue({
        vatRate: null,
        vatRegistrationNumber: '',
        businessRegistration: '',
        companyNameAr: '',
        sellerAddress: '',
        clinicCity: '',
      });
      const config = await service.loadConfig();
      expect(config.vatRate).toBe(0);
    });

    it('uses empty string for missing vatRegistrationNumber', async () => {
      mockClinicSettingsService.get.mockResolvedValue({
        vatRate: 15,
        vatRegistrationNumber: null,
        businessRegistration: '',
        companyNameAr: '',
        sellerAddress: '',
        clinicCity: '',
      });
      const config = await service.loadConfig();
      expect(config.vatRegistrationNumber).toBe('');
    });
  });

  // ─── zeroHash ─────────────────────────────────────────────────────────────

  describe('zeroHash', () => {
    it('returns Base64-encoded zero hash', () => {
      const hash = service.zeroHash();
      expect(mockHashService.toBase64).toHaveBeenCalledWith(ZERO_HASH);
      expect(hash).toBeDefined();
    });
  });

  // ─── generateForInvoice — previousInvoiceHash is now required by TS type ──

  describe('generateForInvoice — previousInvoiceHash', () => {
    it('uses provided previousInvoiceHash directly', () => {
      const result = service.generateForInvoice(
        makeInput({ previousInvoiceHash: 'MY_PREV_HASH' }),
      );
      expect(result.previousHash).toBe('MY_PREV_HASH');
    });

    it('previousInvoiceHash is enforced at compile time (string, not optional)', () => {
      // This test documents that previousInvoiceHash is a required string
      // in GenerateZatcaDataInput — TypeScript prevents null/undefined at compile time.
      // The old getPreviousInvoiceHash() fallback has been removed to prevent
      // the race condition where two concurrent invoices share the same previousHash.
      const input = makeInput();
      expect(typeof input.previousInvoiceHash).toBe('string');
    });
  });

  // ─── generateForInvoice — Phase 1 ─────────────────────────────────────────

  describe('generateForInvoice — Phase 1', () => {
    it('calculates vatAmount correctly (15000 * 15/100 = 2250)', () => {
      const result = service.generateForInvoice(makeInput());
      expect(result.vatAmount).toBe(2250);
    });

    it('sets vatAmount = 0 when vatRate = 0', () => {
      const result = service.generateForInvoice(
        makeInput({ config: makeConfig({ vatRate: 0 }) }),
      );
      expect(result.vatAmount).toBe(0);
    });

    it('sets totalAmount = baseAmount + vatAmount', () => {
      const result = service.generateForInvoice(makeInput());
      expect(result.totalAmount).toBe(15000 + 2250);
    });

    it('sets status = not_applicable', () => {
      const result = service.generateForInvoice(makeInput());
      expect(result.status).toBe('not_applicable');
    });

    it('sets xmlContent = null', () => {
      const result = service.generateForInvoice(makeInput());
      expect(result.xmlContent).toBeNull();
    });

    it('sets qrCodeData from qrService', () => {
      const result = service.generateForInvoice(makeInput());
      expect(mockQrService.buildTlvBase64).toHaveBeenCalled();
      expect(result.qrCodeData).toBe('base64qrdata==');
    });

    it('sets invoiceHash from hashService', () => {
      const result = service.generateForInvoice(makeInput());
      expect(mockHashService.hashXml).toHaveBeenCalled();
      expect(result.invoiceHash).toBeDefined();
    });

    it('uses vatRegistrationNumber when set', () => {
      service.generateForInvoice(makeInput());
      const qrArg = mockQrService.buildTlvBase64.mock.calls[0][0] as {
        vatNumber: string;
      };
      expect(qrArg.vatNumber).toBe('300000000000003');
    });

    it('falls back to businessRegistration when vatRegistrationNumber is empty', () => {
      const input = makeInput({
        config: makeConfig({
          vatRegistrationNumber: '',
          businessRegistration: 'CR-99999',
        }),
      });
      service.generateForInvoice(input);
      const qrArg = mockQrService.buildTlvBase64.mock.calls[0][0] as {
        vatNumber: string;
      };
      expect(qrArg.vatNumber).toBe('CR-99999');
    });
  });

  // ─── generateForInvoice — Phase 2 ─────────────────────────────────────────

  describe('generateForInvoice — Phase 2', () => {
    beforeEach(() => {
      mockXmlBuilder.buildSimplifiedInvoice.mockReturnValue(
        '<Invoice>phase2xml</Invoice>',
      );
    });

    const phase2Input = () =>
      makeInput({ config: makeConfig({ phase: 'phase2' }) });

    it('sets status = pending', () => {
      const result = service.generateForInvoice(phase2Input());
      expect(result.status).toBe('pending');
    });

    it('sets xmlContent from xmlBuilder', () => {
      const result = service.generateForInvoice(phase2Input());
      expect(mockXmlBuilder.buildSimplifiedInvoice).toHaveBeenCalled();
      expect(result.xmlContent).toBe('<Invoice>phase2xml</Invoice>');
    });

    it('hashes the XML and sets invoiceHash', () => {
      const result = service.generateForInvoice(phase2Input());
      expect(mockHashService.hashXml).toHaveBeenCalledWith(
        '<Invoice>phase2xml</Invoice>',
      );
      expect(result.invoiceHash).toBeDefined();
    });

    it('sets qrCodeData from qrService', () => {
      const result = service.generateForInvoice(phase2Input());
      expect(mockQrService.buildTlvBase64).toHaveBeenCalled();
      expect(result.qrCodeData).toBe('base64qrdata==');
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('vatAmount = 0 and totalAmount = 0 when baseAmount = 0', () => {
      const result = service.generateForInvoice(makeInput({ baseAmount: 0 }));
      expect(result.vatAmount).toBe(0);
      expect(result.totalAmount).toBe(0);
    });

    it('rounds VAT: 10001 * 15/100 = 1500.15 → 1500', () => {
      const result = service.generateForInvoice(
        makeInput({ baseAmount: 10001 }),
      );
      expect(result.vatAmount).toBe(1500);
    });
  });
});
