import { encodeZatcaQr, type ZatcaQrFields } from './zatca-qr.util';

const sample: ZatcaQrFields = {
  sellerName: 'Deqah Platform',
  vatNumber: '300000000000003',
  timestampIso: '2026-04-30T12:00:00.000Z',
  totalWithVat: '115.00',
  vatAmount: '15.00',
};

function decodeTlv(b64: string): Array<{ tag: number; value: string }> {
  const buf = Buffer.from(b64, 'base64');
  const out: Array<{ tag: number; value: string }> = [];
  let i = 0;
  while (i < buf.length) {
    const tag = buf[i++];
    const len = buf[i++];
    const value = buf.subarray(i, i + len).toString('utf8');
    i += len;
    out.push({ tag, value });
  }
  return out;
}

describe('encodeZatcaQr', () => {
  it('produces base64 that decodes to the 5 expected TLV triplets in order', () => {
    const b64 = encodeZatcaQr(sample);
    const parts = decodeTlv(b64);

    expect(parts).toEqual([
      { tag: 1, value: 'Deqah Platform' },
      { tag: 2, value: '300000000000003' },
      { tag: 3, value: '2026-04-30T12:00:00.000Z' },
      { tag: 4, value: '115.00' },
      { tag: 5, value: '15.00' },
    ]);
  });

  it('encodes Arabic seller names via UTF-8', () => {
    const b64 = encodeZatcaQr({ ...sample, sellerName: 'منصة دِقة' });
    const parts = decodeTlv(b64);
    expect(parts[0]).toEqual({ tag: 1, value: 'منصة دِقة' });
  });

  it('is deterministic for identical input', () => {
    expect(encodeZatcaQr(sample)).toBe(encodeZatcaQr({ ...sample }));
  });

  it('throws when a value exceeds 255 bytes', () => {
    const long = 'a'.repeat(256);
    expect(() => encodeZatcaQr({ ...sample, sellerName: long })).toThrow(
      /exceeds 255 bytes/,
    );
  });

  it('emits a known-vector base64 for a fixed input', () => {
    // Hand-computed reference value:
    // tag 1 + len 14 + "Deqah Platform"
    // tag 2 + len 15 + "300000000000003"
    // tag 3 + len 24 + "2026-04-30T12:00:00.000Z"
    // tag 4 + len 6  + "115.00"
    // tag 5 + len 5  + "15.00"
    const b64 = encodeZatcaQr(sample);
    const expected = Buffer.concat([
      Buffer.from([1, 14]),
      Buffer.from('Deqah Platform', 'utf8'),
      Buffer.from([2, 15]),
      Buffer.from('300000000000003', 'utf8'),
      Buffer.from([3, 24]),
      Buffer.from('2026-04-30T12:00:00.000Z', 'utf8'),
      Buffer.from([4, 6]),
      Buffer.from('115.00', 'utf8'),
      Buffer.from([5, 5]),
      Buffer.from('15.00', 'utf8'),
    ]).toString('base64');
    expect(b64).toBe(expected);
  });
});
