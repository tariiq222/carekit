import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../database/prisma.service.js';
import { InvoiceHashService } from './services/invoice-hash.service.js';
import { QrGeneratorService } from './services/qr-generator.service.js';
import { XmlBuilderService } from './services/xml-builder.service.js';
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
      'clinic_name',
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
      sellerName: map['clinic_name'] ?? '',
      sellerAddress: map['seller_address'] ?? '',
      city: map['clinic_city'] ?? '',
    };
  }

  /**
   * Returns the base64-encoded zero hash used as previousHash for the first invoice.
   * Exposed so callers can use it inside their own transactions for atomic hash chaining.
   */
  zeroHash(): string {
    return this.hashService.toBase64(ZERO_HASH);
  }

  /**
   * Gets the hash of the last issued invoice for hash chaining.
   * @deprecated Use zeroHash() + an inline query inside a Serializable transaction instead
   * to avoid the race condition where two concurrent invoices get the same previousHash.
   */
  async getPreviousInvoiceHash(): Promise<string> {
    const last = await this.prisma.invoice.findFirst({
      where: { invoiceHash: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { invoiceHash: true },
    }) as { invoiceHash: string | null } | null;

    return last?.invoiceHash ?? this.zeroHash();
  }

  /**
   * Main entry point: generates all ZATCA data for an invoice.
   * Phase 1: QR Code only, no API call.
   * Phase 2: XML + QR Code + hash (API call done separately after DB save).
   */
  async generateForInvoice(input: GenerateZatcaDataInput): Promise<ZatcaInvoiceData> {
    const { config, baseAmount } = input;

    const vatAmount = Math.round((baseAmount * config.vatRate) / 100);
    const totalAmount = baseAmount + vatAmount;
    const previousHash = input.previousInvoiceHash ?? await this.getPreviousInvoiceHash();

    const vatNumberOrCr = config.vatRegistrationNumber || config.businessRegistration;
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
        previousHash,
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
      invoiceHash: previousHash,
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

    const invoiceHash = this.hashService.toBase64(this.hashService.hashXml(xmlContent));

    return {
      vatAmount,
      vatRate: config.vatRate,
      totalAmount,
      invoiceHash,
      previousHash,
      qrCodeData,
      xmlContent,
      status: 'pending',
    };
  }
}
