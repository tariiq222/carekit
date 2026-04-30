# Finance Cluster Tenant Rollout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **⚠️ OWNER-REVIEW GATE:** This plan touches ZATCA (Saudi e-invoicing regulator) and Moyasar (payment gateway) — both owner-only per the root CLAUDE.md Security Sensitivity Tiers. Do NOT start execution until Tariq explicitly approves the plan as written. Any mid-plan amendments to ZATCA/Moyasar code also require re-approval.

**Goal:** Add `organizationId` to all 7 finance-cluster models (Invoice, Payment, Coupon, CouponRedemption, RefundRequest, ZatcaSubmission, ZatcaConfig), update every finance handler to scope creates and cross-cluster reads, convert `ZatcaConfig` to the org-unique singleton pattern, make `Coupon.code` unique-per-org, wire the Moyasar webhook to resolve tenant context from the inbound payment, resolve the `TODO(02e)` in `create-guest-booking` (inherited from plan 02d), and add isolation e2e tests proving cross-org invisibility for invoices, payments, coupons, refunds, and ZATCA submissions.

**Architecture:** Same strangler/cluster pattern used in 02a–02d. The Prisma Proxy extension auto-injects `organizationId` into `where` clauses for scoped models; handlers explicitly set `organizationId` in `data` objects. Two new wrinkles for finance:

1. **`Coupon.code` becomes composite-unique** (`@@unique([organizationId, code])`) — global coupon code namespace becomes per-org. Clients entering a coupon at booking time resolve the code within the current org context.
2. **`ZatcaConfig` converts from fixed-id singleton (`id @default("default")`) to org-unique singleton** (`organizationId @unique`) — the same pattern used for `BrandingConfig` and `OrganizationSettings` in 02c. Get = `upsert({ where: { organizationId }, update: {}, create: {...defaults} })`.
3. **Moyasar webhook is unscoped on entry** — inbound requests from Moyasar carry no CLS tenant context. The handler must (a) look up the payment by `gatewayRef` using an unscoped read path, (b) derive `organizationId` from `invoice.organizationId`, and (c) run the remaining mutations inside `cls.run(() => ctx.set({ organizationId }))` so the Proxy auto-scopes correctly. Precedent: this is the same pattern that will be used for any future external-system webhook (Zoom, FCM DLQ, etc.).

**Tech Stack:** NestJS 11, Prisma 7 (`$extends` Proxy), nestjs-cls (`TenantContextService`), PostgreSQL RLS, Jest + Supertest (isolation e2e)

---

## Critical lessons from prior plans — READ BEFORE STARTING

1. **Grep ALL callsites first** (Task 1) — plans miss callsites. Commit nothing until the grep audit is complete.
2. **`$transaction` callback form bypasses the Proxy.** `tx` inside `async (tx) => {}` is a raw client — explicit `organizationId` required in ALL `tx.*.create()`, `tx.*.findFirst()`, `tx.*.findUnique()` calls. Array-form `this.prisma.$transaction([op1, op2])` is safe because operations are pre-built through the Proxy.
3. **Extension covers `where` not `data`.** All `prisma.*.create({ data: {} })` need explicit `organizationId`.
4. **Derive org from anchor.** Payment, RefundRequest, ZatcaSubmission lifecycle handlers already fetch the Invoice — derive `organizationId` from `invoice.organizationId` rather than re-injecting `TenantContextService`. CouponRedemption derives from Coupon.
5. **Divergence-before-commit.** If reality disagrees with any step, STOP, document, propose amendment, execute only after confirmation. For ZATCA/Moyasar, amendments require owner re-approval.
6. **`npx prisma migrate dev` may conflict with pgvector.** Write migration SQL manually if needed.
7. **Unscoped reads in the webhook** must be deliberate. Use `prisma.$queryRaw` or `prisma.payment.findFirst` wrapped in a `cls.run` with a sentinel "system" flag that the extension skips. The exact mechanism is specified in Task 5.

---

## SCOPED_MODELS after this plan

```ts
const SCOPED_MODELS = new Set<string>([
  // 02a — identity
  'RefreshToken', 'CustomRole', 'Permission',
  // 02b — people
  'Client', 'ClientRefreshToken', 'Employee', 'EmployeeBranch', 'EmployeeService',
  'EmployeeAvailability', 'EmployeeAvailabilityException',
  // 02c — org-config + org-experience
  'Branch', 'Department', 'ServiceCategory', 'Service',
  'ServiceBookingConfig', 'ServiceDurationOption', 'EmployeeServiceOption',
  'BusinessHour', 'Holiday', 'IntakeForm', 'IntakeField', 'Rating',
  'BrandingConfig', 'OrganizationSettings',
  // 02d — bookings
  'Booking', 'BookingStatusLog', 'WaitlistEntry',
  'GroupSession', 'GroupEnrollment', 'GroupSessionWaitlist',
  'BookingSettings',
  // 02e — finance
  'Invoice', 'Payment', 'Coupon', 'CouponRedemption',
  'RefundRequest', 'ZatcaSubmission', 'ZatcaConfig',
]);
```

---

## File Structure

**Schema (modify):**
- `apps/backend/prisma/schema/finance.prisma` — add `organizationId` to 6 models; convert `ZatcaConfig` to org-unique singleton; change `Coupon.code @unique` → `@@unique([organizationId, code])`; add `@@index([organizationId])` on all 7.

**Migration (create):**
- `apps/backend/prisma/migrations/<timestamp>_saas_02e_finance_tenancy/migration.sql` — manual SQL (pgvector safe path).

**SCOPED_MODELS + extension (modify):**
- `apps/backend/src/infrastructure/database/prisma.service.ts` — register 7 finance models; add "system context" bypass mechanism used by the Moyasar webhook and any future external-system entry point.

**Handlers to modify (create-path — need TenantContextService injection):**
- `src/modules/finance/create-invoice/create-invoice.handler.ts`
- `src/modules/finance/coupons/create-coupon.handler.ts`
- `src/modules/finance/refund-payment/request-refund.handler.ts`
- `src/modules/finance/apply-coupon/apply-coupon.handler.ts` (callback-form tx)
- `src/modules/finance/payments/public/init-guest-payment/init-guest-payment.handler.ts` (already has tenant; add to `payment.create` data)
- `src/modules/finance/bank-transfer-upload/bank-transfer-upload.handler.ts`
- `src/modules/finance/zatca-submit/zatca-submit.handler.ts`
- `src/modules/finance/zatca-config/get-zatca-config.handler.ts`
- `src/modules/finance/zatca-config/upsert-zatca-config.handler.ts`
- `src/modules/finance/zatca-config/onboard-zatca.handler.ts`

