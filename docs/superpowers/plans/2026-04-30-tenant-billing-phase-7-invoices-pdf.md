# Tenant Billing Phase 7 Invoices and PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every tenant a self-service invoice history page with downloadable Arabic-first PDF receipts, ZATCA Phase-1 simplified e-invoice fields (sequential numbering, previous-hash chain, base64 TLV QR), and chronological hash integrity. The PDF is a tenant-facing receipt for the SaaS subscription charge — it is not a Moyasar payment receipt and it is not a fully-stamped XAdES ZATCA invoice (deferred to a later phase).

**Architecture:** Extend the existing `platform/billing` vertical slice. Add three columns to `SubscriptionInvoice` (`invoiceNumber`, `invoiceHash`, `previousHash`) plus a per-organization `OrganizationInvoiceCounter` table for monotonic sequential numbering. A new `generate-invoice-pdf/` slice owns rendering (pdfmake + IBM Plex Sans Arabic), QR encoding (base64 TLV), and MinIO upload. PDF generation runs synchronously on first download, caches the result in MinIO under `invoices/{orgId}/{invoiceId}.pdf`, and returns a presigned URL. `SubscriptionInvoice` is intentionally NOT in `SCOPED_MODELS` (it is CareKit's receivable, not the tenant's data) — every tenant-facing handler MUST filter `where: { organizationId }` explicitly, and an isolation e2e spec enforces this invariant.

**Tech Stack:** NestJS 11, Prisma 7 split schema, PostgreSQL, pdfmake, qrcode, MinIO (existing `MediaService`), class-validator DTOs, Next.js 15 App Router, React 19, TanStack Query, Tailwind 4, next-intl, Vitest/Jest.

---

## Contract Decisions

- **Invoice number format:** `INV-{YYYY}-{6-digit-zero-padded-seq}`, sequence is per-organization and reset annually (new row in `OrganizationInvoiceCounter` keyed `(organizationId, year)`). Allocation happens inside a Prisma `$transaction` with `SELECT ... FOR UPDATE` semantics via `update` on the counter row to avoid races.
- **Hash chain:** SHA-256 over the canonical JSON of the invoice's billing fields plus `previousHash`. Canonicalization = `JSON.stringify` with keys sorted alphabetically and no whitespace. The first issued invoice for an organization uses `previousHash = "0"` (string literal). Subsequent invoices look up the prior issued invoice via `findFirst({ where: { organizationId, issuedAt: { not: null }, id: { not: currentId } }, orderBy: { issuedAt: 'desc' } })`.
- **QR payload:** Base64 of a concatenated TLV byte buffer with the 5 ZATCA Phase-1 tags (seller name, VAT number, timestamp ISO-8601, total with VAT, VAT amount). Tag = 1 byte, length = 1 byte (every realistic value ≤ 255 bytes), value = UTF-8 bytes. Triplet layout: `[tag][length][value...]`.
- **PDF library:** `pdfmake` is the primary choice — built-in vfs font handling, RTL-aware text alignment, native Arabic shaping when fed properly subset TTFs. Fallback only if pdfmake font loading fails: `pdfkit + arabic-reshaper + bidi-js` (do not implement the fallback unless blocked).
- **Storage:** MinIO key pattern `invoices/{orgId}/{invoiceId}.pdf`. Reuse the existing `SubscriptionInvoice.pdfUrl` column — DO NOT add a new `pdfStorageKey` field. New code stores the **MinIO object key** (relative path) in `pdfUrl`, not a public URL. The downloader treats the value as a key first; if it begins with `http`, it is treated as a legacy public URL and returned as-is.
- **Idempotency:** If `pdfUrl` is already set, the download endpoint short-circuits and returns a fresh presigned URL without regenerating the PDF. A regenerate endpoint is NOT exposed to tenants in Phase 7 (refund-driven invalidation is deferred to Phase 9 admin scope).
- **Tenant isolation:** Because `SubscriptionInvoice` is not in `SCOPED_MODELS`, every handler in this phase explicitly filters by `organizationId` and returns 404 (not 403) when the invoice belongs to a different org. A dedicated e2e spec asserts org A cannot list, view, or download org B's invoices.
- **i18n:** PDF is bilingual — Arabic-first with English mirror lines. Dashboard UI strings live in `ar.billing.ts` / `en.billing.ts`.

## File Structure

