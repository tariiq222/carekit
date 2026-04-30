# Per-tenant SMS Provider Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the current single-provider, platform-billed SMS service (`send-sms.handler.ts` calling a shared Twilio/Unifonic account) to a **per-tenant, bring-your-own-provider** architecture. Each Organization provides its own SMS provider credentials (Unifonic or Taqnyat) through a new `OrganizationSmsConfig` singleton and pays the provider directly. Platform stops billing SMS usage as a metered resource (Plan 04 amendments removed `NOTIFICATIONS_PER_MONTH`). Adds adapters for Unifonic + Taqnyat behind a common `SmsProvider` interface, credential encryption at rest, provider-specific webhook DLRs scoped to the owning tenant, and a `/settings/sms` dashboard page where owners add + test credentials.

**Architecture:** Strangler-safe — the legacy `send-sms.handler.ts` is replaced by a thin orchestrator that resolves the current tenant's `OrganizationSmsConfig` → instantiates the configured provider adapter → dispatches. Adapters (`UnifonicAdapter`, `TaqnyatAdapter`) implement `SmsProvider { send(to, body, opts): Promise<SmsSendResult> }`. Credentials stored as AES-256-GCM encrypted columns (key rotation via `SMS_PROVIDER_ENCRYPTION_KEY` env). Delivery-receipt webhooks land on `POST /api/v1/public/sms/webhooks/:provider/:organizationId` and use the 02e system-context pattern to resolve tenant before mutating. No platform-level SMS usage metering — removed from Plan 04 scope.

**Tech Stack:** NestJS 11, Prisma 7, nestjs-cls (TenantContextService), `@node-rs/argon2` (if we reuse key material) or native `crypto` AES-GCM, BullMQ (for retry queue on transient provider failures), Jest + Supertest.

