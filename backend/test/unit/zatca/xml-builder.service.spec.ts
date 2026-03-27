import { XmlBuilderService, type ZatcaXmlInput } from '../../../src/modules/zatca/services/xml-builder.service.js';

const baseInput: ZatcaXmlInput = {
  invoiceNumber: 'INV-20260322-12345',
  uuid: '550e8400-e29b-41d4-a716-446655440000',
  issueDate: '2026-03-22',
  issueTime: '10:30:00',
  invoiceHash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  seller: {
    name: 'عيادة الرعاية',
    vatNumber: '300000000000003',
    address: 'شارع الملك فهد',
    city: 'الرياض',
  },
  buyer: { name: 'أحمد الراشد' },
  lines: [
    {
      description: 'استشارة عامة',
      quantity: 1,
      unitPrice: 15000,
      vatRate: 15,
      vatAmount: 2250,
      lineTotal: 15000,
    },
  ],
  totalExcludingVat: 15000,
  vatAmount: 2250,
  totalIncludingVat: 17250,
};

describe('XmlBuilderService', () => {
  let service: XmlBuilderService;
  let xml: string;

  beforeAll(() => {
    service = new XmlBuilderService();
    xml = service.buildSimplifiedInvoice(baseInput);
  });

  // --- Output validity ---

  it('returns a non-empty string', () => {
    expect(typeof xml).toBe('string');
    expect(xml.length).toBeGreaterThan(0);
  });

  it('starts with an XML declaration', () => {
    expect(xml.trimStart()).toMatch(/^<\?xml/);
  });

  it('contains UBL Invoice namespace', () => {
    expect(xml).toContain('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2');
  });

  it('contains <Invoice root element', () => {
    expect(xml).toContain('<Invoice');
  });

  // --- Required UBL fields ---

  it('contains UBLVersionID 2.1', () => {
    expect(xml).toContain('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>');
  });

  it('contains ProfileID reporting:1.0', () => {
    expect(xml).toContain('<cbc:ProfileID>reporting:1.0</cbc:ProfileID>');
  });

  it('contains invoiceNumber as cbc:ID', () => {
    expect(xml).toContain('<cbc:ID>INV-20260322-12345</cbc:ID>');
  });

  it('contains uuid as cbc:UUID', () => {
    expect(xml).toContain('<cbc:UUID>550e8400-e29b-41d4-a716-446655440000</cbc:UUID>');
  });

  it('contains issueDate', () => {
    expect(xml).toContain('<cbc:IssueDate>2026-03-22</cbc:IssueDate>');
  });

  it('contains InvoiceTypeCode with name=0200000 and value 388', () => {
    expect(xml).toContain('<cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>');
  });

  it('contains DocumentCurrencyCode SAR', () => {
    expect(xml).toContain('<cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>');
  });

  // --- Seller / Buyer ---

  it('contains seller name', () => {
    expect(xml).toContain('عيادة الرعاية');
  });

  it('contains seller VAT number', () => {
    expect(xml).toContain('300000000000003');
  });

  it('contains seller city', () => {
    expect(xml).toContain('الرياض');
  });

  it('contains buyer name', () => {
    expect(xml).toContain('أحمد الراشد');
  });

  it('does NOT include buyer PartyTaxScheme when vatNumber is not provided', () => {
    const xmlNoBuyerVat = service.buildSimplifiedInvoice({
      ...baseInput,
      buyer: { name: 'أحمد الراشد' },
    });
    const customerPartyBlock = xmlNoBuyerVat.match(
      /<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/,
    )?.[0] ?? '';
    expect(customerPartyBlock).not.toContain('PartyTaxScheme');
  });

  it('DOES include buyer PartyTaxScheme when vatNumber is provided', () => {
    const xmlWithBuyerVat = service.buildSimplifiedInvoice({
      ...baseInput,
      buyer: { name: 'أحمد الراشد', vatNumber: '311111111111113' },
    });
    const customerPartyBlock = xmlWithBuyerVat.match(
      /<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/,
    )?.[0] ?? '';
    expect(customerPartyBlock).toContain('PartyTaxScheme');
    expect(customerPartyBlock).toContain('311111111111113');
  });

  // --- Financial amounts ---

  it('TaxAmount equals (vatAmount/100).toFixed(2) = 22.50', () => {
    expect(xml).toContain('<cbc:TaxAmount currencyID="SAR">22.50</cbc:TaxAmount>');
  });

  it('PayableAmount equals (totalIncludingVat/100).toFixed(2) = 172.50', () => {
    expect(xml).toContain('<cbc:PayableAmount currencyID="SAR">172.50</cbc:PayableAmount>');
  });

  it('LineExtensionAmount equals (totalExcludingVat/100).toFixed(2) = 150.00', () => {
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="SAR">150.00</cbc:LineExtensionAmount>');
  });

  it('AllowanceTotalAmount is 0.00', () => {
    expect(xml).toContain('<cbc:AllowanceTotalAmount currencyID="SAR">0.00</cbc:AllowanceTotalAmount>');
  });

  it('PrepaidAmount is 0.00', () => {
    expect(xml).toContain('<cbc:PrepaidAmount currencyID="SAR">0.00</cbc:PrepaidAmount>');
  });

  // --- Hash chaining ---

  it('contains invoiceHash in PIH EmbeddedDocumentBinaryObject', () => {
    expect(xml).toContain('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
  });

  // --- VAT edge cases ---

  it('TaxAmount is 0.00 when vatAmount is 0', () => {
    const xmlZeroVat = service.buildSimplifiedInvoice({
      ...baseInput,
      vatAmount: 0,
      totalIncludingVat: 15000,
      lines: [{ ...baseInput.lines[0], vatAmount: 0 }],
    });
    expect(xmlZeroVat).toContain('<cbc:TaxAmount currencyID="SAR">0.00</cbc:TaxAmount>');
  });
});
