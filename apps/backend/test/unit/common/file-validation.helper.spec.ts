/**
 * validateFileContent Helper Unit Tests
 */
import { BadRequestException } from '@nestjs/common';
import { validateFileContent } from '../../../src/common/helpers/file-validation.helper.js';

describe('validateFileContent', () => {
  describe('JPEG validation', () => {
    it('should pass for valid JPEG buffer (0xff 0xd8 0xff)', () => {
      const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(() => validateFileContent(buf, 'image/jpeg')).not.toThrow();
    });

    it('should throw FILE_CONTENT_MISMATCH for invalid JPEG', () => {
      const buf = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      expect(() => validateFileContent(buf, 'image/jpeg')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('PNG validation', () => {
    it('should pass for valid PNG buffer (0x89 PNG header)', () => {
      const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(() => validateFileContent(buf, 'image/png')).not.toThrow();
    });

    it('should throw for buffer that is too short', () => {
      const buf = Buffer.from([0x89, 0x50]);
      expect(() => validateFileContent(buf, 'image/png')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('PDF validation', () => {
    it('should pass for valid PDF buffer (%PDF)', () => {
      const buf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
      expect(() => validateFileContent(buf, 'application/pdf')).not.toThrow();
    });

    it('should throw for invalid PDF magic bytes', () => {
      const buf = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      expect(() => validateFileContent(buf, 'application/pdf')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('WebP validation', () => {
    it('should pass for valid WebP buffer (RIFF...WEBP)', () => {
      const buf = Buffer.alloc(12);
      // RIFF header at offset 0
      buf[0] = 0x52;
      buf[1] = 0x49;
      buf[2] = 0x46;
      buf[3] = 0x46;
      // WEBP marker at offset 8
      buf[8] = 0x57;
      buf[9] = 0x45;
      buf[10] = 0x42;
      buf[11] = 0x50;
      expect(() => validateFileContent(buf, 'image/webp')).not.toThrow();
    });

    it('should throw for buffer with RIFF but not WEBP at offset 8', () => {
      const buf = Buffer.alloc(12);
      buf[0] = 0x52;
      buf[1] = 0x49;
      buf[2] = 0x46;
      buf[3] = 0x46;
      // Wrong marker at offset 8
      buf[8] = 0x00;
      buf[9] = 0x00;
      buf[10] = 0x00;
      buf[11] = 0x00;
      expect(() => validateFileContent(buf, 'image/webp')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('text/plain validation', () => {
    it('should skip content validation for text/plain', () => {
      const buf = Buffer.from('Hello, world!');
      expect(() => validateFileContent(buf, 'text/plain')).not.toThrow();
    });
  });

  describe('unsupported MIME types', () => {
    it('should throw UNSUPPORTED_FILE_TYPE for unknown mime type', () => {
      const buf = Buffer.from([0x00, 0x00]);
      expect(() => validateFileContent(buf, 'video/mp4')).toThrow(
        BadRequestException,
      );
    });
  });
});
