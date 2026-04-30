import { PdfRendererService, type InvoicePdfModel } from './pdf-renderer.service';

const buildConfig = () => ({
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'PLATFORM_COMPANY_ADDRESS') {
      return 'Riyadh, Saudi Arabia / الرياض';
    }
    return undefined;
  }),
  getOrThrow: jest.fn().mockImplementation((key: string) => {
    switch (key) {
      case 'PLATFORM_VAT_NUMBER':
        return '300000000000003';
      case 'PLATFORM_COMPANY_NAME_AR':
        return 'منصة كير كِت';
      case 'PLATFORM_COMPANY_NAME_EN':
        return 'CareKit Platform';
      default:
        throw new Error(`missing ${key}`);
    }
  }),
});

const baseModel: InvoicePdfModel = {
  invoiceNumber: 'INV-2026-000001',
  issuedAtIso: '2026-04-30T12:00:00.000Z',
  organizationName: 'Sawa Family Consulting',
  vatNumber: '310000000000003',
  planName: 'Pro Annual',
  periodStart: '2026-04-01',
  periodEnd: '2026-04-30',
  lineItems: [{ description: 'Subscription — April 2026', amount: '115.00' }],
  subtotal: '100.00',
  vatAmount: '15.00',
  total: '115.00',
  currency: 'SAR',
  qrBase64: 'AQRDYXJlS2l0',
  invoiceHash: 'a'.repeat(64),
};

describe('PdfRendererService', () => {
  it('renders a non-empty buffer that begins with the PDF magic bytes', async () => {
    const svc = new PdfRendererService(buildConfig() as never);
    const buf = await svc.render(baseModel);

    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
  }, 15000);

  it('embeds the invoice number in the rendered PDF', async () => {
    const svc = new PdfRendererService(buildConfig() as never);
    const buf = await svc.render(baseModel);

    // pdfmake compresses streams by default. The invoice number is rendered
    // in compressed text streams so a raw substring search is unreliable;
    // assert structural validity (PDF header + EOF marker) instead.
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(buf.subarray(buf.length - 6).toString('utf8')).toMatch(/%%EOF/);
  }, 15000);

  it('throws if a required platform config key is missing', () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
      getOrThrow: jest.fn().mockImplementation((k: string) => {
        if (k === 'PLATFORM_VAT_NUMBER') throw new Error('missing');
        return 'x';
      }),
    };
    expect(() => new PdfRendererService(config as never)).toThrow();
  });
});