**Handlers to modify (lifecycle — derive organizationId from anchor):**
- `src/modules/finance/process-payment/process-payment.handler.ts` (callback-form tx — derives from `invoice.organizationId`)
- `src/modules/finance/verify-payment/verify-payment.handler.ts`
- `src/modules/finance/refund-payment/approve-refund.handler.ts` (multi-step payment+invoice+refundRequest mutation)
- `src/modules/finance/refund-payment/deny-refund.handler.ts`
- `src/modules/finance/refund-payment/refund-payment.handler.ts`
- `src/modules/finance/moyasar-webhook/moyasar-webhook.handler.ts` (⚠️ owner-only; external-entry unscoped path)
- `src/modules/finance/group-session-ready/group-session-ready.handler.ts`

**Handlers to modify (read-path — switch `findUnique` by fixed id to scoped `findFirst` or upsert):**
- `src/modules/finance/create-invoice/create-invoice.handler.ts` — existing-check by `bookingId` @unique
- `src/modules/finance/get-invoice/get-invoice.handler.ts`
- `src/modules/finance/get-invoice/get-booking-invoice.handler.ts`
- `src/modules/finance/get-invoice/get-public-invoice.handler.ts`
- `src/modules/finance/coupons/get-coupon.handler.ts`
- `src/modules/finance/coupons/update-coupon.handler.ts`
- `src/modules/finance/coupons/delete-coupon.handler.ts`
- `src/modules/finance/coupons/list-coupons.handler.ts`
- `src/modules/finance/list-payments/list-payments.handler.ts`
- `src/modules/finance/get-payment-stats/get-payment-stats.handler.ts`
- `src/modules/finance/refund-payment/list-refunds.handler.ts`

**Cross-cluster call-sites (modify — finance models read from bookings):**
- `src/modules/bookings/create-booking/create-booking.handler.ts` — coupon lookup by code is now composite-unique; switch `findUnique({ code })` → `findFirst({ code })` (Proxy injects org).
- `src/modules/bookings/public/create-guest-booking.handler.ts` — **resolves 02d TODO**: add `organizationId` to `tx.invoice.create` data.
- `src/modules/bookings/client/list-client-bookings.handler.ts` — reads invoice/payment are Proxy-scoped; verify.
- `src/api/mobile/employee/earnings.controller.ts` — invoice aggregation reads are Proxy-scoped; verify.
- `src/api/mobile/client/portal/summary.controller.ts` — invoice aggregate is Proxy-scoped; verify.

**Tests (create):**
- `test/e2e/finance/invoice-isolation.e2e-spec.ts`
- `test/e2e/finance/payment-isolation.e2e-spec.ts`
- `test/e2e/finance/coupon-isolation.e2e-spec.ts`
- `test/e2e/finance/refund-isolation.e2e-spec.ts`
- `test/e2e/finance/zatca-isolation.e2e-spec.ts`
- `test/e2e/finance/moyasar-webhook-tenant-context.e2e-spec.ts`

**Spec files to update** (≈25 files — handler unit tests need the tenant mock):
- All `*.handler.spec.ts` under `src/modules/finance/` touched in the handler list above.
- Any booking spec that mocks coupon lookup.

**Memory (create):**
- `/Users/tariq/.claude/projects/-Users-tariq-code-deqah/memory/saas02e_status.md`

**Transformation index (modify):**
- `docs/superpowers/plans/2026-04-21-saas-transformation-index.md` — mark 02e done, update progress log, remove 02d-invoice TODO from risks.

---

## Task 1: Pre-flight — grep all callsites

- [ ] **Step 1.1: Identify all Invoice create callsites**

```bash
cd apps/backend
grep -rn "invoice\.create\|tx\.invoice\.create" src/ --include="*.ts" | grep -v ".spec.ts" | grep -v ".dto.ts"
```

Expected: `create-invoice.handler.ts`, `public/create-guest-booking.handler.ts` (02d TODO). If any additional files appear, document them before proceeding.

- [ ] **Step 1.2: Identify all Payment create/upsert callsites**

```bash
grep -rn "payment\.create\|payment\.upsert\|tx\.payment\." src/ --include="*.ts" | grep -v ".spec.ts" | grep -v ".dto.ts"
```

Expected: `moyasar-webhook.handler.ts` (upsert), `init-guest-payment.handler.ts`, `bank-transfer-upload.handler.ts`, `process-payment.handler.ts`. Document any extras.

- [ ] **Step 1.3: Identify all Coupon + CouponRedemption create callsites**

```bash
grep -rn "coupon\.create\|couponRedemption\.create\|tx\.coupon\.\|tx\.couponRedemption\." src/ --include="*.ts" | grep -v ".spec.ts"
```

Expected: `create-coupon.handler.ts`, `apply-coupon.handler.ts` (callback tx). Document any extras.

- [ ] **Step 1.4: Identify all RefundRequest create callsites**

```bash
grep -rn "refundRequest\.create\|tx\.refundRequest\." src/ --include="*.ts" | grep -v ".spec.ts"
```

Expected: `request-refund.handler.ts`. Document any extras.

- [ ] **Step 1.5: Identify all ZatcaSubmission + ZatcaConfig callsites**

```bash
grep -rn "zatcaSubmission\.\|zatcaConfig\." src/ --include="*.ts" | grep -v ".spec.ts"
```

Expected: `zatca-submit.handler.ts`, `zatca-config/*.handler.ts`. ZatcaConfig is accessed via `findUnique({ id: 'default' })` + `upsert({ where: { id: 'default' } })` patterns — every one of these changes.

- [ ] **Step 1.6: Identify all `$transaction(async` callback-form uses in finance and any cross-cluster caller that creates finance rows**

```bash
grep -rn "\$transaction(async" src/ --include="*.ts" | grep -v ".spec.ts"
```

Expected in finance: `process-payment.handler.ts`, `apply-coupon.handler.ts`. Expected in bookings (from 02d): `create-booking`, `create-recurring-booking`, `create-guest-booking`, `reschedule-booking`, `client-reschedule-booking`. Document.

- [ ] **Step 1.7: Write the grep-audit summary**

Create `docs/superpowers/qa/saas-02e-callsite-audit-2026-04-21.md` with the raw grep output and any divergences from the expected lists above. If any ZATCA or Moyasar file appears outside the expected list, STOP and escalate to Tariq before proceeding.

- [ ] **Step 1.8: Commit the audit note**

```bash
git add docs/superpowers/qa/saas-02e-callsite-audit-2026-04-21.md
git commit -m "docs(saas-02e): pre-flight callsite audit for finance cluster"
```

---

## Task 2: Schema — add organizationId to 7 finance models + singleton + composite unique

**Files:**
- Modify: `apps/backend/prisma/schema/finance.prisma`

- [ ] **Step 2.1: Add `organizationId` to Invoice**

Insert after `id` line (existing file shows `id String @id @default(uuid())` then `branchId String`):

```prisma
model Invoice {
  id             String        @id @default(uuid())
  organizationId String // SaaS-02e
  branchId       String
  // ... rest unchanged ...

  @@index([clientId])
  @@index([bookingId])
  @@index([organizationId])
}
```

- [ ] **Step 2.2: Add `organizationId` to Payment**

