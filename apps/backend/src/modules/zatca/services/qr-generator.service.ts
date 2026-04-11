import { Injectable } from '@nestjs/common';
import { QR_TAGS } from '../constants/zatca.constants.js';

interface QrInvoiceData {
  sellerName: string;
  vatNumber: string; // VAT registration number or CR number
  invoiceDatetime: string; // ISO 8601 format
  totalWithVat: number; // in halalat (integer)
  vatAmount: number; // in halalat (integer)
}

@Injectable()
export class QrGeneratorService {
  /**
   * Builds TLV (Tag-Length-Value) encoded Base64 string for ZATCA QR Code.
   * Phase 1: 5 mandatory fields.
   * The TLV binary is Base64-encoded, then passed to a QR code renderer.
   */
  buildTlvBase64(data: QrInvoiceData): string {
    const buffers = [
      this.encodeTlv(QR_TAGS.SELLER_NAME, data.sellerName),
      this.encodeTlv(QR_TAGS.VAT_NUMBER, data.vatNumber),
      this.encodeTlv(QR_TAGS.INVOICE_DATETIME, data.invoiceDatetime),
      this.encodeTlv(
        QR_TAGS.TOTAL_WITH_VAT,
        this.formatAmount(data.totalWithVat),
      ),
      this.encodeTlv(QR_TAGS.VAT_AMOUNT, this.formatAmount(data.vatAmount)),
    ];

    const combined = Buffer.concat(buffers);
    return combined.toString('base64');
  }

  private encodeTlv(tag: number, value: string): Buffer {
    const valueBytes = Buffer.from(value, 'utf8');
    const tlv = Buffer.alloc(2 + valueBytes.length);
    tlv.writeUInt8(tag, 0);
    tlv.writeUInt8(valueBytes.length, 1);
    valueBytes.copy(tlv, 2);
    return tlv;
  }

  /**
   * Converts halalat integer to riyal decimal string.
   * Example: 11500 halalat → "115.00"
   */
  private formatAmount(halalat: number): string {
    return (halalat / 100).toFixed(2);
  }
}