Backend:
- Modify: `apps/backend/prisma/schema/platform.prisma`
- Create: `apps/backend/prisma/migrations/20260430160000_tenant_billing_invoice_numbering/migration.sql`
- Create: `apps/backend/src/modules/platform/billing/dto/invoice.dto.ts`
- Create: `apps/backend/src/modules/platform/billing/list-invoices/list-invoices.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/list-invoices/list-invoices.handler.spec.ts`
- Create: `apps/backend/src/modules/platform/billing/get-invoice/get-invoice.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/get-invoice/get-invoice.handler.spec.ts`
- Create: `apps/backend/src/modules/platform/billing/issue-invoice/issue-invoice.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/issue-invoice/issue-invoice.handler.spec.ts`
- Create: `apps/backend/src/modules/platform/billing/issue-invoice/invoice-numbering.service.ts`
- Create: `apps/backend/src/modules/platform/billing/issue-invoice/invoice-numbering.service.spec.ts`
- Create: `apps/backend/src/modules/platform/billing/issue-invoice/invoice-hash.util.ts`
- Create: `apps/backend/src/modules/platform/billing/issue-invoice/invoice-hash.util.spec.ts`
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/generate-invoice-pdf.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/generate-invoice-pdf.handler.spec.ts`
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/pdf-renderer.service.ts`
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/pdf-renderer.service.spec.ts`
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/zatca-qr.util.ts`
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/zatca-qr.util.spec.ts`
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/download-invoice.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/download-invoice.handler.spec.ts`
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/fonts/IBMPlexSansArabic-Regular.ttf` (binary)
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/fonts/IBMPlexSansArabic-Bold.ttf` (binary)
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/fonts/vfs-fonts.ts`
- Modify: `apps/backend/src/modules/platform/billing/billing.module.ts`
- Modify: `apps/backend/src/modules/platform/billing/record-subscription-payment/record-subscription-payment.handler.ts`
- Modify: `apps/backend/src/api/dashboard/billing.controller.ts`
- Modify: `apps/backend/src/api/dashboard/billing.controller.spec.ts`
- Create: `apps/backend/test/e2e/tenant-billing-invoices.e2e-spec.ts`
- Modify: `apps/backend/package.json`

Dashboard:
- Modify: `apps/dashboard/lib/types/billing.ts`
- Modify: `apps/dashboard/lib/api/billing.ts`
- Create: `apps/dashboard/hooks/use-invoices.ts`
- Create: `apps/dashboard/app/(dashboard)/settings/billing/invoices/page.tsx`
- Create: `apps/dashboard/app/(dashboard)/settings/billing/invoices/components/invoices-table.tsx`
- Create: `apps/dashboard/app/(dashboard)/settings/billing/invoices/components/download-invoice-button.tsx`
- Modify: `apps/dashboard/lib/translations/en.billing.ts`
- Modify: `apps/dashboard/lib/translations/ar.billing.ts`
- Create: `apps/dashboard/test/unit/components/billing-invoices.spec.tsx`

OpenAPI:
- Modify: `packages/api-client/src/generated/openapi.json` (regenerated)
- Modify: `packages/api-client/src/generated/*` (regenerated)

---

## Task 1: Schema, Numbering Counter, and Migration

**Files:**
- Modify: `apps/backend/prisma/schema/platform.prisma`
- Create: `apps/backend/prisma/migrations/20260430160000_tenant_billing_invoice_numbering/migration.sql`
- Test: `apps/backend/prisma/schema/platform.prisma` validates

- [ ] **Step 1: Add columns to `SubscriptionInvoice`**

In `platform.prisma`, in the `SubscriptionInvoice` model:

```prisma
  invoiceNumber  String?  @unique
  invoiceHash    String?
  previousHash   String?

  @@index([organizationId, issuedAt])
  @@index([organizationId, invoiceNumber])
```

`invoiceNumber` is nullable because `DRAFT` invoices have not yet been issued; it becomes non-null on `issuedAt` set.

- [ ] **Step 2: Add `OrganizationInvoiceCounter` model**

```prisma
model OrganizationInvoiceCounter {
  organizationId String
  year           Int
  lastSequence   Int    @default(0)
  updatedAt      DateTime @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@id([organizationId, year])
  @@index([organizationId])
}
```

Add the back-relation on `Organization`:

```prisma
  invoiceCounters OrganizationInvoiceCounter[]
```

- [ ] **Step 3: Write migration SQL**

Create `apps/backend/prisma/migrations/20260430160000_tenant_billing_invoice_numbering/migration.sql`:

```sql
ALTER TABLE "SubscriptionInvoice"
  ADD COLUMN "invoiceNumber" TEXT,
  ADD COLUMN "invoiceHash" TEXT,
  ADD COLUMN "previousHash" TEXT;

CREATE UNIQUE INDEX "SubscriptionInvoice_invoiceNumber_key" ON "SubscriptionInvoice"("invoiceNumber");
CREATE INDEX "SubscriptionInvoice_organizationId_issuedAt_idx" ON "SubscriptionInvoice"("organizationId", "issuedAt");
CREATE INDEX "SubscriptionInvoice_organizationId_invoiceNumber_idx" ON "SubscriptionInvoice"("organizationId", "invoiceNumber");

CREATE TABLE "OrganizationInvoiceCounter" (
  "organizationId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "lastSequence" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationInvoiceCounter_pkey" PRIMARY KEY ("organizationId", "year")
);

CREATE INDEX "OrganizationInvoiceCounter_organizationId_idx" ON "OrganizationInvoiceCounter"("organizationId");

ALTER TABLE "OrganizationInvoiceCounter"
  ADD CONSTRAINT "OrganizationInvoiceCounter_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Note: `OrganizationInvoiceCounter` is also intentionally NOT in `SCOPED_MODELS` (write-path is server-side only via `issue-invoice` handler).

- [ ] **Step 4: Apply migration**

```bash
cd apps/backend && npx prisma migrate dev --name tenant_billing_invoice_numbering
npm run prisma:generate --workspace=backend
```

- [ ] **Verify**

```bash
cd apps/backend && npx prisma validate
cd apps/backend && npx prisma migrate status
```

- [ ] **Commit**

```bash
git add apps/backend/prisma/schema/platform.prisma apps/backend/prisma/migrations/20260430160000_tenant_billing_invoice_numbering
git commit -m "feat(billing): add invoice numbering counter and hash columns"
```

---

## Task 2: Invoice Hash Utility and Numbering Service

**Files:**
- Create: `apps/backend/src/modules/platform/billing/issue-invoice/invoice-hash.util.ts`
- Create: `apps/backend/src/modules/platform/billing/issue-invoice/invoice-hash.util.spec.ts`
- Create: `apps/backend/src/modules/platform/billing/issue-invoice/invoice-numbering.service.ts`
- Create: `apps/backend/src/modules/platform/billing/issue-invoice/invoice-numbering.service.spec.ts`

- [ ] **Step 1: Implement canonical hash**

```ts
// invoice-hash.util.ts
import { createHash } from 'node:crypto';

export interface InvoiceHashInput {
  invoiceNumber: string;
  organizationId: string;
  amount: string;          // Decimal serialized as fixed-2 string
  currency: string;
  issuedAt: string;        // ISO-8601 UTC
  periodStart: string;
  periodEnd: string;
  previousHash: string;    // "0" for first invoice
}

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize((value as Record<string, unknown>)[k])).join(',') + '}';
}

export function computeInvoiceHash(input: InvoiceHashInput): string {
  return createHash('sha256').update(canonicalize(input), 'utf8').digest('hex');
}
```

Spec must cover: deterministic output, key-order independence, `previousHash = "0"` for first, change in any field flips the hash.

- [ ] **Step 2: Implement numbering service**

```ts
// invoice-numbering.service.ts
@Injectable()
export class InvoiceNumberingService {
  constructor(private readonly prisma: PrismaService) {}

  async allocate(organizationId: string, now: Date, tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx ?? this.prisma;
    const year = now.getUTCFullYear();
    // upsert + atomic increment
    const counter = await client.organizationInvoiceCounter.upsert({
      where: { organizationId_year: { organizationId, year } },
      create: { organizationId, year, lastSequence: 1 },
      update: { lastSequence: { increment: 1 } },
    });
    const seq = String(counter.lastSequence).padStart(6, '0');
    return `INV-${year}-${seq}`;
  }
}
```

The caller passes a `tx` from a `$transaction` so allocation and invoice update are atomic.

Spec covers: first invocation creates row with seq 1, subsequent increments, year rollover starts a new row at 1, two parallel transactions never collide (test with `Promise.all` of two `$transaction` calls).

- [ ] **Verify**

```bash
cd apps/backend && npx jest src/modules/platform/billing/issue-invoice/invoice-hash.util.spec.ts src/modules/platform/billing/issue-invoice/invoice-numbering.service.spec.ts
```

- [ ] **Commit**

```bash
git add apps/backend/src/modules/platform/billing/issue-invoice/invoice-hash.util.ts apps/backend/src/modules/platform/billing/issue-invoice/invoice-hash.util.spec.ts apps/backend/src/modules/platform/billing/issue-invoice/invoice-numbering.service.ts apps/backend/src/modules/platform/billing/issue-invoice/invoice-numbering.service.spec.ts
git commit -m "feat(billing): add invoice hash and numbering service"
```

---

## Task 3: Issue-Invoice Handler and Wiring

**Files:**
- Create: `apps/backend/src/modules/platform/billing/issue-invoice/issue-invoice.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/issue-invoice/issue-invoice.handler.spec.ts`
- Modify: `apps/backend/src/modules/platform/billing/record-subscription-payment/record-subscription-payment.handler.ts`
- Modify: `apps/backend/src/modules/platform/billing/billing.module.ts`

- [ ] **Step 1: Implement `IssueInvoiceHandler`**

```ts
@Injectable()
export class IssueInvoiceHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: InvoiceNumberingService,
  ) {}

  async execute(invoiceId: string, now: Date = new Date()): Promise<SubscriptionInvoice> {
    return this.prisma.$transaction(async tx => {
      const invoice = await tx.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
      if (invoice.issuedAt) return invoice; // idempotent

      const invoiceNumber = await this.numbering.allocate(invoice.organizationId, now, tx);

      const prior = await tx.subscriptionInvoice.findFirst({
        where: { organizationId: invoice.organizationId, issuedAt: { not: null }, id: { not: invoiceId } },
        orderBy: { issuedAt: 'desc' },
        select: { invoiceHash: true },
      });
      const previousHash = prior?.invoiceHash ?? '0';

      const issuedAt = now;
      const invoiceHash = computeInvoiceHash({
        invoiceNumber,
        organizationId: invoice.organizationId,
        amount: invoice.amount.toFixed(2),
        currency: invoice.currency,
        issuedAt: issuedAt.toISOString(),
        periodStart: invoice.periodStart.toISOString(),
        periodEnd: invoice.periodEnd.toISOString(),
        previousHash,
      });

      return tx.subscriptionInvoice.update({
        where: { id: invoiceId },
        data: { invoiceNumber, issuedAt, invoiceHash, previousHash, status: 'ISSUED' },
      });
    });
  }
}
```

- [ ] **Step 2: Wire from `record-subscription-payment`**

In `record-subscription-payment.handler.ts`, after marking `PAID`, call `await this.issueInvoiceHandler.execute(invoice.id)` if `issuedAt` is null. Inject `IssueInvoiceHandler`.

- [ ] **Step 3: Register in `billing.module.ts`**

Add `IssueInvoiceHandler`, `InvoiceNumberingService` to `providers` and `exports`.

- [ ] **Step 4: Spec**

Cover: idempotency on second call, first invoice gets `previousHash = "0"`, second invoice's `previousHash` matches first's `invoiceHash`, status flips to ISSUED, transaction rollback on numbering failure leaves invoice unchanged.

- [ ] **Verify**

```bash
cd apps/backend && npx jest src/modules/platform/billing/issue-invoice src/modules/platform/billing/record-subscription-payment
```

- [ ] **Commit**

```bash
git add apps/backend/src/modules/platform/billing/issue-invoice apps/backend/src/modules/platform/billing/billing.module.ts apps/backend/src/modules/platform/billing/record-subscription-payment
git commit -m "feat(billing): issue invoices with sequential number and hash chain"
```

---

## Task 4: ZATCA QR TLV Utility

**Files:**
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/zatca-qr.util.ts`
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/zatca-qr.util.spec.ts`

- [ ] **Step 1: Install `qrcode`**

```bash
cd apps/backend && npm install qrcode @types/qrcode
```

(If executor already ran prereq install, skip.)

- [ ] **Step 2: Implement TLV encoder**

```ts
// zatca-qr.util.ts
export interface ZatcaQrFields {
  sellerName: string;
  vatNumber: string;
  timestampIso: string;   // ISO-8601 UTC
  totalWithVat: string;   // fixed-2 string e.g. "115.00"
  vatAmount: string;      // fixed-2 string e.g. "15.00"
}

function tlv(tag: number, value: string): Buffer {
  const valueBuf = Buffer.from(value, 'utf8');
  if (valueBuf.length > 255) {
    throw new Error(`TLV value for tag ${tag} exceeds 255 bytes (got ${valueBuf.length})`);
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
```

Layout per triplet: `[tag (1 byte)][length (1 byte)][value (UTF-8 bytes)]`. All Phase-1 tags fit within ≤255 bytes; throwing is defensive.

- [ ] **Step 3: Spec**

Cover: known-vector encoding (use a fixture and assert exact base64), Arabic seller name encodes correctly via UTF-8, throws when value exceeds 255 bytes (synthesize a long string).

- [ ] **Verify**

```bash
cd apps/backend && npx jest src/modules/platform/billing/generate-invoice-pdf/zatca-qr.util.spec.ts
```

- [ ] **Commit**

```bash
git add apps/backend/src/modules/platform/billing/generate-invoice-pdf/zatca-qr.util.ts apps/backend/src/modules/platform/billing/generate-invoice-pdf/zatca-qr.util.spec.ts apps/backend/package.json apps/backend/package-lock.json
git commit -m "feat(billing): encode zatca phase-1 qr as base64 tlv"
```

---

## Task 5: Fonts and PDF Renderer Service

**Files:**
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/fonts/IBMPlexSansArabic-Regular.ttf` (binary, downloaded)
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/fonts/IBMPlexSansArabic-Bold.ttf` (binary, downloaded)
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/fonts/vfs-fonts.ts`
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/pdf-renderer.service.ts`
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/pdf-renderer.service.spec.ts`
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Install `pdfmake`**

```bash
cd apps/backend && npm install pdfmake
npm install -D @types/pdfmake
```

- [ ] **Step 2: Download fonts**

Download from `https://github.com/IBM/plex/tree/master/IBM-Plex-Sans-Arabic/fonts/complete/ttf` — Regular and Bold variants (OFL license, redistribution permitted). Place at `apps/backend/src/modules/platform/billing/generate-invoice-pdf/fonts/`. Add to git.

- [ ] **Step 3: Build the vfs**

```ts
// vfs-fonts.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const here = __dirname;
export const vfs: Record<string, string> = {
  'IBMPlexSansArabic-Regular.ttf': readFileSync(join(here, 'IBMPlexSansArabic-Regular.ttf')).toString('base64'),
  'IBMPlexSansArabic-Bold.ttf':    readFileSync(join(here, 'IBMPlexSansArabic-Bold.ttf')).toString('base64'),
};

export const fonts = {
  IBMPlex: {
    normal: 'IBMPlexSansArabic-Regular.ttf',
    bold:   'IBMPlexSansArabic-Bold.ttf',
  },
};
```

- [ ] **Step 4: Implement renderer service**

```ts
// pdf-renderer.service.ts
import PdfPrinter from 'pdfmake';
import QRCode from 'qrcode';
import { fonts as fontMap } from './fonts/vfs-fonts';

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

@Injectable()
export class PdfRendererService {
  private readonly printer = new PdfPrinter(fontMap);

  async render(model: InvoicePdfModel): Promise<Buffer> {
    const qrDataUrl = await QRCode.toDataURL(model.qrBase64, { errorCorrectionLevel: 'M', margin: 1 });

    const docDefinition: TDocumentDefinitions = {
      defaultStyle: { font: 'IBMPlex', fontSize: 10 },
      pageSize: 'A4',
      pageMargins: [40, 50, 40, 60],
      content: [
        { text: 'فاتورة ضريبية مبسطة / Simplified Tax Invoice', style: 'h1', alignment: 'center' },
        { text: `${model.invoiceNumber}`, alignment: 'center', margin: [0, 4, 0, 16] },
        {
          columns: [
            { text: [
              { text: 'المُورِّد / Supplier\n', bold: true },
              'CareKit Platform\nVAT: 300000000000003',
            ]},
            { text: [
              { text: 'العميل / Customer\n', bold: true },
              `${model.organizationName}\n`,
              model.vatNumber ? `VAT: ${model.vatNumber}` : '',
            ], alignment: 'right' },
          ],
          margin: [0, 0, 0, 16],
        },
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              [{ text: 'الوصف / Description', bold: true }, { text: 'المبلغ / Amount', bold: true, alignment: 'right' }],
              ...model.lineItems.map(l => [l.description, { text: `${l.amount} ${model.currency}`, alignment: 'right' }]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
        { columns: [
          { text: '' },
          { table: { widths: ['*', 'auto'], body: [
            ['الإجمالي قبل الضريبة / Subtotal', { text: `${model.subtotal} ${model.currency}`, alignment: 'right' }],
            ['ضريبة القيمة المضافة / VAT (15%)', { text: `${model.vatAmount} ${model.currency}`, alignment: 'right' }],
            [{ text: 'الإجمالي / Total', bold: true }, { text: `${model.total} ${model.currency}`, bold: true, alignment: 'right' }],
          ]}, layout: 'noBorders' },
        ], margin: [0, 12, 0, 12] },
        { image: qrDataUrl, width: 120, alignment: 'center' },
        { text: `Hash: ${model.invoiceHash}`, fontSize: 7, alignment: 'center', margin: [0, 8, 0, 0], color: '#888' },
      ],
      styles: { h1: { fontSize: 16, bold: true } },
    };

    return new Promise<Buffer>((resolve, reject) => {
      const doc = this.printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }
}
```

If pdfmake fails to load Arabic glyphs at integration time, fall back to `pdfkit + arabic-reshaper + bidi-js`. Document the fallback in a comment but do not implement preemptively.

- [ ] **Step 5: Spec**

Cover: returns a non-empty `Buffer`, starts with `%PDF-` magic bytes, embeds the QR data URL, contains the invoice number string (search through the binary).

- [ ] **Verify**

```bash
cd apps/backend && npx jest src/modules/platform/billing/generate-invoice-pdf/pdf-renderer.service.spec.ts
```

- [ ] **Commit**

```bash
git add apps/backend/src/modules/platform/billing/generate-invoice-pdf/fonts apps/backend/src/modules/platform/billing/generate-invoice-pdf/pdf-renderer.service.ts apps/backend/src/modules/platform/billing/generate-invoice-pdf/pdf-renderer.service.spec.ts apps/backend/package.json apps/backend/package-lock.json
git commit -m "feat(billing): render bilingual invoice pdf with pdfmake"
```

---

## Task 6: Generate-Invoice-PDF Handler and MinIO Upload

**Files:**
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/generate-invoice-pdf.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/generate-invoice-pdf.handler.spec.ts`
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/download-invoice.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/generate-invoice-pdf/download-invoice.handler.spec.ts`
- Modify: `apps/backend/src/modules/platform/billing/billing.module.ts`

- [ ] **Step 1: Implement generator**

```ts
@Injectable()
export class GenerateInvoicePdfHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: PdfRendererService,
    private readonly media: MediaService,           // existing MinIO wrapper
  ) {}

  async execute(organizationId: string, invoiceId: string): Promise<{ key: string }> {
    const invoice = await this.prisma.subscriptionInvoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: { subscription: { include: { plan: true, organization: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!invoice.issuedAt || !invoice.invoiceNumber) {
      throw new BadRequestException('Invoice not yet issued');
    }
    if (invoice.pdfUrl && !invoice.pdfUrl.startsWith('http')) {
      return { key: invoice.pdfUrl };
    }

    const org = invoice.subscription.organization;
    const subtotal = Number(invoice.amount).toFixed(2);
    const vatAmount = (Number(invoice.amount) * 0.15).toFixed(2);
    const total = (Number(invoice.amount) * 1.15).toFixed(2);

    const qrBase64 = encodeZatcaQr({
      sellerName: 'CareKit Platform',
      vatNumber: '300000000000003',
      timestampIso: invoice.issuedAt.toISOString(),
      totalWithVat: total,
      vatAmount,
    });

    const buffer = await this.renderer.render({
      invoiceNumber: invoice.invoiceNumber,
      issuedAtIso: invoice.issuedAt.toISOString(),
      organizationName: org.name,
      vatNumber: org.vatNumber ?? null,
      planName: invoice.subscription.plan.name,
      periodStart: invoice.periodStart.toISOString().slice(0, 10),
      periodEnd: invoice.periodEnd.toISOString().slice(0, 10),
      lineItems: (invoice.lineItems as Array<{ description: string; amount: number }>).map(l => ({
        description: l.description,
        amount: Number(l.amount).toFixed(2),
      })),
      subtotal,
      vatAmount,
      total,
      currency: invoice.currency,
      qrBase64,
      invoiceHash: invoice.invoiceHash ?? '',
    });

    const key = `invoices/${organizationId}/${invoiceId}.pdf`;
    await this.media.putObject(key, buffer, 'application/pdf');
    await this.prisma.subscriptionInvoice.update({ where: { id: invoiceId }, data: { pdfUrl: key } });
    return { key };
  }
}
```

If `MediaService.putObject` does not exist with that exact signature, adapt to the existing API (the goal is `bucket-key + buffer + contentType`).

- [ ] **Step 2: Implement download handler**

```ts
@Injectable()
export class DownloadInvoiceHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: GenerateInvoicePdfHandler,
    private readonly media: MediaService,
  ) {}

  async execute(organizationId: string, invoiceId: string): Promise<{ url: string }> {
    const invoice = await this.prisma.subscriptionInvoice.findFirst({
      where: { id: invoiceId, organizationId },
      select: { pdfUrl: true, issuedAt: true },
    });
    if (!invoice) throw new NotFoundException();
    if (!invoice.issuedAt) throw new BadRequestException('Invoice not issued');

    let key = invoice.pdfUrl;
    if (key && key.startsWith('http')) {
      return { url: key }; // legacy row stored a public URL
    }
    if (!key) {
      const result = await this.generator.execute(organizationId, invoiceId);
      key = result.key;
    }
    const url = await this.media.presignGetObject(key, 600); // 10 min
    return { url };
  }
}
```

- [ ] **Step 3: Specs**

Generator spec: 404 when invoice belongs to other org, 400 when not issued, returns same key on second call (idempotent), writes `pdfUrl = key` (not URL), MinIO `putObject` called once.

Download spec: 404 cross-org, generates on first call, returns presigned URL on second call without regenerating, treats `http` prefix as legacy URL passthrough.

- [ ] **Step 4: Register in `billing.module.ts`**

Add both handlers + `PdfRendererService` to providers.

- [ ] **Verify**

```bash
cd apps/backend && npx jest src/modules/platform/billing/generate-invoice-pdf
```

- [ ] **Commit**

```bash
git add apps/backend/src/modules/platform/billing/generate-invoice-pdf apps/backend/src/modules/platform/billing/billing.module.ts
git commit -m "feat(billing): generate and download invoice pdfs via minio"
```

---

## Task 7: List/Get Invoices Handlers and Dashboard Controller

**Files:**
- Create: `apps/backend/src/modules/platform/billing/dto/invoice.dto.ts`
- Create: `apps/backend/src/modules/platform/billing/list-invoices/list-invoices.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/list-invoices/list-invoices.handler.spec.ts`
- Create: `apps/backend/src/modules/platform/billing/get-invoice/get-invoice.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/get-invoice/get-invoice.handler.spec.ts`
- Modify: `apps/backend/src/api/dashboard/billing.controller.ts`
- Modify: `apps/backend/src/api/dashboard/billing.controller.spec.ts`

- [ ] **Step 1: DTOs**

```ts
// invoice.dto.ts
export class ListInvoicesQueryDto {
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number = 20;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsEnum(SubscriptionInvoiceStatus) status?: SubscriptionInvoiceStatus;
}

export class InvoiceListItemDto {
  id!: string;
  invoiceNumber!: string | null;
  status!: SubscriptionInvoiceStatus;
  amount!: string;
  currency!: string;
  periodStart!: string;
  periodEnd!: string;
  issuedAt!: string | null;
  paidAt!: string | null;
}
```

- [ ] **Step 2: List handler**

```ts
@Injectable()
export class ListInvoicesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(organizationId: string, query: ListInvoicesQueryDto) {
    const limit = query.limit ?? 20;
    const items = await this.prisma.subscriptionInvoice.findMany({
      where: {
        organizationId,                           // EXPLICIT — model is not in SCOPED_MODELS
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > limit;
    return {
      items: items.slice(0, limit).map(toInvoiceListItem),
      nextCursor: hasMore ? items[limit - 1].id : null,
    };
  }
}
```

- [ ] **Step 3: Get handler**

```ts
@Injectable()
export class GetInvoiceHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(organizationId: string, invoiceId: string) {
    const invoice = await this.prisma.subscriptionInvoice.findFirst({
      where: { id: invoiceId, organizationId },
    });
    if (!invoice) throw new NotFoundException();
    return toInvoiceDetail(invoice);
  }
}
```

- [ ] **Step 4: Wire dashboard controller**

In `apps/backend/src/api/dashboard/billing.controller.ts`:

```ts
@Get('invoices')
@ApiOperation({ summary: 'List billing invoices for current organization' })
listInvoices(@CurrentOrg() orgId: string, @Query() query: ListInvoicesQueryDto) {
  return this.listInvoices.execute(orgId, query);
}

@Get('invoices/:id')
getInvoice(@CurrentOrg() orgId: string, @Param('id') id: string) {
  return this.getInvoice.execute(orgId, id);
}

@Get('invoices/:id/download')
async downloadInvoice(@CurrentOrg() orgId: string, @Param('id') id: string) {
  return this.downloadInvoice.execute(orgId, id);
}
```

Use the project's existing `@CurrentOrg()` decorator (likely named differently — match the convention in sibling controllers).

- [ ] **Step 5: Specs**

List handler spec: empty result for org with no invoices, pagination cursor works, status filter narrows. Cross-org isolation: org B's invoice is not returned.

Get handler spec: 404 when org mismatched.

Controller spec: routes resolve, DTOs validate, error from handler propagates.

- [ ] **Verify**

```bash
cd apps/backend && npx jest src/modules/platform/billing/list-invoices src/modules/platform/billing/get-invoice src/api/dashboard/billing.controller.spec.ts
```

- [ ] **Commit**

```bash
git add apps/backend/src/modules/platform/billing/dto/invoice.dto.ts apps/backend/src/modules/platform/billing/list-invoices apps/backend/src/modules/platform/billing/get-invoice apps/backend/src/api/dashboard/billing.controller.ts apps/backend/src/api/dashboard/billing.controller.spec.ts apps/backend/src/modules/platform/billing/billing.module.ts
git commit -m "feat(billing): expose tenant invoice list and download api"
```

---

## Task 8: Tenant Isolation E2E

**Files:**
- Create: `apps/backend/test/e2e/tenant-billing-invoices.e2e-spec.ts`

- [ ] **Step 1: Spec scenarios**

Bootstrap two orgs A and B, each with one paid invoice (use the issue-invoice handler directly to avoid Moyasar). Then:

1. As org A user: `GET /api/dashboard/billing/invoices` returns only A's invoice.
2. As org A user: `GET /api/dashboard/billing/invoices/{B's invoiceId}` returns 404.
3. As org A user: `GET /api/dashboard/billing/invoices/{B's invoiceId}/download` returns 404.
4. Hash chain integrity: A's second invoice's `previousHash` equals A's first invoice's `invoiceHash`.
5. Numbering integrity: A and B both have `INV-{year}-000001` (per-org sequences are independent).
6. Re-issuing the same invoice is idempotent (number does not change, hash does not change).

- [ ] **Verify**

```bash
cd apps/backend && npx jest --config test/jest-e2e.json tenant-billing-invoices
```

- [ ] **Commit**

```bash
git add apps/backend/test/e2e/tenant-billing-invoices.e2e-spec.ts
git commit -m "test(billing): tenant isolation e2e for invoices"
```

---

## Task 9: Dashboard Invoices Page

**Files:**
- Modify: `apps/dashboard/lib/types/billing.ts`
- Modify: `apps/dashboard/lib/api/billing.ts`
- Create: `apps/dashboard/hooks/use-invoices.ts`
- Create: `apps/dashboard/app/(dashboard)/settings/billing/invoices/page.tsx`
- Create: `apps/dashboard/app/(dashboard)/settings/billing/invoices/components/invoices-table.tsx`
- Create: `apps/dashboard/app/(dashboard)/settings/billing/invoices/components/download-invoice-button.tsx`
- Modify: `apps/dashboard/lib/translations/en.billing.ts`
- Modify: `apps/dashboard/lib/translations/ar.billing.ts`
- Create: `apps/dashboard/test/unit/components/billing-invoices.spec.tsx`

- [ ] **Step 1: Types and API client**

Add `Invoice`, `InvoiceListResponse`, `DownloadInvoiceResponse` to `lib/types/billing.ts`. Add `listInvoices`, `getInvoice`, `downloadInvoice` to `lib/api/billing.ts` using the typed `apiClient`.

- [ ] **Step 2: Hooks**

```ts
// hooks/use-invoices.ts
export function useInvoices(filters: { status?: string; cursor?: string }) {
  return useQuery({
    queryKey: ['billing', 'invoices', filters],
    queryFn: () => listInvoices(filters),
  });
}

export function useDownloadInvoice() {
  return useMutation({
    mutationFn: (id: string) => downloadInvoice(id),
    onSuccess: ({ url }) => window.open(url, '_blank', 'noopener'),
  });
}
```

- [ ] **Step 3: Page anatomy (follow CLAUDE.md "Page Anatomy — The Law")**

```
Breadcrumbs (Settings > Billing > Invoices)
PageHeader: "الفواتير / Invoices" + description
StatsGrid: 4 cards (Total invoices · Paid · Outstanding · This year)
FilterBar: [Status ▼] [Reset]
DataTable: # / Date / Period / Amount / Status / [Download icon]
Pagination
```

Use `@carekit/ui` primitives. No Card wrapper around the table. Action button is icon-only `size-9 rounded-sm` with Tooltip.

- [ ] **Step 4: Translation keys**

Add to `en.billing.ts` and `ar.billing.ts`:

```ts
invoices: {
  title, description, statsTotal, statsPaid, statsOutstanding, statsYear,
  columns: { number, date, period, amount, status, actions },
  status: { DRAFT, ISSUED, PAID, OVERDUE, VOID },
  download, downloading, downloadFailed,
  empty: { title, description },
}
```

Maintain AR/EN parity (verified by `npm run i18n:verify --workspace=dashboard`).

- [ ] **Step 5: Component spec**

Vitest test mounts `InvoicesTable` with mock data, asserts row count, status badge styling, click on download button triggers the mutation.

- [ ] **Verify**

```bash
cd apps/dashboard && npm run typecheck && npm run lint && npm run test -- billing-invoices
cd apps/dashboard && npm run i18n:verify
```

- [ ] **Commit**

```bash
git add apps/dashboard/lib/types/billing.ts apps/dashboard/lib/api/billing.ts apps/dashboard/hooks/use-invoices.ts apps/dashboard/app/\(dashboard\)/settings/billing/invoices apps/dashboard/lib/translations/en.billing.ts apps/dashboard/lib/translations/ar.billing.ts apps/dashboard/test/unit/components/billing-invoices.spec.tsx
git commit -m "feat(dashboard): tenant invoice history page"
```

---

## Task 10: OpenAPI Sync, Final Verification, Handoff

**Files:**
- Modify: `packages/api-client/src/generated/*` (regenerated)

- [ ] **Step 1: Start backend in background**

```bash
cd /Users/tariq/code/carekit-feat-tenant-billing-phase-7
npm run dev --workspace=backend &
BACKEND_PID=$!
# wait for /api/docs-json to be reachable on :5100
```

Use `run_in_background: true`. Poll `curl -fs http://localhost:5100/api/docs-json` until success (max ~60s).

- [ ] **Step 2: Run openapi sync**

```bash
npm run openapi:sync
```

(Use the exact script name as defined in root `package.json` — verify before running.)

- [ ] **Step 3: Stop backend**

```bash
kill $BACKEND_PID
```

- [ ] **Step 4: Full verification suite**

```bash
npm run prisma:generate --workspace=backend
npm run prisma:validate --workspace=backend
cd apps/backend && npx jest --silent
cd apps/backend && npm run typecheck
cd apps/dashboard && npm run test
cd apps/dashboard && npm run typecheck
cd apps/dashboard && npm run lint
cd apps/dashboard && npm run i18n:verify
```

All must pass. If any fail, fix in place — do not skip.

- [ ] **Step 5: E2E sanity**

```bash
cd apps/backend && npx jest --config test/jest-e2e.json tenant-billing-invoices
```

- [ ] **Step 6: Commit regenerated OpenAPI artifacts**

```bash
git add packages/api-client/src/generated
git commit -m "chore(api-client): regenerate openapi for billing invoices"
```

- [ ] **Step 7: Final review**

```bash
git log --oneline main..HEAD
```

Should show 9–10 commits, in this order:
1. `feat(billing): add invoice numbering counter and hash columns`
2. `feat(billing): add invoice hash and numbering service`
3. `feat(billing): issue invoices with sequential number and hash chain`
4. `feat(billing): encode zatca phase-1 qr as base64 tlv`
5. `feat(billing): render bilingual invoice pdf with pdfmake`
6. `feat(billing): generate and download invoice pdfs via minio`
7. `feat(billing): expose tenant invoice list and download api`
8. `test(billing): tenant isolation e2e for invoices`
9. `feat(dashboard): tenant invoice history page`
10. `chore(api-client): regenerate openapi for billing invoices`

- [ ] **Open PR**

Branch is `feat/tenant-billing-phase-7`; merges into `main`. Title: `feat(billing): tenant invoice history with pdf and zatca qr`. Body summarizes scope and explicitly lists deferrals.

---

## Self-Review

### Scope coverage

- ✅ `SubscriptionInvoice` schema additions (`invoiceNumber`, `invoiceHash`, `previousHash`)
- ✅ Per-org sequential numbering (`OrganizationInvoiceCounter`, year-scoped)
- ✅ SHA-256 hash chain with deterministic canonicalization and `previousHash = "0"` bootstrap
- ✅ ZATCA Phase-1 base64 TLV QR (5 tags, 1-byte tag/length, UTF-8)
- ✅ Bilingual A4 PDF via pdfmake + IBM Plex Sans Arabic
- ✅ MinIO storage with `invoices/{orgId}/{invoiceId}.pdf` key, presigned downloads
- ✅ Reuses existing `pdfUrl` column (stores key, not URL); legacy URL passthrough
- ✅ Idempotent generation; second call returns cached presigned URL
- ✅ Dashboard invoices page following CLAUDE.md "Page Anatomy — The Law"
- ✅ AR/EN i18n parity
- ✅ Explicit `organizationId` filtering on every handler (model is intentionally not scoped)
- ✅ Cross-org isolation e2e
- ✅ Hooked into `record-subscription-payment` so paid invoices auto-issue
- ✅ OpenAPI regeneration

### Intentional defers

- **XAdES cryptographic stamping** (full ZATCA Phase-2 e-invoicing): future Phase-Z. Phase 7 ships a Phase-1-shaped simplified invoice receipt with a hash chain; it is a tenant-facing receipt, not a clearance-grade XAdES invoice.
- **Refund-driven PDF invalidation / reissue / credit-note**: deferred to Phase 9 (admin scope). Refunds today update `refundedAmount`/`refundedAt` on the invoice; the original PDF stays cached. Phase 9 will add credit-note generation.
- **Email delivery of PDFs**: not in scope. Phase 7 ships in-app download only. Existing platform-mailer integration already sends `payment-succeeded` notifications without an attachment; that stays unchanged.
- **Mobile invoice list**: not in scope. Mobile is single-tenant per the strategy memo and shows app-level data, not platform billing.

### Risk notes

- **Arabic shaping in pdfmake.** pdfmake relies on the underlying pdfkit text engine. If Arabic glyphs render disconnected or LTR, swap to `pdfkit + arabic-reshaper + bidi-js` (documented fallback in Task 5). Verify visually with the first generated PDF before declaring the task done.
- **ZATCA validators may reject without XAdES.** The QR will pass Phase-1 readers (ZATCA's official scanner app), but server-side Fatoora validators expect XAdES signatures. This is acceptable: the artifact is a tenant-facing receipt for a SaaS subscription charge — distinct from a Moyasar payment receipt and from a clearance-grade ZATCA invoice. Document this explicitly in the PR description.
- **Moyasar receipt vs ZATCA invoice distinction.** Moyasar issues its own gateway receipt for the cardholder. Our PDF is the **subscription invoice** the tenant uses for accounting. Both can coexist; our copy must avoid claiming to be a Moyasar receipt.
- **Numbering race.** Two concurrent transactions could theoretically increment the counter out of order vs. `issuedAt`. The `update ... { increment: 1 }` is atomic at the row level, but if invoice A's transaction starts first and commits second, it ends up with a higher number than B though it was created first. Acceptable: per-org monotonicity of `invoiceNumber` is preserved; `issuedAt` ordering is best-effort. Hash-chain lookup uses `issuedAt DESC` which matches the user-visible chain.
- **Font binary size.** Two TTFs ~1–2MB combined. This is acceptable in `apps/backend/src` because the fonts are runtime assets. They are loaded once at module init.
- **`SubscriptionInvoice` not in `SCOPED_MODELS`.** This is the largest tenant-isolation risk in the phase. Mitigation: explicit `organizationId` filter in every new handler, plus a dedicated cross-org e2e (Task 8) that fails CI if any handler regresses.

### Files touched: ~25 backend + ~9 dashboard + regenerated OpenAPI. Within phase budget.

---