```prisma
model Payment {
  id             String        @id @default(uuid())
  organizationId String // SaaS-02e (denormalized from Invoice)
  invoiceId      String
  // ... rest unchanged ...

  @@index([invoiceId])
  @@index([gatewayRef])
  @@index([organizationId])
}
```

- [ ] **Step 2.3: Add `organizationId` to Coupon and change unique on `code`**

```prisma
model Coupon {
  id             String       @id @default(uuid())
  organizationId String // SaaS-02e
  code           String // uniqueness now composite-per-org
  discountType   DiscountType
  discountValue  Decimal      @db.Decimal(12, 2)
  maxUses        Int?
  usedCount      Int          @default(0)
  minOrderAmt    Decimal?     @db.Decimal(12, 2)
  expiresAt      DateTime?
  isActive       Boolean      @default(true)
  descriptionAr  String?
  descriptionEn  String?
  maxUsesPerUser Int?
  serviceIds     String[]
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  redemptions CouponRedemption[]

  @@unique([organizationId, code])
  @@index([organizationId])
}
```

(The old `code String @unique` becomes `code String`; the unique is now on the composite. Do not keep both — a plain `@unique` on `code` would still globally reserve codes across orgs.)

- [ ] **Step 2.4: Add `organizationId` to CouponRedemption**

```prisma
model CouponRedemption {
  id             String   @id @default(uuid())
  organizationId String // SaaS-02e (denormalized from Coupon)
  couponId       String
  coupon         Coupon   @relation(fields: [couponId], references: [id], onDelete: Restrict)
  invoiceId      String
  clientId       String
  discount       Decimal  @db.Decimal(12, 2)
  redeemedAt     DateTime @default(now())

  @@unique([couponId, invoiceId])
  @@index([invoiceId])
  @@index([organizationId])
}
```

- [ ] **Step 2.5: Convert `ZatcaConfig` to org-unique singleton**

Replace the existing model entirely:

```prisma
model ZatcaConfig {
  id                    String    @id @default(uuid())
  organizationId        String    @unique // SaaS-02e — one config row per org
  vatRegistrationNumber String?
  sellerName            String?
  environment           String    @default("sandbox") // "sandbox" | "production"
  isOnboarded           Boolean   @default(false)
  onboardedAt           DateTime?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

- [ ] **Step 2.6: Add `organizationId` to ZatcaSubmission**

```prisma
model ZatcaSubmission {
  id             String                @id @default(uuid())
  organizationId String // SaaS-02e (denormalized from Invoice)
  invoiceId      String                @unique
  invoice        Invoice               @relation(fields: [invoiceId], references: [id], onDelete: Restrict)
  // ... rest unchanged ...

  @@index([organizationId])
}
```

- [ ] **Step 2.7: Add `organizationId` to RefundRequest**

```prisma
model RefundRequest {
  id             String       @id @default(uuid())
  organizationId String // SaaS-02e (denormalized from Invoice)
  invoiceId      String
  paymentId      String
  clientId       String
  amount         Decimal      @db.Decimal(12, 2)
  reason         String?
  status         RefundStatus @default(PENDING_REVIEW)
  processedAt    DateTime?
  processedBy    String?
  denialReason   String?
  gatewayRef     String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([clientId])
  @@index([invoiceId])
  @@index([status])
  @@index([organizationId])
}
```

- [ ] **Step 2.8: Run `npx prisma format`**

```bash
cd apps/backend && npx prisma format
```

Expected: no errors. File re-indents cleanly.

- [ ] **Step 2.9: Commit the schema change**

```bash
git add apps/backend/prisma/schema/finance.prisma
git commit -m "feat(saas-02e): add organizationId to 7 finance models + ZatcaConfig singleton + Coupon composite unique"
```

---

## Task 3: Migration — manual SQL

**Files:**
- Create: `apps/backend/prisma/migrations/<timestamp>_saas_02e_finance_tenancy/migration.sql`

Why manual SQL: `npx prisma migrate dev` conflicts with the pgvector `DocumentChunk.embedding` index (precedent: 02c, 02d).

- [ ] **Step 3.1: Generate the timestamped migration directory**

```bash
cd apps/backend
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_saas_02e_finance_tenancy"
echo "TS=$TS"
```

- [ ] **Step 3.2: Write the migration SQL**

Create `prisma/migrations/<TS>_saas_02e_finance_tenancy/migration.sql` with this exact content:

```sql
-- SaaS-02e: Finance cluster tenant rollout
-- Adds organizationId to 7 finance models, backfills with DEFAULT_ORG_ID,
-- drops Coupon.code unique and replaces with composite, converts ZatcaConfig
-- from id-based singleton ("default") to organizationId-unique singleton.

-- 1. Invoice
ALTER TABLE "Invoice" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "Invoice" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");

-- 2. Payment
ALTER TABLE "Payment" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "Payment" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "Payment_organizationId_idx" ON "Payment"("organizationId");

-- 3. Coupon — add orgId, swap unique constraint (drop global code unique, add composite)
ALTER TABLE "Coupon" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "Coupon" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "Coupon" DROP CONSTRAINT "Coupon_code_key";
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_organizationId_code_key" UNIQUE ("organizationId", "code");
CREATE INDEX "Coupon_organizationId_idx" ON "Coupon"("organizationId");

-- 4. CouponRedemption
ALTER TABLE "CouponRedemption" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "CouponRedemption" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "CouponRedemption_organizationId_idx" ON "CouponRedemption"("organizationId");

-- 5. RefundRequest
ALTER TABLE "RefundRequest" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "RefundRequest" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "RefundRequest_organizationId_idx" ON "RefundRequest"("organizationId");

-- 6. ZatcaSubmission
ALTER TABLE "ZatcaSubmission" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "ZatcaSubmission" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "ZatcaSubmission_organizationId_idx" ON "ZatcaSubmission"("organizationId");

-- 7. ZatcaConfig — singleton conversion.
-- Before: id @default("default") — one row with id='default'.
-- After: id uuid, organizationId @unique — one row per org.
-- Strategy: add organizationId column (NOT NULL), backfill existing "default" row to DEFAULT_ORG_ID,
-- then swap primary-key default from string "default" to uuid gen and enforce unique on organizationId.
ALTER TABLE "ZatcaConfig" ADD COLUMN "organizationId" TEXT;
UPDATE "ZatcaConfig" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "id" = 'default';
ALTER TABLE "ZatcaConfig" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ZatcaConfig" ADD CONSTRAINT "ZatcaConfig_organizationId_key" UNIQUE ("organizationId");
-- Change id default from "default" string to uuid. Existing id='default' row keeps that id value;
-- new rows get uuid. Prisma generate-time default is enforced at the app layer.
ALTER TABLE "ZatcaConfig" ALTER COLUMN "id" DROP DEFAULT;
-- No organizationId index needed (unique already indexes).

