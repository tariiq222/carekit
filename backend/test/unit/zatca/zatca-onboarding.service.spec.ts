/**
 * CareKit — ZatcaOnboardingService Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZatcaOnboardingService } from '../../../src/modules/zatca/services/zatca-onboarding.service.js';
import { ClinicIntegrationsService } from '../../../src/modules/clinic-integrations/clinic-integrations.service.js';
import { ZatcaCryptoService } from '../../../src/modules/zatca/services/zatca-crypto.service.js';
import { ZatcaApiService } from '../../../src/modules/zatca/services/zatca-api.service.js';
import { XmlBuilderService } from '../../../src/modules/zatca/services/xml-builder.service.js';
import { InvoiceHashService } from '../../../src/modules/zatca/services/invoice-hash.service.js';
import { ZatcaService } from '../../../src/modules/zatca/zatca.service.js';
import type { ZatcaConfig } from '../../../src/modules/zatca/dto/zatca-config.dto.js';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockClinicIntegrationsService = {
  getRaw: jest.fn().mockResolvedValue({
    zatcaPhase: 'phase1',
    zatcaCsid: null,
    zatcaSecret: null,
    zatcaPrivateKey: null,
    zatcaRequestId: null,
  }),
  update: jest.fn().mockResolvedValue({}),
};

const mockCryptoService = {
  generateKeyPair: jest.fn(),
  generateCsr: jest.fn(),
  encryptPrivateKey: jest.fn(),
};

const mockApiService = {
  requestComplianceCsid: jest.fn(),
  requestProductionCsid: jest.fn(),
  checkCompliance: jest.fn(),
};

const mockZatcaService = {
  loadConfig: jest.fn(),
};

const mockXmlBuilder = {
  buildSimplifiedInvoice: jest.fn(),
};

const mockHashService = {
  hashXml: jest.fn(),
  toBase64: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
};

// ── Fixtures ─────────────────────────────────────────────────────────────

const validConfig: ZatcaConfig = {
  phase: 'phase1',
  vatRate: 15,
  vatRegistrationNumber: '300000000000003',
  businessRegistration: 'CR-12345',
  sellerName: 'Test Clinic',
  sellerAddress: '123 Main St',
  city: 'Riyadh',
};

function makeConfig(overrides: Partial<ZatcaConfig> = {}): ZatcaConfig {
  return { ...validConfig, ...overrides };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('ZatcaOnboardingService', () => {
  let service: ZatcaOnboardingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZatcaOnboardingService,
        { provide: ClinicIntegrationsService, useValue: mockClinicIntegrationsService },
        { provide: ZatcaCryptoService, useValue: mockCryptoService },
        { provide: ZatcaApiService, useValue: mockApiService },
        { provide: ZatcaService, useValue: mockZatcaService },
        { provide: XmlBuilderService, useValue: mockXmlBuilder },
        { provide: InvoiceHashService, useValue: mockHashService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<ZatcaOnboardingService>(ZatcaOnboardingService);
  });

  // ─── onboard ────────────────────────────────────────────────────────

  describe('onboard', () => {
    beforeEach(() => {
      // Default: full happy-path stubs
      mockZatcaService.loadConfig.mockResolvedValue(makeConfig());
      mockCryptoService.generateKeyPair.mockReturnValue({
        privateKey:
          '-----BEGIN EC PRIVATE KEY-----\ntest-key\n-----END EC PRIVATE KEY-----',
        publicKey:
          '-----BEGIN PUBLIC KEY-----\ntest-pub\n-----END PUBLIC KEY-----',
      });
      mockCryptoService.generateCsr.mockResolvedValue('base64-csr-string');
      mockCryptoService.encryptPrivateKey.mockReturnValue('encrypted-key');

      mockApiService.requestComplianceCsid.mockResolvedValue({
        requestID: 'comp-req-001',
        binarySecurityToken: 'bst-compliance',
        secret: 'secret-compliance',
      });
      mockApiService.checkCompliance.mockResolvedValue({
        status: '200',
        validationResults: { status: 'PASS' },
      });
      mockApiService.requestProductionCsid.mockResolvedValue({
        requestID: 'prod-req-001',
        binarySecurityToken: 'bst-production',
        secret: 'secret-production',
      });

      mockXmlBuilder.buildSimplifiedInvoice.mockReturnValue(
        '<Invoice>test</Invoice>',
      );
      mockHashService.hashXml.mockReturnValue('raw-hash-hex');
      mockHashService.toBase64.mockReturnValue('base64-hash');

      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'ZATCA_ENCRYPTION_KEY')
          return 'encryption-key-32chars-long!';
        if (key === 'JWT_SECRET') return 'jwt-secret';
        return undefined;
      });

      mockClinicIntegrationsService.update.mockResolvedValue({});
    });

    it('should complete full onboarding flow successfully', async () => {
      const result = await service.onboard('123456');

      expect(result.success).toBe(true);
      expect(result.phase).toBe('phase2');
      expect(result.message).toContain('successfully');
    });

    it('should generate key pair and CSR', async () => {
      await service.onboard('123456');

      expect(mockCryptoService.generateKeyPair).toHaveBeenCalled();
      expect(mockCryptoService.generateCsr).toHaveBeenCalledWith(
        expect.any(String), // privateKey
        expect.objectContaining({
          commonName: 'Test Clinic',
          country: 'SA',
          businessCategory: 'Healthcare',
        }),
      );
    });

    it('should request compliance CSID with CSR and OTP', async () => {
      await service.onboard('987654');

      expect(mockApiService.requestComplianceCsid).toHaveBeenCalledWith(
        'base64-csr-string',
        '987654',
      );
    });

    it('should run 6 compliance test invoices', async () => {
      await service.onboard('123456');

      // 6 compliance checks
      expect(mockApiService.checkCompliance).toHaveBeenCalledTimes(6);
    });

    it('should request production CSID after compliance tests pass', async () => {
      await service.onboard('123456');

      expect(mockApiService.requestProductionCsid).toHaveBeenCalledWith(
        'comp-req-001',
        {
          csid: 'bst-compliance',
          secret: 'secret-compliance',
        },
      );
    });

    it('should encrypt and store credentials', async () => {
      await service.onboard('123456');

      expect(mockCryptoService.encryptPrivateKey).toHaveBeenCalledWith(
        expect.any(String),
        'encryption-key-32chars-long!',
      );
      // Credentials update + phase update
      expect(mockClinicIntegrationsService.update).toHaveBeenCalled();
    });

    it('should update phase to phase2', async () => {
      await service.onboard('123456');

      expect(mockClinicIntegrationsService.update).toHaveBeenCalledWith(
        expect.objectContaining({ zatcaPhase: 'phase2' }),
      );
    });

    it('should throw if sellerName is missing', async () => {
      mockZatcaService.loadConfig.mockResolvedValue(
        makeConfig({ sellerName: '' }),
      );

      await expect(service.onboard('123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if both vatRegistrationNumber and businessRegistration are missing', async () => {
      mockZatcaService.loadConfig.mockResolvedValue(
        makeConfig({
          vatRegistrationNumber: '',
          businessRegistration: '',
        }),
      );

      await expect(service.onboard('123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if API fails during compliance CSID request', async () => {
      mockApiService.requestComplianceCsid.mockRejectedValue(
        new Error('ZATCA API request failed: 401'),
      );

      await expect(service.onboard('123456')).rejects.toThrow(
        'ZATCA API request failed: 401',
      );
    });

    it('should throw if encryption key is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await expect(service.onboard('123456')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── getOnboardingStatus ────────────────────────────────────────────

  describe('getOnboardingStatus', () => {
    it('should return phase2 status when all credentials are stored', async () => {
      mockClinicIntegrationsService.getRaw.mockResolvedValue({
        zatcaPhase: 'phase2',
        zatcaCsid: 'some-csid',
        zatcaSecret: 'some-secret',
        zatcaPrivateKey: 'encrypted-key',
      });

      const status = await service.getOnboardingStatus();

      expect(status.phase).toBe('phase2');
      expect(status.hasCredentials).toBe(true);
      expect(status.csidConfigured).toBe(true);
      expect(status.privateKeyStored).toBe(true);
    });

    it('should return phase1 (not_started) when no credentials exist', async () => {
      mockClinicIntegrationsService.getRaw.mockResolvedValue({
        zatcaPhase: null,
        zatcaCsid: null,
        zatcaSecret: null,
        zatcaPrivateKey: null,
      });

      const status = await service.getOnboardingStatus();

      expect(status.phase).toBe('phase1');
      expect(status.hasCredentials).toBe(false);
      expect(status.csidConfigured).toBe(false);
      expect(status.privateKeyStored).toBe(false);
    });

    it('should return in_progress when CSID exists but private key missing', async () => {
      mockClinicIntegrationsService.getRaw.mockResolvedValue({
        zatcaPhase: 'phase1',
        zatcaCsid: 'some-csid',
        zatcaSecret: null,
        zatcaPrivateKey: null,
      });

      const status = await service.getOnboardingStatus();

      expect(status.phase).toBe('phase1');
      expect(status.csidConfigured).toBe(true);
      expect(status.privateKeyStored).toBe(false);
      expect(status.hasCredentials).toBe(false);
    });

    it('should detect phase2 with partial credentials', async () => {
      mockClinicIntegrationsService.getRaw.mockResolvedValue({
        zatcaPhase: 'phase2',
        zatcaCsid: 'some-csid',
        zatcaSecret: 'some-secret',
        zatcaPrivateKey: null,
      });

      const status = await service.getOnboardingStatus();

      expect(status.phase).toBe('phase2');
      expect(status.hasCredentials).toBe(true);
      expect(status.privateKeyStored).toBe(false);
    });
  });
});
