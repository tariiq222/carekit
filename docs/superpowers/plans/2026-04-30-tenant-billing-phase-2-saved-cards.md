# Tenant Billing Phase 2 Saved Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenant-facing multi-card saved payment methods for SaaS billing, with one default card, tenant isolation, Moyasar token verification, and a dashboard payment-methods page.

**Architecture:** Extend the existing `platform/billing` vertical slice without rewriting billing. `SavedCard` is tenant-scoped and becomes the source of truth for reusable Moyasar tokens; during Phase 2, handlers also keep `Subscription.moyasarCardTokenRef` synchronized with the default card so Phase 1 trial conversion and existing charge crons keep working. Raw PAN/CVC never reaches Deqah; the browser uses Moyasar.js tokenization with a `pk_*` key and sends only `token_*` to the backend.

**Tech Stack:** NestJS 11, Prisma 7 split schema, PostgreSQL RLS, class-validator DTOs, Moyasar REST API, Next.js 15 App Router, React 19, TanStack Query, Tailwind 4, Vitest/Jest.

---

## Contract Decisions

- Use `SavedCard.isDefault` plus a partial unique index as the primary one-default-per-org invariant.
- Add `Subscription.defaultSavedCardId` for admin/debug readability, but do not rely on it alone.
- Add `SavedCard` to `SCOPED_MODELS` and RLS in the same migration.
- Use `NEXT_PUBLIC_MOYASAR_PLATFORM_PUBLISHABLE_KEY` in `apps/dashboard/.env.example`; never expose `MOYASAR_PLATFORM_SECRET_KEY`.
- Moyasar docs list a minimum card payment amount of `100` halalas. The product spec says `0.50 SAR`; implementation should use `SAVED_CARD_VERIFICATION_AMOUNT_HALALAS = 100` unless sandbox evidence proves `50` is accepted. UI copy must say "small verification charge" instead of hardcoding `0.50 SAR`.
- Delete behavior: if the card is the last saved card and the subscription is `ACTIVE`, `TRIALING`, or `PAST_DUE`, return HTTP 422. If a default non-last card is removed, auto-promote the newest remaining card.

## File Structure

Backend:
- Modify: `apps/backend/prisma/schema/platform.prisma`
- Create: `apps/backend/prisma/migrations/20260430130000_tenant_billing_saved_cards/migration.sql`
- Modify: `apps/backend/src/infrastructure/database/prisma.service.ts`
- Modify: `apps/backend/src/modules/finance/moyasar-api/moyasar-subscription.client.ts`
- Create: `apps/backend/src/modules/platform/billing/dto/saved-card.dto.ts`
- Create: `apps/backend/src/modules/platform/billing/saved-cards/list-saved-cards.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/saved-cards/add-saved-card.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/saved-cards/set-default-saved-card.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/saved-cards/remove-saved-card.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/saved-cards/saved-cards.handlers.spec.ts`
- Modify: `apps/backend/src/modules/platform/billing/billing.module.ts`
- Modify: `apps/backend/src/api/dashboard/billing.controller.ts`
- Create: `apps/backend/src/api/dashboard/billing.controller.spec.ts`

Dashboard:
- Modify: `apps/dashboard/.env.example`
- Modify: `apps/dashboard/lib/types/billing.ts`
- Modify: `apps/dashboard/lib/api/billing.ts`
- Modify: `apps/dashboard/hooks/use-current-subscription.ts`
- Modify: `apps/dashboard/lib/translations/en.billing.ts`
- Modify: `apps/dashboard/lib/translations/ar.billing.ts`
- Create: `apps/dashboard/app/(dashboard)/settings/billing/payment-methods/page.tsx`
- Create: `apps/dashboard/app/(dashboard)/settings/billing/payment-methods/components/add-card-dialog.tsx`
- Create: `apps/dashboard/app/(dashboard)/settings/billing/payment-methods/components/set-default-card-dialog.tsx`
- Create: `apps/dashboard/app/(dashboard)/settings/billing/payment-methods/components/remove-card-dialog.tsx`
- Create: `apps/dashboard/test/unit/components/billing-payment-methods.spec.tsx`

## Task 1: SavedCard Schema, RLS, and Tenant Scoping

**Files:**
- Modify: `apps/backend/prisma/schema/platform.prisma`
- Create: `apps/backend/prisma/migrations/20260430130000_tenant_billing_saved_cards/migration.sql`
- Modify: `apps/backend/src/infrastructure/database/prisma.service.ts`
- Test: `apps/backend/prisma/schema/platform.prisma`

- [ ] **Step 1: Add the Prisma model and Subscription default field**

Add this to the billing section of `platform.prisma` near `Subscription`:

```prisma
model SavedCard {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  moyasarTokenId String       @unique
  last4          String
  brand          String
  expiryMonth    Int
  expiryYear     Int
  holderName     String?
  isDefault      Boolean      @default(false)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  defaultForSubscriptions Subscription[] @relation("SubscriptionDefaultSavedCard")
  invoices                SubscriptionInvoice[]

  @@index([organizationId])
  @@index([organizationId, isDefault])
}
```

Add fields to `Subscription`:

```prisma
  defaultSavedCardId String?
  defaultSavedCard   SavedCard? @relation("SubscriptionDefaultSavedCard", fields: [defaultSavedCardId], references: [id], onDelete: SetNull)
```

Add field to `SubscriptionInvoice`:

```prisma
  savedCardId String?
  savedCard   SavedCard? @relation(fields: [savedCardId], references: [id], onDelete: SetNull)
```

Add to `Organization`:

```prisma
  savedCards SavedCard[]
```

- [ ] **Step 2: Create migration with RLS and default-card uniqueness**

Create `apps/backend/prisma/migrations/20260430130000_tenant_billing_saved_cards/migration.sql`:

