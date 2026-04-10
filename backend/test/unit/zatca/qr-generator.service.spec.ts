// Unit tests for QrGeneratorService — pure instantiation, no NestJS DI.
// Verifies TLV encoding, Base64 output, and amount formatting.

import { QrGeneratorService } from '../../../src/modules/zatca/services/qr-generator.service.js';

/** Decodes a Base64 TLV blob into a Map<tag, utf8Value>. */
function decodeTlv(base64: string): Map<number, string> {
  const buf = Buffer.from(base64, 'base64');
  const map = new Map<number, string>();
  let i = 0;
  while (i < buf.length) {
    const tag = buf.readUInt8(i++);
    const len = buf.readUInt8(i++);
    const value = buf.subarray(i, i + len).toString('utf8');
    map.set(tag, value);
    i += len;
  }
  return map;
}

const BASE_DATA = {
  sellerName: 'Acme Clinic',
  vatNumber: '310122393500003',
  invoiceDatetime: '2026-03-22T10:30:00Z',
  totalWithVat: 11500,
  vatAmount: 1500,
};

describe('QrGeneratorService', () => {
  let service: QrGeneratorService;

  beforeEach(() => {
    service = new QrGeneratorService();
  });

  it('returns a non-empty string', () => {
    const result = service.buildTlvBase64(BASE_DATA);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('output is valid Base64 (Buffer.from does not throw)', () => {
    const result = service.buildTlvBase64(BASE_DATA);
    expect(() => Buffer.from(result, 'base64')).not.toThrow();
  });

  it('tag 1 (SELLER_NAME): first byte is 0x01, second byte is UTF-8 byte length', () => {
    const result = service.buildTlvBase64(BASE_DATA);
    const raw = Buffer.from(result, 'base64');
    expect(raw.readUInt8(0)).toBe(1);
    const expectedLen = Buffer.byteLength(BASE_DATA.sellerName, 'utf8');
    expect(raw.readUInt8(1)).toBe(expectedLen);
  });

  it('tag 1 value matches sellerName', () => {
    const map = decodeTlv(service.buildTlvBase64(BASE_DATA));
    expect(map.get(1)).toBe(BASE_DATA.sellerName);
  });

  it('tag 2 (VAT_NUMBER) is present and correct', () => {
    const map = decodeTlv(service.buildTlvBase64(BASE_DATA));
    expect(map.get(2)).toBe(BASE_DATA.vatNumber);
  });

  it('tag 3 (INVOICE_DATETIME) is present and correct', () => {
    const map = decodeTlv(service.buildTlvBase64(BASE_DATA));
    expect(map.get(3)).toBe(BASE_DATA.invoiceDatetime);
  });

  it('tag 4 (TOTAL_WITH_VAT): totalWithVat=11500 encodes as "115.00"', () => {
    const map = decodeTlv(service.buildTlvBase64(BASE_DATA));
    expect(map.get(4)).toBe('115.00');
  });

  it('tag 5 (VAT_AMOUNT): vatAmount=1500 encodes as "15.00"', () => {
    const map = decodeTlv(service.buildTlvBase64(BASE_DATA));
    expect(map.get(5)).toBe('15.00');
  });

  it('vatAmount=0 encodes as "0.00"', () => {
    const map = decodeTlv(
      service.buildTlvBase64({ ...BASE_DATA, vatAmount: 0 }),
    );
    expect(map.get(5)).toBe('0.00');
  });

  it('Arabic seller name encodes correctly (multi-byte UTF-8)', () => {
    const arabicName = 'عيادة النور';
    const map = decodeTlv(
      service.buildTlvBase64({ ...BASE_DATA, sellerName: arabicName }),
    );
    expect(map.get(1)).toBe(arabicName);
  });

  it('Arabic seller name: tag 1 length byte matches actual UTF-8 byte length', () => {
    const arabicName = 'عيادة النور';
    const raw = Buffer.from(
      service.buildTlvBase64({ ...BASE_DATA, sellerName: arabicName }),
      'base64',
    );
    const expectedLen = Buffer.byteLength(arabicName, 'utf8');
    expect(raw.readUInt8(1)).toBe(expectedLen);
  });

  it('different inputs produce different Base64 outputs', () => {
    const out1 = service.buildTlvBase64(BASE_DATA);
    const out2 = service.buildTlvBase64({
      ...BASE_DATA,
      sellerName: 'Other Clinic',
    });
    expect(out1).not.toBe(out2);
  });

  it('15-digit VAT number is encoded correctly', () => {
    const vatNumber = '310122393500003';
    expect(vatNumber).toHaveLength(15);
    const map = decodeTlv(service.buildTlvBase64({ ...BASE_DATA, vatNumber }));
    expect(map.get(2)).toBe(vatNumber);
  });

  it('output contains exactly 5 TLV tags (1 through 5)', () => {
    const map = decodeTlv(service.buildTlvBase64(BASE_DATA));
    expect(map.size).toBe(5);
    for (let tag = 1; tag <= 5; tag++) {
      expect(map.has(tag)).toBe(true);
    }
  });
});
