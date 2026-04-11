import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class InvoiceHashService {
  /**
   * Generates SHA-256 hash of the invoice XML content.
   * Used for hash chaining — each invoice stores its own hash
   * and references the previous invoice's hash.
   */
  hashXml(xmlContent: string): string {
    return createHash('sha256').update(xmlContent, 'utf8').digest('hex');
  }

  /**
   * Encodes a hash string to Base64 as required by ZATCA XML.
   */
  toBase64(hash: string): string {
    return Buffer.from(hash, 'hex').toString('base64');
  }

  /**
   * Encodes the full XML content to Base64 for ZATCA API submission.
   */
  xmlToBase64(xmlContent: string): string {
    return Buffer.from(xmlContent, 'utf8').toString('base64');
  }

  /**
   * Builds the canonical hash input from invoice fields
   * before XML generation (used for hash chain validation).
   */
  buildHashInput(params: {
    invoiceNumber: string;
    issueDate: string;
    issueTime: string;
    totalAmount: number;
    vatAmount: number;
  }): string {
    return [
      params.invoiceNumber,
      params.issueDate,
      params.issueTime,
      params.totalAmount.toString(),
      params.vatAmount.toString(),
    ].join('|');
  }
}