```sql
ALTER TABLE "Subscription" ADD COLUMN "defaultSavedCardId" TEXT;

CREATE TABLE "SavedCard" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "moyasarTokenId" TEXT NOT NULL,
  "last4" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "expiryMonth" INTEGER NOT NULL,
  "expiryYear" INTEGER NOT NULL,
  "holderName" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedCard_moyasarTokenId_key" ON "SavedCard"("moyasarTokenId");
CREATE INDEX "SavedCard_organizationId_idx" ON "SavedCard"("organizationId");
CREATE INDEX "SavedCard_organizationId_isDefault_idx" ON "SavedCard"("organizationId", "isDefault");
CREATE UNIQUE INDEX "SavedCard_one_default_per_org_idx"
  ON "SavedCard"("organizationId")
  WHERE "isDefault" = true;

ALTER TABLE "SavedCard"
  ADD CONSTRAINT "SavedCard_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_defaultSavedCardId_fkey"
  FOREIGN KEY ("defaultSavedCardId") REFERENCES "SavedCard"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubscriptionInvoice" ADD COLUMN "savedCardId" TEXT;
ALTER TABLE "SubscriptionInvoice"
  ADD CONSTRAINT "SubscriptionInvoice_savedCardId_fkey"
  FOREIGN KEY ("savedCardId") REFERENCES "SavedCard"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SavedCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedCard" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_saved_card ON "SavedCard";
CREATE POLICY tenant_isolation_saved_card ON "SavedCard"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
```

- [ ] **Step 3: Add `SavedCard` to `SCOPED_MODELS`**

In `apps/backend/src/infrastructure/database/prisma.service.ts`, add:

```ts
  'SavedCard',
```

near the existing billing entries:

```ts
  'Subscription',
  'UsageRecord',
  'SavedCard',
```

- [ ] **Step 4: Verify schema**

Run:

```bash
npm run prisma:generate --workspace=backend
npm run prisma:validate --workspace=backend
```

Expected: both commands exit `0`; validate prints `The schemas at prisma/schema are valid`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema/platform.prisma \
  apps/backend/prisma/migrations/20260430130000_tenant_billing_saved_cards/migration.sql \
  apps/backend/src/infrastructure/database/prisma.service.ts
git commit -m "feat(billing): add saved card schema"
```

## Task 2: Moyasar Token Metadata and Verification Helpers

**Files:**
- Modify: `apps/backend/src/modules/finance/moyasar-api/moyasar-subscription.client.ts`
- Test: `apps/backend/src/modules/platform/billing/saved-cards/saved-cards.handlers.spec.ts`

- [ ] **Step 1: Write failing tests around add-card external calls**

Create `apps/backend/src/modules/platform/billing/saved-cards/saved-cards.handlers.spec.ts` with the first `AddSavedCardHandler` tests:

```ts
import { UnprocessableEntityException } from '@nestjs/common';
import { AddSavedCardHandler } from './add-saved-card.handler';

const tokenMeta = {
  id: 'token_abc',
  brand: 'visa',
  last4: '1111',
  expiryMonth: 12,
  expiryYear: 2030,
  holderName: 'Clinic Owner',
  verified: true,
};

function buildAddHarness() {
  const prisma = {
    savedCard: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'card-1', ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    subscription: {
      findUnique: jest.fn().mockResolvedValue({ id: 'sub-1', status: 'TRIALING' }),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(async (fn) => fn(prisma)),
  };
  const tenant = { requireOrganizationId: jest.fn().mockReturnValue('org-1') };
  const cache = { invalidate: jest.fn() };
  const moyasar = {
    getToken: jest.fn().mockResolvedValue(tokenMeta),
    chargeWithToken: jest.fn().mockResolvedValue({ id: 'pay_1', status: 'paid' }),
    refundPayment: jest.fn().mockResolvedValue({ id: 'ref_1', amount: 100, status: 'refunded' }),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'BACKEND_URL' ? 'https://api.webvue.pro' : undefined,
    ),
  };
  const handler = new AddSavedCardHandler(prisma as never, tenant as never, cache as never, moyasar as never, config as never);
  return { handler, prisma, cache, moyasar, config };
}

describe('AddSavedCardHandler', () => {
  it('fetches token metadata, verifies with Moyasar charge/refund, and creates default card', async () => {
    const { handler, prisma, moyasar, cache } = buildAddHarness();

    await handler.execute({ moyasarTokenId: 'token_abc', makeDefault: true });

    expect(moyasar.getToken).toHaveBeenCalledWith('token_abc');
    expect(moyasar.chargeWithToken).toHaveBeenCalledWith(expect.objectContaining({
      token: 'token_abc',
      amount: 100,
      currency: 'SAR',
      idempotencyKey: expect.stringMatching(/^saved-card-verify:org-1:/),
    }));
    expect(moyasar.refundPayment).toHaveBeenCalledWith(expect.objectContaining({
      paymentId: 'pay_1',
      amountHalalas: 100,
    }));
    expect(prisma.savedCard.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: 'org-1',
        moyasarTokenId: 'token_abc',
        last4: '1111',
        brand: 'visa',
        isDefault: true,
      }),
    }));
    expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org-1' },
      data: expect.objectContaining({
        defaultSavedCardId: 'card-1',
        moyasarCardTokenRef: 'token_abc',
      }),
    }));
    expect(cache.invalidate).toHaveBeenCalledWith('org-1');
  });

  it('rejects expired token metadata before creating card', async () => {
    const { handler, prisma, moyasar } = buildAddHarness();
    moyasar.getToken.mockResolvedValue({ ...tokenMeta, expiryYear: 2020 });

    await expect(handler.execute({ moyasarTokenId: 'token_old' })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.savedCard.create).not.toHaveBeenCalled();
  });
});
```

Run:

```bash
npm run test --workspace=backend -- src/modules/platform/billing/saved-cards/saved-cards.handlers.spec.ts --runInBand
```

Expected: fails because `add-saved-card.handler.ts` and `MoyasarSubscriptionClient.getToken` do not exist.

- [ ] **Step 2: Add Moyasar client methods**

In `apps/backend/src/modules/finance/moyasar-api/moyasar-subscription.client.ts`, add:

```ts
export interface MoyasarTokenMetadata {
  id: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  holderName: string | null;
  verified: boolean;
}
```

Then add methods:

```ts
async getToken(tokenId: string): Promise<MoyasarTokenMetadata> {
  const secretKey = this.config.getOrThrow<string>('MOYASAR_PLATFORM_SECRET_KEY');
  const response = await fetch(`https://api.moyasar.com/v1/tokens/${tokenId}`, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Moyasar token fetch failed: ${response.status} ${text}`);
  }

  const data = await response.json() as {
    id: string;
    brand?: string;
    last4?: string;
    last_four?: string;
    expiry_month?: number;
    expiry_year?: number;
    month?: number;
    year?: number;
    name?: string | null;
    verified?: boolean;
  };

  return {
    id: data.id,
    brand: data.brand ?? 'unknown',
    last4: data.last4 ?? data.last_four ?? '',
    expiryMonth: data.expiry_month ?? data.month ?? 0,
    expiryYear: data.expiry_year ?? data.year ?? 0,
    holderName: data.name ?? null,
    verified: data.verified ?? false,
  };
}

async deleteToken(tokenId: string): Promise<void> {
  const secretKey = this.config.getOrThrow<string>('MOYASAR_PLATFORM_SECRET_KEY');
  const response = await fetch(`https://api.moyasar.com/v1/tokens/${tokenId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
    },
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`Moyasar token delete failed: ${response.status} ${text}`);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/finance/moyasar-api/moyasar-subscription.client.ts \
  apps/backend/src/modules/platform/billing/saved-cards/saved-cards.handlers.spec.ts