-- 8. Row Level Security (RLS) — enable + policy on all 7 tables
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Coupon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CouponRedemption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefundRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ZatcaSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ZatcaConfig" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "Invoice" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "Payment" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "Coupon" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "CouponRedemption" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "RefundRequest" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ZatcaSubmission" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ZatcaConfig" USING ("organizationId" = current_setting('app.current_organization_id', true));
```

- [ ] **Step 3.3: Apply the migration to dev + test DBs**

```bash
# Dev
cd apps/backend && npx prisma migrate deploy
# Test DB (required by moyasar-webhook-idempotency.spec.ts and new e2e suites)
TEST_DATABASE_URL="postgresql://deqah:deqah@localhost:5999/deqah_test" \
  DATABASE_URL="postgresql://deqah:deqah@localhost:5999/deqah_test" \
  npx prisma migrate deploy
```

Expected: both DBs report "Migration applied successfully". If pgvector blocks the migration, the SQL is already written — `migrate deploy` (not `migrate dev`) should proceed regardless.

- [ ] **Step 3.4: Regenerate Prisma client**

```bash
cd apps/backend && npx prisma generate
```

Expected: client regenerates. `ZatcaConfig` TS type now has `organizationId: string` and no longer accepts `id: "default"` as a default insert.

- [ ] **Step 3.5: Commit**

```bash
git add apps/backend/prisma/migrations/*saas_02e_finance_tenancy
git commit -m "feat(saas-02e): migration — backfill organizationId on 7 finance tables + convert ZatcaConfig to org-unique singleton + swap Coupon.code unique to composite"
```

---

## Task 4: Register finance models in SCOPED_MODELS + add system-context bypass

**Files:**
- Modify: `apps/backend/src/infrastructure/database/prisma.service.ts`

- [ ] **Step 4.1: Read the current SCOPED_MODELS block**

```bash
grep -n "SCOPED_MODELS" apps/backend/src/infrastructure/database/prisma.service.ts
```

- [ ] **Step 4.2: Add the 7 finance model names**

Append to the SCOPED_MODELS Set the same names listed in the "SCOPED_MODELS after this plan" block above (lines marked `// 02e — finance`). Keep alphabetical grouping inside the 02e section.

- [ ] **Step 4.3: Add the system-context bypass**

The Moyasar webhook (Task 8) needs a way to read Payment/Invoice without CLS tenant context (the webhook arrives with no authenticated user). Rather than scatter raw SQL throughout the codebase, add a single explicit bypass primitive:

Add to `TenantContextService` (in `src/infrastructure/database/tenant-context.service.ts`):

```ts
/**
 * Mark the current async-local context as "system" — scoped queries are NOT
 * auto-filtered by organizationId. Use ONLY for external-entry flows (payment
 * gateway webhooks, FCM DLQ, cron jobs) that arrive without a tenant and need
 * to look up the tenant from the payload. After resolving the org, re-run the
 * rest of the work inside a normal cls.run with the resolved organizationId.
 *
 * Never call this from a handler invoked by an authenticated user.
 */
isSystemContext(): boolean {
  return this.cls.get('systemContext') === true;
}
```

Then in `PrismaService` where the extension's `$allModels.$allOperations` interceptor injects `where.organizationId`, add the guard:

```ts
if (!SCOPED_MODELS.has(model)) return query(args);
if (tenantContext.isSystemContext()) return query(args); // external-entry bypass
// ... existing organizationId injection ...
```

- [ ] **Step 4.4: Run typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: it will fail in many finance handlers because the models are now scoped. The failures are the exact callsites we update in Tasks 5–8. Capture the full list in `docs/superpowers/qa/saas-02e-typecheck-after-scoped-2026-04-21.log`.

- [ ] **Step 4.5: Commit**

```bash
git add apps/backend/src/infrastructure/database/ docs/superpowers/qa/saas-02e-typecheck-after-scoped-2026-04-21.log
git commit -m "feat(saas-02e): register 7 finance models in SCOPED_MODELS + add system-context bypass for external-entry webhooks"
```

---

## Task 5: Resolve 02d invoice TODO + scope all non-Moyasar create-paths

**Files:**
- Modify: `src/modules/bookings/public/create-guest-booking.handler.ts` (resolves TODO(02e))
- Modify: `src/modules/finance/create-invoice/create-invoice.handler.ts`
- Modify: `src/modules/finance/coupons/create-coupon.handler.ts`
- Modify: `src/modules/finance/apply-coupon/apply-coupon.handler.ts` (callback-form tx)
- Modify: `src/modules/finance/refund-payment/request-refund.handler.ts`
- Modify: `src/modules/finance/payments/public/init-guest-payment/init-guest-payment.handler.ts`
- Modify: `src/modules/finance/bank-transfer-upload/bank-transfer-upload.handler.ts`

- [ ] **Step 5.1: Resolve TODO(02e) in create-guest-booking**

Open `src/modules/bookings/public/create-guest-booking.handler.ts` and find the `tx.invoice.create` call (≈line 178). The line above it currently has `// TODO(02e): add organizationId once Finance cluster is scoped`. Remove the TODO line and add `organizationId` to the `data` object, sourced from the outer scope's `organizationId` variable (this handler already derives organizationId via TenantContextService per 02d).

Verify first by reading lines 150–200:
```bash
sed -n '150,200p' apps/backend/src/modules/bookings/public/create-guest-booking.handler.ts
```

Then edit:

```ts
const invoice = await tx.invoice.create({
  data: {
    organizationId, // SaaS-02e — resolves TODO(02d→02e)
    bookingId: booking.id,
    branchId: booking.branchId,
    clientId: booking.clientId,
    employeeId: booking.employeeId,
    subtotal: booking.price,
    vatAmt: /* existing */,
    total: /* existing */,
    currency: booking.currency,
    status: 'DRAFT',
  },
});
```

(Keep all existing fields — only add `organizationId` as the first key.)

- [ ] **Step 5.2: Scope `create-invoice.handler.ts`**