**Dependency:** Plan 02f (Comms cluster) merged — `ChatbotConfig` singleton pattern precedent used here. Must land **before** Plan 04 execution (Plan 04's amendments depend on SMS being out of platform billing scope).

---

## Critical lessons carried forward from prior plans

1. **Singleton upsert-on-read pattern** (Lesson 10 from index). `OrganizationSmsConfig` follows the 02c/02f model: `id @default(uuid())` + `organizationId @unique`. Get = `upsert({ where: { organizationId }, update: {}, create: { organizationId, provider: 'NONE' } })`.
2. **System-context bypass for webhooks** (02e pattern). Provider DLR webhooks arrive with no CLS tenant context — the `:organizationId` path param is the lookup key; signature verification happens inside system context; then `cls.run` with resolved `organizationId` for the mutation.
3. **`$transaction` callback form bypasses the Proxy** (Lesson 11). The send-sms flow writes an `SmsDelivery` row + updates `SmsDelivery.status` inside a tx — explicit `organizationId` on every `tx.*` call.
4. **Secrets in Postgres**: never plaintext. AES-GCM with authenticated additional data (AAD = `organizationId`) so a DB dump alone can't be decrypted at another tenant context.
5. **Provider adapter isolation**: adapters have zero knowledge of Prisma or the tenant context. They receive plain credentials + payload, return a normalized result. This makes adding a third provider (e.g. Twilio as fallback) a 1-file change.
6. **Bilingual error strings**: every public-facing error returned from `/settings/sms/test` has `{ ar, en }` variants per root `CLAUDE.md` Arabic-first rule.

---

## SCOPED_MODELS after this plan

```ts
const SCOPED_MODELS = new Set<string>([
  // (all models from 01–02g)
  // 02g-sms additions:
  'OrganizationSmsConfig', 'SmsDelivery',
]);
```

---

## File Structure

**Schema (modify):**
- `apps/backend/prisma/schema/comms.prisma` — add `OrganizationSmsConfig` (singleton) + `SmsDelivery` (per-send audit row).

**Migration (create):**
- `apps/backend/prisma/migrations/<ts>_saas_02g_sms_per_tenant/migration.sql` — create the 2 tables, add org FK, enable RLS, seed NONE-provider rows for existing orgs.

**New infrastructure module:** `apps/backend/src/infrastructure/sms/`
- `sms-provider.interface.ts` — `SmsProvider` contract + shared types (`SmsSendResult`, `SmsStatus`, `DlrPayload`).
- `sms-credentials.service.ts` — AES-GCM encrypt/decrypt helpers with `organizationId` as AAD.
- `unifonic.adapter.ts` + `unifonic.adapter.spec.ts` — Unifonic REST adapter.
- `taqnyat.adapter.ts` + `taqnyat.adapter.spec.ts` — Taqnyat REST adapter.
- `no-op.adapter.ts` — returned when provider=NONE; throws `SmsProviderNotConfiguredException` on send.
- `sms-provider.factory.ts` + `.spec.ts` — resolves adapter by `OrganizationSmsConfig.provider`.
- `sms.module.ts` — exports factory.

**Module changes:** `apps/backend/src/modules/comms/`
- **Modify:** `send-sms/send-sms.handler.ts` — replace direct provider call with factory-based dispatch scoped to tenant; write `SmsDelivery` row.
- **Modify:** `send-sms/send-sms.handler.spec.ts` — mock factory.
- **New:** `org-sms-config/get-org-sms-config.handler.ts` + spec — owner-scoped read.
- **New:** `org-sms-config/upsert-org-sms-config.handler.ts` + spec — write; encrypts credentials before store; never returns decrypted secrets.
- **New:** `org-sms-config/test-sms-config.handler.ts` + spec — sends a test SMS to the owner's verified phone using pending (uncommitted) credentials before persistence.
- **New:** `sms-dlr/sms-dlr.handler.ts` + spec — handles inbound provider DLR webhook.

**Controllers (new + modified):**
- `src/api/dashboard/comms.controller.ts` — add 3 routes: `GET/PUT /settings/sms`, `POST /settings/sms/test`. Owner-only via CASL `CommsSettings.update`.
- `src/api/public/sms-webhooks.controller.ts` (new file) — `POST /api/v1/public/sms/webhooks/:provider/:organizationId` (no auth — signature + org-id path param authenticate).

**Dashboard UI:** `apps/dashboard/app/(dashboard)/settings/sms/`
- `page.tsx` — provider picker (`NONE` | `UNIFONIC` | `TAQNYAT`), credential form per provider, test-send button, delivery-log table.
- `form.tsx` — RHF + Zod form scoped to the selected provider.
- `components/delivery-log-table.tsx` — last 50 deliveries with status badges.
- Query hook in `apps/dashboard/hooks/use-sms-config.ts`.

**Env additions:** `apps/backend/.env.example` + `apps/backend/src/config/env.validation.ts`
- `SMS_PROVIDER_ENCRYPTION_KEY` — 32-byte base64, required.
- `SMS_WEBHOOK_URL_BASE` — public URL registered with providers.

**Tests (new):**
- `test/e2e/comms/sms-config-isolation.e2e-spec.ts` — tenant-isolation (org A cannot read org B's config).
- `test/e2e/comms/sms-send-scoped.e2e-spec.ts` — two orgs, each with different provider, sends land on correct provider.
- `test/e2e/comms/sms-dlr-tenant-context.e2e-spec.ts` — DLR webhook for org A only updates org A's SmsDelivery row.

**Memory (create):**
- `/Users/tariq/.claude/projects/-Users-tariq-code-deqah/memory/saas02g_sms_status.md`

**Transformation index (modify):**
- `docs/superpowers/plans/2026-04-21-saas-transformation-index.md` — mark 02g-sms done, progress-log entry, clear the Plan-04-blocker risk.

---

## Task 0 — (no owner gate needed, but confirm scope)

No payments / auth / migrations side-effect beyond the new tables. This plan does NOT flip any existing behavior until the dashboard UI is live — `send-sms.handler.ts` keeps working with the legacy env-based provider when `OrganizationSmsConfig.provider = NONE` (the default seeded for every existing org). Task 10 (cutover) is the switch.

---

## Task 1 — Pre-flight grep audit

- [ ] **Step 1.1: Identify every callsite of `send-sms` + `SmsService`**

```bash
cd apps/backend
grep -rn "send-sms\|sendSms\|SmsService\|this\.sms\." src/ --include="*.ts" | grep -v ".spec.ts"
```

Expected: `comms/send-sms/send-sms.handler.ts`, `comms/events/on-booking-reminder.handler.ts`, plus any cron or notification dispatcher. Write the list to `docs/superpowers/qa/saas-02g-sms-callsites-<date>.md`.

- [ ] **Step 1.2: Identify the legacy provider client**

```bash
grep -rn "unifonic\|taqnyat\|twilio\|SmsClient\|HttpService.*sms" src/ node_modules/@deqah/ 2>/dev/null | head -20
```

Document the current provider, env vars in use, and which module imports it.

- [ ] **Step 1.3: Commit audit**

```bash
git add docs/superpowers/qa/saas-02g-sms-callsites-*.md
git commit -m "docs(saas-02g-sms): pre-flight callsite audit"
```

---

## Task 2 — Schema: `OrganizationSmsConfig` + `SmsDelivery`

**File:** `apps/backend/prisma/schema/comms.prisma`

- [ ] **Step 2.1: Add enum + two models**

Insert (after existing comms enums):

```prisma
enum SmsProvider {
  NONE
  UNIFONIC
  TAQNYAT
}

enum SmsDeliveryStatus {
  QUEUED
  SENT
  DELIVERED
  FAILED
  UNKNOWN
}

model OrganizationSmsConfig {
  id             String      @id @default(uuid())
  organizationId String      @unique // SaaS-02g-sms — singleton per org
  provider       SmsProvider @default(NONE)
  senderId       String? // e.g. "Deqah" or per-tenant brand
  // Encrypted credential payload (AES-GCM). JSON-stringified provider-specific fields.
  credentialsCiphertext String? // base64(nonce || tag || ciphertext)
  webhookSecret         String? // HMAC secret for DLR signature
  lastTestAt            DateTime?
  lastTestOk            Boolean?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([organizationId])
}

model SmsDelivery {
  id             String            @id @default(uuid())
  organizationId String // SaaS-02g-sms
  provider       SmsProvider
  toPhone        String
  body           String
  bodyHash       String // sha256, used for idempotency with retries
  status         SmsDeliveryStatus @default(QUEUED)
  providerMessageId String?        @unique
  errorCode      String?
  errorMessage   String?
  sentAt         DateTime?
  deliveredAt    DateTime?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@index([organizationId])
  @@index([status])
  @@index([createdAt])
}
```

- [ ] **Step 2.2: Format + commit**

```bash
cd apps/backend && npx prisma format
git add prisma/schema/comms.prisma
git commit -m "feat(saas-02g-sms): schema — OrganizationSmsConfig singleton + SmsDelivery audit row"
```

---

## Task 3 — Migration (manual SQL, pgvector-safe)

**File:** `apps/backend/prisma/migrations/<ts>_saas_02g_sms_per_tenant/migration.sql`

- [ ] **Step 3.1: Create migration directory + SQL**

```bash
cd apps/backend
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_saas_02g_sms_per_tenant"
```

Migration body:

```sql
-- SaaS-02g-sms: per-tenant SMS provider refactor.
CREATE TYPE "SmsProvider" AS ENUM ('NONE','UNIFONIC','TAQNYAT');
CREATE TYPE "SmsDeliveryStatus" AS ENUM ('QUEUED','SENT','DELIVERED','FAILED','UNKNOWN');

CREATE TABLE "OrganizationSmsConfig" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" "SmsProvider" NOT NULL DEFAULT 'NONE',
  "senderId" TEXT,
  "credentialsCiphertext" TEXT,
  "webhookSecret" TEXT,
  "lastTestAt" TIMESTAMP(3),
  "lastTestOk" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationSmsConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationSmsConfig_organizationId_key" ON "OrganizationSmsConfig"("organizationId");
CREATE INDEX "OrganizationSmsConfig_organizationId_idx" ON "OrganizationSmsConfig"("organizationId");

CREATE TABLE "SmsDelivery" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" "SmsProvider" NOT NULL,
  "toPhone" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "bodyHash" TEXT NOT NULL,
  "status" "SmsDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "providerMessageId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmsDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SmsDelivery_providerMessageId_key" ON "SmsDelivery"("providerMessageId");
CREATE INDEX "SmsDelivery_organizationId_idx" ON "SmsDelivery"("organizationId");
CREATE INDEX "SmsDelivery_status_idx" ON "SmsDelivery"("status");
CREATE INDEX "SmsDelivery_createdAt_idx" ON "SmsDelivery"("createdAt");

-- Seed one NONE-provider row for every existing org so send-sms has a config to fall back to.
INSERT INTO "OrganizationSmsConfig" ("id", "organizationId", "provider", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", 'NONE', NOW(), NOW() FROM "Organization";

-- RLS
ALTER TABLE "OrganizationSmsConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SmsDelivery" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "OrganizationSmsConfig" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "SmsDelivery" USING ("organizationId" = current_setting('app.current_organization_id', true));
```

- [ ] **Step 3.2: Apply + regenerate client**

```bash
cd apps/backend && npx prisma migrate deploy
TEST_DATABASE_URL="postgresql://deqah:deqah@localhost:5999/deqah_test" \
  DATABASE_URL="postgresql://deqah:deqah@localhost:5999/deqah_test" \
  npx prisma migrate deploy
npx prisma generate
```

- [ ] **Step 3.3: Register both models in SCOPED_MODELS**

Open `apps/backend/src/infrastructure/database/prisma.service.ts` and add `'OrganizationSmsConfig', 'SmsDelivery'` under a new `// 02g-sms` section.

- [ ] **Step 3.4: Commit**

```bash
git add apps/backend/prisma/migrations apps/backend/src/infrastructure/database/prisma.service.ts
git commit -m "feat(saas-02g-sms): migration + scoped models"
```

---

## Task 4 — `SmsProvider` interface + credentials encryption

**Files:**
- Create: `apps/backend/src/infrastructure/sms/sms-provider.interface.ts`
- Create: `apps/backend/src/infrastructure/sms/sms-credentials.service.ts` + spec.

- [ ] **Step 4.1: Write the failing spec for credentials encryption**

`sms-credentials.service.spec.ts`:

```ts
describe('SmsCredentialsService', () => {
  const KEY = Buffer.from('0'.repeat(64), 'hex').toString('base64'); // 32 bytes
  let svc: SmsCredentialsService;
  beforeEach(() => (svc = new SmsCredentialsService({ get: () => KEY } as any)));

  it('round-trips a payload with orgId AAD', () => {
    const cipher = svc.encrypt({ apiKey: 'abc', appSid: 'xyz' }, 'org-1');
    expect(svc.decrypt(cipher, 'org-1')).toEqual({ apiKey: 'abc', appSid: 'xyz' });
  });

  it('fails to decrypt with wrong orgId (AAD mismatch)', () => {
    const cipher = svc.encrypt({ apiKey: 'abc' }, 'org-1');
    expect(() => svc.decrypt(cipher, 'org-2')).toThrow(/authentication failed/);
  });
});
```

- [ ] **Step 4.2: Run the failing test**

```bash
cd apps/backend && npx jest src/infrastructure/sms/sms-credentials.service.spec.ts
```

Expected: file not found / fail.

- [ ] **Step 4.3: Implement `SmsCredentialsService`**

```ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class SmsCredentialsService {
  private readonly key: Buffer;
  constructor(private readonly cfg: ConfigService) {
    const raw = cfg.get<string>('SMS_PROVIDER_ENCRYPTION_KEY');
    if (!raw) throw new InternalServerErrorException('SMS_PROVIDER_ENCRYPTION_KEY missing');
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new InternalServerErrorException('SMS encryption key must be 32 bytes');
    this.key = key;
  }

  encrypt(payload: object, organizationId: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(organizationId));
    const plain = Buffer.from(JSON.stringify(payload), 'utf8');
    const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ct]).toString('base64');
  }

  decrypt(ciphertext: string, organizationId: string): any {
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAAD(Buffer.from(organizationId));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(plain.toString('utf8'));
  }
}
```

Run tests, all green.

- [ ] **Step 4.4: Write the `SmsProvider` interface**

`sms-provider.interface.ts`:

```ts
export type SmsSendResult = {
  providerMessageId: string;
  status: 'SENT' | 'QUEUED';
};

export type DlrPayload = {
  providerMessageId: string;
  status: 'DELIVERED' | 'FAILED';
  errorCode?: string;
  errorMessage?: string;
  rawBody: string; // for signature verification
  signature: string;
};

export interface SmsProvider {
  readonly name: 'UNIFONIC' | 'TAQNYAT' | 'NONE';
  send(to: string, body: string, senderId: string | null): Promise<SmsSendResult>;
  verifyDlrSignature(payload: DlrPayload, webhookSecret: string): void; // throws on mismatch
  parseDlr(rawBody: string): Omit<DlrPayload, 'rawBody' | 'signature'>;
}
```

- [ ] **Step 4.5: Commit**

```bash
git add apps/backend/src/infrastructure/sms
git commit -m "feat(saas-02g-sms): SmsProvider interface + AES-GCM credentials service (org-AAD)"
```

---

## Task 5 — Unifonic + Taqnyat adapters

Identical TDD pattern for each.

- [ ] **Step 5.1: Spec `unifonic.adapter.spec.ts`**

```ts
describe('UnifonicAdapter', () => {
  it('POSTs to /Messages with correct fields', async () => {
    const nock = require('nock');
    nock('https://api.unifonic.com').post('/rest/SMS/messages').reply(200, {
      success: true,
      data: { MessageID: 'unif-123' },
    });
    const adapter = new UnifonicAdapter({ appSid: 'sid', apiKey: 'key' });
    const res = await adapter.send('+966500000000', 'hi', 'Deqah');
    expect(res).toEqual({ providerMessageId: 'unif-123', status: 'SENT' });
  });

  it('rejects bad HMAC in DLR', () => {
    const adapter = new UnifonicAdapter({ appSid: 'sid', apiKey: 'key' });
    expect(() =>
      adapter.verifyDlrSignature(
        { providerMessageId: 'x', status: 'DELIVERED', rawBody: '{}', signature: 'deadbeef' },
        'secret',
      ),
    ).toThrow();
  });
});
```

Run → fail.

- [ ] **Step 5.2: Implement `UnifonicAdapter`**

Skeleton:

```ts
import { createHmac, timingSafeEqual } from 'crypto';
import axios from 'axios';
import type { SmsProvider, SmsSendResult, DlrPayload } from './sms-provider.interface';

type UnifonicCreds = { appSid: string; apiKey: string };

export class UnifonicAdapter implements SmsProvider {
  readonly name = 'UNIFONIC' as const;
  constructor(private readonly creds: UnifonicCreds) {}

  async send(to: string, body: string, senderId: string | null): Promise<SmsSendResult> {
    const res = await axios.post('https://api.unifonic.com/rest/SMS/messages', {
      AppSid: this.creds.appSid,
      Recipient: to,
      Body: body,
      SenderID: senderId,
    }, {
      headers: { Authorization: `Bearer ${this.creds.apiKey}` },
      timeout: 10_000,
    });
    if (!res.data?.success) throw new Error(`Unifonic error: ${JSON.stringify(res.data)}`);
    return { providerMessageId: String(res.data.data.MessageID), status: 'SENT' };
  }

  verifyDlrSignature(p: DlrPayload, secret: string): void {
    const expected = createHmac('sha256', secret).update(p.rawBody).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(p.signature, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Unifonic DLR signature mismatch');
  }

  parseDlr(rawBody: string): { providerMessageId: string; status: 'DELIVERED' | 'FAILED'; errorCode?: string; errorMessage?: string } {
    const p = JSON.parse(rawBody);
    return {
      providerMessageId: String(p.messageId),
      status: p.status === 'delivered' ? 'DELIVERED' : 'FAILED',
      errorCode: p.errorCode,
      errorMessage: p.errorMessage,
    };
  }
}
```

Run tests → green.

- [ ] **Step 5.3: Repeat for `taqnyat.adapter.ts`**

Taqnyat REST endpoint: `https://api.taqnyat.sa/v1/messages`, auth via `Bearer <token>`. Follow identical structure; one spec file.

- [ ] **Step 5.4: Write `sms-provider.factory.ts`**

```ts
@Injectable()
export class SmsProviderFactory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: SmsCredentialsService,
  ) {}

  async forCurrentTenant(organizationId: string): Promise<SmsProvider> {
    const cfg = await this.prisma.organizationSmsConfig.findFirst({ where: { organizationId } });
    if (!cfg || cfg.provider === 'NONE' || !cfg.credentialsCiphertext) return new NoOpAdapter();
    const creds = this.credentials.decrypt(cfg.credentialsCiphertext, organizationId);
    switch (cfg.provider) {
      case 'UNIFONIC': return new UnifonicAdapter(creds);
      case 'TAQNYAT':  return new TaqnyatAdapter(creds);
      default: return new NoOpAdapter();
    }
  }
}
```

- [ ] **Step 5.5: Commit**

```bash
git add apps/backend/src/infrastructure/sms
git commit -m "feat(saas-02g-sms): Unifonic + Taqnyat adapters + factory"
```

---

## Task 6 — Org SMS config handlers (get / upsert / test)

**Files:**
- Create: `apps/backend/src/modules/comms/org-sms-config/get-org-sms-config.handler.ts` + spec
- Create: `apps/backend/src/modules/comms/org-sms-config/upsert-org-sms-config.handler.ts` + spec
- Create: `apps/backend/src/modules/comms/org-sms-config/test-sms-config.handler.ts` + spec

- [ ] **Step 6.1: `get` handler (upsert-on-read singleton pattern)**

```ts
@Injectable()
export class GetOrgSmsConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(): Promise<Omit<OrganizationSmsConfig, 'credentialsCiphertext' | 'webhookSecret'>> {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    const row = await this.prisma.organizationSmsConfig.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId, provider: 'NONE' },
    });
    // NEVER return decrypted credentials or webhook secret to the dashboard.
    const { credentialsCiphertext, webhookSecret, ...safe } = row;
    return { ...safe, credentialsConfigured: !!credentialsCiphertext };
  }
}
```

- [ ] **Step 6.2: `upsert` handler**

Validates provider-specific credential shape (Zod per provider), encrypts, stores. Generates a random `webhookSecret` if provider changes.

- [ ] **Step 6.3: `test-sms-config` handler**

Takes a pending config payload (not yet saved) + the owner's verified phone. Encrypts ephemerally, sends a test SMS using a transient adapter, returns `{ ok, providerMessageId | errorMessage }`. Updates `lastTestAt` + `lastTestOk` on the persisted row when testing an already-saved config.

- [ ] **Step 6.4: Specs for all three**

Mock the factory + Prisma. Assert: encrypted output never equals input, decrypted output equals input, get-handler never returns credentials, bilingual errors.

- [ ] **Step 6.5: Commit**

```bash
git add apps/backend/src/modules/comms/org-sms-config
git commit -m "feat(saas-02g-sms): get/upsert/test handlers for OrganizationSmsConfig"
```

---

## Task 7 — Replace `send-sms.handler.ts` with factory-based dispatch

- [ ] **Step 7.1: Update spec to expect factory call + SmsDelivery row**

```ts
it('resolves tenant provider, sends, writes SmsDelivery', async () => {
  const adapter = { send: jest.fn().mockResolvedValue({ providerMessageId: 'm1', status: 'SENT' }) };
  factory.forCurrentTenant.mockResolvedValue(adapter);

  await handler.execute({ to: '+966500000000', body: 'hi' });

  expect(adapter.send).toHaveBeenCalledWith('+966500000000', 'hi', null);
  expect(prisma.smsDelivery.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ organizationId: 'org-A', providerMessageId: 'm1', status: 'SENT' }),
  });
});
```

- [ ] **Step 7.2: Replace handler body**

```ts
async execute(cmd: SendSmsCommand) {
  const organizationId = this.tenant.requireOrganizationIdOrDefault();
  const adapter = await this.factory.forCurrentTenant(organizationId);
  const bodyHash = createHash('sha256').update(cmd.body).digest('hex');
  try {
    const result = await adapter.send(cmd.to, cmd.body, null);
    return await this.prisma.smsDelivery.create({
      data: {
        organizationId,
        provider: adapter.name,
        toPhone: cmd.to,
        body: cmd.body,
        bodyHash,
        status: result.status === 'SENT' ? 'SENT' : 'QUEUED',
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
      },
    });
  } catch (err) {
    await this.prisma.smsDelivery.create({
      data: {
        organizationId, provider: adapter.name, toPhone: cmd.to, body: cmd.body, bodyHash,
        status: 'FAILED', errorMessage: (err as Error).message,
      },
    });
    throw err;
  }
}
```

- [ ] **Step 7.3: Commit**

```bash
git add apps/backend/src/modules/comms/send-sms
git commit -m "feat(saas-02g-sms): send-sms dispatches via tenant-scoped provider factory + audit row"
```

---

## Task 8 — DLR webhook controller

**Files:**
- Create: `apps/backend/src/api/public/sms-webhooks.controller.ts`
- Create: `apps/backend/src/modules/comms/sms-dlr/sms-dlr.handler.ts` + spec.

- [ ] **Step 8.1: Route shape**

`POST /api/v1/public/sms/webhooks/:provider/:organizationId`. Path param + signature authenticate. No JWT, no CASL.

- [ ] **Step 8.2: Handler — 3-stage tenant resolution (02e pattern)**

```ts
async execute(req: { provider: 'UNIFONIC' | 'TAQNYAT'; organizationId: string; rawBody: string; signature: string }) {
  // Stage 1 — system-context read config
  const cfg = await this.cls.run(async () => {
    this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
    return this.prisma.organizationSmsConfig.findFirst({ where: { organizationId: req.organizationId } });
  });
  if (!cfg || cfg.provider !== req.provider) return { skipped: true };

  // Stage 2 — verify signature
  const adapter = await this.factory.forCurrentTenant(req.organizationId);
  adapter.verifyDlrSignature({ providerMessageId: '', status: 'DELIVERED', rawBody: req.rawBody, signature: req.signature }, cfg.webhookSecret!);
  const dlr = adapter.parseDlr(req.rawBody);

  // Stage 3 — update SmsDelivery inside tenant context
  return this.cls.run(async () => {
    this.cls.set('organizationId', req.organizationId);
    await this.prisma.smsDelivery.updateMany({
      where: { providerMessageId: dlr.providerMessageId },
      data: {
        status: dlr.status,
        errorCode: dlr.errorCode,
        errorMessage: dlr.errorMessage,
        deliveredAt: dlr.status === 'DELIVERED' ? new Date() : undefined,
      },
    });
    return {};
  });
}
```

- [ ] **Step 8.3: Spec — two orgs, correct DLR routing**

Seed two orgs with different providers + pending SmsDelivery rows. Send DLR for org A → only org A's row updated. Wrong signature → rejected.

- [ ] **Step 8.4: Commit**

```bash
git add apps/backend/src/api/public/sms-webhooks.controller.ts apps/backend/src/modules/comms/sms-dlr
git commit -m "feat(saas-02g-sms): DLR webhook with 3-stage tenant resolution + signature verify"
```

---

## Task 9 — Dashboard UI `/settings/sms`

**Files:**
- Create: `apps/dashboard/app/(dashboard)/settings/sms/page.tsx` + `form.tsx` + `components/delivery-log-table.tsx`
- Create: `apps/dashboard/hooks/use-sms-config.ts`

- [ ] **Step 9.1: Page anatomy per root `CLAUDE.md`**

Breadcrumbs → PageHeader → ErrorBanner → form (Card) → FilterBar (on the delivery log) → DataTable.

- [ ] **Step 9.2: Form — provider picker + per-provider schema**

RHF + Zod. On provider change, swap visible fields:
- UNIFONIC: `{ appSid, apiKey }`
- TAQNYAT: `{ apiToken }`
- NONE: read-only note "SMS not configured".

- [ ] **Step 9.3: Test button → `POST /settings/sms/test`**

Sends to the owner's verified phone; shows success/failure toast (bilingual per DS).

- [ ] **Step 9.4: Delivery log table**

Reads `GET /settings/sms/deliveries` (owner-scoped, paginated). Status badges (SENT=primary, DELIVERED=success, FAILED=destructive).

- [ ] **Step 9.5: Commit**

```bash
git add apps/dashboard/app/\(dashboard\)/settings/sms apps/dashboard/hooks/use-sms-config.ts
git commit -m "feat(saas-02g-sms): dashboard /settings/sms page"
```

---

## Task 10 — Cutover + deprecation

- [ ] **Step 10.1: Remove legacy env-based provider from `send-sms` once every org has a provider OR explicit NONE**

The handler (Task 7) already dispatches via factory. This step just removes the legacy `this.smsClient` field + env vars from the module. Verify no other callsite imports it.

- [ ] **Step 10.2: Remove `TWILIO_*` / legacy env vars from `env.validation.ts`**

Keep `SMS_PROVIDER_ENCRYPTION_KEY` + `SMS_WEBHOOK_URL_BASE` only.

- [ ] **Step 10.3: Update `apps/backend/CLAUDE.md`**

Add a paragraph under Comms cluster: "SMS is per-tenant as of 02g-sms. See `OrganizationSmsConfig`. Platform billing does NOT meter SMS — tenants pay their chosen provider directly."

- [ ] **Step 10.4: Commit**

```bash
git add apps/backend
git commit -m "chore(saas-02g-sms): remove legacy platform-SMS env vars + update CLAUDE.md"
```

---

## Task 11 — Isolation e2e

**Files:**
- Create: `test/e2e/comms/sms-config-isolation.e2e-spec.ts`
- Create: `test/e2e/comms/sms-send-scoped.e2e-spec.ts`
- Create: `test/e2e/comms/sms-dlr-tenant-context.e2e-spec.ts`

Test matrix (per isolation-harness pattern established in 02b):

- **config-isolation**: org A reads only its own config; update from org B does not affect org A; credentials decrypted under org-A AAD fail under org-B AAD.
- **send-scoped**: two orgs with different providers; `send-sms` resolves correct adapter; SmsDelivery row carries correct `organizationId`; cross-read returns empty.
- **dlr-tenant-context**: DLR for org A updates only org A's row; DLR with org A's providerMessageId but path `:organizationId=orgB` is rejected (signature mismatch or provider mismatch).

Run:

```bash
cd apps/backend && npm run test:e2e -- --testPathPattern=comms/sms
```

Expected: all green.

- [ ] **Step 11.2: Commit**

```bash
git add apps/backend/test/e2e/comms
git commit -m "test(saas-02g-sms): isolation e2e — config + send + DLR"
```

---

## Task 12 — Memory + index

- [ ] **Step 12.1: Create status memory**

File `/Users/tariq/.claude/projects/-Users-tariq-code-deqah/memory/saas02g_sms_status.md`:

```markdown
---
name: SaaS-02g-sms status
description: Per-tenant SMS provider refactor — Unifonic + Taqnyat adapters + OrganizationSmsConfig singleton + platform SMS billing removed
type: project
---
**Scope delivered:** 2 models scoped (OrganizationSmsConfig singleton + SmsDelivery audit). Two adapters (Unifonic + Taqnyat) + factory. DLR webhook 3-stage tenant resolution. Dashboard /settings/sms live. Platform SMS billing removed (confirms Plan 04 amendments).

**Why:** Tenants must use their own regulated SMS providers (Saudi telecom KSA, each clinic needs own sender-id registration). Platform SMS billing impractical + legally complex.

**How to apply:**
- Every SMS goes through `SmsProviderFactory.forCurrentTenant(orgId)`. Never call a provider adapter directly from a handler.
- Credentials use AES-GCM with `organizationId` as AAD — tamper-proof across tenants.
- DLR webhooks use the 02e pattern: system-context read → signature verify → cls.run mutation.
- Get-handler NEVER returns decrypted secrets to the dashboard; the form writes-only.

**Test evidence:** 3 isolation e2e suites, N unit specs, typecheck clean.

**Next:** Plan 04 (Billing) unblocked. Plan 02h (strict mode) can now include SMS handlers.
```

- [ ] **Step 12.2: Update MEMORY.md pointer + transformation-index**

Append pointer line. In the index: mark 02g-sms done, add progress-log entry, remove the "Plan-02g-sms NEW" risk from active risks.

- [ ] **Step 12.3: Commit + open PR**

```bash
git add <memory files> docs/superpowers/plans/2026-04-21-saas-transformation-index.md
git commit -m "docs(saas-02g-sms): memory + index update"
git push -u origin feat/saas-02g-sms-per-tenant
gh pr create --title "feat(saas-02g-sms): per-tenant SMS provider refactor" --body "<summary with owner-review note for credential encryption review + 3 isolation suites green + Plan 04 unblocked>"
```

---

## Rollback plan

Reversible at every step:
- Task 3 migration: backward-compatible (new tables + `OrganizationSmsConfig.provider=NONE` default seeded for every existing org → legacy path still works).
- Task 7 cutover: `send-sms` flag-gated via `SMS_PROVIDER_MODE=legacy|factory`. Flip to `legacy` temporarily if the factory misbehaves in prod.
- Task 10: only removes code/env after Task 7+11 have been green in prod for 48h.

If a production incident surfaces, `git revert` the Task-10 commit (restores legacy env-based fallback) while keeping Tasks 1–9 intact. No data loss.

---

## Amendments applied during execution

> _This section is empty until execution. If reality diverges from any step, stop, document here, and await confirmation before continuing._