git commit -m "feat(billing): add Moyasar saved-card token helpers"
```

## Task 3: Saved Card Handlers

**Files:**
- Create: `apps/backend/src/modules/platform/billing/dto/saved-card.dto.ts`
- Create: `apps/backend/src/modules/platform/billing/saved-cards/list-saved-cards.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/saved-cards/add-saved-card.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/saved-cards/set-default-saved-card.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/saved-cards/remove-saved-card.handler.ts`
- Modify: `apps/backend/src/modules/platform/billing/saved-cards/saved-cards.handlers.spec.ts`

- [ ] **Step 1: Add DTOs**

Create `apps/backend/src/modules/platform/billing/dto/saved-card.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class AddSavedCardDto {
  @ApiProperty({ example: 'token_abc123' })
  @IsString()
  @Matches(/^token_[A-Za-z0-9_-]+$/)
  moyasarTokenId!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  makeDefault?: boolean;
}
```

- [ ] **Step 2: Add list handler**

Create `list-saved-cards.handler.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';

@Injectable()
export class ListSavedCardsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  execute() {
    const organizationId = this.tenant.requireOrganizationId();
    return this.prisma.savedCard.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        brand: true,
        last4: true,
        expiryMonth: true,
        expiryYear: true,
        holderName: true,
        isDefault: true,
        createdAt: true,
      },
    });
  }
}
```

- [ ] **Step 3: Add create/default handler**

Create `add-saved-card.handler.ts`:

```ts
import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { MoyasarSubscriptionClient } from '../../../finance/moyasar-api/moyasar-subscription.client';

const SAVED_CARD_VERIFICATION_AMOUNT_HALALAS = 100;
const BILLABLE_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE'] as const;

export interface AddSavedCardCommand {
  moyasarTokenId: string;
  makeDefault?: boolean;
}

