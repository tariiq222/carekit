# AI + Media + Ops + Platform Tenant Rollout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope the remaining infrastructure-adjacent clusters before strict mode is flipped on in 02h. Adds `organizationId` to KnowledgeDocument, DocumentChunk, File, ActivityLog, Report, FeatureFlag, Integration, ProblemReport; converts `SiteSetting` from global key-value content to an org-scoped variant (per-org `key` uniqueness); updates every reader + writer across `ai/`, `media/`, `ops/`, `platform/`, and `content/` modules; and adds isolation e2e tests with special coverage for the semantic-search pgvector `$queryRaw`.

**Architecture:** Same strangler/cluster pattern as 02a–02f. Two new wrinkles that require extra care here:

1. **⚠️ DocumentChunk has a pgvector `Unsupported("vector(1536)")` column.** The migrations in 02b/02c/02d/02e/02f all used `npx prisma migrate deploy` + a manually-written `migration.sql` to avoid `prisma migrate dev` re-running pgvector-incompatible hooks. This plan MUST follow the same path — the migration SQL is written entirely by hand in Task 3. Do NOT run `prisma migrate dev` on this cluster.
2. **Semantic search uses `$queryRaw`.** Invariant #4 from the transformation index: every `$queryRaw` must include an `organization_id` predicate. `semantic-search.handler.ts` runs a raw SQL similarity query on `DocumentChunk` — it MUST be edited by hand to inject `AND dc."organizationId" = ${organizationId}` into the WHERE clause. The Prisma Proxy extension does NOT scope `$queryRaw` calls.
3. **SiteSetting has `key` as the primary key** (no separate id column). Converting to multi-tenant requires swapping the primary key from `key` to a composite `(organizationId, key)` — a destructive schema change. This plan drops the existing primary key and adds the composite, preserving all rows under DEFAULT_ORG.
4. **ActivityLog writes happen from almost everywhere** (login audit, RBAC mutations, payment events). Writers must populate `organizationId` — prefer deriving from the actor's CLS context; if CLS is not set (system events), use DEFAULT_ORG with an explicit log line.

**Tech Stack:** NestJS 11, Prisma 7 (`$extends` Proxy), nestjs-cls (`TenantContextService`), PostgreSQL RLS + pgvector, Jest + Supertest (isolation e2e).

---

## Critical lessons from prior plans — READ BEFORE STARTING

