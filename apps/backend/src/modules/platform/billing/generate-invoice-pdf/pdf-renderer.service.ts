import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import QRCode from 'qrcode';
import { fonts as fontMap, vfs } from './fonts/vfs-fonts';

// pdfmake ships a server-side `PdfPrinter` class plus a VFS + URL resolver.
// The published `@types/pdfmake` only describes the browser API, so we type
// the server shape locally. We assemble the printer manually (mirroring
// pdfmake's `base.js#createPdf`) to inject our embedded font VFS and skip
// remote URL fetching.
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
const PdfPrinterCtor = require('pdfmake/js/Printer').default as new (
  fontDescriptors: Record<string, unknown>,
  virtualFs: unknown,
  urlResolver: unknown,
) => {
  createPdfKitDocument(docDefinition: unknown): Promise<
    NodeJS.ReadableStream & { end: () => void }
  >;
};
const VirtualFileSystemCtor = require('pdfmake/js/virtual-fs').default
  .constructor as new () => {
  writeFileSync(filename: string, contents: Buffer | string): void;
  existsSync(filename: string): boolean;
};
const URLResolverCtor = require('pdfmake/js/URLResolver').default as new (
  fs: unknown,
) => { setUrlAccessPolicy: (cb: (url: string) => boolean) => void };
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

export interface InvoicePdfModel {
  invoiceNumber: string;
  issuedAtIso: string;
  organizationName: string;
  vatNumber: string | null;
  planName: string;
  periodStart: string;
  periodEnd: string;
  lineItems: Array<{ description: string; amount: string }>;
  subtotal: string;
  vatAmount: string;
  total: string;
  currency: string;
  qrBase64: string;
  invoiceHash: string;
}

/**
 * Phase 7 — bilingual (Arabic/English) tenant invoice renderer.
 *
 * Uses pdfmake with embedded IBM Plex Sans Arabic. Platform identity
 * (seller name AR/EN, VAT, address) is read from `ConfigService` once and
 * stamped into every rendered PDF — never hardcoded.
 *
 * If Arabic shaping breaks at integration time, the documented fallback is
 * pdfkit + arabic-reshaper + bidi-js. Verify visually against the first
 * generated PDF before declaring complete.
 */
@Injectable()
export class PdfRendererService {
  private readonly printer = (() => {
    const virtualFs = new VirtualFileSystemCtor();
    for (const [name, b64] of Object.entries(vfs)) {
      virtualFs.writeFileSync(name, Buffer.from(b64, 'base64'));
    }
    const resolver = new URLResolverCtor(virtualFs);
    // Block remote URL access — all assets come from the embedded VFS.
    resolver.setUrlAccessPolicy(() => false);
    return new PdfPrinterCtor(fontMap, virtualFs, resolver);
  })();
  private readonly platformVatNumber: string;
  private readonly platformNameAr: string;
  private readonly platformNameEn: string;
  private readonly platformAddress: string;

  constructor(config: ConfigService) {
    this.platformVatNumber = config.getOrThrow<string>('PLATFORM_VAT_NUMBER');
    this.platformNameAr = config.getOrThrow<string>('PLATFORM_COMPANY_NAME_AR');
    this.platformNameEn = config.getOrThrow<string>('PLATFORM_COMPANY_NAME_EN');
    this.platformAddress = config.get<string>('PLATFORM_COMPANY_ADDRESS') ?? '';
  }

  async render(model: InvoicePdfModel): Promise<Buffer> {
    const qrDataUrl = await QRCode.toDataURL(model.qrBase64, {
      errorCorrectionLevel: 'M',
      margin: 1,
    });

    const supplierAddressLine = this.platformAddress
      ? `\n${this.platformAddress}`
      : '';

    const docDefinition = {
      defaultStyle: { font: 'IBMPlex', fontSize: 10 },
      pageSize: 'A4',
      pageMargins: [40, 50, 40, 60],
      content: [
        {
          text: 'فاتورة ضريبية مبسطة / Simplified Tax Invoice',
          style: 'h1',
          alignment: 'center',
        },
        {
          text: model.invoiceNumber,
          alignment: 'center',
          margin: [0, 4, 0, 4],
        },
        {
          text: `${model.issuedAtIso.slice(0, 10)}`,
          alignment: 'center',
          margin: [0, 0, 0, 16],
          fontSize: 9,
          color: '#555',
        },
        {
          columns: [
            {
              text: [
                { text: 'المُورِّد / Supplier\n', bold: true },
                `${this.platformNameAr} / ${this.platformNameEn}\n`,
                `VAT: ${this.platformVatNumber}`,
                supplierAddressLine,
              ],
            },
            {
              text: [
                { text: 'العميل / Customer\n', bold: true },
                `${model.organizationName}\n`,
                model.vatNumber ? `VAT: ${model.vatNumber}` : '',
              ],
              alignment: 'right',
            },
          ],
          margin: [0, 0, 0, 16],
        },
        {
          text: `${model.planName} — ${model.periodStart} → ${model.periodEnd}`,
          margin: [0, 0, 0, 8],
          italics: true,
        },
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'الوصف / Description', bold: true },
                {
                  text: 'المبلغ / Amount',
                  bold: true,
                  alignment: 'right',
                },
              ],
              ...model.lineItems.map(l => [
                l.description,
                {
                  text: `${l.amount} ${model.currency}`,
                  alignment: 'right',
                },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
        {
          columns: [
            { text: '' },
            {
              table: {
                widths: ['*', 'auto'],
                body: [
                  [
                    'الإجمالي قبل الضريبة / Subtotal',
                    {
                      text: `${model.subtotal} ${model.currency}`,
                      alignment: 'right',
                    },
                  ],
                  [
                    'ضريبة القيمة المضافة / VAT (15%)',
                    {
                      text: `${model.vatAmount} ${model.currency}`,
                      alignment: 'right',
                    },
                  ],
                  [
                    {
                      text: 'الإجمالي شامل الضريبة / Total (VAT-inclusive)',
                      bold: true,
                    },
                    {
                      text: `${model.total} ${model.currency}`,
                      bold: true,
                      alignment: 'right',
                    },
                  ],
                ],
              },
              layout: 'noBorders',
            },
          ],
          margin: [0, 12, 0, 12],
        },
        { image: qrDataUrl, width: 120, alignment: 'center' },
        {
          text: `Hash: ${model.invoiceHash}`,
          fontSize: 7,
          alignment: 'center',
          margin: [0, 8, 0, 0],
          color: '#888',
        },
      ],
      styles: { h1: { fontSize: 16, bold: true } },
    };

    const doc = await this.printer.createPdfKitDocument(docDefinition);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }
}
