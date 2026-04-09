import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { InvoiceHashService } from './services/invoice-hash.service.js';
import { QrGeneratorService } from './services/qr-generator.service.js';
import { XmlBuilderService } from './services/xml-builder.service.js';
import { ClinicSettingsService } from '../clinic-settings/clinic-settings.service.js';
import { ClinicIntegrationsService } from '../clinic-integrations/clinic-integrations.service.js';
import {
  ZatcaConfig,
  GenerateZatcaDataInput,
  ZatcaInvoiceData,
} from './dto/zatca-config.dto.js';

const ZERO_HASH = '0'.repeat(64);

@Injectable()
export class ZatcaService {
  constructor(
    private readonly hashService: InvoiceHashService,
    private readonly qrService: QrGeneratorService,
    private readonly xmlBuilder: XmlBuilderService,
    private readonly clinicSettingsService: ClinicSettingsService,
    private readonly clinicIntegrationsService: ClinicIntegrationsService,
  ) {}

  async loadConfig(): Promise<ZatcaConfig> {
    const [settings, integrations] = await Promise.all([
      this.clinicSettingsService.get(),
      this.clinicIntegrationsService.getRaw(),
    ]);

    return {
      phase: (integrations.zatcaPhase ?? 'phase1') as 'phase1' | 'phase2',
      vatRate: Number(settings.vatRate ?? 0),
      vatRegistrationNumber: settings.vatRegistrationNumber ?? '',
      businessRegistration: settings.businessRegistration ?? '',
      sellerName: settings.companyNameAr ?? '',
      sellerAddress: settings.sellerAddress ?? '',
      city: settings.clinicCity ?? '',
    };
  }

  /**
   * Returns the base64-encoded zero hash used as previousHash for the first invoice.
   * Callers MUST use this inside a Serializable transaction together with the
   * inline query that reads the last invoice hash — this is the only safe way
   * to guarantee atomic hash chaining.
   */
  zeroHash(): string {
    return this.hashService.toBase64(ZERO_HASH);
  }

  /**
   * Main entry point: generates all ZATCA data for an invoice.
   * Phase 1: QR Code only, no API call.
   * Phase 2: XML + QR Code + hash (API call done separately after DB save).
   *
   * IMPORTANT: `previousInvoiceHash` is required. Callers must read the last
   * invoice hash inside a Serializable transaction and pass it here.
   * This prevents the race condition where two concurrent invoices
   * get the same previousHash.
   */
  generateForInvoice(input: GenerateZatcaDataInput): ZatcaInvoiceData {
    const { config, baseAmount, previousInvoiceHash } = input;

    const vatAmount = Math.round((baseAmount * config.vatRate) / 100);
    const totalAmount = baseAmount + vatAmount;

    const vatNumberOrCr =
      config.vatRegistrationNumber || config.businessRegistration;
    const qrCodeData = this.qrService.buildTlvBase64({
      sellerName: config.sellerName,
      vatNumber: vatNumberOrCr,
      invoiceDatetime: `${input.issueDate}T${input.issueTime}`,
      totalWithVat: totalAmount,
      vatAmount,
    });

    if (config.phase === 'phase1') {
      const hashInput = this.hashService.buildHashInput({
        invoiceNumber: input.invoiceNumber,
        issueDate: input.issueDate,
        issueTime: input.issueTime,
        totalAmount,
        vatAmount,
      });
      const invoiceHash = this.hashService.toBase64(
        this.hashService.hashXml(hashInput),
      );

      return {
        vatAmount,
        vatRate: config.vatRate,
        totalAmount,
        invoiceHash,
        previousHash: previousInvoiceHash,
        qrCodeData,
        xmlContent: null,
        status: 'not_applicable',
      };
    }

    // Phase 2: build full XML
    const xmlContent = this.xmlBuilder.buildSimplifiedInvoice({
      invoiceNumber: input.invoiceNumber,
      uuid: input.uuid ?? uuidv4(),
      issueDate: input.issueDate,
      issueTime: input.issueTime,
      invoiceHash: previousInvoiceHash,
      seller: {
        name: config.sellerName,
        vatNumber: vatNumberOrCr,
        address: config.sellerAddress,
        city: config.city,
      },
      buyer: { name: input.buyerName },
      lines: [
        {
          description: input.serviceDescription,
          quantity: 1,
          unitPrice: baseAmount,
          vatRate: config.vatRate,
          vatAmount,
          lineTotal: baseAmount,
        },
      ],
      totalExcludingVat: baseAmount,
      vatAmount,
      totalIncludingVat: totalAmount,
    });

    const invoiceHash = this.hashService.toBase64(
      this.hashService.hashXml(xmlContent),
    );

    return {
      vatAmount,
      vatRate: config.vatRate,
      totalAmount,
      invoiceHash,
      previousHash: previousInvoiceHash,
      qrCodeData,
      xmlContent,
      status: 'pending',
    };
  }
}