1. **Grep ALL callsites first** (Task 1). ActivityLog and File writes are sprinkled across the entire codebase — missing a single one leaves data under DEFAULT_ORG.
2. **`$transaction` callback form bypasses the Proxy.** Every `tx.*.create()` / `tx.*.findFirst()` inside an `async (tx) => {}` callback needs explicit `organizationId`.
3. **Extension covers `where` not `data`.** Every create statement outside the Proxy is explicit.
4. **`$queryRaw` is not scoped by the extension.** Must be edited manually to include `organization_id = $X`. Applies to `semantic-search.handler.ts` and any health-check that raw-counts tables.
5. **pgvector: `npx prisma migrate dev` is not safe here** — write migration.sql manually, use `migrate deploy`.
6. **Composite unique swap breaks `findUnique`.** SiteSetting, Integration (`provider @unique`), FeatureFlag (`key @unique`) all need `findUnique` → `findFirst` migration in read handlers.
7. **Singleton conversion pattern (02c, 02e, 02f).** SiteSetting uses a **per-key-per-org** pattern, not a full singleton — composite primary key `(organizationId, key)`. FeatureFlag and Integration stay as regular scoped models with composite unique on their natural key.
8. **ActivityLog writers often run in event subscribers** — CLS may not be set. Accept `organizationId` on the command or derive from the event envelope.
9. **RLS tests need a non-superuser role** (02b lesson 5). Dev DB user is fine for application-level isolation tests; only raw-SQL RLS probes need the non-superuser — flag in Task 9.
10. **Divergence-before-commit.** If reality diverges, STOP, document, propose amendment, await confirmation.

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
  // 02f — comms
  'EmailTemplate', 'Notification',
  'ChatConversation', 'CommsChatMessage',
  'ChatSession', 'ChatMessage',
  'ContactMessage', 'ChatbotConfig',
  // 02g — ai + media + ops + platform + content
  'KnowledgeDocument', 'DocumentChunk',
  'File',
  'ActivityLog', 'Report',
  'FeatureFlag', 'Integration', 'ProblemReport',
  'SiteSetting',
]);
```

---

## File Structure

**Schema (modify):**
- `apps/backend/prisma/schema/ai.prisma` — add `organizationId` to KnowledgeDocument, DocumentChunk (denormalized). Note: ChatSession/ChatMessage/ChatbotConfig were already scoped in 02f.
- `apps/backend/prisma/schema/media.prisma` — add `organizationId` to File.
- `apps/backend/prisma/schema/ops.prisma` — add `organizationId` to ActivityLog, Report.
- `apps/backend/prisma/schema/platform.prisma` — add `organizationId` to FeatureFlag, Integration, ProblemReport. Change `Integration.provider @unique` → `@@unique([organizationId, provider])`. Change `FeatureFlag.key @unique` → `@@unique([organizationId, key])`.
- `apps/backend/prisma/schema/content.prisma` — restructure SiteSetting primary key from `key` to `(organizationId, key)` composite.

**Migration (create, manual SQL, pgvector-safe):**
- `apps/backend/prisma/migrations/<timestamp>_saas_02g_infra_tenancy/migration.sql`

**SCOPED_MODELS (modify):**
- `apps/backend/src/infrastructure/database/prisma.service.ts`

**Handlers to modify — AI cluster:**
- `src/modules/ai/manage-knowledge-base/create-knowledge-document.handler.ts`
- `src/modules/ai/manage-knowledge-base/list-knowledge-documents.handler.ts`
- `src/modules/ai/manage-knowledge-base/delete-knowledge-document.handler.ts`
- `src/modules/ai/embed-document/embed-document.handler.ts` (creates DocumentChunks)
- `src/modules/ai/semantic-search/semantic-search.handler.ts` ⚠️ **$queryRaw rewrite**

**Handlers to modify — Media cluster:**
- `src/modules/media/files/upload-file.handler.ts`
- `src/modules/media/files/get-file.handler.ts`
- `src/modules/media/files/delete-file.handler.ts`
- `src/modules/media/files/list-files.handler.ts`

**Handlers to modify — Ops cluster:**
- `src/modules/ops/log-activity/log-activity.handler.ts` ⚠️ widespread writer
- `src/modules/ops/generate-report/*.handler.ts` — create path + list
- `src/modules/ops/health-check/health-check.handler.ts` — any `$queryRaw` count probes

**Handlers to modify — Platform cluster:**
- `src/modules/platform/feature-flags/*.handler.ts` — create/update/delete/list/get
- `src/modules/platform/integrations/*.handler.ts`
- `src/modules/platform/problem-reports/*.handler.ts`

**Handlers to modify — Content (SiteSetting) cluster:**
- `src/modules/content/site-settings/*.handler.ts` — upsert + get + list

**Cross-cutting (modify):**
- Every `ActivityLog` writer call-site outside the `log-activity` handler (grep Task 1).
- Event subscribers that log activity (bookings, finance, identity events).

**Tests (create):**
- `test/e2e/ai/knowledge-base-isolation.e2e-spec.ts`
- `test/e2e/ai/semantic-search-isolation.e2e-spec.ts` ⚠️ critical
- `test/e2e/media/file-isolation.e2e-spec.ts`
- `test/e2e/ops/activity-log-isolation.e2e-spec.ts`
- `test/e2e/ops/report-isolation.e2e-spec.ts`
- `test/e2e/platform/feature-flag-isolation.e2e-spec.ts`
- `test/e2e/platform/integration-isolation.e2e-spec.ts`
- `test/e2e/platform/problem-report-isolation.e2e-spec.ts`
- `test/e2e/content/site-setting-isolation.e2e-spec.ts`

**Memory (create):**
- `/Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/saas02g_status.md`

**Transformation index (modify):**
- `docs/superpowers/plans/2026-04-21-saas-transformation-index.md` — mark 02g done.

---

## Task 1: Pre-flight — grep all callsites

- [ ] **Step 1.1: Identify KnowledgeDocument + DocumentChunk callsites**

```bash
cd apps/backend
grep -rn "knowledgeDocument\.\|documentChunk\." src/ --include="*.ts" | grep -v ".spec.ts"
```

Expected: `manage-knowledge-base/*`, `embed-document/*`, `semantic-search/*`.

- [ ] **Step 1.2: Identify every `$queryRaw` / `$executeRaw` usage**

```bash
grep -rn "\$queryRaw\|\$executeRaw\|queryRawUnsafe\|executeRawUnsafe" src/ --include="*.ts" | grep -v ".spec.ts"
```

Each raw SQL call MUST include `"organizationId" = $X` in WHERE. Document every hit. Most critical: `semantic-search.handler.ts`.

- [ ] **Step 1.3: Identify File callsites**

```bash
grep -rn "prisma\.file\.\|tx\.file\." src/ --include="*.ts" | grep -v ".spec.ts" | grep -v "FileVisibility"
```

Expected: `media/files/*`, plus any handler that uploads attachments (service avatars, branding assets, intake form uploads).

- [ ] **Step 1.4: Identify ActivityLog writers — CRITICAL**

```bash
grep -rn "activityLog\.create\|logActivity\|LogActivityHandler\|ActivityLogService" src/ --include="*.ts" | grep -v ".spec.ts"
```

Every producer writes or invokes `LogActivityHandler`. List all callers so Task 7 updates each to pass `organizationId`.

- [ ] **Step 1.5: Identify Report callsites**

```bash
grep -rn "report\.create\|report\.findFirst\|report\.findUnique\|report\.findMany" src/ --include="*.ts" | grep -v ".spec.ts"
```

- [ ] **Step 1.6: Identify FeatureFlag + Integration + ProblemReport callsites**

```bash
grep -rn "featureFlag\.\|integration\.\|problemReport\." src/ --include="*.ts" | grep -v ".spec.ts"
```

Note: `integration.provider @unique` and `featureFlag.key @unique` will break `findUnique` callers — document them.

- [ ] **Step 1.7: Identify SiteSetting callsites**

```bash
grep -rn "siteSetting\." src/ --include="*.ts" | grep -v ".spec.ts"
```

`findUnique({ where: { key } })` callers break after the primary-key swap — all become `findFirst({ where: { key } })` (Proxy auto-scopes by org after the composite key is in place).

- [ ] **Step 1.8: Identify $transaction(async callback uses across these clusters**

```bash
grep -rn "\$transaction(async" src/modules/ai/ src/modules/media/ src/modules/ops/ src/modules/platform/ src/modules/content/ --include="*.ts" | grep -v ".spec.ts"
```

- [ ] **Step 1.9: Write the grep-audit summary**

Create `docs/superpowers/qa/saas-02g-callsite-audit-2026-04-21.md` with the full raw grep output and a "writers to update" checklist. Flag every ActivityLog writer that lives outside the ops/log-activity slice.

- [ ] **Step 1.10: Commit**

```bash
git add docs/superpowers/qa/saas-02g-callsite-audit-2026-04-21.md
git commit -m "docs(saas-02g): pre-flight callsite audit for ai/media/ops/platform/content clusters"
```

---

## Task 2: Schema changes

- [ ] **Step 2.1: `ai.prisma` — KnowledgeDocument + DocumentChunk**

```prisma
model KnowledgeDocument {
  id             String         @id @default(uuid())
  organizationId String // SaaS-02g
  title          String
  sourceType     String
  sourceRef      String?
  status         DocumentStatus @default(PENDING)
  metadata       Json?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  chunks DocumentChunk[]

  @@index([status])
  @@index([createdAt])
  @@index([organizationId])
}

model DocumentChunk {
  id             String                       @id @default(uuid())
  organizationId String // SaaS-02g (denormalized from KnowledgeDocument — required for $queryRaw filter)
  documentId     String
  content        String
  embedding      Unsupported("vector(1536)")?
  chunkIndex     Int
  tokenCount     Int                          @default(0)
  createdAt      DateTime                     @default(now())

  document KnowledgeDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@index([organizationId])
}
```

- [ ] **Step 2.2: `media.prisma` — File**

```prisma
model File {
  id             String         @id @default(uuid())
  organizationId String // SaaS-02g
  bucket         String
  storageKey     String         @unique
  filename       String
  mimetype       String
  size           Int
  visibility     FileVisibility @default(PRIVATE)
  ownerType      String?
  ownerId        String?
  uploadedBy     String?
  isDeleted      Boolean        @default(false)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  @@index([ownerType, ownerId])
  @@index([uploadedBy])
  @@index([organizationId])
}
```

(`storageKey` stays globally unique because MinIO bucket keys are global; `organizationId` is for logical isolation.)

- [ ] **Step 2.3: `ops.prisma` — ActivityLog + Report**

```prisma
model ActivityLog {
  id             String         @id @default(uuid())
  organizationId String // SaaS-02g
  userId         String?
  userEmail      String?
  action         ActivityAction
  entity         String
  entityId       String?
  description    String
  metadata       Json?
  ipAddress      String?
  userAgent      String?
  occurredAt     DateTime       @default(now())

  @@index([occurredAt])
  @@index([entity, entityId])
  @@index([userId])
  @@index([organizationId])
}

model Report {
  id             String       @id @default(uuid())
  organizationId String // SaaS-02g
  type           ReportType
  format         ReportFormat @default(JSON)
  status         ReportStatus @default(PENDING)
  params         Json
  resultUrl      String?
  resultData     Json?
  errorMsg       String?
  requestedBy    String?
  createdAt      DateTime     @default(now())
  completedAt    DateTime?

  @@index([type, createdAt])
  @@index([organizationId])
}
```

- [ ] **Step 2.4: `platform.prisma` — FeatureFlag + Integration + ProblemReport**

```prisma
model FeatureFlag {
  id             String   @id @default(cuid())
  organizationId String // SaaS-02g
  key            String // uniqueness now composite-per-org
  enabled        Boolean  @default(true)
  nameAr         String
  nameEn         String
  descriptionAr  String?
  descriptionEn  String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([organizationId, key])
  @@index([organizationId])
}

model Integration {
  id             String   @id @default(uuid())
  organizationId String // SaaS-02g
  provider       String // uniqueness now composite-per-org
  config         Json
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([organizationId, provider])
  @@index([organizationId])
}

model ProblemReport {
  id             String              @id @default(uuid())
  organizationId String // SaaS-02g
  reporterId     String
  type           ProblemReportType
  title          String
  description    String
  status         ProblemReportStatus @default(OPEN)
  resolution     String?
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt

  @@index([status])
  @@index([organizationId])
}
```

- [ ] **Step 2.5: `content.prisma` — SiteSetting composite primary key**

Current model uses `key` as primary key. New:

```prisma
model SiteSetting {
  organizationId String // SaaS-02g
  key            String
  valueText      String?
  valueAr        String?
  valueEn        String?
  valueJson      Json?
  valueMedia     String?
  updatedAt      DateTime @updatedAt

  @@id([organizationId, key])
  @@index([updatedAt])
  @@index([organizationId])
}
```

Note: dropping the old `@id` on `key` and adding `@@id([organizationId, key])` is a destructive schema change — Task 3 migration handles it explicitly.

- [ ] **Step 2.6: Format + validate**

```bash
cd apps/backend && npx prisma format && npx prisma validate
```

Expected: clean. pgvector may warn — that's fine; manual SQL migration follows.

- [ ] **Step 2.7: Commit schema**

```bash
git add apps/backend/prisma/schema/
git commit -m "feat(saas-02g): add organizationId to ai/media/ops/platform/content models + composite unique swaps"
```

---

## Task 3: Migration — manual SQL, pgvector-safe

**⚠️ DO NOT run `npx prisma migrate dev`.** Write the migration SQL by hand and apply with `npx prisma migrate deploy`. The `DocumentChunk.embedding vector(1536)` column causes `migrate dev` to misbehave — precedent: 02b/02c/02d/02e/02f.

- [ ] **Step 3.1: Create timestamped migration dir**

```bash
cd apps/backend
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_saas_02g_infra_tenancy"
echo "TS=$TS"
```

- [ ] **Step 3.2: Write migration.sql**

Create `prisma/migrations/<TS>_saas_02g_infra_tenancy/migration.sql`:

```sql
-- SaaS-02g: Infrastructure-adjacent clusters (AI + Media + Ops + Platform + Content)
-- pgvector-safe manual migration — applied via `prisma migrate deploy`.

-- 1. KnowledgeDocument
ALTER TABLE "KnowledgeDocument" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "KnowledgeDocument" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "KnowledgeDocument_organizationId_idx" ON "KnowledgeDocument"("organizationId");

-- 2. DocumentChunk (denormalized — required for pgvector $queryRaw filter)
ALTER TABLE "DocumentChunk" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "DocumentChunk" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "DocumentChunk_organizationId_idx" ON "DocumentChunk"("organizationId");

-- 3. File
ALTER TABLE "File" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "File" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "File_organizationId_idx" ON "File"("organizationId");

-- 4. ActivityLog
ALTER TABLE "ActivityLog" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "ActivityLog" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "ActivityLog_organizationId_idx" ON "ActivityLog"("organizationId");

-- 5. Report
ALTER TABLE "Report" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "Report" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "Report_organizationId_idx" ON "Report"("organizationId");

-- 6. FeatureFlag — add orgId, swap key unique for composite
ALTER TABLE "FeatureFlag" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "FeatureFlag" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "FeatureFlag" DROP CONSTRAINT "FeatureFlag_key_key";
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_organizationId_key_key" UNIQUE ("organizationId", "key");
CREATE INDEX "FeatureFlag_organizationId_idx" ON "FeatureFlag"("organizationId");

-- 7. Integration — add orgId, swap provider unique for composite
ALTER TABLE "Integration" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "Integration" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "Integration" DROP CONSTRAINT "Integration_provider_key";
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_organizationId_provider_key" UNIQUE ("organizationId", "provider");
CREATE INDEX "Integration_organizationId_idx" ON "Integration"("organizationId");

-- 8. ProblemReport
ALTER TABLE "ProblemReport" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "ProblemReport" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "ProblemReport_organizationId_idx" ON "ProblemReport"("organizationId");

-- 9. SiteSetting — primary key swap from (key) to (organizationId, key)
ALTER TABLE "SiteSetting" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "SiteSetting" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "SiteSetting" DROP CONSTRAINT "SiteSetting_pkey";
ALTER TABLE "SiteSetting" ADD CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("organizationId", "key");
CREATE INDEX "SiteSetting_organizationId_idx" ON "SiteSetting"("organizationId");

-- 10. Row Level Security on all 9 tables
ALTER TABLE "KnowledgeDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentChunk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "File" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeatureFlag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Integration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProblemReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteSetting" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "KnowledgeDocument" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "DocumentChunk" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "File" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ActivityLog" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "Report" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "FeatureFlag" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "Integration" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ProblemReport" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "SiteSetting" USING ("organizationId" = current_setting('app.current_organization_id', true));
```

- [ ] **Step 3.3: Apply migration (dev + test)**

```bash
cd apps/backend && npx prisma migrate deploy
TEST_DATABASE_URL="postgresql://carekit:carekit@localhost:5999/carekit_test" \
  DATABASE_URL="postgresql://carekit:carekit@localhost:5999/carekit_test" \
  npx prisma migrate deploy
```

**DO NOT run `npx prisma migrate dev` under any circumstances on this cluster.** `deploy` applies the SQL as-written without touching pgvector generation.

Expected: both DBs migrated. If dev DB is out of sync from earlier experimentation, reset via `npx prisma migrate reset` only after confirming there is no unmigrated work in progress (destructive — ask the executor before running).

- [ ] **Step 3.4: Regenerate Prisma client**

```bash
cd apps/backend && npx prisma generate
```

Expected: types update to require `organizationId` on all 9 models.

- [ ] **Step 3.5: Commit migration**

```bash
git add apps/backend/prisma/migrations/*saas_02g_infra_tenancy
git commit -m "feat(saas-02g): migration — organizationId on 9 infra models (pgvector-safe manual SQL)"
```

---

## Task 4: Register SCOPED_MODELS

- [ ] **Step 4.1: Append the 9 model names to `SCOPED_MODELS` in `prisma.service.ts`**

Add after the 02f block:

```ts
// 02g — ai + media + ops + platform + content
'KnowledgeDocument', 'DocumentChunk',
'File',
'ActivityLog', 'Report',
'FeatureFlag', 'Integration', 'ProblemReport',
'SiteSetting',
```

- [ ] **Step 4.2: Typecheck + capture failures**

```bash
cd apps/backend && npm run typecheck 2> docs/superpowers/qa/saas-02g-typecheck-after-scoped-2026-04-21.log || true
```

Expected: failures in every writer — that's the checklist for Tasks 5–9.

- [ ] **Step 4.3: Commit**

```bash
git add apps/backend/src/infrastructure/database/prisma.service.ts docs/superpowers/qa/saas-02g-typecheck-after-scoped-2026-04-21.log
git commit -m "feat(saas-02g): register 9 infra models in SCOPED_MODELS"
```

---

## Task 5: AI cluster — KnowledgeDocument, DocumentChunk, semantic-search $queryRaw

**Files:**
- Modify: `src/modules/ai/manage-knowledge-base/*.handler.ts`
- Modify: `src/modules/ai/embed-document/embed-document.handler.ts`
- Modify: `src/modules/ai/semantic-search/semantic-search.handler.ts` ⚠️

- [ ] **Step 5.1: `create-knowledge-document.handler.ts`**

Inject `TenantContextService`. Add `organizationId: this.tenant.requireOrganizationIdOrDefault()` to `prisma.knowledgeDocument.create({ data })`.

- [ ] **Step 5.2: `embed-document.handler.ts`**

Fetch the KnowledgeDocument first (Proxy auto-scopes by CLS). Derive `organizationId` from `doc.organizationId`. For each chunk:

```ts
const doc = await this.prisma.knowledgeDocument.findFirst({ where: { id: cmd.documentId } });
if (!doc) throw new NotFoundException('Document not found');

for (const chunk of chunks) {
  await this.prisma.documentChunk.create({
    data: {
      organizationId: doc.organizationId,   // SaaS-02g
      documentId: doc.id,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      tokenCount: chunk.tokenCount,
    },
  });
  // embedding written via $executeRaw — see step 5.4
}
```

- [ ] **Step 5.3: Writing embedding via `$executeRaw`**

The embedding column is `Unsupported("vector(1536)")` — Prisma cannot set it via `data`. Existing code uses `prisma.$executeRaw` to UPDATE with `embedding = $1::vector`. After 02g, this UPDATE must also filter by `organizationId` to prevent any accidental cross-org write (defense in depth):

```ts
await this.prisma.$executeRaw`
  UPDATE "DocumentChunk"
     SET "embedding" = ${vector}::vector
   WHERE "id" = ${chunk.id}
     AND "organizationId" = ${doc.organizationId}
`;
```

- [ ] **Step 5.4: ⚠️ `semantic-search.handler.ts` — the critical $queryRaw rewrite**

The current handler runs something like:

```ts
const rows = await this.prisma.$queryRaw<SemanticSearchRow[]>`
  SELECT dc."id", dc."content", dc."documentId",
         1 - (dc."embedding" <=> ${vector}::vector) as similarity
    FROM "DocumentChunk" dc
    WHERE dc."embedding" IS NOT NULL
    ORDER BY dc."embedding" <=> ${vector}::vector
    LIMIT ${topK}
`;
```

After 02g, this MUST include `AND dc."organizationId" = ${organizationId}`:

```ts
const organizationId = this.tenant.requireOrganizationIdOrDefault();
const rows = await this.prisma.$queryRaw<SemanticSearchRow[]>`
  SELECT dc."id", dc."content", dc."documentId",
         1 - (dc."embedding" <=> ${vector}::vector) as similarity
    FROM "DocumentChunk" dc
    WHERE dc."embedding" IS NOT NULL
      AND dc."organizationId" = ${organizationId}
    ORDER BY dc."embedding" <=> ${vector}::vector
    LIMIT ${topK}
`;
```

Inject `TenantContextService`. Do NOT interpolate `organizationId` via `${...}` template literal without the tagged template — use `Prisma.sql` fragments if composing dynamically. Prisma parameterizes the template-literal values, so the tagged form shown here is safe against SQL injection.

- [ ] **Step 5.5: `list-knowledge-documents` + `delete-knowledge-document`**

`findMany` + `findFirst` auto-scope through Proxy. Delete by id: pre-fetch + delete. Cascade to DocumentChunks: the existing `onDelete: Cascade` handles row-level cleanup; verify embeddings are gone after a delete.

- [ ] **Step 5.6: Specs + run**

```bash
cd apps/backend && npx jest src/modules/ai --no-coverage
```

Expected: green. Mock `$queryRaw` return for semantic-search spec to verify the `organizationId` predicate is present in the generated SQL string — assert by spying `prismaService.$queryRaw` and checking the bound-params include the expected org id.

- [ ] **Step 5.7: Commit**

```bash
git add apps/backend/src/modules/ai
git commit -m "feat(saas-02g): scope AI cluster + inject organizationId into semantic-search \$queryRaw"
```

---

## Task 6: Media cluster — File

**Files:**
- Modify: `src/modules/media/files/*.handler.ts`
- Plus any caller that uploads a File (grep 1.3 output): branding logo upload, service avatar upload, etc. — each must now pass CLS-derived organizationId.

- [ ] **Step 6.1: `upload-file.handler.ts`**

Inject `TenantContextService`. Add `organizationId: this.tenant.requireOrganizationIdOrDefault()` to `prisma.file.create({ data })`.

- [ ] **Step 6.2: `get-file.handler.ts` / `list-files.handler.ts` / `delete-file.handler.ts`**

Proxy auto-scopes. Pre-fetch guard on delete.

- [ ] **Step 6.3: External callers uploading files**

For every caller surfaced in grep 1.3 outside `media/files/*`: confirm they invoke `UploadFileHandler` (which now sets organizationId) rather than writing `prisma.file.create` directly. If any handler writes `prisma.file.create` directly, add `organizationId` to the data block.

- [ ] **Step 6.4: Specs + run**

```bash
cd apps/backend && npx jest src/modules/media --no-coverage
```

- [ ] **Step 6.5: Commit**

```bash
git add apps/backend/src/modules/media
git commit -m "feat(saas-02g): scope File uploads + reads"
```

---

## Task 7: Ops cluster — ActivityLog (widespread) + Report + health-check

**Files:**
- Modify: `src/modules/ops/log-activity/log-activity.handler.ts` ⚠️
- Modify: every caller surfaced in grep 1.4 that writes ActivityLog
- Modify: `src/modules/ops/generate-report/*.handler.ts`
- Modify: `src/modules/ops/health-check/health-check.handler.ts`

- [ ] **Step 7.1: `log-activity.handler.ts` — accept organizationId explicitly**

Many ActivityLog writes happen in event subscribers where CLS is not guaranteed. Change the command to accept `organizationId`:

```ts
export interface LogActivityCommand {
  organizationId?: string; // optional — falls back to CLS or DEFAULT_ORG
  userId?: string;
  action: ActivityAction;
  entity: string;
  entityId?: string;
  description: string;
  metadata?: Json;
  ipAddress?: string;
  userAgent?: string;
}

async execute(cmd: LogActivityCommand) {
  const organizationId =
    cmd.organizationId ?? this.tenant.requireOrganizationIdOrDefault();
  return this.prisma.activityLog.create({
    data: {
      organizationId,
      userId: cmd.userId,
      action: cmd.action,
      entity: cmd.entity,
      entityId: cmd.entityId,
      description: cmd.description,
      metadata: cmd.metadata,
      ipAddress: cmd.ipAddress,
      userAgent: cmd.userAgent,
    },
  });
}
```

- [ ] **Step 7.2: Update every ActivityLog caller**

For each call-site in grep 1.4:
- If it runs inside a request-scoped (authenticated) handler, no change needed — `requireOrganizationIdOrDefault()` handles it.
- If it runs inside an event subscriber or BullMQ job, pass `organizationId: event.organizationId` (or `job.data.organizationId`) explicitly.

- [ ] **Step 7.3: `generate-report/*.handler.ts`**

Inject tenant. `report.create({ data: { organizationId, ... } })`. `list-reports` auto-scoped. `get-report` Proxy-scoped.

- [ ] **Step 7.4: `health-check.handler.ts`**

If it runs raw SQL count probes (grep 1.2 result), confirm each includes `"organizationId" = $X` where the probe is meant to be org-scoped. System-level health probes (e.g. "is the DB reachable") can remain un-scoped — flag with an inline comment.

- [ ] **Step 7.5: Specs + run**

```bash
cd apps/backend && npx jest src/modules/ops --no-coverage
```

- [ ] **Step 7.6: Commit**

```bash
git add apps/backend/src/modules/ops apps/backend/src/modules 2>/dev/null
git commit -m "feat(saas-02g): scope ActivityLog writers + Report create/read + health-check raw probes"
```

---

## Task 8: Platform cluster — FeatureFlag + Integration + ProblemReport

**Files:**
- Modify: `src/modules/platform/feature-flags/*.handler.ts`
- Modify: `src/modules/platform/integrations/*.handler.ts`
- Modify: `src/modules/platform/problem-reports/*.handler.ts`

- [ ] **Step 8.1: FeatureFlag handlers**

- Create: inject tenant, add `organizationId` to `data`.
- Read: `findFirst({ where: { key } })` (composite unique — Proxy scopes). Never `findUnique({ key })`.
- Update / Delete: pre-fetch guard by id + mutation by id.

- [ ] **Step 8.2: Integration handlers**

- Create: inject tenant, add `organizationId`. `findFirst({ where: { provider } })` (composite unique).
- Note: `Integration.provider` represents a third-party integration slug (e.g. "moyasar"). The same provider can now be configured independently per org — this is correct multi-tenant behaviour.

- [ ] **Step 8.3: ProblemReport handlers**

- Create: inject tenant, add `organizationId`.
- List / get / update: Proxy auto-scopes.

- [ ] **Step 8.4: Specs + run**

```bash
cd apps/backend && npx jest src/modules/platform --no-coverage
```

- [ ] **Step 8.5: Commit**

```bash
git add apps/backend/src/modules/platform
git commit -m "feat(saas-02g): scope FeatureFlag + Integration + ProblemReport + composite unique swaps"
```

---

## Task 9: Content cluster — SiteSetting composite primary key

**Files:**
- Modify: `src/modules/content/site-settings/*.handler.ts`

- [ ] **Step 9.1: `upsert-site-setting.handler.ts`**

After the primary-key swap, upsert by composite key:

```ts
const organizationId = this.tenant.requireOrganizationIdOrDefault();
return this.prisma.siteSetting.upsert({
  where: { organizationId_key: { organizationId, key: cmd.key } },
  update: { valueText: cmd.valueText, valueAr: cmd.valueAr, valueEn: cmd.valueEn, valueJson: cmd.valueJson, valueMedia: cmd.valueMedia },
  create: { organizationId, key: cmd.key, valueText: cmd.valueText, valueAr: cmd.valueAr, valueEn: cmd.valueEn, valueJson: cmd.valueJson, valueMedia: cmd.valueMedia },
});
```

Inject `TenantContextService`. The Prisma-generated composite key name is `organizationId_key` (alphabetical concatenation); confirm via `npx prisma generate` output.

- [ ] **Step 9.2: `get-site-setting.handler.ts` + `list-site-settings.handler.ts`**

- Single get: `findFirst({ where: { key } })` (Proxy auto-scopes).
- List: `findMany` Proxy-scoped.
- Any existing `findUnique({ where: { key } })` is now broken — switch to `findFirst`.

- [ ] **Step 9.3: Website / public consumers of SiteSetting**

The public website reads SiteSetting to render Hero/Features/Stats content. If the reader is `apps/website` via the API (`GET /api/v1/public/site-settings`), the public controller must resolve the tenant from the host before invoking the handler — same pattern as ContactMessage in 02f.

Confirm the middleware binding on the public site-settings route:

```bash
grep -rn "site-setting\|siteSetting" apps/backend/src/api/public/ --include="*.ts"
```

- [ ] **Step 9.4: Specs + run**

```bash
cd apps/backend && npx jest src/modules/content --no-coverage
```

- [ ] **Step 9.5: Commit**

```bash
git add apps/backend/src/modules/content apps/backend/src/api/public/ 2>/dev/null
git commit -m "feat(saas-02g): scope SiteSetting composite primary key + public host resolution"
```

---

## Task 10: Isolation e2e tests

Use the `cls.run(async () => ctx.set({ organizationId }))` harness established in 02b–02f.

- [ ] **Step 10.1: `ai/knowledge-base-isolation.e2e-spec.ts`**

Tests:
1. Org A creates a KnowledgeDocument + chunks → Org B's list returns empty.
2. Org B cannot delete Org A's document by id.

- [ ] **Step 10.2: `ai/semantic-search-isolation.e2e-spec.ts` ⚠️ CRITICAL**

This is the single most important test in 02g — the $queryRaw path is outside Proxy coverage.

Tests:
1. Seed Org A with 5 chunks about "dental cleaning" + Org B with 5 chunks about "physiotherapy".
2. Populate embeddings for all chunks (use a deterministic stub vectorizer in the test helper).
3. Run semantic-search under Org A's CLS context with query "cleaning" — assert ALL returned rows have `organizationId = orgA`.
4. Run same search under Org B's CLS — returns only Org B chunks.
5. Adversarial check: run `$queryRaw` manually against the handler's SQL, with `organizationId = orgB` — confirm Org A's chunks never appear.
6. Run with `topK = 100` to force scan — isolation must still hold across the full chunk set.

- [ ] **Step 10.3: `media/file-isolation.e2e-spec.ts`**

1. Org A uploads a File → Org B list-files returns empty.
2. `get-file(id)` for Org A's file id from Org B context returns NotFound.
3. `delete-file(id)` for Org A's file id from Org B context returns NotFound and file remains.

- [ ] **Step 10.4: `ops/activity-log-isolation.e2e-spec.ts`**

1. Log an activity as Org A → Org B cannot see it.
2. Event-driven activity log (bookings event → ops log) carries correct organizationId.

- [ ] **Step 10.5: `ops/report-isolation.e2e-spec.ts`**

1. Org A requests a revenue report → Org B list returns empty.

- [ ] **Step 10.6: `platform/feature-flag-isolation.e2e-spec.ts`**

1. Same key, two orgs — both succeed (composite unique). Each org sees only its own.
2. Toggling Org A's flag does not affect Org B's.

- [ ] **Step 10.7: `platform/integration-isolation.e2e-spec.ts`**

1. Same provider (e.g. "moyasar"), two orgs — both succeed with different config blobs.
2. Reading provider=moyasar from each org returns that org's config.

- [ ] **Step 10.8: `platform/problem-report-isolation.e2e-spec.ts`**

1. Org A reports a problem → Org B list empty.

- [ ] **Step 10.9: `content/site-setting-isolation.e2e-spec.ts`**

1. Org A upserts `home.hero.title.ar = "A"`, Org B upserts `home.hero.title.ar = "B"`. Both coexist under composite PK.
2. Org A `get(home.hero.title.ar)` returns "A"; Org B returns "B".
3. Public host-based read for orgA.carekit.app returns A; orgB.carekit.app returns B.

- [ ] **Step 10.10: Run all new suites**

```bash
cd apps/backend && npm run test:e2e -- --testPathPattern="(ai|media|ops|platform|content)"
```

Expected: all 9 suites green. Then run the full regression:

```bash
cd apps/backend && npm run test:e2e
```

Expected: no regressions from prior clusters.

- [ ] **Step 10.11: Commit**

```bash
git add apps/backend/test/e2e/ai apps/backend/test/e2e/media apps/backend/test/e2e/ops apps/backend/test/e2e/platform apps/backend/test/e2e/content
git commit -m "test(saas-02g): infra clusters isolation e2e (9 suites) + semantic-search \$queryRaw adversarial"
```

---

## Task 11: Full regression + memory + index

- [ ] **Step 11.1: Typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: clean.

- [ ] **Step 11.2: Unit suite**

```bash
cd apps/backend && npm run test
```

Expected: all green. Record count.

- [ ] **Step 11.3: Full e2e suite**

```bash
cd apps/backend && npm run test:e2e
```

Expected: all green — prior clusters + 9 new 02g suites.

- [ ] **Step 11.4: Create memory file**

`/Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/saas02g_status.md`:

```markdown
---
name: SaaS-02g status
description: Plan 02g (ai + media + ops + platform + content tenant rollout) — 9 infra models scoped, semantic-search $queryRaw org-filtered, pgvector-safe migration
type: project
---
**Status:** PR #<N> <state> (feat/saas-02g-infra-clusters → main).

**Scope delivered:** 9 models tenant-scoped — KnowledgeDocument, DocumentChunk, File, ActivityLog, Report, FeatureFlag, Integration, ProblemReport, SiteSetting.

**Key patterns:**
- `$queryRaw` must be edited by hand to include `organizationId = $X` — extension does NOT scope raw SQL. Enforced in semantic-search.
- DocumentChunk denormalizes organizationId from KnowledgeDocument — required because pgvector similarity scan needs a plain WHERE clause.
- SiteSetting primary key swap: `@id key` → `@@id([organizationId, key])`. All readers use composite upsert.
- ActivityLog writers in event subscribers take `organizationId` explicitly on the command (not CLS-only).
- FeatureFlag.key + Integration.provider become composite-unique per org.
- pgvector-safe migration path: manual SQL + `prisma migrate deploy` (never `migrate dev`).

**Test evidence:** <fill in> unit, 9 new infra isolation e2e, semantic-search adversarial test passed.

**Next:** Plan 02h — flip `TENANT_ENFORCEMENT=strict` + adversarial cross-tenant penetration suite.
```

- [ ] **Step 11.5: Update MEMORY.md**

Append:

```
- [SaaS-02g status](saas02g_status.md) — Plan 02g delivered <date> PR #<N>; infra clusters (9 models) + semantic-search \$queryRaw org filter + SiteSetting composite PK + pgvector-safe migration
```

- [ ] **Step 11.6: Update transformation index**

- Progress: 8/18 (44%).
- Phase 02g ✅ DONE.
- Executor next: merge → plan 02h ready (strict mode + penetration tests).
- Append log entry.

- [ ] **Step 11.7: Final commit**

```bash
git add /Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/saas02g_status.md \
        /Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/MEMORY.md \
        docs/superpowers/plans/2026-04-21-saas-transformation-index.md
git commit -m "docs(saas): mark 02g done in index + memory (infra clusters)"
```

- [ ] **Step 11.8: Open PR**

```bash
git push -u origin feat/saas-02g-infra-clusters
gh pr create --title "feat(saas-02g): ai + media + ops + platform + content tenant rollout — 9 models + semantic-search scoped" \
  --body "Scopes KnowledgeDocument, DocumentChunk, File, ActivityLog, Report, FeatureFlag, Integration, ProblemReport, SiteSetting. semantic-search \$queryRaw now filters by organizationId. pgvector-safe manual migration."
```

---

## Amendments applied during execution

> _This section is empty until execution. If reality diverges from any step, stop, document here, and await confirmation before continuing._