Inject `TenantContextService` in the constructor (pattern established in 02b–02d):

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly eventBus: EventBusService,
  private readonly tenant: TenantContextService,
) {}
```

Change the existing-check from `findUnique({ bookingId })` to `findFirst({ bookingId })` (Proxy auto-scopes the where). Add `organizationId: this.tenant.requireOrganizationIdOrDefault()` to the `prisma.invoice.create` data block.

Also add `organizationId` to the published event envelope (`finance.invoice.created`) so downstream consumers (email, ZATCA) receive it without re-querying.

- [ ] **Step 5.3: Scope `create-coupon.handler.ts`**

Inject `TenantContextService`. Change the existing-check from `findUnique({ code })` to `findFirst({ code })` (composite unique — Proxy scopes it). Add `organizationId: this.tenant.requireOrganizationIdOrDefault()` to the `prisma.coupon.create` data block.

- [ ] **Step 5.4: Scope `apply-coupon.handler.ts` (callback-form tx)**

This handler uses `await this.prisma.$transaction(async (tx) => { ... })` — the `tx` client bypasses the Proxy. Explicit `organizationId` required in every `tx.*` call inside the callback.

- Inject `TenantContextService`.
- Before entering the transaction, capture: `const organizationId = this.tenant.requireOrganizationIdOrDefault();`
- Inside the transaction:
  - `tx.coupon.updateMany({ where: { id: coupon.id, organizationId, ... }, data: {...} })` — keep the existing optimistic-lock where clauses and append `organizationId`.
  - `tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } })` — `where: { id }` unique targets a single row; since id is UUID, this is safe without organizationId, but the row being updated must still be within the current org. Assert via a prefetch `tx.coupon.findFirst({ where: { id: coupon.id, organizationId } })` to avoid blind cross-org updates. Document this in the commit message.
  - `tx.couponRedemption.create({ data: { organizationId, couponId, invoiceId, clientId, discount } })` — explicit organizationId.
  - `tx.invoice.update({ where: { id: invoice.id }, data: { discountAmt, total } })` — same UUID-targeting safety note applies; the prior `findFirst` through the Proxy already validated ownership.

- [ ] **Step 5.5: Scope `request-refund.handler.ts`**

Inject `TenantContextService`. Change `findFirst({ id: cmd.invoiceId })` — Proxy auto-scopes. Change `findFirst({ invoiceId, status: PENDING_REVIEW })` — Proxy auto-scopes. In the `refundRequest.create` data block, add `organizationId: this.tenant.requireOrganizationIdOrDefault()`.

- [ ] **Step 5.6: Scope `init-guest-payment.handler.ts`**

Already uses `TenantContextService` (per 02d people pattern). Add `organizationId: this.tenant.requireOrganizationIdOrDefault()` to the `prisma.payment.create` data block. The existing `findFirst` reads auto-scope.

- [ ] **Step 5.7: Scope `bank-transfer-upload.handler.ts`**

Inject `TenantContextService`. The `findFirst({ id: invoiceId })` auto-scopes through Proxy. Add `organizationId: this.tenant.requireOrganizationIdOrDefault()` to the `prisma.payment.create` data block.

- [ ] **Step 5.8: Update spec mocks for the handlers touched in 5.2–5.7**

Use the `buildTenant()` helper established in 02b (`test/helpers/tenant.mock.ts`). Add `buildTenant() as never` at the constructor position matching the handler.

- [ ] **Step 5.9: Run the finance unit tests**

```bash
cd apps/backend && npx jest src/modules/finance/create-invoice src/modules/finance/coupons src/modules/finance/apply-coupon src/modules/finance/refund-payment/request-refund src/modules/finance/payments/public src/modules/finance/bank-transfer-upload src/modules/bookings/public/create-guest-booking
```

Expected: all green.

- [ ] **Step 5.10: Commit**

```bash
git add apps/backend/src/modules/finance apps/backend/src/modules/bookings/public/create-guest-booking.handler.ts
git commit -m "feat(saas-02e): scope finance create-paths by org + resolve 02d invoice TODO in create-guest-booking"
```

---

## Task 6: Scope lifecycle / update handlers (derive org from anchor)

**Files:**
- Modify: `src/modules/finance/process-payment/process-payment.handler.ts` (callback-form tx)
- Modify: `src/modules/finance/verify-payment/verify-payment.handler.ts`
- Modify: `src/modules/finance/refund-payment/approve-refund.handler.ts`
- Modify: `src/modules/finance/refund-payment/deny-refund.handler.ts`
- Modify: `src/modules/finance/refund-payment/refund-payment.handler.ts`
- Modify: `src/modules/finance/group-session-ready/group-session-ready.handler.ts`

These handlers already fetch the anchor row (Payment → Invoice, RefundRequest → Invoice). Derive `organizationId` from the anchor — do not re-inject `TenantContextService` for a value that's already in hand (02d lesson).

- [ ] **Step 6.1: `process-payment.handler.ts` (callback tx)**

Read the current structure (lines 20–110):

```bash
sed -n '20,110p' apps/backend/src/modules/finance/process-payment/process-payment.handler.ts
```

Inside the `$transaction(async (tx) => { ... })` callback, the initial `tx.invoice.findUnique({ where: { id: invoiceId } })` — this is a tx call that bypasses the Proxy. Change to `tx.invoice.findFirst({ where: { id: invoiceId } })` and add organizationId from the caller's CLS BEFORE the transaction. Pattern:

```ts
async execute(cmd: ProcessPaymentCommand) {
  // CLS is set by the authenticated caller — capture it BEFORE entering the tx callback.
  // The Proxy has already scoped the pre-tx reads; inside tx, we must be explicit.
  const organizationId = /* derived from pre-tx findFirst on Payment/Invoice */;

  const { payment, newStatus } = await this.prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, organizationId },
    });
    // ... existing logic ...
    const payment = await tx.payment.update({
      where: { id: payment.id },
      data: { status: newStatus, processedAt: new Date() },
    });
    return { payment, newStatus };
  });
  // ...
}
```

Inject `TenantContextService` here because `process-payment` is called from an authenticated context (dashboard/employee). `organizationId = this.tenant.requireOrganizationIdOrDefault()` at the top of `execute`.

- [ ] **Step 6.2: `verify-payment.handler.ts`**

Uses `prisma.payment.findFirst` (Proxy-scoped automatically). The `prisma.payment.update({ where: { id } })` targets a UUID — add a pre-update `findFirst({ id, organizationId })` guard only if the handler is callable in a cross-tenant boundary. Otherwise, the Proxy has already confirmed ownership on the initial `findFirst`. Document in commit.

If the handler also does `prisma.invoice.findUnique` → change to `findFirst`. No data changes otherwise.

- [ ] **Step 6.3: `approve-refund.handler.ts`**

Derives organizationId from `refundRequest.organizationId` (available on the fetched row after 02e migration). Use it for downstream mutations. Example:

```ts
const refundRequest = await this.prisma.refundRequest.findFirst({
  where: { id: cmd.refundRequestId },
});
if (!refundRequest) throw new NotFoundException(...);
const { organizationId } = refundRequest;
// subsequent mutations on payment / invoice / refundRequest pass through the
// Proxy by id — Proxy has organizationId from CLS. Verify with a pre-mutation
// guard query if any update targets a row NOT already fetched via Proxy.
```

- [ ] **Step 6.4: `deny-refund.handler.ts` and `refund-payment.handler.ts`**

Same pattern — no new injection, `findFirst` auto-scopes, mutations on UUID-ids stay.

- [ ] **Step 6.5: `group-session-ready.handler.ts`**

Change `prisma.invoice.findUnique` → `findFirst`. No create-path changes.

- [ ] **Step 6.6: Update spec mocks**

All spec files for these handlers need `buildTenant() as never` at the matching constructor position.

- [ ] **Step 6.7: Run tests**

```bash
cd apps/backend && npx jest src/modules/finance/process-payment src/modules/finance/verify-payment src/modules/finance/refund-payment src/modules/finance/group-session-ready
```

Expected: all green.

- [ ] **Step 6.8: Commit**

```bash
git add apps/backend/src/modules/finance
git commit -m "feat(saas-02e): scope finance lifecycle handlers (process-payment callback tx, refunds, verify-payment, group-session-ready)"
```

---

## Task 7: Scope read-paths + ZATCA config singleton conversion

**Files:**
- Modify: `src/modules/finance/zatca-config/get-zatca-config.handler.ts`
- Modify: `src/modules/finance/zatca-config/upsert-zatca-config.handler.ts`
- Modify: `src/modules/finance/zatca-config/onboard-zatca.handler.ts`
- Modify: `src/modules/finance/get-invoice/get-invoice.handler.ts`
- Modify: `src/modules/finance/get-invoice/get-booking-invoice.handler.ts`
- Modify: `src/modules/finance/get-invoice/get-public-invoice.handler.ts`
- Modify: `src/modules/finance/coupons/get-coupon.handler.ts`
- Modify: `src/modules/finance/coupons/update-coupon.handler.ts`
- Modify: `src/modules/finance/coupons/delete-coupon.handler.ts`
- Modify: `src/modules/finance/coupons/list-coupons.handler.ts`
- Modify: `src/modules/finance/list-payments/list-payments.handler.ts`
- Modify: `src/modules/finance/get-payment-stats/get-payment-stats.handler.ts`
- Modify: `src/modules/finance/refund-payment/list-refunds.handler.ts`
- Modify: `src/modules/finance/zatca-submit/zatca-submit.handler.ts`

- [ ] **Step 7.1: `get-zatca-config.handler.ts` — singleton upsert-on-read**

Current (id-based):
```ts
return this.prisma.zatcaConfig.upsert({
  where: { id: 'default' },
  update: {},
  create: { id: 'default' },
});
```

New (org-unique):
```ts
const organizationId = this.tenant.requireOrganizationIdOrDefault();
return this.prisma.zatcaConfig.upsert({
  where: { organizationId },
  update: {},
  create: { organizationId },
});
```

Inject `TenantContextService`.

- [ ] **Step 7.2: `upsert-zatca-config.handler.ts`**

Replace `where: { id: 'default' }` with `where: { organizationId }`. Replace `create: { id: 'default', ...rest }` with `create: { organizationId, ...rest }`. Inject tenant.

- [ ] **Step 7.3: `onboard-zatca.handler.ts`**

Replace both `findUnique({ where: { id: 'default' } })` and `upsert({ where: { id: 'default' } })` with `findFirst({ where: {} })` (Proxy scopes) and `upsert({ where: { organizationId } })` respectively. Inject tenant.

- [ ] **Step 7.4: Invoice / Coupon / Payment / Refund read handlers**

Change every `findUnique` that targets a non-orgId-composite key to `findFirst` (Proxy scopes). Every `findMany` and `count` already works through the Proxy on `where` — no code change needed but add the `organizationId` index-aware comment where relevant.

Specific changes per file:
- `get-invoice.handler.ts`: already `findFirst` — verify the controller passes only `id` in where.
- `get-booking-invoice.handler.ts`: already `findFirst` by `bookingId` — Proxy handles it.
- `get-public-invoice.handler.ts`: already `findFirst` — add a note that guest tokens resolve to an org before hitting this handler.
- `get-coupon.handler.ts` / `update-coupon.handler.ts` / `delete-coupon.handler.ts`: change `findUnique({ id })` → `findFirst({ id })`. The delete path must also pre-check redemption count scoped to org.
- `list-coupons.handler.ts`: `findMany` + `count` already Proxy-scoped.
- `list-payments.handler.ts` / `get-payment-stats.handler.ts`: Proxy-scoped.
- `list-refunds.handler.ts`: Proxy-scoped.

- [ ] **Step 7.5: `zatca-submit.handler.ts`**

Inject tenant. Change the initial `prisma.invoice.findFirst` — Proxy scopes. Change `prisma.zatcaSubmission.findUnique({ invoiceId })` → `findFirst({ invoiceId })`. Add `organizationId: this.tenant.requireOrganizationIdOrDefault()` to the `prisma.zatcaSubmission.create` data block.

- [ ] **Step 7.6: Update spec mocks + run tests**

```bash
cd apps/backend && npx jest src/modules/finance
```

Expected: all green.

- [ ] **Step 7.7: Commit**

```bash
git add apps/backend/src/modules/finance
git commit -m "feat(saas-02e): scope finance read-paths + ZatcaConfig singleton org-unique upsert-on-read"
```

---

## Task 8: ⚠️ Moyasar webhook — resolve tenant from payload then run scoped

**⚠️ OWNER-ONLY — STOP before executing this task. Tariq must explicitly approve the approach. Do not merge this task in a bundle PR with other tasks without owner sign-off.**

**Files:**
- Modify: `apps/backend/src/modules/finance/moyasar-webhook/moyasar-webhook.handler.ts`
- Modify: `apps/backend/src/modules/finance/moyasar-webhook/moyasar-webhook.handler.spec.ts`

**Problem:** Moyasar webhook requests arrive with no authenticated user / no CLS tenant context. The handler currently uses `this.prisma.payment.findFirst` and `this.prisma.invoice.findFirst` — after Task 4, these will auto-inject organizationId from CLS, which is unset, so they'll fall back to `DEFAULT_ORG_ID` and MISS any payment belonging to a different org.

**Solution:** Three-stage flow:
1. **Verify signature** (unchanged — pure crypto, no DB).
2. **Resolve tenant from payload** — use the system-context bypass added in Task 4 to read Payment by `gatewayRef` and Invoice by `id` with no org filter. Extract `invoice.organizationId`.
3. **Run the rest scoped** — wrap all subsequent mutations (`payment.upsert`, `invoice.update`, event publish) in `cls.run(() => cls.set('organizationId', invoice.organizationId) ... )` so the Proxy applies org-scoping and RLS is satisfied.

- [ ] **Step 8.1: Inject `ClsService` and `TenantContextService`**

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly eventBus: EventBusService,
  private readonly config: ConfigService,
  private readonly cls: ClsService,
  private readonly tenant: TenantContextService,
) {}
```

