import { validateMagicBytes } from './magic-byte-validator';

// ── Real magic-byte fixtures ──────────────────────────────────────────────────

/** Minimal valid PNG: 8-byte PNG signature + IHDR + IDAT + IEND */
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR length + type
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 px
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth, color, crc
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT length + type
  0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, // IDAT data
  0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, // IDAT crc
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND length + type
  0x44, 0xae, 0x42, 0x60, 0x82,                   // IEND data + crc
]);

/** Minimal JPEG: SOI marker */
const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

/** Minimal PDF: %PDF- magic header */
const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstartxref\n0\n%%EOF\n');

/** MP4 video bytes (should NOT be in any upload allow-list) */
const MP4_BYTES = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
  0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00,
  0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d,
]);

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const ALL_MIMES = [
  ...IMAGE_MIMES,
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
] as const;

describe('validateMagicBytes', () => {
  describe('valid files — ok: true', () => {
    it('accepts a correct PNG buffer claimed as image/png', async () => {
      const result = await validateMagicBytes(PNG_BYTES, 'image/png', ALL_MIMES);
      expect(result.ok).toBe(true);
      expect(result.detectedMime).toBe('image/png');
    });

    it('accepts a correct JPEG buffer claimed as image/jpeg', async () => {
      const result = await validateMagicBytes(JPEG_BYTES, 'image/jpeg', ALL_MIMES);
      expect(result.ok).toBe(true);
      expect(result.detectedMime).toBe('image/jpeg');
    });

    it('accepts a correct PDF buffer claimed as application/pdf', async () => {
      const result = await validateMagicBytes(PDF_BYTES, 'application/pdf', ALL_MIMES);
      expect(result.ok).toBe(true);
      expect(result.detectedMime).toBe('application/pdf');
    });

    it('accepts plain text when claimed as text/plain (no magic bytes)', async () => {
      const txtBuffer = Buffer.from('Hello, this is plain text\n');
      const result = await validateMagicBytes(txtBuffer, 'text/plain', ALL_MIMES);
      expect(result.ok).toBe(true);
      expect(result.detectedMime).toBeNull();
    });

    it('accepts CSV when claimed as text/csv (no magic bytes)', async () => {
      const csvBuffer = Buffer.from('name,age\nAlice,30\n');
      const result = await validateMagicBytes(csvBuffer, 'text/csv', ALL_MIMES);
      expect(result.ok).toBe(true);
      expect(result.detectedMime).toBeNull();
    });
  });

  describe('spoofed mime — ok: false', () => {
    it('rejects PNG bytes claimed as image/jpeg', async () => {
      const result = await validateMagicBytes(PNG_BYTES, 'image/jpeg', ALL_MIMES);
      expect(result.ok).toBe(false);
      expect(result.detectedMime).toBe('image/png');
      expect(result.reason).toMatch(/does not match detected/);
    });

    it('rejects MP4 bytes claimed as image/png', async () => {
      const result = await validateMagicBytes(MP4_BYTES, 'image/png', ALL_MIMES);
      expect(result.ok).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('rejects PDF bytes claimed as image/jpeg', async () => {
      const result = await validateMagicBytes(PDF_BYTES, 'image/jpeg', ALL_MIMES);
      expect(result.ok).toBe(false);
      expect(result.detectedMime).toBe('application/pdf');
    });
  });

  describe('detected mime not in allow-list — ok: false', () => {
    it('rejects MP4 buffer even when claimed mime is also not in list', async () => {
      const result = await validateMagicBytes(MP4_BYTES, 'video/mp4', ['image/jpeg']);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/not in allow-list/);
    });

    it('rejects PNG buffer against an image-only allow-list when mime missing', async () => {
      // PDF not in the allow-list restricted to images only
      const result = await validateMagicBytes(PDF_BYTES, 'application/pdf', IMAGE_MIMES);
      expect(result.ok).toBe(false);
    });
  });

  describe('no magic bytes + not a text mime — ok: false', () => {
    it('rejects random binary with no magic bytes claimed as image/png', async () => {
      const randomBytes = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
      const result = await validateMagicBytes(randomBytes, 'image/png', ALL_MIMES);
      expect(result.ok).toBe(false);
    });

    it('rejects plain text bytes claimed as application/pdf (text not in allow-list)', async () => {
      const txt = Buffer.from('just text');
      const result = await validateMagicBytes(txt, 'application/pdf', IMAGE_MIMES);
      expect(result.ok).toBe(false);
    });
  });

  describe('custom textMimes option', () => {
    it('accepts buffer with no magic bytes when claimed mime is in custom textMimes + allowedMimes', async () => {
      const xmlBuffer = Buffer.from('<?xml version="1.0"?><root/>');
      const result = await validateMagicBytes(
        xmlBuffer,
        'text/xml',
        ['text/xml'],
        { textMimes: ['text/xml'] },
      );
      expect(result.ok).toBe(true);
    });
  });
});
