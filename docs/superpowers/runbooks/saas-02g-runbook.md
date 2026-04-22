# SaaS-02g — AI + Media + Ops + Platform Cluster Rollout — Runbook

**For:** tariq (manual executor)
**Prerequisite:** Plan 03 merged, dev DB clean, main at latest
**Target branch:** `feat/saas-02g-ai-media-ops-platform`
**Plan file:** `docs/superpowers/plans/2026-04-21-saas-02g-ai-media-ops-platform.md` (1027 lines)

---

## Scope

**Models to scope (8 new entries to `SCOPED_MODELS`):**
| Cluster | Models |
|---|---|
| AI | `KnowledgeDocument`, `DocumentChunk` ⚠️ pgvector |
| Media | `File` |
| Ops | `ActivityLog`, `Report` |
| Platform | `ProblemReport`, `Integration`, `FeatureFlag` |

**Singleton conversion (1 model):**
| Cluster | Model | Pattern |
|---|---|---|
| Content | `SiteSetting` | org-unique singleton (like BrandingConfig/OrganizationSettings/ZatcaConfig/ChatbotConfig) |

**Critical risk:** `DocumentChunk.embedding` is `Unsupported("vector(1536)")` (pgvector). Migration MUST use manual SQL + `migrate deploy` — never `migrate dev`. Same playbook as 02d/02e/02f/03.

**SCOPED_MODELS after 02g:** 38+ models (up from 30 after 02f).

---

## Preparation

```bash
cd /Users/tariq/code/carekit
git fetch origin main
git checkout -b feat/saas-02g-ai-media-ops-platform origin/main

# Reset dev DB to latest main state
cd apps/backend
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="[consent text]" \
  DATABASE_URL="postgresql://carekit:carekit_dev_password@localhost:5999/carekit_dev" \
  npx prisma migrate reset --force
DATABASE_URL="postgresql://carekit:carekit_dev_password@localhost:5999/carekit_dev" npm run seed
```

---

## Task 1 — Pre-flight callsite audit

Verify plan-assumed callsites match reality. Write output to `docs/superpowers/qa/saas-02g-callsite-audit-<date>.md`.

```bash
cd apps/backend

# 1.1 Every create/upsert for each model
grep -rn "knowledgeDocument\.\(create\|upsert\|createMany\)\|documentChunk\.create\|\.file\.\(create\|upsert\)\|activityLog\.create\|report\.create\|problemReport\.\(create\|upsert\)\|integration\.\(create\|upsert\)\|featureFlag\.\(create\|upsert\)\|siteSetting\.\(create\|upsert\)" src/ --include="*.ts" | grep -v ".spec.ts" > /tmp/02g-creates.txt

# 1.2 $queryRaw callsites — CRITICAL for pgvector semantic-search
grep -rn "queryRaw\|queryRawUnsafe" src/ --include="*.ts" | grep -v ".spec.ts" > /tmp/02g-rawqueries.txt

# 1.3 $transaction callback form
grep -rn "\$transaction(async" src/ --include="*.ts" | grep -v ".spec.ts" > /tmp/02g-tx.txt
```