@Injectable()
export class AddSavedCardHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
    private readonly moyasar: MoyasarSubscriptionClient,
    private readonly config: ConfigService,
  ) {}

  async execute(cmd: AddSavedCardCommand) {
    const organizationId = this.tenant.requireOrganizationId();
    const token = await this.moyasar.getToken(cmd.moyasarTokenId);
    this.assertUsableToken(token.expiryMonth, token.expiryYear);

    const existing = await this.prisma.savedCard.findMany({
      where: { organizationId, moyasarTokenId: cmd.moyasarTokenId },
      select: { id: true },
    });
    if (existing.length > 0) throw new ConflictException('saved_card_already_exists');

    const verification = await this.moyasar.chargeWithToken({
      token: cmd.moyasarTokenId,
      amount: SAVED_CARD_VERIFICATION_AMOUNT_HALALAS,
      currency: 'SAR',
      idempotencyKey: `saved-card-verify:${organizationId}:${randomUUID()}`,
      description: 'Deqah saved card verification',
      callbackUrl: this.billingCallbackUrl(),
    });

    if (verification.status.toLowerCase() !== 'paid') {
      throw new UnprocessableEntityException('saved_card_verification_failed');
    }

    await this.moyasar.refundPayment({
      paymentId: verification.id,
      amountHalalas: SAVED_CARD_VERIFICATION_AMOUNT_HALALAS,
      idempotencyKey: `saved-card-refund:${verification.id}`,
    });

    const cards = await this.prisma.savedCard.findMany({
      where: { organizationId },
      select: { id: true },
    });
    const shouldDefault = cmd.makeDefault === true || cards.length === 0;

    const created = await this.prisma.$transaction(async (tx) => {
      if (shouldDefault) {
        await tx.savedCard.updateMany({
          where: { organizationId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const card = await tx.savedCard.create({
        data: {
          organizationId,
          moyasarTokenId: token.id,
          last4: token.last4,
          brand: token.brand,
          expiryMonth: token.expiryMonth,
          expiryYear: token.expiryYear,
          holderName: token.holderName,
          isDefault: shouldDefault,
        },
      });

      if (shouldDefault) {
        await tx.subscription.update({
          where: { organizationId },
          data: {
            defaultSavedCardId: card.id,
            moyasarCardTokenRef: card.moyasarTokenId,
          },
        });
      }

      return card;
    });

    this.cache.invalidate(organizationId);
    return created;
  }

  private assertUsableToken(expiryMonth: number, expiryYear: number): void {
    const now = new Date();
    const expiresAt = new Date(expiryYear, expiryMonth, 1);
    if (expiryMonth < 1 || expiryMonth > 12 || expiresAt <= now) {
      throw new UnprocessableEntityException('saved_card_expired');
    }
  }

  private billingCallbackUrl(): string {
    const base =
      this.config.get<string>('BACKEND_URL') ??
      this.config.get<string>('DASHBOARD_PUBLIC_URL', '');
    return `${base.replace(/\/+$/, '')}/api/v1/public/billing/webhooks/moyasar`;
  }
}
```

- [ ] **Step 4: Add set-default handler**

Create `set-default-saved-card.handler.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { SubscriptionCacheService } from '../subscription-cache.service';

@Injectable()
export class SetDefaultSavedCardHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
  ) {}

  async execute(cardId: string) {
    const organizationId = this.tenant.requireOrganizationId();
    const card = await this.prisma.savedCard.findFirst({
      where: { id: cardId, organizationId },
    });
    if (!card) throw new NotFoundException('saved_card_not_found');

    await this.prisma.$transaction(async (tx) => {
      await tx.savedCard.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
      await tx.savedCard.update({
        where: { id: card.id },
        data: { isDefault: true },
      });
      await tx.subscription.update({
        where: { organizationId },
        data: {
          defaultSavedCardId: card.id,
          moyasarCardTokenRef: card.moyasarTokenId,
        },
      });
    });

    this.cache.invalidate(organizationId);
    return { ok: true };
  }
}
```

- [ ] **Step 5: Add remove handler**

Create `remove-saved-card.handler.ts`:

```ts
import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { MoyasarSubscriptionClient } from '../../../finance/moyasar-api/moyasar-subscription.client';

const BILLABLE_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE'] as const;

@Injectable()
export class RemoveSavedCardHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
    private readonly moyasar: MoyasarSubscriptionClient,
  ) {}

  async execute(cardId: string) {
    const organizationId = this.tenant.requireOrganizationId();
    const cards = await this.prisma.savedCard.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    const card = cards.find((item) => item.id === cardId);
    if (!card) throw new NotFoundException('saved_card_not_found');

    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
      select: { status: true },
    });
    const hasActiveSubscription =
      sub ? BILLABLE_STATUSES.includes(sub.status as (typeof BILLABLE_STATUSES)[number]) : false;
    if (cards.length === 1 && hasActiveSubscription) {
      throw new UnprocessableEntityException('cannot_delete_last_card_with_active_subscription');
    }

    const replacement = card.isDefault
      ? cards.find((item) => item.id !== card.id) ?? null
      : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.savedCard.delete({ where: { id: card.id } });
      if (replacement) {
        await tx.savedCard.update({ where: { id: replacement.id }, data: { isDefault: true } });
        await tx.subscription.update({
          where: { organizationId },
          data: {
            defaultSavedCardId: replacement.id,
            moyasarCardTokenRef: replacement.moyasarTokenId,
          },
        });
      }
      if (!replacement && card.isDefault) {
        await tx.subscription.update({
          where: { organizationId },
          data: { defaultSavedCardId: null, moyasarCardTokenRef: null },
        });
      }
    });

    await this.moyasar.deleteToken(card.moyasarTokenId);
    this.cache.invalidate(organizationId);
    return { ok: true };
  }
}
```

- [ ] **Step 6: Extend handler tests**

Extend `saved-cards.handlers.spec.ts` with tests for:

```ts
it('lists cards for the current organization newest/default first', async () => {
  const { handler, prisma } = buildListHarness();

  await handler.execute();

  expect(prisma.savedCard.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { organizationId: 'org-1' },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  }));
});

it('sets exactly one default card and syncs Subscription token fields', async () => {
  const { handler, prisma, cache } = buildSetDefaultHarness();

  await handler.execute('card-2');

  expect(prisma.savedCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { organizationId: 'org-1', isDefault: true },
    data: { isDefault: false },
  }));
  expect(prisma.savedCard.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 'card-2', organizationId: 'org-1' },
    data: { isDefault: true },
  }));
  expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { organizationId: 'org-1' },
    data: { defaultSavedCardId: 'card-2', moyasarCardTokenRef: 'token_2' },
  }));
  expect(cache.invalidate).toHaveBeenCalledWith('org-1');
});

it('blocks deleting the last card when subscription is ACTIVE', async () => {
  const { handler, prisma, moyasar } = buildRemoveHarness({
    cardCount: 1,
    subscriptionStatus: 'ACTIVE',
  });

  await expect(handler.execute('card-1')).rejects.toMatchObject({ response: 'last_saved_card_required' });
  expect(prisma.savedCard.delete).not.toHaveBeenCalled();
  expect(moyasar.deleteToken).not.toHaveBeenCalled();
});

it('auto-promotes newest remaining card when deleting the default card', async () => {
  const { handler, prisma } = buildRemoveHarness({
    cardCount: 2,
    deletingDefault: true,
    replacement: { id: 'card-2', moyasarTokenId: 'token_2' },
  });

  await handler.execute('card-1');

  expect(prisma.savedCard.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 'card-2', organizationId: 'org-1' },
    data: { isDefault: true },
  }));
  expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { organizationId: 'org-1' },
    data: { defaultSavedCardId: 'card-2', moyasarCardTokenRef: 'token_2' },
  }));
});

it('deletes the Moyasar token after DB deletion succeeds', async () => {
  const { handler, prisma, moyasar } = buildRemoveHarness({ cardCount: 2 });

  await handler.execute('card-1');

  expect(prisma.savedCard.delete).toHaveBeenCalledWith({
    where: { id: 'card-1', organizationId: 'org-1' },
  });
  expect(moyasar.deleteToken).toHaveBeenCalledWith('token_1');
});
```

Each test must assert the Prisma `where: { organizationId: 'org-1' }` filter is present on reads.

- [ ] **Step 7: Run handler tests**

```bash
npm run test --workspace=backend -- src/modules/platform/billing/saved-cards/saved-cards.handlers.spec.ts --runInBand
```

Expected: all saved-card handler tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/platform/billing/dto/saved-card.dto.ts \
  apps/backend/src/modules/platform/billing/saved-cards \
  apps/backend/src/modules/finance/moyasar-api/moyasar-subscription.client.ts
git commit -m "feat(billing): manage saved cards"
```