- [ ] **Step 8.2: Rewrite `execute()` with the three-stage flow**

```ts
async execute(req: MoyasarWebhookRequest): Promise<{ skipped?: boolean }> {
  const secret = this.config.get<string>('MOYASAR_SECRET_KEY');
  if (!secret) {
    this.logger.error('MOYASAR_SECRET_KEY not configured — refusing webhook');
    throw new InternalServerErrorException('Payment webhook is not configured');
  }
  this.verifySignature(req.rawBody, req.signature, secret);

  const payload = req.payload;
  const { invoiceId } = payload.metadata ?? {};
  if (!invoiceId) {
    this.logger.warn(`Moyasar webhook missing metadata: ${payload.id}`);
    return { skipped: true };
  }

  // STAGE 2 — resolve tenant from payload (system context bypasses org filter).
  const invoice = await this.cls.run(async () => {
    this.cls.set('systemContext', true);
    return this.prisma.invoice.findFirst({ where: { id: invoiceId } });
  });
  if (!invoice) return { skipped: true };

  // Idempotency check — also in system context (same payment row could belong
  // to any org; we already have the gateway-signature-authenticated payload).
  const existing = await this.cls.run(async () => {
    this.cls.set('systemContext', true);
    return this.prisma.payment.findFirst({
      where: { gatewayRef: payload.id, status: PaymentStatus.COMPLETED },
    });
  });
  if (existing) return { skipped: true };

  // STAGE 3 — run the rest inside the resolved tenant's context.
  return this.cls.run(async () => {
    this.cls.set('organizationId', invoice.organizationId);

    const amountSar = payload.amount / 100;
    const status: PaymentStatus =
      payload.status === 'paid' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;

    const payment = await this.prisma.payment.upsert({
      where: { idempotencyKey: `moyasar:${payload.id}` },
      update: { status, processedAt: new Date(), failureReason: payload.message },
      create: {
        organizationId: invoice.organizationId, // SaaS-02e
        invoiceId,
        amount: amountSar,
        currency: payload.currency,
        method: PaymentMethod.ONLINE_CARD,
        status,
        gatewayRef: payload.id,
        idempotencyKey: `moyasar:${payload.id}`,
        processedAt: status === PaymentStatus.COMPLETED ? new Date() : undefined,
        failureReason: payload.message,
      },
    });

    if (status === PaymentStatus.COMPLETED) {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID', paidAt: new Date() },
      });

      const event = new PaymentCompletedEvent({
        paymentId: payment.id,
        invoiceId: invoice.id,
        bookingId: invoice.bookingId,
        amount: amountSar,
        currency: invoice.currency,
        organizationId: invoice.organizationId, // pass to downstream consumers
      });
      await this.eventBus.publish(event.eventName, event.toEnvelope());
    } else if (status === PaymentStatus.FAILED) {
      const failedEvent = new PaymentFailedEvent({
        paymentId: payment.id,
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        amount: amountSar,
        currency: invoice.currency,
        reason: payload.message,
        organizationId: invoice.organizationId,
      });
      await this.eventBus.publish(failedEvent.eventName, failedEvent.toEnvelope());
    }

    return {};
  });
}
```