**Expected from plan:**
- Embedding path: `embed-document.handler.ts` (creates KnowledgeDocument + many DocumentChunks inside $transaction callback)
- Semantic search: `semantic-search.handler.ts` — `$queryRawUnsafe` (must add `organizationId` predicate per Red-flag invariant #4 in transformation index)
- File upload: `upload-file.handler.ts` (creates File)
- Activity log: `log-activity.handler.ts` (creates ActivityLog on every authenticated mutation)
- Reports: `generate-report/*` (creates Report rows)
- Platform: 3 feature-flag handlers + 3 problem-report handlers + 2 integration handlers
- Site-settings: `bulk-upsert-site-settings.handler.ts` (singleton upsert-on-read)

If any divergence, STOP and amend the plan before committing.

**Commit:**
```bash
git add docs/superpowers/qa/saas-02g-callsite-audit-*.md
git commit -m "docs(saas-02g): pre-flight callsite audit"
```

---

## Task 2 — Schema changes

**Files:** `apps/backend/prisma/schema/{ai,media,ops,platform,content}.prisma`

### 2.1 AI cluster — ai.prisma

Add `organizationId` to `KnowledgeDocument` + `DocumentChunk`:

```prisma
model KnowledgeDocument {
  id             String         @id @default(uuid())
  organizationId String // SaaS-02g
  title          String
  // ... existing fields ...

  chunks DocumentChunk[]

  @@index([organizationId])
}

model DocumentChunk {
  id             String                       @id @default(uuid())
  organizationId String // SaaS-02g (denormalized from KnowledgeDocument)
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

### 2.2 Media cluster — media.prisma

```prisma
model File {
  id             String         @id @default(uuid())
  organizationId String // SaaS-02g
  bucket         String
  storageKey     String // uniqueness now composite-per-org
  // ... existing fields ...

  @@unique([organizationId, storageKey]) // was @unique on storageKey alone
  @@index([organizationId])
  @@index([ownerType, ownerId])
  @@index([uploadedBy])
}
```

### 2.3 Ops cluster — ops.prisma

```prisma
model ActivityLog {
  id             String         @id @default(uuid())
  organizationId String // SaaS-02g
  userId         String?
  // ... existing fields ...

  @@index([organizationId])
  @@index([occurredAt])
  @@index([entity, entityId])
  @@index([userId])
}

model Report {
  id             String       @id @default(uuid())
  organizationId String // SaaS-02g
  // ... existing fields ...

  @@index([organizationId])
}
```

### 2.4 Platform cluster — platform.prisma

Scope only `ProblemReport`, `Integration`, `FeatureFlag`. **Do NOT scope** `Organization`, `Membership`, `Vertical*` (these are platform-level by design).

```prisma
model ProblemReport {
  id             String              @id @default(uuid())
  organizationId String // SaaS-02g
  // ...
  @@index([organizationId])
}

model Integration {
  id             String   @id @default(uuid())
  organizationId String // SaaS-02g
  key            String // now composite unique per org
  // ...
  @@unique([organizationId, key]) // was @unique on key
  @@index([organizationId])
}

model FeatureFlag {
  id             String   @id @default(uuid())
  organizationId String // SaaS-02g
  key            String // now composite unique per org
  // ...
  @@unique([organizationId, key]) // was @unique on key
  @@index([organizationId])
}
```

### 2.5 Content cluster — content.prisma (SiteSetting singleton conversion)

Per 02c pattern (BrandingConfig precedent):

```prisma
model SiteSetting {
  id             String   @id @default(uuid())
  organizationId String   @unique // SaaS-02g — singleton per org
  // ... existing fields (heroTitle, aboutText, etc.) ...
}
```

### 2.6 Format + commit

```bash
cd apps/backend && npx prisma format
git add apps/backend/prisma/schema/
git commit -m "feat(saas-02g): add organizationId to 8 models + SiteSetting singleton + composite uniques on File/Integration/FeatureFlag"
```

---

## Task 3 — Migration (manual SQL, pgvector-safe)

```bash
cd apps/backend
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_saas_02g_ai_media_ops_platform_tenancy"
```

**File:** `prisma/migrations/<TS>_saas_02g_ai_media_ops_platform_tenancy/migration.sql`

```sql
-- SaaS-02g: AI + media + ops + platform cluster tenant rollout
-- pgvector-safe (manual SQL; migrate deploy path)

-- 1. KnowledgeDocument
ALTER TABLE "KnowledgeDocument" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "KnowledgeDocument" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "KnowledgeDocument_organizationId_idx" ON "KnowledgeDocument"("organizationId");

-- 2. DocumentChunk
ALTER TABLE "DocumentChunk" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "DocumentChunk" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "DocumentChunk_organizationId_idx" ON "DocumentChunk"("organizationId");

-- 3. File — add orgId, swap unique constraint (drop global storageKey unique, add composite)
ALTER TABLE "File" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "File" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "File" DROP CONSTRAINT "File_storageKey_key";
ALTER TABLE "File" ADD CONSTRAINT "File_organizationId_storageKey_key" UNIQUE ("organizationId", "storageKey");
CREATE INDEX "File_organizationId_idx" ON "File"("organizationId");

-- 4. ActivityLog
ALTER TABLE "ActivityLog" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "ActivityLog" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "ActivityLog_organizationId_idx" ON "ActivityLog"("organizationId");

-- 5. Report
ALTER TABLE "Report" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "Report" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "Report_organizationId_idx" ON "Report"("organizationId");

-- 6. ProblemReport
ALTER TABLE "ProblemReport" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "ProblemReport" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "ProblemReport_organizationId_idx" ON "ProblemReport"("organizationId");

-- 7. Integration — swap global key unique to composite
ALTER TABLE "Integration" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "Integration" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "Integration" DROP CONSTRAINT "Integration_key_key";
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_organizationId_key_key" UNIQUE ("organizationId", "key");
CREATE INDEX "Integration_organizationId_idx" ON "Integration"("organizationId");

-- 8. FeatureFlag — same swap
ALTER TABLE "FeatureFlag" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "FeatureFlag" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "FeatureFlag" DROP CONSTRAINT "FeatureFlag_key_key";
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_organizationId_key_key" UNIQUE ("organizationId", "key");
CREATE INDEX "FeatureFlag_organizationId_idx" ON "FeatureFlag"("organizationId");

-- 9. SiteSetting — singleton conversion (pattern: 02c BrandingConfig)
ALTER TABLE "SiteSetting" ADD COLUMN "organizationId" TEXT;
UPDATE "SiteSetting" SET "organizationId" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "SiteSetting" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SiteSetting" ADD CONSTRAINT "SiteSetting_organizationId_key" UNIQUE ("organizationId");
-- If the existing id was fixed string, swap the default:
ALTER TABLE "SiteSetting" ALTER COLUMN "id" DROP DEFAULT;

-- 10. RLS on all 8 + SiteSetting
ALTER TABLE "KnowledgeDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentChunk"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "File"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityLog"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Report"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProblemReport"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Integration"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeatureFlag"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteSetting"       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "KnowledgeDocument" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "DocumentChunk"     USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "File"              USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ActivityLog"       USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "Report"            USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ProblemReport"     USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "Integration"       USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "FeatureFlag"       USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "SiteSetting"       USING ("organizationId" = current_setting('app.current_organization_id', true));
```

### Apply migration

```bash
DATABASE_URL="postgresql://carekit:carekit_dev_password@localhost:5999/carekit_dev" \
  npx prisma migrate deploy

TEST_DATABASE_URL="postgresql://carekit:carekit_dev_password@localhost:5999/carekit_test" \
  DATABASE_URL="postgresql://carekit:carekit_dev_password@localhost:5999/carekit_test" \
  npx prisma migrate deploy

npx prisma generate
```

**Commit:**
```bash
git add prisma/migrations/
git commit -m "feat(saas-02g): migration — backfill organizationId on 8 models + SiteSetting singleton + pgvector-safe (migrate deploy)"
```

---

## Task 4 — Register in SCOPED_MODELS

**File:** `apps/backend/src/infrastructure/database/prisma.service.ts`

Append under a new `// 02g` section in the `SCOPED_MODELS` Set:
```ts
// 02g — AI + media + ops + platform
'KnowledgeDocument', 'DocumentChunk',
'File',
'ActivityLog', 'Report',
'ProblemReport', 'Integration', 'FeatureFlag',
'SiteSetting',
```

Run typecheck. Expect failures in every handler touching these models — those become the handler tasks below.

```bash
npm run typecheck 2>&1 | tee /tmp/02g-typecheck-after-scoped.log
```

**Commit:**
```bash
git add apps/backend/src/infrastructure/database/prisma.service.ts /tmp/02g-typecheck-after-scoped.log
# (copy the log into docs/superpowers/qa/ instead of /tmp if you want it archived)
git commit -m "feat(saas-02g): register 9 models in SCOPED_MODELS"
```

---

## Task 5 — AI handlers (embed + semantic search)

### 5.1 `embed-document.handler.ts`

Inject `TenantContextService`. Use explicit `organizationId` inside its `$transaction` callback (creates KnowledgeDocument + many DocumentChunks).

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly tenant: TenantContextService,
  // other existing deps
) {}