## Task 4: Dashboard Billing API Endpoints

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/billing.module.ts`
- Modify: `apps/backend/src/api/dashboard/billing.controller.ts`
- Create: `apps/backend/src/api/dashboard/billing.controller.spec.ts`

- [ ] **Step 1: Register handlers in BillingModule**

Import and add these providers:

```ts
import { ListSavedCardsHandler } from './saved-cards/list-saved-cards.handler';
import { AddSavedCardHandler } from './saved-cards/add-saved-card.handler';
import { SetDefaultSavedCardHandler } from './saved-cards/set-default-saved-card.handler';
import { RemoveSavedCardHandler } from './saved-cards/remove-saved-card.handler';
```

Add to `HANDLERS`:

```ts
  ListSavedCardsHandler,
  AddSavedCardHandler,
  SetDefaultSavedCardHandler,
  RemoveSavedCardHandler,
```

- [ ] **Step 2: Add controller routes**

Modify `BillingController` imports:

```ts
import { Delete, Param, Patch } from "@nestjs/common";
import { AddSavedCardDto } from "../../modules/platform/billing/dto/saved-card.dto";
import { ListSavedCardsHandler } from "../../modules/platform/billing/saved-cards/list-saved-cards.handler";
import { AddSavedCardHandler } from "../../modules/platform/billing/saved-cards/add-saved-card.handler";
import { SetDefaultSavedCardHandler } from "../../modules/platform/billing/saved-cards/set-default-saved-card.handler";
import { RemoveSavedCardHandler } from "../../modules/platform/billing/saved-cards/remove-saved-card.handler";
```

Inject handlers:

```ts
    private readonly listSavedCards: ListSavedCardsHandler,
    private readonly addSavedCard: AddSavedCardHandler,
    private readonly setDefaultSavedCard: SetDefaultSavedCardHandler,
    private readonly removeSavedCard: RemoveSavedCardHandler,
```

Add routes:

```ts
  @Get("saved-cards")
  @ApiOperation({ summary: "List saved billing cards" })
  savedCards() {
    return this.listSavedCards.execute();
  }

  @Post("saved-cards")
  @ApiOperation({ summary: "Add a saved billing card" })
  addCard(@Body() dto: AddSavedCardDto) {
    return this.addSavedCard.execute(dto);
  }

  @Patch("saved-cards/:id/set-default")
  @HttpCode(200)
  @ApiOperation({ summary: "Set saved billing card as default" })
  setDefaultCard(@Param("id") id: string) {
    return this.setDefaultSavedCard.execute(id);
  }

  @Delete("saved-cards/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Remove a saved billing card" })
  removeCard(@Param("id") id: string) {
    return this.removeSavedCard.execute(id);
  }
```

- [ ] **Step 3: Controller smoke test**

Create `apps/backend/src/api/dashboard/billing.controller.spec.ts`:

```ts
it('delegates saved-card routes to handlers', async () => {
  expect(await controller.savedCards()).toEqual([{ id: 'card-1' }]);
  expect(listSavedCards.execute).toHaveBeenCalled();
  await controller.addCard({ moyasarTokenId: 'token_abc', makeDefault: true });
  expect(addSavedCard.execute).toHaveBeenCalledWith({ moyasarTokenId: 'token_abc', makeDefault: true });
  await controller.setDefaultCard('card-1');
  expect(setDefaultSavedCard.execute).toHaveBeenCalledWith('card-1');
  await controller.removeCard('card-1');
  expect(removeSavedCard.execute).toHaveBeenCalledWith('card-1');
});
```

- [ ] **Step 4: Run backend route tests**

```bash
npm run test --workspace=backend -- src/api/dashboard/billing.controller.spec.ts src/modules/platform/billing/saved-cards/saved-cards.handlers.spec.ts --runInBand
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/platform/billing/billing.module.ts \
  apps/backend/src/api/dashboard/billing.controller.ts \
  apps/backend/src/api/dashboard/billing.controller.spec.ts
git commit -m "feat(billing): expose saved card endpoints"
```

## Task 5: Dashboard API, Types, Hooks, and Env

**Files:**
- Modify: `apps/dashboard/.env.example`
- Modify: `apps/dashboard/lib/types/billing.ts`
- Modify: `apps/dashboard/lib/api/billing.ts`
- Modify: `apps/dashboard/hooks/use-current-subscription.ts`
- Test: `apps/dashboard/test/unit/lib/billing-api.spec.ts`

- [ ] **Step 1: Add publishable key env example**

Append to `apps/dashboard/.env.example`:

```bash
# Platform SaaS billing cards. Public pk_* key only; never expose sk_* here.
NEXT_PUBLIC_MOYASAR_PLATFORM_PUBLISHABLE_KEY=pk_test_change-me
```

- [ ] **Step 2: Add frontend types**

In `apps/dashboard/lib/types/billing.ts`, add:

```ts
export interface SavedCard {
  id: string
  brand: string
  last4: string
  expiryMonth: number
  expiryYear: number
  holderName?: string | null
  isDefault: boolean
  createdAt: string
}
```

- [ ] **Step 3: Add API methods**

In `apps/dashboard/lib/api/billing.ts`:

```ts
import type { Plan, Subscription, BillingCycle, SavedCard } from "@/lib/types/billing"
```

Add:

```ts
  savedCards: () =>
    api.get<SavedCard[]>('/dashboard/billing/saved-cards'),

  addSavedCard: (dto: { moyasarTokenId: string; makeDefault?: boolean }) =>
    api.post<SavedCard>('/dashboard/billing/saved-cards', dto),

  setDefaultSavedCard: (id: string) =>
    api.patch<{ ok: true }>(`/dashboard/billing/saved-cards/${id}/set-default`, {}),

  removeSavedCard: (id: string) =>
    api.delete<{ ok: true }>(`/dashboard/billing/saved-cards/${id}`),
```

- [ ] **Step 4: Add hooks**

In `apps/dashboard/hooks/use-current-subscription.ts`, extend keys:

```ts
  savedCards: () => ['billing', 'saved-cards'] as const,
