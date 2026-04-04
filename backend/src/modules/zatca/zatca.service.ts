import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { InvoiceHashService } from './services/invoice-hash.service.js';
import { QrGeneratorService } from './services/qr-generator.service.js';
import { XmlBuilderService } from './services/xml-builder.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  ZatcaConfig,
  GenerateZatcaDataInput,
  ZatcaInvoiceData,
} from './dto/zatca-config.dto.js';

const ZERO_HASH = '0'.repeat(64);

@Injectable()
export class ZatcaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashService: InvoiceHashService,
    private readonly qrService: QrGeneratorService,
    private readonly xmlBuilder: XmlBuilderService,
  ) {}

  /**
   * Loads ZATCA config from WhiteLabelConfig table.
   */
  async loadConfig(): Promise<ZatcaConfig> {
    const keys = [
      'zatca_phase',
      'vat_rate',
      'vat_registration_number',
      'business_registration',
      'system_name',
      'seller_address',
      'clinic_city',
    ];

    const configs = await this.prisma.whiteLabelConfig.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });

    const map = Object.fromEntries(configs.map((c) => [c.key, c.value]));

    return {
      phase: (map['zatca_phase'] ?? 'phase1') as 'phase1' | 'phase2',
      vatRate: parseInt(map['vat_rate'] ?? '0', 10),
      vatRegistrationNumber: map['vat_registration_number'] ?? '',
      businessRegistration: map['business_registration'] ?? '',
      sellerName: map['system_name'] ?? '',
      sellerAddress: map['seller_address'] ?? '',
      city: map['clinic_city'] ?? '',
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