async execute(cmd: EmbedDocumentCommand) {
  const organizationId = this.tenant.requireOrganizationIdOrDefault();

  return this.prisma.$transaction(async (tx) => {
    const document = await tx.knowledgeDocument.create({
      data: {
        organizationId, // Lesson 8 — explicit
        title: cmd.title,
        // ...
      },
    });

    for (const chunk of chunks) {
      await tx.documentChunk.create({
        data: {
          organizationId, // Lesson 11 — explicit in tx
          documentId: document.id,
          content: chunk.content,
          chunkIndex: chunk.index,
          tokenCount: chunk.tokenCount,
        },
      });
      // Write embedding via raw SQL (Unsupported type):
      await tx.$executeRawUnsafe(
        `UPDATE "DocumentChunk" SET embedding = $1::vector WHERE id = $2`,
        `[${chunk.embedding.join(',')}]`,
        chunkId,
      );
    }

    return document;
  });
}
```

### 5.2 `semantic-search.handler.ts` — ⚠️ CRITICAL raw-query fix

Current file uses `$queryRawUnsafe` without an `organizationId` predicate. This violates Red-flag invariant #4.

**Change the raw SQL to include `organizationId`:**

```ts
async execute(cmd: { query: number[]; topK?: number }) {
  const organizationId = this.tenant.requireOrganizationIdOrDefault();
  const embedding = `[${cmd.query.join(',')}]`;
  const topK = cmd.topK ?? 5;

  // Safe parameterized raw query. Ordering by pgvector cosine distance.
  const rows = await this.prisma.$queryRaw<{ id: string; documentId: string; content: string; score: number }[]>`
    SELECT id, "documentId", content,
           1 - (embedding <=> ${embedding}::vector) AS score
    FROM "DocumentChunk"
    WHERE "organizationId" = ${organizationId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embedding}::vector
    LIMIT ${topK}
  `;
  return rows;
}
```

Inject `TenantContextService`. Update spec to assert `organizationId` appears in the query text.

### 5.3 `manage-knowledge-base.handler.ts`

Similar: inject tenant, add `organizationId` to `knowledgeDocument.create/update` data blocks.

### 5.4 Commit

```bash
git add apps/backend/src/modules/ai/
git commit -m "feat(saas-02g): scope AI handlers (embed-document tx + semantic-search raw query + manage-knowledge-base)"
```

---

## Task 6 — Media handlers

### 6.1 `upload-file.handler.ts`

```ts
const organizationId = this.tenant.requireOrganizationIdOrDefault();
const file = await this.prisma.file.create({
  data: {
    organizationId, // Lesson 8
    bucket,
    storageKey, // now unique per (organizationId, storageKey)
    // ...
  },
});
```

Note: `storageKey` generation should stay collision-free (it's UUID-based anyway). The composite unique just adds defense in depth.

### 6.2 `list-files.handler.ts` / `delete-file.handler.ts`

Proxy auto-scopes reads via `where`. Change any `findUnique({ storageKey })` → `findFirst({ storageKey })` — the composite unique change breaks the old signature.

### 6.3 Commit

```bash
git add apps/backend/src/modules/media/
git commit -m "feat(saas-02g): scope media File create/read paths"
```

---

## Task 7 — Ops handlers (ActivityLog + Report)

### 7.1 `log-activity.handler.ts`

This handler is called from MANY places (every authenticated mutation). Pattern:

```ts
const organizationId = this.tenant.requireOrganizationIdOrDefault();
await this.prisma.activityLog.create({
  data: {
    organizationId, // Lesson 8
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
```

### 7.2 `generate-report/*` handlers

Each report builder writes to `Report` table. Add `organizationId` to every `this.prisma.report.create` data.

Also: inside `activity-report.builder.ts` — it reads `ActivityLog` via `findMany` (Proxy auto-scopes). Verify no raw SQL needed.

### 7.3 Commit

```bash
git add apps/backend/src/modules/ops/
git commit -m "feat(saas-02g): scope ActivityLog + Report create paths"
```

---

## Task 8 — Platform handlers

### 8.1 Feature flags (3 handlers)

`list-feature-flags`, `get-feature-flag-map`, `update-feature-flag`:
- Reads: Proxy auto-scopes.
- Writes: add `organizationId` to every create/upsert.
- `update-feature-flag` — keys are now composite. Change `update({ where: { key } })` → `update({ where: { organizationId_key: { organizationId, key } } })` (new composite unique name).

### 8.2 Integrations (2 handlers)

Same pattern. Integration.key is now composite.

### 8.3 Problem reports (3 handlers)

Create-problem-report inject tenant; list + update use Proxy auto-scope.

### 8.4 Commit

```bash
git add apps/backend/src/modules/platform/
git commit -m "feat(saas-02g): scope feature-flag + integration + problem-report handlers"
```

---

## Task 9 — SiteSetting singleton (content cluster)

### 9.1 `list-site-settings.handler.ts`

Before 02g this likely reads by `id: 'default'`. After: upsert-on-read with `organizationId`.

```ts
async execute() {
  const organizationId = this.tenant.requireOrganizationIdOrDefault();
  return this.prisma.siteSetting.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId /* + defaults */ },
  });
}
```

### 9.2 `bulk-upsert-site-settings.handler.ts`

```ts
async execute(cmd: BulkUpsertSiteSettingsCommand) {
  const organizationId = this.tenant.requireOrganizationIdOrDefault();
  return this.prisma.siteSetting.update({
    where: { organizationId },
    data: cmd.settings,
  });
}
```

### 9.3 Commit

```bash
git add apps/backend/src/modules/content/site-settings/
git commit -m "feat(saas-02g): SiteSetting singleton via organizationId upsert-on-read"
```

---

## Task 10 — Spec updates

Every handler spec that touched an existing handler in Tasks 5–9 needs:
- `buildTenant() as never` at the right constructor position
- Fixtures updated to include `organizationId: DEFAULT_ORG_ID` on create-path inputs

Run in batches:
```bash
npx jest src/modules/ai/
npx jest src/modules/media/
npx jest src/modules/ops/
npx jest src/modules/platform/
npx jest src/modules/content/
```

Fix failures (almost certainly Lesson 8 / 11 violations you missed or fixture drift).

**Commit:**
```bash
git add apps/backend/src
git commit -m "test(saas-02g): update handler specs with tenant mock + fixture orgId"
```

---

## Task 11 — Isolation e2e suites

**Files under `apps/backend/test/e2e/`:**

### 11.1 `ai/semantic-search-isolation.e2e-spec.ts`
Seed 2 KnowledgeDocuments + embeddings per org → assert Org A search never returns Org B chunks. **Critical test** — exercises the raw-query org predicate fix.

### 11.2 `media/file-isolation.e2e-spec.ts`
Upload same-storageKey in two orgs (should succeed per composite unique); Org A cannot list Org B's files.

### 11.3 `ops/activity-log-isolation.e2e-spec.ts`
Two orgs log activity independently; list-activity only returns own org.

### 11.4 `platform/feature-flag-isolation.e2e-spec.ts`
Same-key flag in two orgs with different values; each org reads its own value.

### 11.5 `platform/problem-report-isolation.e2e-spec.ts`

### 11.6 `content/site-setting-isolation.e2e-spec.ts`
Singleton per org; update in Org A does not affect Org B.

Use `isolation-harness.ts` pattern from 02b.

**Run:**
```bash
npm run test:e2e -- --testPathPattern="(ai|media|ops|platform|content)"
```

**Commit:**
```bash
git add apps/backend/test/e2e/
git commit -m "test(saas-02g): isolation e2e — 6 suites (semantic-search + media + ops + platform + content)"
```

---

## Task 12 — Full regression

```bash
cd apps/backend
npm run typecheck   # clean
npm run test        # all unit pass
npm run test:e2e    # all e2e pass (incl. prior clusters — regression check)
```

Record counts for memory file.

---

## Task 13 — Memory + index update

**Create** `/Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/saas02g_status.md`:

```markdown
---
name: SaaS-02g status
description: Plan 02g (AI + media + ops + platform cluster rollout) delivered YYYY-MM-DD — 8 models scoped + SiteSetting singleton + pgvector-safe semantic search
type: project
---
**Status:** PR merged.