```

Add:

```ts
export function useSavedCards() {
  return useQuery({
    queryKey: BILLING_KEYS.savedCards(),
    queryFn: () => billingApi.savedCards(),
  })
}
```

Add mutations to `useBillingMutations()`:

```ts
  const addSavedCardMut = useMutation({
    mutationFn: (dto: { moyasarTokenId: string; makeDefault?: boolean }) =>
      billingApi.addSavedCard(dto),
    onSuccess: invalidate,
  })

  const setDefaultSavedCardMut = useMutation({
    mutationFn: (id: string) => billingApi.setDefaultSavedCard(id),
    onSuccess: invalidate,
  })

  const removeSavedCardMut = useMutation({
    mutationFn: (id: string) => billingApi.removeSavedCard(id),
    onSuccess: invalidate,
  })
```

Return them:

```ts
return {
  startMut,
  upgradeMut,
  downgradeMut,
  cancelMut,
  resumeMut,
  addSavedCardMut,
  setDefaultSavedCardMut,
  removeSavedCardMut,
}
```

- [ ] **Step 5: Add API unit test**

Create `apps/dashboard/test/unit/lib/billing-api.spec.ts`:

```ts
import { describe, expect, it, vi } from "vitest"
import { billingApi } from "@/lib/api/billing"
import { api } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe("billingApi saved cards", () => {
  it("calls saved card endpoints", async () => {
    await billingApi.savedCards()
    expect(api.get).toHaveBeenCalledWith("/dashboard/billing/saved-cards")

    await billingApi.addSavedCard({ moyasarTokenId: "token_abc", makeDefault: true })
    expect(api.post).toHaveBeenCalledWith("/dashboard/billing/saved-cards", {
      moyasarTokenId: "token_abc",
      makeDefault: true,
    })

    await billingApi.setDefaultSavedCard("card-1")
    expect(api.patch).toHaveBeenCalledWith("/dashboard/billing/saved-cards/card-1/set-default", {})

    await billingApi.removeSavedCard("card-1")
    expect(api.delete).toHaveBeenCalledWith("/dashboard/billing/saved-cards/card-1")
  })
})
```

- [ ] **Step 6: Run frontend API test**

```bash
npm run test --workspace=dashboard -- test/unit/lib/billing-api.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/.env.example \
  apps/dashboard/lib/types/billing.ts \
  apps/dashboard/lib/api/billing.ts \
  apps/dashboard/hooks/use-current-subscription.ts \
  apps/dashboard/test/unit/lib/billing-api.spec.ts
git commit -m "feat(dashboard): add saved card client API"
```

## Task 6: Payment Methods Page and Dialogs

**Files:**
- Create: `apps/dashboard/app/(dashboard)/settings/billing/payment-methods/page.tsx`
- Create: `apps/dashboard/app/(dashboard)/settings/billing/payment-methods/components/add-card-dialog.tsx`
- Create: `apps/dashboard/app/(dashboard)/settings/billing/payment-methods/components/set-default-card-dialog.tsx`
- Create: `apps/dashboard/app/(dashboard)/settings/billing/payment-methods/components/remove-card-dialog.tsx`
- Modify: `apps/dashboard/lib/translations/en.billing.ts`
- Modify: `apps/dashboard/lib/translations/ar.billing.ts`
- Test: `apps/dashboard/test/unit/components/billing-payment-methods.spec.tsx`

- [ ] **Step 1: Write failing component test**

Create `apps/dashboard/test/unit/components/billing-payment-methods.spec.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach } from "vitest"
import PaymentMethodsPage from "@/app/(dashboard)/settings/billing/payment-methods/page"

const { useLocale, useSavedCards, useBillingMutations } = vi.hoisted(() => ({
  useLocale: vi.fn(),
  useSavedCards: vi.fn(),
  useBillingMutations: vi.fn(),
}))

