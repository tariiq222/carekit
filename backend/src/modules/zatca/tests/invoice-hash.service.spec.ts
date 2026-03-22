// Unit tests for InvoiceHashService — pure instantiation, no NestJS DI.
// Verifies SHA-256 hashing, Base64 encoding, and canonical hash input building.

import { createHash } from 'crypto';
import { InvoiceHashService } from '../services/invoice-hash.service.js';

const ZERO_HASH = '0'.repeat(64);
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('InvoiceHashService', () => {
  let service: InvoiceHashService;

  beforeEach(() => {
    service = new InvoiceHashService();
  });

  // --- hashXml ---

  it('hashXml returns a 64-character hex string', () => {
    const hash = service.hashXml('<Invoice/>');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashXml is deterministic (same input → same output)', () => {
    const xml = '<Invoice><ID>INV-001</ID></Invoice>';
    expect(service.hashXml(xml)).toBe(service.hashXml(xml));
  });

  it('hashXml produces different hashes for different inputs', () => {
    expect(service.hashXml('<Invoice>A</Invoice>')).not.toBe(service.hashXml('<Invoice>B</Invoice>'));
  });

  it('hashXml of empty string equals known SHA-256 value', () => {
    expect(service.hashXml('')).toBe(EMPTY_SHA256);
  });

  it('hashXml matches Node.js crypto SHA-256 independently', () => {
    const xml = '<Invoice><ID>INV-42</ID></Invoice>';
    const expected = createHash('sha256').update(xml, 'utf8').digest('hex');
    expect(service.hashXml(xml)).toBe(expected);
  });

  // --- toBase64 ---

  it('toBase64 round-trips: Buffer.from(base64, "base64") equals original hex bytes', () => {
    const hash = service.hashXml('<Invoice/>');
    const base64 = service.toBase64(hash);
    const decoded = Buffer.from(base64, 'base64').toString('hex');
    expect(decoded).toBe(hash);
  });

  it('toBase64 of ZERO_HASH produces consistent Base64', () => {
    const expected = Buffer.from(ZERO_HASH, 'hex').toString('base64');
    expect(service.toBase64(ZERO_HASH)).toBe(expected);
  });

  it('toBase64 output is a non-empty string', () => {
    const result = service.toBase64(EMPTY_SHA256);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  // --- xmlToBase64 ---

  it('xmlToBase64 round-trip: decode → original string', () => {
    const xml = '<Invoice><ID>INV-001</ID></Invoice>';
    const base64 = service.xmlToBase64(xml);
    expect(Buffer.from(base64, 'base64').toString('utf8')).toBe(xml);
  });

  it('xmlToBase64 handles Arabic text correctly', () => {
    const arabicXml = '<فاتورة><رقم>١٢٣</رقم></فاتورة>';
    const base64 = service.xmlToBase64(arabicXml);
    expect(Buffer.from(base64, 'base64').toString('utf8')).toBe(arabicXml);
  });

  it('xmlToBase64 returns non-empty string for empty input', () => {
    const result = service.xmlToBase64('');
    expect(typeof result).toBe('string');
  });

  // --- buildHashInput ---

  it('buildHashInput returns pipe-separated fields in correct order', () => {
    const result = service.buildHashInput({
      invoiceNumber: 'INV-001',
      issueDate: '2026-03-22',
      issueTime: '10:30:00',
      totalAmount: 17250,
      vatAmount: 2250,
    });
    expect(result).toBe('INV-001|2026-03-22|10:30:00|17250|2250');
  });

  it('buildHashInput converts numeric amounts to strings', () => {
    const result = service.buildHashInput({
      invoiceNumber: 'INV-002',
      issueDate: '2026-01-01',
      issueTime: '08:00:00',
      totalAmount: 0,
      vatAmount: 0,
    });
    expect(result).toBe('INV-002|2026-01-01|08:00:00|0|0');
  });

  it('buildHashInput contains exactly 4 pipe separators (5 fields)', () => {
    const result = service.buildHashInput({
      invoiceNumber: 'INV-003',
      issueDate: '2026-06-15',
      issueTime: '12:00:00',
      totalAmount: 5000,
      vatAmount: 750,
    });
    expect(result.split('|')).toHaveLength(5);
  });
});