**Scope delivered:** 8 models tenant-scoped (KnowledgeDocument, DocumentChunk, File, ActivityLog, Report, ProblemReport, Integration, FeatureFlag) + SiteSetting singleton conversion (per 02c pattern). File.storageKey, Integration.key, FeatureFlag.key converted from global to composite unique per (organizationId, key).

**Key amendments vs. plan (pre-flight found):** fill in during execution.

**How to apply:**
- Semantic search raw query now always includes `"organizationId" = $organizationId` predicate. Any future handler using `$queryRaw`/`$queryRawUnsafe` on scoped tables MUST include the org predicate (Red-flag invariant #4, enforced by code review + RLS backstop).
- File.storageKey is composite-unique per (orgId, storageKey) — same storageKey string CAN exist across orgs.
- Integration + FeatureFlag keys also composite — `findUnique` → `findFirst` or composite-key syntax.
- SiteSetting upsert-on-read same pattern as BrandingConfig/ChatbotConfig.
- embed-document tx callback sets `organizationId` on every DocumentChunk (Lesson 11).

**Test evidence:** N unit + 6 isolation e2e suites. Typecheck clean.

**Next:** Plan 02g-sms (per-tenant SMS provider refactor — unblocks Plan 04 billing).
```

**Append to `MEMORY.md`** + update `transformation-index.md` (Phase 02g → ✅ MERGED, progress log, clear risks).

**Final commits:**
```bash
git add /Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/saas02g_status.md \
        /Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/MEMORY.md \
        docs/superpowers/plans/2026-04-21-saas-transformation-index.md
git commit -m "docs(saas-02g): memory + index — AI/media/ops/platform cluster delivered"
```

---

## Task 14 — PR + merge

```bash
git push -u origin feat/saas-02g-ai-media-ops-platform

gh pr create --title "feat(saas-02g): AI + media + ops + platform cluster tenant rollout" --body "$(cat <<'EOF'
## Summary
- 8 models scoped (KnowledgeDocument, DocumentChunk, File, ActivityLog, Report, ProblemReport, Integration, FeatureFlag)
- SiteSetting converted to org-unique singleton
- File.storageKey + Integration.key + FeatureFlag.key → composite unique per (orgId, key)
- semantic-search raw query now includes organizationId predicate
- embed-document \$transaction callback sets organizationId on every chunk create
- 6 isolation e2e suites added
- pgvector-safe migration (manual SQL + migrate deploy)

## Test plan
- [ ] Typecheck clean
- [ ] Unit + e2e green
- [ ] Manual check: embed a KB doc in org A, semantic-search from org B → 0 results
EOF
)"

