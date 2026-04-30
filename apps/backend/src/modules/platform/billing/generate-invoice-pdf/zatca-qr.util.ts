/**
 * ZATCA Phase-1 simplified e-invoice QR encoder.
 *
 * Layout per triplet: `[tag (1 byte)][length (1 byte)][value (UTF-8 bytes)]`.
 * The five Phase-1 tags are:
 *   1 — seller name
 *   2 — VAT registration number
 *   3 — invoice timestamp (ISO-8601 UTC)
 *   4 — invoice total (VAT-inclusive)
 *   5 — VAT amount
 *
 * The function is pure: callers (typically a NestJS service) source seller
 * name and VAT number from `ConfigService` and pass them in. The function
 * never reads environment variables itself.
 */
export interface ZatcaQrFields {
  /** Seller (platform) display name in any language. */
  sellerName: string;
  /** Saudi VAT registration number. */
  vatNumber: string;
  /** ISO-8601 UTC timestamp string. */
  timestampIso: string;
  /** Total inclusive of VAT, fixed-2 string (e.g. "115.00"). */
  totalWithVat: string;
  /** VAT portion of the total, fixed-2 string (e.g. "15.00"). */
  vatAmount: string;
}

function tlv(tag: number, value: string): Buffer {
  const valueBuf = Buffer.from(value, 'utf8');
  if (valueBuf.length > 255) {
    throw new Error(
      `TLV value for tag ${tag} exceeds 255 bytes (got ${valueBuf.length})`,
    );
  }
  return Buffer.concat([Buffer.from([tag, valueBuf.length]), valueBuf]);
}

export function encodeZatcaQr(fields: ZatcaQrFields): string {
  const buf = Buffer.concat([
    tlv(1, fields.sellerName),
    tlv(2, fields.vatNumber),
    tlv(3, fields.timestampIso),
    tlv(4, fields.totalWithVat),
    tlv(5, fields.vatAmount),
  ]);
  return buf.toString('base64');
}