vi.mock("@/components/locale-provider", () => ({ useLocale }))
vi.mock("@/hooks/use-current-subscription", () => ({ useSavedCards, useBillingMutations }))
vi.mock("@/components/features/breadcrumbs", () => ({ Breadcrumbs: () => <div>Breadcrumbs</div> }))
vi.mock("@/components/features/list-page-shell", () => ({ ListPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock("@/components/features/page-header", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }))

describe("PaymentMethodsPage", () => {
  const setDefault = vi.fn()
  const remove = vi.fn()

  beforeEach(() => {
    setDefault.mockReset()
    remove.mockReset()
    useLocale.mockReturnValue({
      locale: "en",
      t: (key: string) => ({
        "billing.paymentMethods.title": "Payment methods",
        "billing.paymentMethods.description": "Manage cards used for Deqah subscription billing.",
        "billing.paymentMethods.add": "Add card",
        "billing.paymentMethods.default": "Default",
        "billing.paymentMethods.setDefault": "Set default",
        "billing.paymentMethods.remove": "Remove",
        "billing.paymentMethods.empty": "No saved cards yet.",
        "billing.paymentMethods.confirmSetDefault": "Use this card for future invoices?",
        "billing.paymentMethods.confirmRemove": "Remove this saved card?",
        "billing.actions.confirm": "Confirm",
      })[key] ?? key,
    })
    useBillingMutations.mockReturnValue({
      setDefaultSavedCardMut: { mutateAsync: setDefault, isPending: false },
      removeSavedCardMut: { mutateAsync: remove, isPending: false },
      addSavedCardMut: { mutateAsync: vi.fn(), isPending: false },
    })
  })

  it("renders saved cards with default badge", () => {
    useSavedCards.mockReturnValue({
      isLoading: false,
      data: [{ id: "card-1", brand: "visa", last4: "1111", expiryMonth: 12, expiryYear: 2030, isDefault: true }],
    })

    render(<PaymentMethodsPage />)

    expect(screen.getByRole("heading", { name: "Payment methods" })).toBeInTheDocument()
    expect(screen.getByText(/1111/)).toBeInTheDocument()
    expect(screen.getByText("Default")).toBeInTheDocument()
  })

  it("opens confirmation before setting a non-default card as default", async () => {
    useSavedCards.mockReturnValue({
      isLoading: false,
      data: [{ id: "card-2", brand: "mastercard", last4: "2222", expiryMonth: 10, expiryYear: 2031, isDefault: false }],
    })

    render(<PaymentMethodsPage />)
    await userEvent.click(screen.getByRole("button", { name: "Set default" }))
    expect(screen.getByRole("dialog", { name: "Set default" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }))

    expect(setDefault).toHaveBeenCalledWith("card-2")
  })

  it("opens confirmation before removing a saved card", async () => {
    useSavedCards.mockReturnValue({
      isLoading: false,
      data: [{ id: "card-3", brand: "visa", last4: "3333", expiryMonth: 9, expiryYear: 2032, isDefault: false }],
    })

    render(<PaymentMethodsPage />)
    await userEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(screen.getByRole("dialog", { name: "Remove" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }))

    expect(remove).toHaveBeenCalledWith("card-3")
  })
})
```

Run:

```bash
npm run test --workspace=dashboard -- test/unit/components/billing-payment-methods.spec.tsx
```

Expected: FAIL because page does not exist.

- [ ] **Step 2: Add translations**

Add keys to `en.billing.ts`:

```ts
  "billing.paymentMethods.title": "Payment methods",
  "billing.paymentMethods.description": "Manage cards used for Deqah subscription billing.",
  "billing.paymentMethods.add": "Add card",
  "billing.paymentMethods.default": "Default",
  "billing.paymentMethods.setDefault": "Set default",
  "billing.paymentMethods.remove": "Remove",
  "billing.paymentMethods.empty": "No saved cards yet.",
  "billing.paymentMethods.smallVerification": "A small verification charge is refunded immediately.",
  "billing.paymentMethods.cardNumber": "Card number",
  "billing.paymentMethods.cardHolder": "Cardholder name",
  "billing.paymentMethods.expiryMonth": "Month",
  "billing.paymentMethods.expiryYear": "Year",
  "billing.paymentMethods.cvc": "CVC",
  "billing.paymentMethods.confirmSetDefault": "Use this card for future invoices?",
  "billing.paymentMethods.confirmRemove": "Remove this saved card?",
```

Add matching Arabic keys to `ar.billing.ts`.

- [ ] **Step 3: Add page with three dialogs**

Create `apps/dashboard/app/(dashboard)/settings/billing/payment-methods/page.tsx` with:

```tsx
"use client"

import { useState } from "react"
import { Badge, Button, Card, Input, Skeleton } from "@deqah/ui"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { useLocale } from "@/components/locale-provider"
import { useBillingMutations, useSavedCards } from "@/hooks/use-current-subscription"
import type { SavedCard } from "@/lib/types/billing"

function formatCard(card: SavedCard) {
  return `${card.brand.toUpperCase()} •••• ${card.last4}`
}

export default function PaymentMethodsPage() {
  const { t } = useLocale()
  const { data: cards = [], isLoading } = useSavedCards()
  const { setDefaultSavedCardMut, removeSavedCardMut } = useBillingMutations()
  const [addOpen, setAddOpen] = useState(false)
  const [defaultCard, setDefaultCard] = useState<SavedCard | null>(null)
  const [removeCard, setRemoveCard] = useState<SavedCard | null>(null)

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("billing.paymentMethods.title")}
        description={t("billing.paymentMethods.description")}
        action={<Button onClick={() => setAddOpen(true)}>{t("billing.paymentMethods.add")}</Button>}
      />

      <div className="space-y-3">
        {isLoading && <Skeleton className="h-28 w-full" />}
        {!isLoading && cards.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">{t("billing.paymentMethods.empty")}</Card>
        )}
        {cards.map((card) => (
          <Card key={card.id} className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{formatCard(card)}</p>
                {card.isDefault && <Badge variant="outline">{t("billing.paymentMethods.default")}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {String(card.expiryMonth).padStart(2, "0")} / {card.expiryYear}
              </p>
            </div>
            <div className="flex gap-2">
              {!card.isDefault && (
                <Button size="sm" variant="outline" onClick={() => setDefaultCard(card)}>
                  {t("billing.paymentMethods.setDefault")}
                </Button>
              )}
              <Button size="sm" variant="outline" className="text-error hover:text-error" onClick={() => setRemoveCard(card)}>
                {t("billing.paymentMethods.remove")}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {addOpen && <AddCardDialog open={addOpen} onOpenChange={setAddOpen} />}
      {defaultCard && (
        <SetDefaultCardDialog
          card={defaultCard}
          onOpenChange={(open) => {
            if (!open) setDefaultCard(null)
          }}
          onConfirm={async () => {
            await setDefaultSavedCardMut.mutateAsync(defaultCard.id)
            setDefaultCard(null)
          }}
        />
      )}
      {removeCard && (
        <RemoveCardDialog
          card={removeCard}
          onOpenChange={(open) => {
            if (!open) setRemoveCard(null)
          }}
          onConfirm={async () => {
            await removeSavedCardMut.mutateAsync(removeCard.id)
            setRemoveCard(null)
          }}
        />
      )}
    </ListPageShell>
  )
}

function SetDefaultCardDialog({
  card,
  onConfirm,
  onOpenChange,
}: {
  card: SavedCard
  onConfirm: () => Promise<void>
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useLocale()
  return (
    <ConfirmCardDialog
      title={t("billing.paymentMethods.setDefault")}
      body={`${t("billing.paymentMethods.confirmSetDefault")} ${formatCard(card)}`}
      confirmLabel={t("billing.actions.confirm")}
      onCancel={() => onOpenChange(false)}
      onConfirm={onConfirm}
    />
  )
}

function RemoveCardDialog({
  card,
  onConfirm,
  onOpenChange,
}: {
  card: SavedCard
  onConfirm: () => Promise<void>
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useLocale()
  return (
    <ConfirmCardDialog
      title={t("billing.paymentMethods.remove")}
      body={`${t("billing.paymentMethods.confirmRemove")} ${formatCard(card)}`}
      confirmLabel={t("billing.actions.confirm")}
      onCancel={() => onOpenChange(false)}
      onConfirm={onConfirm}
    />
  )
}

function ConfirmCardDialog({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string
  body: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  const { t } = useLocale()
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>{t("billing.actions.back")}</Button>
          <Button type="button" onClick={() => void onConfirm()}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}

function AddCardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useLocale()
  const { addSavedCardMut } = useBillingMutations()
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const token = await tokenizeWithMoyasar(event.currentTarget)
    await addSavedCardMut.mutateAsync({ moyasarTokenId: token.id, makeDefault: true })
    onOpenChange(false)
  }

  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
      <form onSubmit={(event) => void submit(event)} className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">{t("billing.paymentMethods.add")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("billing.paymentMethods.smallVerification")}</p>
        <input type="hidden" name="publishable_api_key" value={process.env.NEXT_PUBLIC_MOYASAR_PLATFORM_PUBLISHABLE_KEY ?? ""} />
        <input type="hidden" name="save_only" value="true" />
        <div className="mt-4 grid gap-3">
          <Input name="name" placeholder={t("billing.paymentMethods.cardHolder")} autoComplete="cc-name" />
          <Input name="number" placeholder={t("billing.paymentMethods.cardNumber")} inputMode="numeric" autoComplete="cc-number" dir="ltr" />
          <div className="grid grid-cols-3 gap-2">
            <Input name="month" placeholder={t("billing.paymentMethods.expiryMonth")} inputMode="numeric" autoComplete="cc-exp-month" dir="ltr" />
            <Input name="year" placeholder={t("billing.paymentMethods.expiryYear")} inputMode="numeric" autoComplete="cc-exp-year" dir="ltr" />
            <Input name="cvc" placeholder={t("billing.paymentMethods.cvc")} inputMode="numeric" autoComplete="cc-csc" dir="ltr" />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-error">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("billing.actions.back")}</Button>
          <Button type="submit" disabled={addSavedCardMut.isPending}>{t("billing.paymentMethods.add")}</Button>
        </div>
      </form>
    </div>
  )

  async function tokenizeWithMoyasar(form: HTMLFormElement): Promise<{ id: string }> {
    const moyasar = await loadMoyasar()
    return moyasar.tokenize(form)
  }

  async function loadMoyasar(): Promise<{ tokenize: (form: HTMLFormElement) => Promise<{ id: string }> }> {
    if (typeof window === "undefined") throw new Error("moyasar_browser_only")
    const existing = (window as Window & { Moyasar?: { tokenize: (form: HTMLFormElement) => Promise<{ id: string }> } }).Moyasar
    if (existing) return existing
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script")
      script.src = "https://cdn.moyasar.com/mpf/1.15.0/moyasar.js"
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("moyasar_script_failed"))
      document.head.appendChild(script)
    })
    const loaded = (window as Window & { Moyasar?: { tokenize: (form: HTMLFormElement) => Promise<{ id: string }> } }).Moyasar
    if (!loaded) throw new Error("moyasar_unavailable")
    return loaded
  }
}
```

Keep the route under the 350-line project rule by moving the three dialog functions into:

- `components/add-card-dialog.tsx`
- `components/set-default-card-dialog.tsx`
- `components/remove-card-dialog.tsx`

- [ ] **Step 4: Run component test**

```bash
npm run test --workspace=dashboard -- test/unit/components/billing-payment-methods.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/app/'(dashboard)'/settings/billing/payment-methods/page.tsx \
  apps/dashboard/app/'(dashboard)'/settings/billing/payment-methods/components \
  apps/dashboard/lib/translations/en.billing.ts \
  apps/dashboard/lib/translations/ar.billing.ts \
  apps/dashboard/test/unit/components/billing-payment-methods.spec.tsx
