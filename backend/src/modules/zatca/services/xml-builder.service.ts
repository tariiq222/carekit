import { Injectable } from '@nestjs/common';
import { create } from 'xmlbuilder2';

interface InvoiceParty {
  name: string;
  vatNumber: string;
  address: string;
  city: string;
}

interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number; // halalat
  vatRate: number; // percentage (0 or 15)
  vatAmount: number; // halalat
  lineTotal: number; // halalat (without VAT)
}

export interface ZatcaXmlInput {
  invoiceNumber: string;
  uuid: string;
  issueDate: string; // YYYY-MM-DD
  issueTime: string; // HH:mm:ss
  invoiceHash: string; // Base64 SHA-256 of previous invoice (or zeros for first)
  seller: InvoiceParty;
  buyer: { name: string; vatNumber?: string };
  lines: InvoiceLine[];
  totalExcludingVat: number; // halalat
  vatAmount: number; // halalat
  totalIncludingVat: number; // halalat
}

@Injectable()
export class XmlBuilderService {
  /**
   * Builds a ZATCA-compliant UBL 2.1 XML invoice string.
   * Supports Simplified Invoice (B2C) — Phase 1 and Phase 2.
   */
  buildSimplifiedInvoice(input: ZatcaXmlInput): string {
    const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('Invoice', {
      xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
      'xmlns:cac':
        'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      'xmlns:cbc':
        'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      'xmlns:ext':
        'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
    });

    this.addHeader(root, input);
    this.addSeller(root, input.seller);
    this.addBuyer(root, input.buyer);
    this.addTaxTotal(
      root,
      input.totalExcludingVat,
      input.vatAmount,
      input.vatAmount > 0 ? (input.lines[0]?.vatRate ?? 15) : 0,
    );
    this.addLegalMonetaryTotal(root, input);
    this.addInvoiceLines(root, input.lines);

    return root.end({ prettyPrint: false });
  }

  private addHeader(
    root: ReturnType<typeof create>,
    input: ZatcaXmlInput,
  ): void {
    root.ele('cbc:UBLVersionID').txt('2.1').up();
    root.ele('cbc:ProfileID').txt('reporting:1.0').up();
    root.ele('cbc:ID').txt(input.invoiceNumber).up();
    root.ele('cbc:UUID').txt(input.uuid).up();
    root.ele('cbc:IssueDate').txt(input.issueDate).up();
    root.ele('cbc:IssueTime').txt(input.issueTime).up();
    root.ele('cbc:InvoiceTypeCode', { name: '0200000' }).txt('388').up();
    root.ele('cbc:DocumentCurrencyCode').txt('SAR').up();
    root.ele('cbc:TaxCurrencyCode').txt('SAR').up();
    root
      .ele('cac:AdditionalDocumentReference')
      .ele('cbc:ID')
      .txt('ICV')
      .up()
      .ele('cbc:UUID')
      .txt(input.invoiceNumber)
      .up()
      .up();
    root
      .ele('cac:AdditionalDocumentReference')
      .ele('cbc:ID')
      .txt('PIH')
      .up()
      .ele('cac:Attachment')
      .ele('cbc:EmbeddedDocumentBinaryObject', { mimeCode: 'text/plain' })
      .txt(input.invoiceHash)
      .up()
      .up()
      .up();
  }

  private addSeller(
    root: ReturnType<typeof create>,
    seller: InvoiceParty,
  ): void {
    const party = root.ele('cac:AccountingSupplierParty').ele('cac:Party');
    // Use TIN scheme if VAT number starts with 3 (15-digit TIN), otherwise CRN
    const schemeID =
      seller.vatNumber.length === 15 && seller.vatNumber.startsWith('3')
        ? 'TIN'
        : 'CRN';
    party
      .ele('cac:PartyIdentification')
      .ele('cbc:ID', { schemeID })
      .txt(seller.vatNumber)
      .up()
      .up();
    party
      .ele('cac:PostalAddress')
      .ele('cbc:CityName')
      .txt(seller.city)
      .up()
      .ele('cbc:StreetName')
      .txt(seller.address)
      .up()
      .ele('cac:Country')
      .ele('cbc:IdentificationCode')
      .txt('SA')
      .up()
      .up()
      .up();
    party
      .ele('cac:PartyTaxScheme')
      .ele('cbc:CompanyID')
      .txt(seller.vatNumber)
      .up()
      .ele('cac:TaxScheme')
      .ele('cbc:ID')
      .txt('VAT')
      .up()
      .up()
      .up();
    party
      .ele('cac:PartyLegalEntity')
      .ele('cbc:RegistrationName')
      .txt(seller.name)
      .up()
      .up();
    root.up();
  }