- [ ] **Step 8.3: Extend `PaymentCompletedEvent` and `PaymentFailedEvent` with `organizationId`**

Both events already flow into `payment-completed-handler` in bookings (02d). Accepting organizationId on the event is a non-breaking addition — add as optional first, then a follow-up migration in 02f can make it required once all producers set it.

- [ ] **Step 8.4: Update `moyasar-webhook.handler.spec.ts`**

Tests must now stub `ClsService` and `TenantContextService`. Add fixtures that:
- Create an Invoice in Org A with organizationId `orgA`.
- Call execute() with a payload referencing invoiceId.
- Assert: the Payment was upserted with organizationId `orgA`.
- Assert: the published event envelope includes organizationId `orgA`.

Repeat for Org B — the same webhook handler instance should route payments to the correct org based on the invoice payload, never to DEFAULT_ORG.

- [ ] **Step 8.5: Run tests**

```bash
cd apps/backend && npx jest src/modules/finance/moyasar-webhook
```

Expected: all green.

- [ ] **Step 8.6: Commit**

```bash
git add apps/backend/src/modules/finance/moyasar-webhook apps/backend/src/modules/finance/events
git commit -m "feat(saas-02e): moyasar webhook resolves tenant from invoice.organizationId via system-context bypass"
```

---

## Task 9: Cross-cluster readers — booking handlers that touch finance

**Files:**
- Modify: `src/modules/bookings/create-booking/create-booking.handler.ts` — coupon lookup
- Verify: `src/modules/bookings/client/list-client-bookings.handler.ts`
- Verify: `src/api/mobile/employee/earnings.controller.ts`
- Verify: `src/api/mobile/client/portal/summary.controller.ts`

- [ ] **Step 9.1: `create-booking.handler.ts` coupon lookup**

Current: `this.prisma.coupon.findUnique({ where: { code } })` — this breaks after Task 2 because `code` is no longer a plain unique. Change to:

```ts
const coupon = await this.prisma.coupon.findFirst({ where: { code } });
// Proxy auto-scopes by organizationId — caller's CLS must be set (it is,
// this is an authenticated dashboard/client flow).
```

- [ ] **Step 9.2: Verify list-client-bookings and portal readers**

These already call `findMany` / `aggregate` — Proxy auto-scopes `where`. No code change; add a comment above each finance-model read noting org auto-scoping.

- [ ] **Step 9.3: Update `create-booking.handler.spec.ts`**

The spec's mock coupon fixture must include `organizationId`. Update the fixture factory in `test/helpers/finance.fixture.ts` (create if not present) to inject DEFAULT_ORG_ID.

- [ ] **Step 9.4: Run tests**

```bash
cd apps/backend && npx jest src/modules/bookings
```

Expected: all green.

- [ ] **Step 9.5: Commit**

```bash
git add apps/backend/src/modules/bookings apps/backend/src/api apps/backend/test
git commit -m "feat(saas-02e): scope coupon lookup in create-booking + verify cross-cluster finance readers"
```

---

## Task 10: Isolation e2e tests

**Files (create):**
- `test/e2e/finance/invoice-isolation.e2e-spec.ts`
- `test/e2e/finance/payment-isolation.e2e-spec.ts`
- `test/e2e/finance/coupon-isolation.e2e-spec.ts`
- `test/e2e/finance/refund-isolation.e2e-spec.ts`
- `test/e2e/finance/zatca-isolation.e2e-spec.ts`
- `test/e2e/finance/moyasar-webhook-tenant-context.e2e-spec.ts`

Use the `isolation-harness.ts` pattern established in 02b/02c/02d (`cls.run(() => { ctx.set({ organizationId }); ... })`). Each spec seeds two orgs (A and B) and asserts cross-org invisibility and correct scoping on mutations.

- [ ] **Step 10.1: `invoice-isolation.e2e-spec.ts`**

Tests:
1. Create Invoice in Org A → Org B cannot see it via `list-invoices` or `get-invoice(id)`.
2. Create Invoice in Org A with same `bookingId` but Org B has a different booking with that id (different org) — no cross-contamination.

- [ ] **Step 10.2: `payment-isolation.e2e-spec.ts`**

Tests:
1. Create Payment in Org A → list-payments in Org B returns empty.
2. verify-payment for Org A's payment from Org B context throws NotFound.

- [ ] **Step 10.3: `coupon-isolation.e2e-spec.ts`**

Tests:
1. **Same code, two orgs** — Org A creates coupon `WELCOME10`, Org B creates coupon `WELCOME10`. Both succeed (composite unique). Each org only sees its own.
2. Redemption from Org A's coupon at an Org B invoice must fail.

