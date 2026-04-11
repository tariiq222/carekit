import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { ClinicIntegrationsService } from '../../clinic-integrations/clinic-integrations.service.js';
import { ZatcaCryptoService } from './zatca-crypto.service.js';
import { ZatcaApiService } from './zatca-api.service.js';
import { XmlBuilderService } from './xml-builder.service.js';
import { InvoiceHashService } from './invoice-hash.service.js';
import { ZatcaService } from '../zatca.service.js';
import type { ZatcaConfig } from '../dto/zatca-config.dto.js';
import type {
  OnboardingResult,
  OnboardingStatus,
} from '../dto/zatca-onboard.dto.js';
import type { ZatcaCredentials } from './zatca-api.service.js';

const ZERO_HASH = '0'.repeat(64);
const TEST_INVOICE_COUNT = 6;

@Injectable()
export class ZatcaOnboardingService {
  private readonly logger = new Logger(ZatcaOnboardingService.name);

  constructor(
    private readonly clinicIntegrationsService: ClinicIntegrationsService,
    private readonly cryptoService: ZatcaCryptoService,
    private readonly apiService: ZatcaApiService,
    private readonly zatcaService: ZatcaService,
    private readonly xmlBuilder: XmlBuilderService,
    private readonly hashService: InvoiceHashService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Orchestrates the full ZATCA Phase 2 onboarding flow:
   * 1. Load config
   * 2. Generate ECDSA key pair
   * 3. Build CSR
   * 4. Request Compliance CSID
   * 5. Run 6 compliance test invoices
   * 6. Request Production CSID
   * 7. Encrypt + store credentials
   * 8. Update phase to phase2
   */
  async onboard(otp: string): Promise<OnboardingResult> {
    this.logger.log('Starting ZATCA Phase 2 onboarding...');

    const zatcaConfig = await this.zatcaService.loadConfig();
    this.validateConfig(zatcaConfig);

    // Generate key pair + CSR
    const { privateKey } = this.cryptoService.generateKeyPair();
    const csr = await this.buildCsr(zatcaConfig, privateKey);

    // Request Compliance CSID
    this.logger.log('Requesting compliance CSID...');
    const complianceResult = await this.apiService.requestComplianceCsid(
      csr,
      otp,
    );

    const complianceCredentials: ZatcaCredentials = {
      csid: complianceResult.binarySecurityToken,
      secret: complianceResult.secret,
    };

    // Run compliance tests
    this.logger.log('Running compliance invoice tests...');
    await this.runComplianceTests(zatcaConfig, complianceCredentials);

    // Exchange for Production CSID
    this.logger.log('Requesting production CSID...');
    const productionResult = await this.apiService.requestProductionCsid(
      complianceResult.requestID,
      complianceCredentials,
    );

    // Encrypt and store everything
    const encryptionKey = this.getEncryptionKey();
    const encryptedKey = this.cryptoService.encryptPrivateKey(
      privateKey,
      encryptionKey,
    );

    await this.storeCredentials({
      csid: productionResult.binarySecurityToken,
      secret: productionResult.secret,
      privateKey: encryptedKey,
      requestId: productionResult.requestID,
    });

    await this.updatePhase('phase2');

    this.logger.log('ZATCA onboarding completed successfully');
    return {
      success: true,
      message: 'ZATCA Phase 2 onboarding completed successfully',
      phase: 'phase2',
    };
  }

  /**
   * Returns the current onboarding status.
   */
  async getOnboardingStatus(): Promise<OnboardingStatus> {
    const integrations = await this.clinicIntegrationsService.getRaw();

    return {
      phase: (integrations.zatcaPhase ?? 'phase1') as 'phase1' | 'phase2',
      hasCredentials: !!(integrations.zatcaCsid && integrations.zatcaSecret),
      csidConfigured: !!integrations.zatcaCsid,
      privateKeyStored: !!integrations.zatcaPrivateKey,
    };
  }

  // ── Private helpers ────────────────────────────────────────

  private validateConfig(config: ZatcaConfig): void {
    if (!config.sellerName) {
      throw new BadRequestException(
        'Clinic name (sellerName) is required for ZATCA onboarding',
      );
    }

    const hasVatOrCr =
      config.vatRegistrationNumber || config.businessRegistration;
    if (!hasVatOrCr) {
      throw new BadRequestException(
        'VAT registration number or business registration is required',
      );
    }
  }

  private async buildCsr(
    config: ZatcaConfig,
    privateKey: string,
  ): Promise<string> {
    return this.cryptoService.generateCsr(privateKey, {
      commonName: config.sellerName,
      organizationUnit: 'CareKit',
      organization: config.sellerName,
      country: 'SA',
      serialNumber: `1-CareKit|2-15|3-${Date.now()}`,
      vatNumber: config.vatRegistrationNumber || config.businessRegistration,
      businessCategory: 'Healthcare',
    });
  }

  private async runComplianceTests(
    config: ZatcaConfig,
    credentials: ZatcaCredentials,
  ): Promise<void> {
    const testInvoices = this.buildTestInvoices(config);

    for (let i = 0; i < testInvoices.length; i++) {
      const test = testInvoices[i];
      this.logger.log(
        `Compliance test ${i + 1}/${testInvoices.length}: ${test.uuid}`,
      );

      const xmlBase64 = Buffer.from(test.xml).toString('base64');
      await this.apiService.checkCompliance(
        {
          invoiceHash: test.hash,
          uuid: test.uuid,
          invoice: xmlBase64,
        },
        credentials,
      );
    }

    this.logger.log('All compliance tests passed');
  }

  private buildTestInvoices(
    config: ZatcaConfig,
  ): Array<{ xml: string; hash: string; uuid: string }> {
    const invoices: Array<{ xml: string; hash: string; uuid: string }> = [];
    const now = new Date();
    const vatNumberOrCr =
      config.vatRegistrationNumber || config.businessRegistration;

    for (let i = 1; i <= TEST_INVOICE_COUNT; i++) {
      const uuid = crypto.randomUUID();
      const baseAmount = i * 10000; // 100-600 SAR in halalat
      const vatAmount = Math.round((baseAmount * config.vatRate) / 100);

      const xml = this.xmlBuilder.buildSimplifiedInvoice({
        invoiceNumber: `TEST-${String(i).padStart(3, '0')}`,
        uuid,
        issueDate: now.toISOString().split('T')[0],
        issueTime: now.toTimeString().split(' ')[0],
        invoiceHash: this.hashService.toBase64(ZERO_HASH),
        seller: {
          name: config.sellerName,
          vatNumber: vatNumberOrCr,
          address: config.sellerAddress,
          city: config.city,
        },
        buyer: { name: `Test Buyer ${i}` },
        lines: [
          {
            description: `Test Service ${i}`,
            quantity: 1,
            unitPrice: baseAmount,
            vatRate: config.vatRate,
            vatAmount,
            lineTotal: baseAmount,
          },
        ],
        totalExcludingVat: baseAmount,
        vatAmount,
        totalIncludingVat: baseAmount + vatAmount,
      });

      const hash = this.hashService.toBase64(this.hashService.hashXml(xml));
      invoices.push({ xml, hash, uuid });
    }

    return invoices;
  }

  private async storeCredentials(data: {
    csid: string;
    secret: string;
    privateKey: string;
    requestId: string;
  }): Promise<void> {
    await this.clinicIntegrationsService.update({
      zatcaCsid: data.csid,
      zatcaSecret: data.secret,
      zatcaPrivateKey: data.privateKey,
      zatcaRequestId: data.requestId,
    });
  }

  private async updatePhase(phase: string): Promise<void> {
    await this.clinicIntegrationsService.update({ zatcaPhase: phase });
  }

  private getEncryptionKey(): string {
    const key =
      this.config.get<string>('ZATCA_ENCRYPTION_KEY') ??
      this.config.get<string>('JWT_SECRET');

    if (!key) {
      throw new BadRequestException(
        'ZATCA_ENCRYPTION_KEY or JWT_SECRET must be configured',
      );
    }

    return key;
  }
}
