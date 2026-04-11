import { BadRequestException } from '@nestjs/common';

/**
 * Magic-byte signatures for validating file content matches declared MIME type.
 * Each entry contains one or more byte sequences that must ALL match for the type.
 */
const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number }[]> = {
  'image/jpeg': [{ bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4e, 0x47] }],
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header at offset 0
    { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // WEBP at offset 8
  ],
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    { bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK zip header (DOCX is a zip archive)
  ],
  'application/msword': [{ bytes: [0xd0, 0xcf, 0x11, 0xe0] }], // OLE2 compound document
  'text/plain': [], // No magic bytes — text files have no fixed signature
};

/**
 * Validates that a file's binary content matches its declared MIME type
 * by checking magic bytes (file signatures).
 *
 * This provides defense-in-depth against attackers who spoof the
 * Content-Type header to bypass multer's fileFilter.
 *
 * @throws BadRequestException if content does not match declared type
 */
export function validateFileContent(
  buffer: Buffer,
  declaredMimeType: string,
): void {
  const signatures = MAGIC_BYTES[declaredMimeType];

  if (signatures === undefined) {
    throw new BadRequestException({
      statusCode: 400,
      message: 'Unsupported file type',
      error: 'UNSUPPORTED_FILE_TYPE',
    });
  }

  // Types with no magic bytes (e.g. text/plain) skip content validation
  if (signatures.length === 0) {
    return;
  }

  for (const sig of signatures) {
    const offset = sig.offset ?? 0;

    if (buffer.length < offset + sig.bytes.length) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'File content does not match declared type',
        error: 'FILE_CONTENT_MISMATCH',
      });
    }

    const matches = sig.bytes.every((byte, i) => buffer[offset + i] === byte);

    if (!matches) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'File content does not match declared type',
        error: 'FILE_CONTENT_MISMATCH',
      });
    }
  }
}