git commit -m "feat(dashboard): add billing payment methods page"
```

## Task 7: Verification and Handoff

**Files:**
- Review all files changed in this branch.

- [ ] **Step 1: Run backend verification**

```bash
npm run prisma:generate --workspace=backend
npm run prisma:validate --workspace=backend
npm run test --workspace=backend -- src/modules/platform/billing/saved-cards/saved-cards.handlers.spec.ts src/api/dashboard/billing.controller.spec.ts --runInBand
npm run typecheck --workspace=backend
npx eslint src/modules/platform/billing/saved-cards/*.ts src/modules/platform/billing/dto/saved-card.dto.ts src/api/dashboard/billing.controller.ts src/modules/platform/billing/billing.module.ts src/modules/finance/moyasar-api/moyasar-subscription.client.ts
```

Expected: all commands exit `0`.

- [ ] **Step 2: Run dashboard verification**

```bash
npm run test --workspace=dashboard -- test/unit/lib/billing-api.spec.ts test/unit/components/billing-payment-methods.spec.tsx
npm run typecheck --workspace=dashboard
npm run i18n:verify --workspace=dashboard
npm run lint --workspace=dashboard -- .env.example lib/types/billing.ts lib/api/billing.ts hooks/use-current-subscription.ts app/'(dashboard)'/settings/billing/payment-methods/page.tsx test/unit/components/billing-payment-methods.spec.tsx test/unit/lib/billing-api.spec.ts lib/translations/en.billing.ts lib/translations/ar.billing.ts
```

Expected: all commands exit `0`.

- [ ] **Step 3: Manual QA notes**

If backend and dashboard can be started locally, run:

```bash
npm run dev:backend
npm run dev:dashboard
```

Then use the browser to verify:

1. `/settings/billing/payment-methods` shows empty state.
2. Add-card dialog loads Moyasar.js and tokenizes with a `pk_test_*` key.
3. A tokenized card appears as default.
4. A second card can be added and set as default.
5. Removing the last active-subscription card shows the backend 422 error.

Record manual QA in `docs/superpowers/qa/billing-phase-2-report-2026-04-30.md` only after real browser verification.

- [ ] **Step 4: Final branch status**

```bash
git status --short --branch
git log --oneline main..HEAD
```

Expected: clean worktree and 4-6 focused commits on `feat/tenant-billing-phase-2`.

## Self-Review

- Spec coverage: covers Phase 2 SavedCard schema, RLS, 4 handlers, saved-card endpoints, payment-methods page, add/set-default/remove flows, and Moyasar tokenization boundary.
- Intentional defer: admin read-only saved-card views and DunningLog are Phase 5/9, not Phase 2.
- Risk note: verification charge amount uses `100` halalas because Moyasar reference says minimum `100`; if product requires exactly `50`, verify against Moyasar sandbox before implementation.
- No raw card data crosses into backend; only `token_*` is sent to Deqah.