gh pr merge <N> --squash --delete-branch --admin
```

---

## Snags to watch

- **Prisma client not regenerated** after schema change → `findUnique({ key })` suddenly isn't valid. Run `npx prisma generate`.
- **pgvector migration fails** with `extension "vector" not available` on CI — pre-existing CI infra issue unrelated to 02g; merge with admin override.
- **Raw query SQL injection** — the semantic-search uses `$queryRaw` (tagged template) NOT `$queryRawUnsafe` with string concat. Verify the fix keeps parameterization intact.
- **Activity log on unauthenticated path** — any handler that fires `log-activity` from a non-CLS context (e.g. cron bootstrap, webhook before tenant resolution) needs to pass `organizationId` explicitly OR use `requireOrganizationIdOrDefault()` fallback — never `requireOrganizationId()`.

---

## Rollback

Forward-only migration; `organizationId` NOT NULL with backfill. To abort: revert the handler commits first, then the migration folder (Prisma won't auto-rollback but the column stays nullable-at-runtime since all handlers would be reverted).

---

## When done, tell me "02g done" and I'll:
- Confirm memory/index consistency
- Launch 02g-sms runbook (next in sequence — same shape, smaller scope: 2 new tables + adapters)
- Track the remaining chain (02h → 04 → 05b → 06 → 07 → 08 → 09 → 10)