  private addBuyer(
    root: ReturnType<typeof create>,
    buyer: { name: string; vatNumber?: string },
  ): void {
    const party = root.ele('cac:AccountingCustomerParty').ele('cac:Party');
    party
      .ele('cac:PartyLegalEntity')
      .ele('cbc:RegistrationName')
      .txt(buyer.name)
      .up()
      .up();
    if (buyer.vatNumber) {
      party
        .ele('cac:PartyTaxScheme')
        .ele('cbc:CompanyID')
        .txt(buyer.vatNumber)
        .up()
        .ele('cac:TaxScheme')
        .ele('cbc:ID')
        .txt('VAT')
        .up()
        .up()
        .up();
    }
    root.up();
  }

  private addTaxTotal(
    root: ReturnType<typeof create>,
    totalExclVatHalalat: number,
    vatAmountHalalat: number,
    vatRate: number,
  ): void {
    const vatAmountSar = (vatAmountHalalat / 100).toFixed(2);
    const taxableAmountSar = (totalExclVatHalalat / 100).toFixed(2);
    root
      .ele('cac:TaxTotal')
      .ele('cbc:TaxAmount', { currencyID: 'SAR' })
      .txt(vatAmountSar)
      .up()
      .ele('cac:TaxSubtotal')
      .ele('cbc:TaxableAmount', { currencyID: 'SAR' })
      .txt(taxableAmountSar)
      .up()
      .ele('cbc:TaxAmount', { currencyID: 'SAR' })
      .txt(vatAmountSar)
      .up()
      .ele('cac:TaxCategory')
      .ele('cbc:ID', { schemeAgencyID: '6', schemeID: 'UN/ECE 5305' })
      .txt('S')
      .up()
      .ele('cbc:Percent')
      .txt(vatRate.toString())
      .up()
      .ele('cac:TaxScheme')
      .ele('cbc:ID')
      .txt('VAT')
      .up()
      .up()
      .up()
      .up()
      .up();
  }

  private addInvoiceLines(
    root: ReturnType<typeof create>,
    lines: InvoiceLine[],
  ): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const unitPriceSar = (line.unitPrice / 100).toFixed(2);
      const lineTotalSar = (line.lineTotal / 100).toFixed(2);
      const vatAmountSar = (line.vatAmount / 100).toFixed(2);

      root
        .ele('cac:InvoiceLine')
        .ele('cbc:ID')
        .txt(String(i + 1))
        .up()
        .ele('cbc:InvoicedQuantity', { unitCode: 'PCE' })
        .txt(line.quantity.toString())
        .up()
        .ele('cbc:LineExtensionAmount', { currencyID: 'SAR' })
        .txt(lineTotalSar)
        .up()
        .ele('cac:TaxTotal')
        .ele('cbc:TaxAmount', { currencyID: 'SAR' })
        .txt(vatAmountSar)
        .up()
        .ele('cbc:RoundingAmount', { currencyID: 'SAR' })
        .txt(((line.lineTotal + line.vatAmount) / 100).toFixed(2))
        .up()
        .up()
        .ele('cac:Item')
        .ele('cbc:Name')
        .txt(line.description)
        .up()
        .ele('cac:ClassifiedTaxCategory')
        .ele('cbc:ID')
        .txt('S')
        .up()
        .ele('cbc:Percent')
        .txt(line.vatRate.toString())
        .up()
        .ele('cac:TaxScheme')
        .ele('cbc:ID')
        .txt('VAT')
        .up()
        .up()
        .up()
        .up()
        .ele('cac:Price')
        .ele('cbc:PriceAmount', { currencyID: 'SAR' })
        .txt(unitPriceSar)
        .up()
        .up()
        .up();
    }
  }

  private addLegalMonetaryTotal(
    root: ReturnType<typeof create>,
    input: ZatcaXmlInput,
  ): void {
    const excl = (input.totalExcludingVat / 100).toFixed(2);
    const vat = (input.vatAmount / 100).toFixed(2);
    const incl = (input.totalIncludingVat / 100).toFixed(2);

    root
      .ele('cac:LegalMonetaryTotal')
      .ele('cbc:LineExtensionAmount', { currencyID: 'SAR' })
      .txt(excl)
      .up()
      .ele('cbc:TaxExclusiveAmount', { currencyID: 'SAR' })
      .txt(excl)
      .up()
      .ele('cbc:TaxInclusiveAmount', { currencyID: 'SAR' })
      .txt(incl)
      .up()
      .ele('cbc:AllowanceTotalAmount', { currencyID: 'SAR' })
      .txt('0.00')
      .up()
      .ele('cbc:PrepaidAmount', { currencyID: 'SAR' })
      .txt('0.00')
      .up()
      .ele('cbc:PayableAmount', { currencyID: 'SAR' })
      .txt(incl)
      .up()
      .up();
  }
}
