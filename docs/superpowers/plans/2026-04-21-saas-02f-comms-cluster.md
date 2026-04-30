# Comms Cluster Tenant Rollout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `organizationId` to all comms-cluster models (EmailTemplate, Notification, ChatConversation, CommsChatMessage, ContactMessage), scope the AI-cluster conversational models that belong to comms flows (ChatSession, ChatMessage), convert `ChatbotConfig` to the org-unique singleton pattern established in 02c, update every comms + notification callsite to scope creates and reads, and add isolation e2e tests proving cross-org invisibility for notifications, email-templates, chat threads and contact messages.

**Architecture:** Same strangler/cluster pattern as 02a–02e. The Prisma Proxy extension auto-injects `organizationId` into `where` clauses for scoped models; handlers explicitly set `organizationId` in `data` objects. Two specific wrinkles for comms:

1. **EmailTemplate.slug becomes composite-unique** (`@@unique([organizationId, slug])`) — the global slug namespace becomes per-org so each tenant can override a default template without colliding. Seed data keeps its slugs per-org.
2. **ChatbotConfig converts from key-based upsert to org-unique singleton** (`organizationId @unique`, same pattern as BrandingConfig/OrganizationSettings from 02c and ZatcaConfig from 02e). The current `key` field is dropped in favour of a structured row per org.
3. **ContactMessage is the public "contact us" form** — requests come through `api/public` without an authenticated user. The public controller must resolve the tenant from the host/domain before invoking the handler; the handler itself uses `TenantContextService.requireOrganizationIdOrDefault()`.

**Tech Stack:** NestJS 11, Prisma 7 (`$extends` Proxy), nestjs-cls (`TenantContextService`), PostgreSQL RLS, Jest + Supertest (isolation e2e)

---

## Critical lessons from prior plans — READ BEFORE STARTING