- [ ] **Step 10.4: `refund-isolation.e2e-spec.ts`**

Tests:
1. Request refund in Org A → list-refunds in Org B returns empty.
2. approve-refund from Org B for Org A's RefundRequest throws NotFound.

- [ ] **Step 10.5: `zatca-isolation.e2e-spec.ts`**

Tests:
1. **Singleton per org** — get-zatca-config in Org A returns Org A's config; in Org B returns Org B's config. Updating one does not affect the other.
2. zatca-submit for Org A's invoice from Org B context throws NotFound.

- [ ] **Step 10.6: `moyasar-webhook-tenant-context.e2e-spec.ts`**

Tests (the single most important e2e in this plan):
1. Seed Invoice in Org A (id=invA) and Invoice in Org B (id=invB).
2. Send webhook payload `{ metadata: { invoiceId: invA }, id: 'mys_1', status: 'paid' }`.
3. Assert: Payment is created with `organizationId = orgA.id` (not DEFAULT_ORG, not orgB).
4. Assert: Event envelope on the bus carries `organizationId = orgA.id`.
5. Send second webhook for invB with same structure → Payment created under `orgB.id`.
6. Both payments coexist; `list-payments` in Org A returns one, in Org B returns the other.
7. Idempotency: replay the first webhook → returns `{ skipped: true }` and no duplicate.

- [ ] **Step 10.7: Run all isolation e2e**

```bash
cd apps/backend && npm run test:e2e -- --testPathPattern=finance
```

Expected: all 6 suites green. Run prior-cluster isolation suites too:

```bash
cd apps/backend && npm run test:e2e -- --testPathPattern="(bookings|identity|people|org-config)"
```

Expected: no regressions.

- [ ] **Step 10.8: Commit**

```bash
git add apps/backend/test/e2e/finance
git commit -m "test(saas-02e): finance cluster cross-tenant isolation e2e (6 suites) + moyasar webhook tenant-resolution"
```

---

## Task 11: Full regression + memory + index

- [ ] **Step 11.1: Full typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: clean.

- [ ] **Step 11.2: Full unit test suite**

```bash
cd apps/backend && npm run test
```

Expected: all green. Record count in the status note (was 953/953 after 02d).

- [ ] **Step 11.3: Full e2e suite**

```bash
cd apps/backend && npm run test:e2e
```

Expected: all green. Record count (was 38 isolation e2e after 02d = 6 booking-new + 32 prior).

- [ ] **Step 11.4: Create the status memory file**

Create `/Users/tariq/.claude/projects/-Users-tariq-code-deqah/memory/saas02e_status.md`:

```markdown
---
name: SaaS-02e status
description: Plan 02e (finance cluster tenant rollout) — 7 models scoped, ZatcaConfig singleton converted, Moyasar webhook resolves tenant from payload, 02d invoice TODO resolved
type: project
---
**Status:** PR #<N> <state> (feat/saas-02e-finance-cluster → main).

**Scope delivered:** 7 models tenant-scoped — Invoice, Payment, Coupon, CouponRedemption, RefundRequest, ZatcaSubmission, ZatcaConfig.

**Why:** Fifth cluster of SaaS-02 rollout. Finance is the regulated cluster: ZATCA (Saudi e-invoicing) and Moyasar (payment gateway) are owner-only. Every change reviewed + owner-approved before merge.

**Key amendments vs. plan (pre-flight found):** <fill in during execution>

**How to apply:**
- Coupon code is now composite-unique — `findFirst({ code })` everywhere, never `findUnique({ code })`.
- ZatcaConfig: upsert-on-read with `where: { organizationId }` (same pattern as BrandingConfig/OrganizationSettings).
- Moyasar webhook 3-stage pattern: verify signature → resolve tenant from invoice in system-context → run mutations inside cls.run with resolved orgId. Same pattern applies to any future external-entry (Zoom callbacks, FCM DLQ, cron from external triggers).
- Payment, RefundRequest, ZatcaSubmission lifecycle handlers derive orgId from invoice.organizationId — no TenantContextService injection needed.
- `process-payment` + `apply-coupon` use $transaction callback form — explicit organizationId in all `tx.*` ops.

**Test evidence:** <fill in> unit, 6 new finance isolation e2e, prior isolation e2e regression check passed.

**Next:** Plan 02f (Comms — Notification, ChatSession, EmailTemplate, ChatbotConfig singleton).
```

- [ ] **Step 11.5: Update MEMORY.md pointer**

Append one line under the existing 02d entry:

```
- [SaaS-02e status](saas02e_status.md) — Plan 02e delivered <date> PR #<N>; finance cluster (7 models) + ZatcaConfig singleton + Moyasar tenant resolution; unit + finance isolation e2e; 02d invoice TODO resolved
```

- [ ] **Step 11.6: Update transformation index**

In `docs/superpowers/plans/2026-04-21-saas-transformation-index.md`:
- Progress: 6/18 phases done (33%).
- Phase 02e ✅ DONE with PR link.
- Executor next action: merge PR #<N> → plan 02f ready.
- Remove the "02d invoice TODO" line from active risks (resolved).
- Add new risk note if Moyasar signature verification surfaces any edge cases during e2e.

- [ ] **Step 11.7: Final commit**

```bash
git add /Users/tariq/.claude/projects/-Users-tariq-code-deqah/memory/saas02e_status.md /Users/tariq/.claude/projects/-Users-tariq-code-deqah/memory/MEMORY.md docs/superpowers/plans/2026-04-21-saas-transformation-index.md
git commit -m "docs(saas): mark 02e done in index + memory (finance cluster + moyasar tenant resolution)"
```

- [ ] **Step 11.8: Open the PR**

```bash
git push -u origin feat/saas-02e-finance-cluster
gh pr create --title "feat(saas-02e): finance cluster tenant rollout — 7 models + ZatcaConfig singleton + Moyasar tenant resolution" \
  --body "<summary including owner-review checklist: ZATCA config migration safe, Moyasar webhook verified with two-org isolation test, 02d invoice TODO resolved, all 7 models scoped>"
```

**⚠️ After PR opens, request Tariq's explicit owner-review approval BEFORE merging**, even under the "auto-merge phases" feedback rule. ZATCA + Moyasar are owner-gated.

---

## Rollback plan (if Moyasar webhook breaks in production)

If the tenant-resolution rewrite causes webhooks to fail post-deploy:

1. `git revert` the moyasar-webhook commit only — all other 02e commits are independent.
2. The migration is forward-only but schema-compatible with the pre-02e handler (the column is NOT NULL with a default backfill, and the old handler would just write DEFAULT_ORG to it — visible under permissive mode but not correct multi-tenant behavior).
3. If the schema itself must revert, drop the RLS policies and the columns can be kept as-is — no row-level data loss.

Document any real production incident in `docs/superpowers/incidents/` and add the lesson to the critical-lessons list at the top of the next plan.