1. **Grep ALL callsites first** (Task 1) — plans miss callsites. Commit nothing until the grep audit is complete. 02a, 02d, 02e all surfaced "missed" callers.
2. **`$transaction` callback form bypasses the Proxy.** `tx` inside `async (tx) => {}` is a raw client — explicit `organizationId` required in ALL `tx.*.create()`, `tx.*.findFirst()`, `tx.*.findUnique()` calls. Array-form `this.prisma.$transaction([op1, op2])` is safe because operations are pre-built through the Proxy.
3. **Extension covers `where` not `data`.** Every `prisma.*.create({ data: {} })` needs explicit `organizationId`.
4. **Singleton conversion pattern (02c + 02e).** Upsert-on-read: `prisma.model.upsert({ where: { organizationId }, update: {}, create: { organizationId, ...defaults } })`. Used for BrandingConfig, OrganizationSettings, ZatcaConfig — applies verbatim to ChatbotConfig here.
5. **Composite unique swap breaks `findUnique` callsites** (02b lesson 7). When `slug @unique` becomes `@@unique([organizationId, slug])`, every `findUnique({ where: { slug } })` must switch to `findFirst({ where: { slug } })` (Proxy auto-scopes).
6. **Unauthenticated entries must resolve tenant before calling handlers** (02e Moyasar lesson). ContactMessage public endpoint resolves tenant from `Host` header / custom-domain lookup before invoking the handler.
7. **Async CLS callbacks** (02b lesson 9). Any `cls.run(() => ...)` wrapper must use `async () => {}` — sync callbacks returning a Promise lose the AsyncLocalStorage context before Prisma fires.
8. **Divergence-before-commit.** If reality disagrees with any step, STOP, document, propose amendment, execute only after confirmation.
9. **`npx prisma migrate dev` may conflict with pgvector.** Write migration SQL manually — `migrate deploy` is safe.

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
]);
```

---

## File Structure

**Schema (modify):**
- `apps/backend/prisma/schema/comms.prisma` — add `organizationId` to 5 comms models; change `EmailTemplate.slug @unique` → `@@unique([organizationId, slug])`; add `@@index([organizationId])` on each.
- `apps/backend/prisma/schema/ai.prisma` — add `organizationId` to ChatSession, ChatMessage (denormalized); convert ChatbotConfig from `key @unique` key-value model to org-unique singleton (same shape as BrandingConfig).

**Migration (create):**
- `apps/backend/prisma/migrations/<timestamp>_saas_02f_comms_tenancy/migration.sql` — manual SQL (pgvector-safe path; ai.prisma borders DocumentChunk).

**SCOPED_MODELS (modify):**
- `apps/backend/src/infrastructure/database/prisma.service.ts`

**Handlers to modify (create-path — need TenantContextService injection):**
- `src/modules/comms/notifications/create-notification/create-notification.handler.ts` (grep to confirm exact filename)
- `src/modules/comms/send-notification/send-notification.handler.ts`
- `src/modules/comms/email-templates/create-email-template.handler.ts`
- `src/modules/comms/email-templates/update-email-template.handler.ts`
- `src/modules/comms/email-templates/delete-email-template.handler.ts`
- `src/modules/comms/email-templates/get-email-template.handler.ts`
- `src/modules/comms/email-templates/list-email-templates.handler.ts`
- `src/modules/comms/chat/create-conversation.handler.ts`
- `src/modules/comms/chat/send-message.handler.ts`
- `src/modules/comms/chat/list-conversations.handler.ts`
- `src/modules/comms/chat/get-conversation.handler.ts`
- `src/modules/comms/contact-messages/create-contact-message.handler.ts`
- `src/modules/comms/contact-messages/list-contact-messages.handler.ts`
- `src/modules/comms/contact-messages/update-contact-message-status.handler.ts`
- `src/modules/ai/chat-completion/chat-completion.handler.ts` (creates ChatSession + ChatMessage)
- `src/modules/ai/chatbot-config/get-chatbot-config.handler.ts`
- `src/modules/ai/chatbot-config/update-chatbot-config.handler.ts`

**Handlers to modify (lifecycle — derive organizationId from anchor):**
- `src/modules/comms/chat/close-conversation.handler.ts` — derives org from conversation.
- `src/modules/comms/notifications/mark-read.handler.ts` — derives org from notification (Proxy auto-scopes the where).
- Any event consumer that creates a Notification (grep in Task 1).

**Cross-cluster event producers (modify — must include organizationId in the Notification data):**
- `src/modules/bookings/events/*.ts` producers that trigger notifications (grep Task 1).
- `src/modules/finance/events/*.ts` producers that trigger notifications.

**Public controller (modify — resolve tenant from host):**
- `src/api/public/contact.controller.ts` — before invoking `CreateContactMessageHandler`, resolve the org from `Host` header via the `TenantResolverService` established in SaaS-01.

**Tests (create):**
- `test/e2e/comms/notification-isolation.e2e-spec.ts`
- `test/e2e/comms/email-template-isolation.e2e-spec.ts`
- `test/e2e/comms/chat-isolation.e2e-spec.ts`
- `test/e2e/comms/contact-message-isolation.e2e-spec.ts`
- `test/e2e/comms/chatbot-config-isolation.e2e-spec.ts`

**Memory (create):**
- `/Users/tariq/.claude/projects/-Users-tariq-code-deqah/memory/saas02f_status.md`

**Transformation index (modify):**
- `docs/superpowers/plans/2026-04-21-saas-transformation-index.md` — mark 02f done, append progress log entry.

---

## Task 1: Pre-flight — grep all callsites

- [ ] **Step 1.1: Confirm exact comms handler filenames**

```bash
cd apps/backend
ls src/modules/comms/notifications/ src/modules/comms/send-notification/ \
   src/modules/comms/email-templates/ src/modules/comms/chat/ \
   src/modules/comms/contact-messages/
```

Record the exact filenames. Update this plan's handler list if names differ from the guesses above.

- [ ] **Step 1.2: Identify all Notification create callsites**

```bash
grep -rn "notification\.create\|notification\.createMany\|tx\.notification\." src/ --include="*.ts" | grep -v ".spec.ts" | grep -v ".dto.ts"
```

Expected: `send-notification.handler.ts` plus any booking/finance event handler that directly inserts a Notification row. If any cross-cluster producer writes Notification directly, add it to the handler list.

- [ ] **Step 1.3: Identify all EmailTemplate read/write callsites**

```bash
grep -rn "emailTemplate\.\|prisma.emailTemplate\|tx\.emailTemplate\." src/ --include="*.ts" | grep -v ".spec.ts"
```

Expected: all CRUD handlers under `comms/email-templates/`. Any `findUnique({ slug })` is a breaking callsite after Task 2 — document them.

- [ ] **Step 1.4: Identify all Chat* callsites (ChatConversation, CommsChatMessage, ChatSession, ChatMessage)**

```bash
grep -rn "chatConversation\.\|commsChatMessage\.\|chatSession\.\|chatMessage\." src/ --include="*.ts" | grep -v ".spec.ts"
```

Expected: `comms/chat/*`, `ai/chat-completion/*`. Any semantic-search read paths referencing chat tables.

- [ ] **Step 1.5: Identify all ContactMessage callsites**

```bash
grep -rn "contactMessage\.\|prisma.contactMessage" src/ --include="*.ts" | grep -v ".spec.ts"
```

Expected: `comms/contact-messages/*` and a public controller under `src/api/public/`.

- [ ] **Step 1.6: Identify all ChatbotConfig callsites**

```bash
grep -rn "chatbotConfig\." src/ --include="*.ts" | grep -v ".spec.ts"
```

Expected: `ai/chatbot-config/*`, potentially read from `ai/chat-completion/chat-completion.handler.ts` for system-prompt injection.

- [ ] **Step 1.7: Identify all `$transaction(async` callback-form uses in comms + ai**

```bash
grep -rn "\$transaction(async" src/modules/comms/ src/modules/ai/ --include="*.ts" | grep -v ".spec.ts"
```

Any callback-form `tx` block needs explicit `organizationId` in every `tx.*` call inside it.

- [ ] **Step 1.8: Write the grep-audit summary**

Create `docs/superpowers/qa/saas-02f-callsite-audit-2026-04-21.md` with the raw grep output plus any divergences from the expected lists above. Flag any callsite not already listed in this plan.

- [ ] **Step 1.9: Commit the audit note**

```bash
git add docs/superpowers/qa/saas-02f-callsite-audit-2026-04-21.md
git commit -m "docs(saas-02f): pre-flight callsite audit for comms cluster"
```

---

## Task 2: Schema changes

**Files:**
- Modify: `apps/backend/prisma/schema/comms.prisma`
- Modify: `apps/backend/prisma/schema/ai.prisma`

- [ ] **Step 2.1: Read the current comms.prisma**

```bash
sed -n '1,120p' apps/backend/prisma/schema/comms.prisma
```

Confirm the current model field order before editing.

- [ ] **Step 2.2: Add `organizationId` to Notification**

Edit `apps/backend/prisma/schema/comms.prisma`. After `id String @id @default(uuid())`:

```prisma
model Notification {
  id             String           @id @default(uuid())
  organizationId String // SaaS-02f
  recipientId    String
  recipientType  RecipientType
  type           NotificationType
  title          String
  body           String
  metadata       Json?
  isRead         Boolean          @default(false)
  readAt         DateTime?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  @@index([recipientId])
  @@index([recipientId, createdAt])
  @@index([organizationId])
}
```

- [ ] **Step 2.3: Add `organizationId` to ChatConversation**

```prisma
model ChatConversation {
  id             String             @id @default(uuid())
  organizationId String // SaaS-02f
  clientId       String
  employeeId     String?
  isAiChat       Boolean            @default(false)
  status         ConversationStatus @default(OPEN)
  lastMessageAt  DateTime?
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  messages CommsChatMessage[]

  @@index([clientId])
  @@index([employeeId])
  @@index([status, lastMessageAt])
  @@index([organizationId])
}
```

- [ ] **Step 2.4: Add `organizationId` to CommsChatMessage (denormalized from conversation)**

```prisma
model CommsChatMessage {
  id             String            @id @default(uuid())
  organizationId String // SaaS-02f (denormalized from ChatConversation)
  conversationId String
  conversation   ChatConversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderType     MessageSenderType
  senderId       String?
  body           String
  isRead         Boolean           @default(false)
  createdAt      DateTime          @default(now())

  @@index([conversationId, createdAt])
  @@index([organizationId])
}
```

- [ ] **Step 2.5: Add `organizationId` to ContactMessage**

```prisma
model ContactMessage {
  id             String               @id @default(uuid())
  organizationId String // SaaS-02f
  name           String
  phone          String?
  email          String?
  subject        String?
  body           String
  status         ContactMessageStatus @default(NEW)
  createdAt      DateTime             @default(now())
  readAt         DateTime?
  archivedAt     DateTime?

  @@index([status, createdAt])
  @@index([organizationId])
}
```

- [ ] **Step 2.6: Change EmailTemplate.slug unique → composite + add organizationId**

```prisma
model EmailTemplate {
  id             String   @id @default(uuid())
  organizationId String // SaaS-02f — slug namespace becomes per-org
  slug           String // uniqueness now composite-per-org
  nameAr         String
  nameEn         String?
  subjectAr      String
  subjectEn      String?
  htmlBody       String
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([organizationId, slug])
  @@index([organizationId])
}
```

(Drop the old `slug String @unique` — the plain unique would still reserve slugs globally.)

- [ ] **Step 2.7: Edit ai.prisma — add organizationId to ChatSession + ChatMessage**

```prisma
model ChatSession {
  id             String   @id @default(uuid())
  organizationId String // SaaS-02f
  clientId       String?
  userId         String?
  title          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  messages ChatMessage[]

  @@index([createdAt])
  @@index([clientId])
  @@index([organizationId])
}

model ChatMessage {
  id             String   @id @default(uuid())
  organizationId String // SaaS-02f (denormalized from ChatSession)
  sessionId      String
  role           String
  content        String
  tokensUsed     Int      @default(0)
  model          String?
  createdAt      DateTime @default(now())

  session ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
  @@index([organizationId])
}
```

- [ ] **Step 2.8: Convert ChatbotConfig to org-unique singleton**

Current (key-value):
```prisma
model ChatbotConfig {
  id        String   @id @default(uuid())
  key       String   @unique
  value     Json
  category  String   @default("general")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([category])
}
```

Replace with (org-unique singleton, mirrors BrandingConfig/ZatcaConfig):
```prisma
model ChatbotConfig {
  id                String   @id @default(uuid())
  organizationId    String   @unique // SaaS-02f — one config row per org
  systemPromptAr    String?
  systemPromptEn    String?
  greetingAr        String?
  greetingEn        String?
  escalateToHumanAt Int?     // message count threshold; null = never auto-escalate
  settings          Json? // catchall for future keyed settings
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

If current callers rely on the key-value shape, Task 7 migrates them to the new typed fields + `settings` JSON blob. Document the mapping (e.g. `key="system_prompt_ar"` → `systemPromptAr`) in Task 7 before editing handlers.

- [ ] **Step 2.9: Run `npx prisma format` and `npx prisma validate`**

```bash
cd apps/backend && npx prisma format && npx prisma validate
```

Expected: re-indents cleanly and validates. If pgvector causes validation issues, the migration will be manual — that's expected.

- [ ] **Step 2.10: Commit schema**

```bash
git add apps/backend/prisma/schema/comms.prisma apps/backend/prisma/schema/ai.prisma
git commit -m "feat(saas-02f): add organizationId to comms models + ChatbotConfig singleton + EmailTemplate composite slug unique"
```

---

## Task 3: Migration — manual SQL

**Files:**
- Create: `apps/backend/prisma/migrations/<timestamp>_saas_02f_comms_tenancy/migration.sql`

Why manual SQL: `npx prisma migrate dev` may conflict with pgvector (02d/02e precedent). `migrate deploy` with manual SQL avoids the generator re-running against the `DocumentChunk.embedding Unsupported("vector(1536)")` column.

- [ ] **Step 3.1: Generate the timestamped migration directory**

```bash
cd apps/backend
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_saas_02f_comms_tenancy"
echo "TS=$TS"
```

- [ ] **Step 3.2: Write migration.sql**

Create `prisma/migrations/<TS>_saas_02f_comms_tenancy/migration.sql`:

```sql
-- SaaS-02f: Comms cluster tenant rollout
-- 1. Notification
ALTER TABLE "Notification" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "Notification" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "Notification_organizationId_idx" ON "Notification"("organizationId");

-- 2. ChatConversation
ALTER TABLE "ChatConversation" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "ChatConversation" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "ChatConversation_organizationId_idx" ON "ChatConversation"("organizationId");

-- 3. CommsChatMessage
ALTER TABLE "CommsChatMessage" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "CommsChatMessage" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "CommsChatMessage_organizationId_idx" ON "CommsChatMessage"("organizationId");

-- 4. ContactMessage
ALTER TABLE "ContactMessage" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "ContactMessage" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "ContactMessage_organizationId_idx" ON "ContactMessage"("organizationId");

-- 5. EmailTemplate — drop global slug unique, add composite, add index
ALTER TABLE "EmailTemplate" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "EmailTemplate" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "EmailTemplate" DROP CONSTRAINT "EmailTemplate_slug_key";
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_organizationId_slug_key" UNIQUE ("organizationId", "slug");
CREATE INDEX "EmailTemplate_organizationId_idx" ON "EmailTemplate"("organizationId");

-- 6. ChatSession
ALTER TABLE "ChatSession" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "ChatSession" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "ChatSession_organizationId_idx" ON "ChatSession"("organizationId");

-- 7. ChatMessage
ALTER TABLE "ChatMessage" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "ChatMessage" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX "ChatMessage_organizationId_idx" ON "ChatMessage"("organizationId");

-- 8. ChatbotConfig — singleton conversion.
-- Strategy: preserve existing key/value rows by collapsing them into a single
-- per-org row. All existing rows belong to DEFAULT_ORG.
-- 8a. Add new typed columns + organizationId
ALTER TABLE "ChatbotConfig" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "ChatbotConfig" ADD COLUMN "systemPromptAr" TEXT;
ALTER TABLE "ChatbotConfig" ADD COLUMN "systemPromptEn" TEXT;
ALTER TABLE "ChatbotConfig" ADD COLUMN "greetingAr" TEXT;
ALTER TABLE "ChatbotConfig" ADD COLUMN "greetingEn" TEXT;
ALTER TABLE "ChatbotConfig" ADD COLUMN "escalateToHumanAt" INTEGER;
ALTER TABLE "ChatbotConfig" ADD COLUMN "settings" JSONB;

-- 8b. Collapse any existing key-value rows into one DEFAULT_ORG singleton row.
-- Keep it simple: if rows exist, drop them and insert a fresh singleton.
-- (Admins can re-enter values through the dashboard; same migration pattern used
-- for BrandingConfig in 02c when fields were restructured.)
DELETE FROM "ChatbotConfig";
INSERT INTO "ChatbotConfig" ("id", "organizationId", "createdAt", "updatedAt")
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', NOW(), NOW());

-- 8c. Drop the old key unique + category index, drop legacy columns
ALTER TABLE "ChatbotConfig" DROP CONSTRAINT "ChatbotConfig_key_key";
DROP INDEX IF EXISTS "ChatbotConfig_category_idx";
ALTER TABLE "ChatbotConfig" DROP COLUMN "key";
ALTER TABLE "ChatbotConfig" DROP COLUMN "value";
ALTER TABLE "ChatbotConfig" DROP COLUMN "category";

-- 8d. Lock organizationId NOT NULL + unique
ALTER TABLE "ChatbotConfig" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ChatbotConfig" ADD CONSTRAINT "ChatbotConfig_organizationId_key" UNIQUE ("organizationId");

-- 9. Row Level Security on all 8 tables
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommsChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContactMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatbotConfig" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "Notification" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ChatConversation" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "CommsChatMessage" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ContactMessage" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "EmailTemplate" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ChatSession" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ChatMessage" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ChatbotConfig" USING ("organizationId" = current_setting('app.current_organization_id', true));
```

- [ ] **Step 3.3: Apply migration (dev + test)**

```bash
cd apps/backend && npx prisma migrate deploy
TEST_DATABASE_URL="postgresql://deqah:deqah@localhost:5999/deqah_test" \
  DATABASE_URL="postgresql://deqah:deqah@localhost:5999/deqah_test" \
  npx prisma migrate deploy
```

Expected: both DBs report migration applied. If pgvector errors out, confirm `migrate deploy` (not `migrate dev`) and inspect the error — manual SQL avoids pgvector-level generation.

- [ ] **Step 3.4: Regenerate Prisma client**

```bash
cd apps/backend && npx prisma generate
```

Expected: new types for ChatbotConfig reflect the singleton shape. TS will show errors in every handler that references the old `key`/`value`/`category` fields — that's exactly what Task 7 fixes.

- [ ] **Step 3.5: Commit migration**

```bash
git add apps/backend/prisma/migrations/*saas_02f_comms_tenancy
git commit -m "feat(saas-02f): migration — add organizationId to 7 comms/ai tables + convert ChatbotConfig to singleton"
```

---

## Task 4: Register comms models in SCOPED_MODELS

**Files:**
- Modify: `apps/backend/src/infrastructure/database/prisma.service.ts`

- [ ] **Step 4.1: Locate the SCOPED_MODELS Set**

```bash
grep -n "SCOPED_MODELS" apps/backend/src/infrastructure/database/prisma.service.ts
```

- [ ] **Step 4.2: Append the 8 comms/ai model names**

Add to the Set, after the `// 02e — finance` block:

```ts
// 02f — comms
'EmailTemplate', 'Notification',
'ChatConversation', 'CommsChatMessage',
'ChatSession', 'ChatMessage',
'ContactMessage', 'ChatbotConfig',
```

- [ ] **Step 4.3: Run typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: fails on every chatbot-config handler (old fields removed) + every ContactMessage / Notification / ChatConversation create call (now needs explicit organizationId). Capture the list:

```bash
cd apps/backend && npm run typecheck 2> docs/superpowers/qa/saas-02f-typecheck-after-scoped-2026-04-21.log || true
```

- [ ] **Step 4.4: Commit**

```bash
git add apps/backend/src/infrastructure/database/prisma.service.ts docs/superpowers/qa/saas-02f-typecheck-after-scoped-2026-04-21.log
git commit -m "feat(saas-02f): register 8 comms/ai models in SCOPED_MODELS"
```

---

## Task 5: Scope Notification + send-notification handlers

**Files:**
- Modify: `src/modules/comms/send-notification/send-notification.handler.ts`
- Modify: any handler discovered in Task 1.2 that writes Notification directly
- Update: `src/modules/comms/send-notification/send-notification.handler.spec.ts`

- [ ] **Step 5.1: Read the handler**

```bash
cat apps/backend/src/modules/comms/send-notification/send-notification.handler.ts
```

- [ ] **Step 5.2: Inject TenantContextService + add organizationId to data**

```ts
import { TenantContextService } from '../../../common/tenant';

@Injectable()
export class SendNotificationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    // ...
  ) {}

  async execute(cmd: SendNotificationCommand): Promise<Notification> {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    return this.prisma.notification.create({
      data: {
        organizationId,         // SaaS-02f
        recipientId: cmd.recipientId,
        recipientType: cmd.recipientType,
        type: cmd.type,
        title: cmd.title,
        body: cmd.body,
        metadata: cmd.metadata,
      },
    });
  }
}
```

- [ ] **Step 5.3: For any cross-cluster event consumer that creates a Notification**

If Task 1.2 surfaced a booking/finance event handler that writes a Notification directly (not via `SendNotificationHandler`), it runs in an event-subscriber context where CLS may not be set. Two options:

**Option A (preferred):** route through `SendNotificationHandler` so tenant resolution is centralized.

**Option B (if direct write is required):** derive `organizationId` from the event envelope (`BaseEvent` carries `organizationId` per root invariant #3). Add it to the Notification data block:
```ts
const organizationId = event.organizationId;
await this.prisma.notification.create({ data: { organizationId, ... } });
```

- [ ] **Step 5.4: Update spec with buildTenant()**

Ensure `test/helpers/tenant.mock.ts#buildTenant()` is used as the constructor injection. Pattern (from 02b):

```ts
handler = new SendNotificationHandler(prisma as never, buildTenant() as never);
```

- [ ] **Step 5.5: Run unit tests**

```bash
cd apps/backend && npx jest src/modules/comms/send-notification --no-coverage
```

Expected: green.

- [ ] **Step 5.6: Commit**

```bash
git add apps/backend/src/modules/comms/send-notification/ \
        apps/backend/src/modules/comms/notifications/ \
        apps/backend/src/modules/bookings/payment-completed-handler/ 2>/dev/null || true
git commit -m "feat(saas-02f): scope Notification create-path + event-driven notification producers"
```

---

## Task 6: Scope EmailTemplate handlers + chat (ChatConversation/CommsChatMessage)

**Files:**
- Modify: all `src/modules/comms/email-templates/*.handler.ts`
- Modify: all `src/modules/comms/chat/*.handler.ts`

- [ ] **Step 6.1: `create-email-template.handler.ts`**

Inject `TenantContextService`. Change any `findUnique({ where: { slug } })` (uniqueness check) → `findFirst({ where: { slug } })` (Proxy auto-scopes). Add `organizationId: this.tenant.requireOrganizationIdOrDefault()` to `prisma.emailTemplate.create({ data: {...} })`.

- [ ] **Step 6.2: `update-email-template.handler.ts`**

Change `findUnique({ where: { slug } })` → `findFirst({ where: { slug } })`. Updates targeting `where: { id }` are UUID-safe (Proxy scopes the pre-update findFirst). Add a pre-update `findFirst({ id })` guard to reject cross-org id probes:

```ts
const existing = await this.prisma.emailTemplate.findFirst({ where: { id: cmd.id } });
if (!existing) throw new NotFoundException('Email template not found');
return this.prisma.emailTemplate.update({ where: { id: cmd.id }, data: {...} });
```

- [ ] **Step 6.3: `delete-email-template.handler.ts`**

Same pre-delete guard pattern as 6.2.

- [ ] **Step 6.4: `get-email-template.handler.ts` + `list-email-templates.handler.ts`**

Already use `findFirst` / `findMany` through the Proxy — just verify no residual `findUnique({ slug })`. Add clarifying comments.

- [ ] **Step 6.5: `comms/chat/create-conversation.handler.ts`**

Inject tenant. Add `organizationId` to `chatConversation.create({ data })`.

- [ ] **Step 6.6: `comms/chat/send-message.handler.ts`**

Inject tenant. Before creating a `CommsChatMessage`, the handler fetches the conversation — derive `organizationId: conversation.organizationId` for the message create. That avoids trusting client-supplied org context.

```ts
const conversation = await this.prisma.chatConversation.findFirst({ where: { id: cmd.conversationId } });
if (!conversation) throw new NotFoundException('Conversation not found');
return this.prisma.commsChatMessage.create({
  data: {
    organizationId: conversation.organizationId,
    conversationId: conversation.id,
    senderType: cmd.senderType,
    senderId: cmd.senderId,
    body: cmd.body,
  },
});
```

- [ ] **Step 6.7: `comms/chat/list-conversations.handler.ts` + `get-conversation.handler.ts` + `close-conversation.handler.ts`**

- `list-conversations` — Proxy auto-scopes.
- `get-conversation` — verify `findFirst` not `findUnique`.
- `close-conversation` — fetch first, then update by id (UUID safe).

- [ ] **Step 6.8: Update spec mocks**

Every handler spec gets `buildTenant()` injected at the matching constructor position.

- [ ] **Step 6.9: Run tests**

```bash
cd apps/backend && npx jest src/modules/comms/email-templates src/modules/comms/chat --no-coverage
```

Expected: green.

- [ ] **Step 6.10: Commit**

```bash
git add apps/backend/src/modules/comms/email-templates apps/backend/src/modules/comms/chat
git commit -m "feat(saas-02f): scope EmailTemplate + ChatConversation + CommsChatMessage handlers"
```

---

## Task 7: Scope AI cluster (ChatSession/ChatMessage + ChatbotConfig singleton)

**Files:**
- Modify: `src/modules/ai/chat-completion/chat-completion.handler.ts`
- Modify: `src/modules/ai/chatbot-config/get-chatbot-config.handler.ts`
- Modify: `src/modules/ai/chatbot-config/update-chatbot-config.handler.ts`
- Modify: any spec referencing the old key/value ChatbotConfig shape

- [ ] **Step 7.1: `chat-completion.handler.ts`**

Inject `TenantContextService`. Add organizationId to ChatSession create and ChatMessage creates:

```ts
const organizationId = this.tenant.requireOrganizationIdOrDefault();
const session = await this.prisma.chatSession.create({
  data: {
    organizationId,
    clientId: cmd.clientId,
    userId: cmd.userId,
    title: cmd.title,
  },
});

// Each ChatMessage (user + assistant):
await this.prisma.chatMessage.create({
  data: {
    organizationId,
    sessionId: session.id,
    role,
    content,
    tokensUsed,
    model,
  },
});
```

If chat-completion uses `$transaction(async (tx) => ...)` to insert user + assistant messages together, every `tx.chatMessage.create` needs explicit `organizationId`.

- [ ] **Step 7.2: `get-chatbot-config.handler.ts` — upsert-on-read singleton**

Replace old key-based reads with the singleton pattern:

```ts
async execute(): Promise<ChatbotConfig> {
  const organizationId = this.tenant.requireOrganizationIdOrDefault();
  return this.prisma.chatbotConfig.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId },
  });
}
```

Inject `TenantContextService`.

- [ ] **Step 7.3: `update-chatbot-config.handler.ts`**

```ts
async execute(cmd: UpdateChatbotConfigCommand): Promise<ChatbotConfig> {
  const organizationId = this.tenant.requireOrganizationIdOrDefault();
  return this.prisma.chatbotConfig.update({
    where: { organizationId },
    data: {
      systemPromptAr: cmd.systemPromptAr,
      systemPromptEn: cmd.systemPromptEn,
      greetingAr: cmd.greetingAr,
      greetingEn: cmd.greetingEn,
      escalateToHumanAt: cmd.escalateToHumanAt,
      settings: cmd.settings ?? undefined,
    },
  });
}
```

- [ ] **Step 7.4: Update DTO shape**

If the old DTO uses `{ key: string; value: unknown }`, replace with explicit fields (`systemPromptAr?`, `systemPromptEn?`, etc.). Update the dashboard controller and any test fixtures accordingly. List the callers:

```bash
grep -rn "UpdateChatbotConfigDto\|GetChatbotConfig" apps/backend/src/ --include="*.ts" | grep -v ".spec.ts"
```

- [ ] **Step 7.5: Update chat-completion config reads**

If `chat-completion.handler.ts` reads ChatbotConfig to inject a system prompt (e.g. previously `prisma.chatbotConfig.findUnique({ where: { key: 'system_prompt' } })`), replace with:

```ts
const cfg = await this.prisma.chatbotConfig.findFirst({ where: {} });
// Proxy auto-scopes by organizationId from CLS. Fall back to defaults if null.
const systemPrompt = cfg?.systemPromptAr ?? DEFAULT_SYSTEM_PROMPT_AR;
```

- [ ] **Step 7.6: Update specs + run**

```bash
cd apps/backend && npx jest src/modules/ai --no-coverage
```

Expected: green. Fix any remaining key/value references.

- [ ] **Step 7.7: Commit**

```bash
git add apps/backend/src/modules/ai apps/backend/src/api/dashboard/ai.controller.ts 2>/dev/null || true
git commit -m "feat(saas-02f): scope ChatSession + ChatMessage + convert ChatbotConfig to org singleton"
```

---

## Task 8: Scope ContactMessage — public entry + handlers

**Files:**
- Modify: `src/modules/comms/contact-messages/*.handler.ts`
- Modify: `src/api/public/contact.controller.ts` (or equivalent)

- [ ] **Step 8.1: `create-contact-message.handler.ts`**

Inject `TenantContextService`. Add `organizationId` to `contactMessage.create({ data })`. Use `requireOrganizationIdOrDefault()`:

```ts
const organizationId = this.tenant.requireOrganizationIdOrDefault();
return this.prisma.contactMessage.create({
  data: {
    organizationId,
    name: cmd.name,
    phone: cmd.phone,
    email: cmd.email,
    subject: cmd.subject,
    body: cmd.body,
  },
});
```

- [ ] **Step 8.2: Public controller — resolve tenant from Host before invoking handler**

The public contact endpoint is unauthenticated. SaaS-01 introduced `TenantResolverService` / `TenantMiddleware` that maps `Host` header → organization. Confirm the middleware is applied to the public contact route so CLS has `organizationId` set before the handler runs.

If the route is not yet covered, add the middleware binding:

```ts
consumer
  .apply(TenantMiddleware)
  .forRoutes({ path: 'api/v1/public/contact', method: RequestMethod.POST });
```

Document the host-resolution flow in a handler comment.

- [ ] **Step 8.3: `list-contact-messages.handler.ts` + `update-contact-message-status.handler.ts`**

- `list-contact-messages` — Proxy auto-scopes `findMany` / `count`.
- `update-contact-message-status` — pre-fetch `findFirst({ id })` to reject cross-org id probes, then update by id.

- [ ] **Step 8.4: Specs + run**

```bash
cd apps/backend && npx jest src/modules/comms/contact-messages --no-coverage
```

- [ ] **Step 8.5: Commit**

```bash
git add apps/backend/src/modules/comms/contact-messages apps/backend/src/api/public/contact.controller.ts 2>/dev/null || true
git commit -m "feat(saas-02f): scope ContactMessage create/read + wire public host-based tenant resolution"
```

---

## Task 9: Isolation e2e tests

**Files (create):**
- `test/e2e/comms/notification-isolation.e2e-spec.ts`
- `test/e2e/comms/email-template-isolation.e2e-spec.ts`
- `test/e2e/comms/chat-isolation.e2e-spec.ts`
- `test/e2e/comms/contact-message-isolation.e2e-spec.ts`
- `test/e2e/comms/chatbot-config-isolation.e2e-spec.ts`

Use the same `cls.run(() => ctx.set({ organizationId }))` harness pattern used in 02b–02e isolation specs.

- [ ] **Step 9.1: `notification-isolation.e2e-spec.ts`**

Tests:
1. Org A creates Notification for its clients. Org B cannot see it via `findMany`.
2. `markRead` for Org A's notification from Org B context returns NotFound.
3. `list-notifications` paginated count respects org boundary.

- [ ] **Step 9.2: `email-template-isolation.e2e-spec.ts`**

Tests:
1. **Same slug, two orgs** — Org A creates `booking_confirmed`, Org B creates `booking_confirmed`. Both succeed (composite unique). Each org only sees its own.
2. `get-email-template(slug=booking_confirmed)` in Org A returns Org A's row; in Org B returns Org B's row.
3. `delete-email-template(id)` for Org A's id from Org B context returns NotFound.

- [ ] **Step 9.3: `chat-isolation.e2e-spec.ts`**

Tests:
1. Org A creates a ChatConversation + messages. Org B's `list-conversations` returns empty.
2. Sending a CommsChatMessage to Org A's conversation from Org B context throws NotFound.
3. ChatSession + ChatMessage from AI cluster: Org A's session invisible to Org B.

- [ ] **Step 9.4: `contact-message-isolation.e2e-spec.ts`**

Tests:
1. Org A's contact form submits → lands with `organizationId = orgA`.
2. Org B's `list-contact-messages` cannot see Org A's submissions.
3. `update-contact-message-status` for Org A's id from Org B context returns NotFound.

- [ ] **Step 9.5: `chatbot-config-isolation.e2e-spec.ts`**

Tests:
1. **Singleton per org** — `getChatbotConfig` in Org A returns Org A's row; in Org B returns Org B's row (auto-created on first read).
2. Updating Org A's config does not mutate Org B's.

- [ ] **Step 9.6: Run all new e2e suites**

```bash
cd apps/backend && npm run test:e2e -- --testPathPattern=comms
```

Expected: all 5 suites green. Regression check prior clusters:

```bash
cd apps/backend && npm run test:e2e -- --testPathPattern="(bookings|identity|people|org-config|finance)"
```

Expected: no regressions.

- [ ] **Step 9.7: Commit**

```bash
git add apps/backend/test/e2e/comms
git commit -m "test(saas-02f): comms cluster cross-tenant isolation e2e (5 suites)"
```

---

## Task 10: Full regression + memory + index

- [ ] **Step 10.1: Full typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: clean.

- [ ] **Step 10.2: Full unit test suite**

```bash
cd apps/backend && npm run test
```

Expected: all green. Record the count (02e baseline + new comms specs).

- [ ] **Step 10.3: Full e2e suite**

```bash
cd apps/backend && npm run test:e2e
```

Expected: all green. Record new isolation count.

- [ ] **Step 10.4: Create the status memory file**

Create `/Users/tariq/.claude/projects/-Users-tariq-code-deqah/memory/saas02f_status.md`:

```markdown
---
name: SaaS-02f status
description: Plan 02f (comms cluster tenant rollout) — 8 models scoped, ChatbotConfig singleton converted, public ContactMessage resolves tenant from host
type: project
---
**Status:** PR #<N> <state> (feat/saas-02f-comms-cluster → main).

**Scope delivered:** 8 models tenant-scoped — EmailTemplate, Notification, ChatConversation, CommsChatMessage, ChatSession, ChatMessage, ContactMessage, ChatbotConfig.

**Key patterns:**
- EmailTemplate.slug now composite-unique per org — `findFirst({ slug })` everywhere, never `findUnique({ slug })`.
- ChatbotConfig: upsert-on-read with `where: { organizationId }` — restructured from key-value into typed singleton.
- ContactMessage public entry: `TenantMiddleware` resolves org from Host before the handler fires.
- CommsChatMessage create derives `organizationId` from `conversation.organizationId` (anchor pattern from 02d/02e).
- Notification event producers propagate `event.organizationId` into `data` block.

**Test evidence:** <fill in> unit, 5 new comms isolation e2e, prior isolation regression clean.

**Next:** Plan 02g (AI + media + ops + platform — KnowledgeDocument pgvector-aware migration).
```

- [ ] **Step 10.5: Update MEMORY.md pointer**

Append under the existing 02e entry:

```
- [SaaS-02f status](saas02f_status.md) — Plan 02f delivered <date> PR #<N>; comms cluster (8 models) + ChatbotConfig singleton + public ContactMessage host-based tenant resolution
```

- [ ] **Step 10.6: Update transformation index**

In `docs/superpowers/plans/2026-04-21-saas-transformation-index.md`:
- Progress: 7/18 phases done (39%).
- Phase 02f ✅ DONE with PR link.
- Executor next action: merge PR → plan 02g ready.
- Append progress log entry.

- [ ] **Step 10.7: Final commit**

```bash
git add /Users/tariq/.claude/projects/-Users-tariq-code-deqah/memory/saas02f_status.md \
        /Users/tariq/.claude/projects/-Users-tariq-code-deqah/memory/MEMORY.md \
        docs/superpowers/plans/2026-04-21-saas-transformation-index.md
git commit -m "docs(saas): mark 02f done in index + memory (comms cluster)"
```

- [ ] **Step 10.8: Open the PR**

```bash
git push -u origin feat/saas-02f-comms-cluster
gh pr create --title "feat(saas-02f): comms cluster tenant rollout — 8 models + ChatbotConfig singleton + public host resolution" \
  --body "Scopes Notification, ChatConversation, CommsChatMessage, ChatSession, ChatMessage, ContactMessage, EmailTemplate + ChatbotConfig singleton. Public ContactMessage endpoint resolves tenant from Host header."
```

---

## Amendments applied during execution

> _This section is empty until execution. If reality diverges from any step, stop, document here, and await confirmation before continuing._
