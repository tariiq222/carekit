# Tenant Self-Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow new business owners to register, start a 14-day free trial, and complete a 4-step onboarding wizard — all without super-admin intervention.

**Architecture:** Single atomic backend transaction creates Organization + User + Membership + BrandingConfig + OrganizationSettings + Subscription in one shot, then issues a JWT pair. The dashboard has a standalone `/register` page and an `/onboarding` wizard (4 steps) outside the `(dashboard)` route group. A new `ExpireTrialsCron` fills the existing gap (`TRIALING → PAST_DUE`). A `TrialBanner` component sits in the dashboard layout.

**Tech Stack:** NestJS 11 / Prisma 7 / bcryptjs (backend); Next.js 15 App Router / TanStack Query v5 / React Hook Form / Zod / Tailwind 4 (dashboard); BullMQ for cron registration.

---

## File Map

### Backend — new files

| File | Purpose |
|------|---------|
| `src/modules/platform/tenant-registration/register-tenant.dto.ts` | Input DTO with class-validator decorators |
| `src/modules/platform/tenant-registration/register-tenant.handler.ts` | Single-transaction registration handler |
| `src/modules/platform/tenant-registration/register-tenant.handler.spec.ts` | Unit tests |
| `src/modules/platform/billing/expire-trials/expire-trials.cron.ts` | Hourly TRIALING → PAST_DUE cron |
| `src/modules/platform/billing/expire-trials/expire-trials.cron.spec.ts` | Unit tests |
| `src/api/public/tenants.controller.ts` | `POST /api/v1/public/tenants/register` |

### Backend — modified files

| File | Change |
|------|--------|
| `prisma/schema/platform.prisma` | Add `onboardingCompletedAt DateTime?` to `Organization` |
| `src/modules/platform/platform.module.ts` | Register `RegisterTenantHandler` |
| `src/api/public/public.module.ts` | Import `PlatformModule` (or `TenantRegistrationModule`); register `TenantsController` |
| `src/modules/ops/cron-tasks/cron-tasks.service.ts` | Add `EXPIRE_TRIALS` job + wire `ExpireTrialsCron` |
| `src/modules/ops/ops.module.ts` | Import and register `ExpireTrialsCron` |
| `src/api/dashboard/organization.controller.ts` | Add `PATCH /dashboard/organization/mark-onboarded` endpoint |

### Dashboard — new files

| File | Purpose |
|------|---------|
| `app/register/page.tsx` | Thin page shell for register route |
| `components/features/register-form.tsx` | Registration form component |
| `lib/schemas/register.schema.ts` | Zod schema for register form |
| `app/onboarding/page.tsx` | Wizard orchestrator (4 steps) |
| `components/features/onboarding/onboarding-step-1-business.tsx` | Business name + Vertical picker |
| `components/features/onboarding/onboarding-step-2-branding.tsx` | Color + Logo |
| `components/features/onboarding/onboarding-step-3-branch.tsx` | Branch + Business hours |
| `components/features/onboarding/onboarding-step-4-confirm.tsx` | Summary + Start button |
| `components/trial-banner.tsx` | Trial days remaining / upgrade prompt |
| `lib/translations/ar.register.ts` | Arabic translations for register + onboarding |
| `lib/translations/en.register.ts` | English translations for register + onboarding |

### Dashboard — modified files

| File | Change |
|------|--------|
| `lib/api/auth.ts` | Add `registerTenant()` function |
| `lib/translations/ar.ts` | Import and spread `arRegister` |
| `lib/translations/en.ts` | Import and spread `enRegister` |
| `components/providers/auth-provider.tsx` | Expose `loginWithTokens()` for post-registration |
| `app/(dashboard)/layout.tsx` | Add `<TrialBanner />` + onboarding redirect guard |

---

## Task 1: Prisma Migration — `onboardingCompletedAt`

**Files:**
- Modify: `apps/backend/prisma/schema/platform.prisma`
- Create: `apps/backend/prisma/migrations/<timestamp>_add_onboarding_completed_at/migration.sql`

- [ ] **Step 1: Add field to schema**

Open `apps/backend/prisma/schema/platform.prisma`. Find the `Organization` model (starts around line with `model Organization {`). Add the new field after `suspendedReason String?`:

```prisma
  onboardingCompletedAt DateTime?
```

The model block should now include:
```prisma
  suspendedReason       String?
  onboardingCompletedAt DateTime?
  createdAt             DateTime           @default(now())
```

- [ ] **Step 2: Run migration**

```bash
cd apps/backend
npm run prisma:migrate
# When prompted for migration name, enter: add_onboarding_completed_at
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 3: Verify migration file exists**

```bash
ls apps/backend/prisma/migrations/ | grep onboarding
```

Expected: one directory named `<timestamp>_add_onboarding_completed_at`

- [ ] **Step 4: Commit**

```bash
git add apps/backend/prisma/schema/platform.prisma apps/backend/prisma/migrations/
git commit -m "feat(db): add onboardingCompletedAt to Organization"
```

---

## Task 2: Backend — `RegisterTenantHandler`

**Files:**
- Create: `apps/backend/src/modules/platform/tenant-registration/register-tenant.dto.ts`
- Create: `apps/backend/src/modules/platform/tenant-registration/register-tenant.handler.ts`
- Create: `apps/backend/src/modules/platform/tenant-registration/register-tenant.handler.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/modules/platform/tenant-registration/register-tenant.handler.spec.ts`:

```typescript
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RegisterTenantHandler } from './register-tenant.handler';

// ── Minimal prisma mock ──────────────────────────────────────────────────────
const makePrisma = (overrides: Record<string, unknown> = {}) => ({
  $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(txMock)),
  plan: { findFirst: jest.fn().mockResolvedValue({ id: 'plan-1', isActive: true }) },
  subscription: { findFirst: jest.fn().mockResolvedValue(null) },
  ...overrides,
});

const txMock = {
  organization: { create: jest.fn().mockResolvedValue({ id: 'org-1' }) },
  user: { create: jest.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com', role: 'ADMIN', customRoleId: null, customRole: null }) },
  membership: { create: jest.fn().mockResolvedValue({ id: 'mem-1', organizationId: 'org-1' }) },
  brandingConfig: { create: jest.fn().mockResolvedValue({}) },
  organizationSettings: { create: jest.fn().mockResolvedValue({}) },
};

const makePassword = () => ({ hash: jest.fn().mockResolvedValue('hashed') });
const makeTokens = () => ({ issueTokenPair: jest.fn().mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' }) });
const makeConfig = (slug = 'BASIC', trialDays = 14) => ({
  get: jest.fn().mockImplementation((key: string, def: unknown) => {
    if (key === 'PLATFORM_DEFAULT_PLAN_SLUG') return slug;
    if (key === 'SAAS_TRIAL_DAYS') return trialDays;
    return def;
  }),
});
const makeTenant = () => ({ set: jest.fn(), requireOrganizationId: jest.fn().mockReturnValue('org-1') });
const makeCache = () => ({ invalidate: jest.fn() });
const makeStartSub = () => ({ execute: jest.fn().mockResolvedValue({ id: 'sub-1' }) });

describe('RegisterTenantHandler', () => {
  let handler: RegisterTenantHandler;
  let prisma: ReturnType<typeof makePrisma>;
  let tokens: ReturnType<typeof makeTokens>;
  let startSub: ReturnType<typeof makeStartSub>;
  let tenant: ReturnType<typeof makeTenant>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    tokens = makeTokens();
    startSub = makeStartSub();
    tenant = makeTenant();
    handler = new RegisterTenantHandler(
      prisma as never,
      makePassword() as never,
      tokens as never,
      makeConfig() as never,
      tenant as never,
      makeCache() as never,
      startSub as never,
    );
  });

  it('throws ConflictException when email already exists (P2002 on user.email)', async () => {
    const txConflict = { ...txMock, user: { create: jest.fn().mockRejectedValue({ code: 'P2002', message: 'Unique constraint failed on email' }) } };
    prisma.$transaction = jest.fn(async (cb) => cb(txConflict));
    await expect(handler.execute({ name: 'Ali', email: 'a@b.com', phone: '0501234567', password: 'Pass@1234', businessNameAr: 'عيادة' }))
      .rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when default plan not found', async () => {
    prisma.plan.findFirst = jest.fn().mockResolvedValue(null);
    await expect(handler.execute({ name: 'Ali', email: 'new@b.com', phone: '0501234567', password: 'Pass@1234', businessNameAr: 'عيادة' }))
      .rejects.toThrow(NotFoundException);
  });

  it('creates org + user + membership + branding + settings inside one transaction', async () => {
    await handler.execute({ name: 'Ali', email: 'new@b.com', phone: '0501234567', password: 'Pass@1234', businessNameAr: 'عيادة علي' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.organization.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'TRIALING', nameAr: 'عيادة علي' }),
    }));
    expect(txMock.membership.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: 'OWNER', isActive: true }),
    }));
    expect(txMock.brandingConfig.create).toHaveBeenCalled();
    expect(txMock.organizationSettings.create).toHaveBeenCalled();
  });

  it('calls StartSubscriptionHandler.execute after transaction', async () => {
    await handler.execute({ name: 'Ali', email: 'new@b.com', phone: '0501234567', password: 'Pass@1234', businessNameAr: 'عيادة' });
    expect(startSub.execute).toHaveBeenCalledWith(expect.objectContaining({ billingCycle: 'MONTHLY' }));
  });

  it('returns accessToken and refreshToken', async () => {
    const result = await handler.execute({ name: 'Ali', email: 'new@b.com', phone: '0501234567', password: 'Pass@1234', businessNameAr: 'عيادة' });
    expect(result).toMatchObject({ accessToken: 'at', refreshToken: 'rt' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/backend && npx jest src/modules/platform/tenant-registration/register-tenant.handler.spec.ts -v
```

Expected: FAIL with `Cannot find module './register-tenant.handler'`

- [ ] **Step 3: Create DTO**

Create `apps/backend/src/modules/platform/tenant-registration/register-tenant.dto.ts`:

```typescript
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterTenantDto {
  @ApiProperty({ description: 'Full name of the owner', example: 'علي محمد' })
  @IsString() @IsNotEmpty() name!: string;

  @ApiProperty({ description: 'Email address (used as login)', example: 'ali@clinic.com' })
  @IsEmail() email!: string;

  @ApiProperty({ description: 'Mobile phone number', example: '0501234567' })
  @IsString() @IsNotEmpty() phone!: string;

  @ApiProperty({ description: 'Password — min 8 chars, ≥1 uppercase, ≥1 digit', example: 'Pass@1234' })
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Z])(?=.*\d)/, { message: 'password must have at least one uppercase letter and one digit' })
  password!: string;

  @ApiProperty({ description: 'Business name in Arabic', example: 'عيادة الرعاية' })
  @IsString() @IsNotEmpty() businessNameAr!: string;

  @ApiPropertyOptional({ description: 'Business name in English', example: 'Deqah Clinic' })
  @IsOptional() @IsString() businessNameEn?: string;
}
```

- [ ] **Step 4: Create handler**

Create `apps/backend/src/modules/platform/tenant-registration/register-tenant.handler.ts`:

```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PasswordService } from '../../identity/shared/password.service';
import { TokenService } from '../../identity/shared/token.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { SubscriptionCacheService } from '../billing/subscription-cache.service';
import { StartSubscriptionHandler } from '../billing/start-subscription/start-subscription.handler';
import type { RegisterTenantDto } from './register-tenant.dto';

function slugify(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w؀-ۿ-]/g, '')
    .toLowerCase()
    .slice(0, 60);
}

@Injectable()
export class RegisterTenantHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
    private readonly startSubscription: StartSubscriptionHandler,
  ) {}

  async execute(dto: RegisterTenantDto) {
    const planSlug = this.config.get<string>('PLATFORM_DEFAULT_PLAN_SLUG', 'BASIC');
    const plan = await this.prisma.plan.findFirst({ where: { slug: planSlug, isActive: true } });
    if (!plan) throw new NotFoundException(`Default plan '${planSlug}' not found — run the seed script`);

    const trialDays = this.config.get<number>('SAAS_TRIAL_DAYS', 14);
    const trialEndsAt = new Date(Date.now() + trialDays * 86_400_000);
    const passwordHash = await this.password.hash(dto.password);
    const baseSlug = slugify(dto.businessNameAr) || 'org';

    let result: { orgId: string; userId: string; membershipId: string };

    try {
      result = await this.prisma.$transaction(async (tx) => {
        // Slugify + collision suffix
        const existingCount = await (tx as typeof this.prisma).organization.count({
          where: { slug: { startsWith: baseSlug } },
        });
        const slug = existingCount === 0 ? baseSlug : `${baseSlug}-${existingCount}`;

        const org = await tx.organization.create({
          data: {
            slug,
            nameAr: dto.businessNameAr,
            nameEn: dto.businessNameEn ?? null,
            status: 'TRIALING',
            trialEndsAt,
          },
        });

        const user = await tx.user.create({
          data: {
            email: dto.email,
            name: dto.name,
            phone: dto.phone,
            passwordHash,
            role: 'ADMIN',
            isActive: true,
          },
        });

        const membership = await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            role: 'OWNER',
            isActive: true,
            acceptedAt: new Date(),
          },
        });

        await tx.brandingConfig.create({
          data: {
            organizationId: org.id,
            organizationNameAr: dto.businessNameAr,
            organizationNameEn: dto.businessNameEn ?? null,
          },
        });

        await tx.organizationSettings.create({
          data: {
            organizationId: org.id,
            timezone: 'Asia/Riyadh',
            vatRate: 0.15,
          },
        });

        return { orgId: org.id, userId: user.id, membershipId: membership.id };
      });
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }

    // Set CLS tenant context so StartSubscriptionHandler.execute() can call requireOrganizationId()
    this.tenant.set(result.orgId);

    await this.startSubscription.execute({ planId: plan.id, billingCycle: 'MONTHLY' });

    this.cache.invalidate(result.orgId);

    const userForTokens = await this.prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
      include: { customRole: { include: { permissions: true } } },
    });

    return this.tokens.issueTokenPair(userForTokens, {
      organizationId: result.orgId,
      membershipId: result.membershipId,
      isSuperAdmin: false,
    });
  }
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/backend && npx jest src/modules/platform/tenant-registration/register-tenant.handler.spec.ts -v
```

Expected: all 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/platform/tenant-registration/
git commit -m "feat(platform): add RegisterTenantHandler with single-transaction org bootstrap"
```

---

## Task 3: Backend — `TenantsController` + wiring

**Files:**
- Create: `apps/backend/src/api/public/tenants.controller.ts`
- Modify: `apps/backend/src/api/public/public.module.ts`
- Modify: `apps/backend/src/modules/platform/platform.module.ts`

- [ ] **Step 1: Create controller**

Create `apps/backend/src/api/public/tenants.controller.ts`:

```typescript
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiCreatedResponse, ApiResponse } from '@nestjs/swagger';
import { ApiPublicResponses, ApiErrorDto } from '../../common/swagger';
import { RegisterTenantDto } from '../../modules/platform/tenant-registration/register-tenant.dto';
import { RegisterTenantHandler } from '../../modules/platform/tenant-registration/register-tenant.handler';

@ApiTags('Public / Tenants')
@ApiPublicResponses()
@Controller('tenants')
export class PublicTenantsController {
  constructor(private readonly registerTenant: RegisterTenantHandler) {}

  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new tenant organization with a 14-day free trial' })
  @ApiCreatedResponse({ description: 'Organization created; returns access + refresh tokens' })
  @ApiResponse({ status: 409, description: 'Email already registered', type: ApiErrorDto })
  async registerEndpoint(@Body() dto: RegisterTenantDto) {
    return this.registerTenant.execute(dto);
  }
}
```

- [ ] **Step 2: Register handler in PlatformModule**

Open `apps/backend/src/modules/platform/platform.module.ts`. Find the `ADMIN_HANDLERS` array and add `RegisterTenantHandler` to it. Also add the import at the top:

```typescript
import { RegisterTenantHandler } from './tenant-registration/register-tenant.handler';
```

Add to `ADMIN_HANDLERS` array (or create a separate `REGISTRATION_HANDLERS` array before the `@Module` decorator — either works):

```typescript
RegisterTenantHandler,
```

Ensure `RegisterTenantHandler` appears in both `providers` and `exports` arrays of the module.

- [ ] **Step 3: Register controller in PublicModule**

Open `apps/backend/src/api/public/public.module.ts`.

Add import:
```typescript
import { PublicTenantsController } from './tenants.controller';
```

Add to the `imports` array: `PlatformModule` (already imported in many other modules — check if it's already there; if not, add `import { PlatformModule } from '../../modules/platform/platform.module';`).

Add `PublicTenantsController` to the `controllers` array.

- [ ] **Step 4: Run typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: 0 errors

- [ ] **Step 5: Run tests**

```bash
cd apps/backend && npm run test
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/api/public/tenants.controller.ts apps/backend/src/api/public/public.module.ts apps/backend/src/modules/platform/platform.module.ts
git commit -m "feat(api): expose POST /public/tenants/register endpoint"
```

---

## Task 4: Backend — `mark-onboarded` endpoint

**Files:**
- Modify: `apps/backend/src/api/dashboard/organization.controller.ts`

- [ ] **Step 1: Add endpoint to organization controller**

Open `apps/backend/src/api/dashboard/organization.controller.ts`. Read the full file to find where other PATCH endpoints live.

Add at the end of the controller class (before the closing `}`), after existing settings endpoints:

```typescript
@Patch('mark-onboarded')
@HttpCode(HttpStatus.NO_CONTENT)
@ApiOperation({ summary: 'Mark the organization onboarding wizard as completed' })
@ApiNoContentResponse({ description: 'Onboarding marked complete' })
async markOnboardedEndpoint(@UserId() userId: string) {
  const organizationId = this.tenant.requireOrganizationId();
  await this.prisma.organization.update({
    where: { id: organizationId },
    data: { onboardingCompletedAt: new Date() },
  });
}
```

Make sure the controller already injects `PrismaService` and `TenantContextService`. If `PrismaService` is not already injected, add it to the constructor:

```typescript
constructor(
  // ... existing handlers ...
  private readonly prisma: PrismaService,
  private readonly tenant: TenantContextService,
) {}
```

And add the import at the top if missing:
```typescript
import { PrismaService } from '../../infrastructure/database';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/api/dashboard/organization.controller.ts
git commit -m "feat(api): add PATCH /dashboard/organization/mark-onboarded"
```

---

## Task 5: Backend — `ExpireTrialsCron`

**Files:**
- Create: `apps/backend/src/modules/platform/billing/expire-trials/expire-trials.cron.ts`
- Create: `apps/backend/src/modules/platform/billing/expire-trials/expire-trials.cron.spec.ts`
- Modify: `apps/backend/src/modules/ops/cron-tasks/cron-tasks.service.ts`
- Modify: `apps/backend/src/modules/ops/ops.module.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/modules/platform/billing/expire-trials/expire-trials.cron.spec.ts`:

```typescript
import { ExpireTrialsCron } from './expire-trials.cron';

const NOW = new Date('2026-05-01T12:00:00.000Z');

const buildConfig = (enabled: boolean) => ({
  get: jest.fn().mockImplementation((key: string, def: unknown) => {
    if (key === 'BILLING_CRON_ENABLED') return enabled;
    return def;
  }),
});

const buildPrisma = (orgs: Array<{ id: string }> = []) => ({
  organization: {
    findMany: jest.fn().mockResolvedValue(orgs),
    updateMany: jest.fn().mockResolvedValue({ count: orgs.length }),
  },
  subscription: {
    updateMany: jest.fn().mockResolvedValue({ count: orgs.length }),
  },
});

const buildCache = () => ({ invalidate: jest.fn() });

describe('ExpireTrialsCron', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('does nothing when BILLING_CRON_ENABLED=false', async () => {
    const prisma = buildPrisma([{ id: 'org-1' }]);
    const cron = new ExpireTrialsCron(prisma as never, buildConfig(false) as never, buildCache() as never);
    await cron.execute();
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it('does nothing when no expired trials', async () => {
    const prisma = buildPrisma([]);
    const cron = new ExpireTrialsCron(prisma as never, buildConfig(true) as never, buildCache() as never);
    await cron.execute();
    expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
  });

  it('transitions expired TRIALING orgs to PAST_DUE', async () => {
    const orgs = [{ id: 'org-1' }, { id: 'org-2' }];
    const prisma = buildPrisma(orgs);
    const cron = new ExpireTrialsCron(prisma as never, buildConfig(true) as never, buildCache() as never);
    await cron.execute();
    expect(prisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['org-1', 'org-2'] } },
      data: { status: 'PAST_DUE' },
    });
    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { organizationId: { in: ['org-1', 'org-2'] }, status: 'TRIALING' },
      data: { status: 'PAST_DUE', pastDueSince: expect.any(Date) },
    });
  });

  it('invalidates cache for each expired org', async () => {
    const orgs = [{ id: 'org-1' }, { id: 'org-2' }];
    const prisma = buildPrisma(orgs);
    const cache = buildCache();
    const cron = new ExpireTrialsCron(prisma as never, buildConfig(true) as never, cache as never);
    await cron.execute();
    expect(cache.invalidate).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/backend && npx jest src/modules/platform/billing/expire-trials/expire-trials.cron.spec.ts -v
```

Expected: FAIL with `Cannot find module './expire-trials.cron'`

- [ ] **Step 3: Implement the cron**

Create `apps/backend/src/modules/platform/billing/expire-trials/expire-trials.cron.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SubscriptionCacheService } from '../subscription-cache.service';

@Injectable()
export class ExpireTrialsCron {
  private readonly logger = new Logger(ExpireTrialsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cache: SubscriptionCacheService,
  ) {}

  async execute(): Promise<void> {
    if (!this.config.get<boolean>('BILLING_CRON_ENABLED', false)) return;

    const now = new Date();

    const expiredOrgs = await this.prisma.organization.findMany({
      where: {
        status: 'TRIALING',
        trialEndsAt: { lt: now },
      },
      select: { id: true },
    });

    if (expiredOrgs.length === 0) return;

    const orgIds = expiredOrgs.map((o) => o.id);

    await this.prisma.organization.updateMany({
      where: { id: { in: orgIds } },
      data: { status: 'PAST_DUE' },
    });

    await this.prisma.subscription.updateMany({
      where: { organizationId: { in: orgIds }, status: 'TRIALING' },
      data: { status: 'PAST_DUE', pastDueSince: now },
    });

    for (const { id } of expiredOrgs) {
      this.cache.invalidate(id);
    }

    this.logger.log(`Transitioned ${orgIds.length} expired trials to PAST_DUE`);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/backend && npx jest src/modules/platform/billing/expire-trials/expire-trials.cron.spec.ts -v
```

Expected: all 4 tests PASS

- [ ] **Step 5: Wire cron into CronTasksService**

Open `apps/backend/src/modules/ops/cron-tasks/cron-tasks.service.ts`.

Add import:
```typescript
import { ExpireTrialsCron } from '../../platform/billing/expire-trials/expire-trials.cron';
```

Add to `CRON_JOBS` constant:
```typescript
EXPIRE_TRIALS: 'expire-trials',
```

Add to constructor parameters:
```typescript
private readonly expireTrials: ExpireTrialsCron,
```

Add to `jobs` array in `registerRepeatingJobs()`:
```typescript
{ name: CRON_JOBS.EXPIRE_TRIALS, cron: '0 * * * *' }, // hourly
```

Add to the `switch` in `registerWorker()`:
```typescript
case CRON_JOBS.EXPIRE_TRIALS:
  await this.expireTrials.execute();
  break;
```

- [ ] **Step 6: Wire cron into OpsModule**

Open `apps/backend/src/modules/ops/ops.module.ts`.

Add import:
```typescript
import { ExpireTrialsCron } from '../platform/billing/expire-trials/expire-trials.cron';
```

Add to `cronHandlers` array:
```typescript
ExpireTrialsCron,
```

- [ ] **Step 7: Run typecheck + tests**

```bash
cd apps/backend && npm run typecheck && npm run test
```

Expected: 0 typecheck errors, all tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/platform/billing/expire-trials/ apps/backend/src/modules/ops/cron-tasks/cron-tasks.service.ts apps/backend/src/modules/ops/ops.module.ts
git commit -m "feat(billing): add ExpireTrialsCron to transition TRIALING → PAST_DUE"
```

---

## Task 6: Dashboard — Translations

**Files:**
- Create: `apps/dashboard/lib/translations/ar.register.ts`
- Create: `apps/dashboard/lib/translations/en.register.ts`
- Modify: `apps/dashboard/lib/translations/ar.ts`
- Modify: `apps/dashboard/lib/translations/en.ts`

- [ ] **Step 1: Create Arabic translations**

Create `apps/dashboard/lib/translations/ar.register.ts`:

```typescript
export const arRegister: Record<string, string> = {
  "register.title": "ابدأ تجربتك المجانية",
  "register.subtitle": "14 يوم مجاناً — بدون بطاقة ائتمانية",
  "register.fields.name": "الاسم الكامل",
  "register.fields.email": "البريد الإلكتروني",
  "register.fields.phone": "رقم الجوال",
  "register.fields.password": "كلمة المرور",
  "register.fields.passwordHint": "8 أحرف على الأقل، حرف كبير ورقم",
  "register.fields.businessNameAr": "اسم النشاط بالعربي",
  "register.fields.businessNameEn": "اسم النشاط بالإنجليزي (اختياري)",
  "register.cta": "إنشاء الحساب",
  "register.loading": "جاري إنشاء الحساب...",
  "register.haveAccount": "لديك حساب بالفعل؟",
  "register.signIn": "تسجيل الدخول",
  "register.error.emailTaken": "هذا البريد الإلكتروني مسجّل مسبقاً",
  "register.error.generic": "حدث خطأ، يرجى المحاولة مجدداً",

  "onboarding.title": "أهلاً، لنُعِدّ نشاطك",
  "onboarding.step1.title": "معلومات النشاط",
  "onboarding.step1.businessNameAr": "اسم النشاط بالعربي",
  "onboarding.step1.businessNameEn": "اسم النشاط بالإنجليزي (اختياري)",
  "onboarding.step1.vertical": "نوع النشاط (القطاع)",
  "onboarding.step1.verticalPlaceholder": "اختر نوع نشاطك",
  "onboarding.step2.title": "الهوية البصرية",
  "onboarding.step2.primaryColor": "اللون الرئيسي",
  "onboarding.step2.logo": "شعار النشاط",
  "onboarding.step2.logoHint": "PNG أو SVG — حتى 2MB",
  "onboarding.step2.uploadLogo": "رفع الشعار",
  "onboarding.step3.title": "الفرع الرئيسي",
  "onboarding.step3.branchName": "اسم الفرع",
  "onboarding.step3.city": "المدينة",
  "onboarding.step3.businessHours": "ساعات العمل",
  "onboarding.step3.day.0": "الأحد",
  "onboarding.step3.day.1": "الاثنين",
  "onboarding.step3.day.2": "الثلاثاء",
  "onboarding.step3.day.3": "الأربعاء",
  "onboarding.step3.day.4": "الخميس",
  "onboarding.step3.day.5": "الجمعة",
  "onboarding.step3.day.6": "السبت",
  "onboarding.step4.title": "كل شيء جاهز!",
  "onboarding.step4.trialInfo": "لديك 14 يوماً لاستكشاف كل الميزات مجاناً",
  "onboarding.step4.start": "ابدأ الآن",
  "onboarding.next": "التالي",
  "onboarding.back": "السابق",
  "onboarding.skip": "تخطّ",
  "onboarding.saving": "جاري الحفظ...",

  "trialBanner.trialing": "باقي {days} يوم في فترتك التجريبية",
  "trialBanner.trialingLastDay": "آخر يوم في فترتك التجريبية",
  "trialBanner.pastDue": "انتهت فترتك التجريبية — فعّل اشتراكك للاستمرار",
  "trialBanner.suspended": "تم إيقاف حسابك مؤقتاً",
  "trialBanner.subscribe": "اشترك الآن",
}
```

- [ ] **Step 2: Create English translations**

Create `apps/dashboard/lib/translations/en.register.ts`:

```typescript
export const enRegister: Record<string, string> = {
  "register.title": "Start your free trial",
  "register.subtitle": "14 days free — no credit card required",
  "register.fields.name": "Full name",
  "register.fields.email": "Email address",
  "register.fields.phone": "Mobile number",
  "register.fields.password": "Password",
  "register.fields.passwordHint": "At least 8 characters, one uppercase, one digit",
  "register.fields.businessNameAr": "Business name in Arabic",
  "register.fields.businessNameEn": "Business name in English (optional)",
  "register.cta": "Create account",
  "register.loading": "Creating account...",
  "register.haveAccount": "Already have an account?",
  "register.signIn": "Sign in",
  "register.error.emailTaken": "This email is already registered",
  "register.error.generic": "Something went wrong, please try again",

  "onboarding.title": "Welcome, let's set up your business",
  "onboarding.step1.title": "Business info",
  "onboarding.step1.businessNameAr": "Business name in Arabic",
  "onboarding.step1.businessNameEn": "Business name in English (optional)",
  "onboarding.step1.vertical": "Business type (vertical)",
  "onboarding.step1.verticalPlaceholder": "Choose your business type",
  "onboarding.step2.title": "Visual identity",
  "onboarding.step2.primaryColor": "Primary color",
  "onboarding.step2.logo": "Business logo",
  "onboarding.step2.logoHint": "PNG or SVG — up to 2MB",
  "onboarding.step2.uploadLogo": "Upload logo",
  "onboarding.step3.title": "Main branch",
  "onboarding.step3.branchName": "Branch name",
  "onboarding.step3.city": "City",
  "onboarding.step3.businessHours": "Business hours",
  "onboarding.step3.day.0": "Sunday",
  "onboarding.step3.day.1": "Monday",
  "onboarding.step3.day.2": "Tuesday",
  "onboarding.step3.day.3": "Wednesday",
  "onboarding.step3.day.4": "Thursday",
  "onboarding.step3.day.5": "Friday",
  "onboarding.step3.day.6": "Saturday",
  "onboarding.step4.title": "All set!",
  "onboarding.step4.trialInfo": "You have 14 days to explore all features for free",
  "onboarding.step4.start": "Get started",
  "onboarding.next": "Next",
  "onboarding.back": "Back",
  "onboarding.skip": "Skip",
  "onboarding.saving": "Saving...",

  "trialBanner.trialing": "{days} days left in your free trial",
  "trialBanner.trialingLastDay": "Last day of your free trial",
  "trialBanner.pastDue": "Your trial has ended — activate your subscription to continue",
  "trialBanner.suspended": "Your account has been suspended",
  "trialBanner.subscribe": "Subscribe now",
}
```

- [ ] **Step 3: Register translations in index files**

Open `apps/dashboard/lib/translations/ar.ts`. Add import and spread:

```typescript
import { arRegister } from "./ar.register"
```

Add `...arRegister,` to the `ar` object (after `...arZoom`).

Open `apps/dashboard/lib/translations/en.ts`. Add import and spread:

```typescript
import { enRegister } from "./en.register"
```

Add `...enRegister,` to the `en` object (after `...enZoom`).

- [ ] **Step 4: Verify i18n parity**

```bash
cd apps/dashboard && npm run i18n:verify
```

Expected: 0 parity errors

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/lib/translations/ar.register.ts apps/dashboard/lib/translations/en.register.ts apps/dashboard/lib/translations/ar.ts apps/dashboard/lib/translations/en.ts
git commit -m "feat(i18n): add register + onboarding + trial-banner translations (AR+EN)"
```

---

## Task 7: Dashboard — `registerTenant()` API function + `loginWithTokens()`

**Files:**
- Modify: `apps/dashboard/lib/api/auth.ts`
- Modify: `apps/dashboard/components/providers/auth-provider.tsx`

- [ ] **Step 1: Add `registerTenant()` to auth API**

Open `apps/dashboard/lib/api/auth.ts`. Read the full file. Add after the existing `login()` function:

```typescript
export interface RegisterTenantPayload {
  name: string
  email: string
  phone: string
  password: string
  businessNameAr: string
  businessNameEn?: string
}

export async function registerTenant(payload: RegisterTenantPayload): Promise<AuthResponse> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/tenants/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? 'Registration failed')
  }
  const data = (await res.json()) as AuthResponse
  persistAuth(data)
  return data
}
```

- [ ] **Step 2: Expose `loginWithTokens()` in AuthProvider**

Open `apps/dashboard/components/providers/auth-provider.tsx`. Read the full file.

Add `loginWithTokens` to the `AuthContextValue` interface:
```typescript
loginWithTokens: (res: AuthResponse) => void
```

Add implementation inside `AuthProvider` (after the existing `login` callback):
```typescript
const loginWithTokens = useCallback((res: AuthResponse) => {
  setUser(res.user)
  setPermissions(res.user.permissions ?? [])
  scheduleRefresh(res.expiresIn)
}, [scheduleRefresh])
```

Add to the context value object:
```typescript
loginWithTokens,
```

Add to the `useAuth()` destructure pattern (it's already typed by the interface — just adding it to the value is enough).

Import `AuthResponse` at the top if not already imported:
```typescript
import type { AuthUser, AuthResponse } from "@/lib/api/auth"
```

- [ ] **Step 3: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/lib/api/auth.ts apps/dashboard/components/providers/auth-provider.tsx
git commit -m "feat(dashboard): add registerTenant API fn + loginWithTokens to AuthProvider"
```

---

## Task 8: Dashboard — `RegisterForm` component + `/register` page

**Files:**
- Create: `apps/dashboard/lib/schemas/register.schema.ts`
- Create: `apps/dashboard/components/features/register-form.tsx`
- Create: `apps/dashboard/app/register/page.tsx`

- [ ] **Step 1: Create Zod schema**

Create `apps/dashboard/lib/schemas/register.schema.ts`:

```typescript
import { z } from "zod"

export const registerSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صحيح"),
  phone: z.string().min(9, "رقم جوال غير صحيح"),
  password: z
    .string()
    .min(8, "كلمة المرور 8 أحرف على الأقل")
    .regex(/[A-Z]/, "يجب أن تحتوي على حرف كبير")
    .regex(/[0-9]/, "يجب أن تحتوي على رقم"),
  businessNameAr: z.string().min(2, "اسم النشاط مطلوب"),
  businessNameEn: z.string().optional(),
})

export type RegisterFormValues = z.infer<typeof registerSchema>
```

- [ ] **Step 2: Create RegisterForm component**

Create `apps/dashboard/components/features/register-form.tsx`:

```typescript
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Input, Label } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { registerTenant } from "@/lib/api/auth"
import { registerSchema, type RegisterFormValues } from "@/lib/schemas/register.schema"

export function RegisterForm() {
  const { t } = useLocale()
  const { loginWithTokens } = useAuth()
  const router = useRouter()
  const [serverError, setServerError] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError("")
    try {
      const res = await registerTenant(values)
      loginWithTokens(res)
      router.push("/onboarding")
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.toLowerCase().includes("already")) {
        setServerError(t("register.error.emailTaken"))
      } else {
        setServerError(t("register.error.generic"))
      }
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
      <h1 className="mb-1 text-2xl font-bold text-foreground">{t("register.title")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("register.subtitle")}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Name */}
        <div className="space-y-1">
          <Label htmlFor="name">{t("register.fields.name")}</Label>
          <Input id="name" {...register("name")} autoComplete="name" />
          {errors.name && <p className="text-xs text-error">{errors.name.message}</p>}
        </div>

        {/* Email */}
        <div className="space-y-1">
          <Label htmlFor="email">{t("register.fields.email")}</Label>
          <Input id="email" type="email" {...register("email")} autoComplete="email" />
          {errors.email && <p className="text-xs text-error">{errors.email.message}</p>}
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <Label htmlFor="phone">{t("register.fields.phone")}</Label>
          <Input id="phone" type="tel" {...register("phone")} autoComplete="tel" />
          {errors.phone && <p className="text-xs text-error">{errors.phone.message}</p>}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <Label htmlFor="password">{t("register.fields.password")}</Label>
          <Input id="password" type="password" {...register("password")} autoComplete="new-password" />
          <p className="text-xs text-muted-foreground">{t("register.fields.passwordHint")}</p>
          {errors.password && <p className="text-xs text-error">{errors.password.message}</p>}
        </div>

        {/* Business Name AR */}
        <div className="space-y-1">
          <Label htmlFor="businessNameAr">{t("register.fields.businessNameAr")}</Label>
          <Input id="businessNameAr" {...register("businessNameAr")} />
          {errors.businessNameAr && <p className="text-xs text-error">{errors.businessNameAr.message}</p>}
        </div>

        {/* Business Name EN */}
        <div className="space-y-1">
          <Label htmlFor="businessNameEn">{t("register.fields.businessNameEn")}</Label>
          <Input id="businessNameEn" {...register("businessNameEn")} />
        </div>

        {serverError && <p className="text-sm text-error">{serverError}</p>}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t("register.loading") : t("register.cta")}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t("register.haveAccount")}{" "}
        <Link href="/" className="text-primary underline-offset-4 hover:underline">
          {t("register.signIn")}
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Create register page**

Create `apps/dashboard/app/register/page.tsx`:

```typescript
import { RegisterForm } from "@/components/features/register-form"

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <RegisterForm />
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/lib/schemas/register.schema.ts apps/dashboard/components/features/register-form.tsx apps/dashboard/app/register/page.tsx
git commit -m "feat(dashboard): add /register page with RegisterForm"
```

---

## Task 9: Dashboard — Onboarding Wizard

**Files:**
- Create: `apps/dashboard/hooks/use-verticals.ts`
- Create: `apps/dashboard/components/features/onboarding/onboarding-step-1-business.tsx`
- Create: `apps/dashboard/components/features/onboarding/onboarding-step-2-branding.tsx`
- Create: `apps/dashboard/components/features/onboarding/onboarding-step-3-branch.tsx`
- Create: `apps/dashboard/components/features/onboarding/onboarding-step-4-confirm.tsx`
- Create: `apps/dashboard/app/onboarding/page.tsx`

- [ ] **Step 1: Create `use-verticals` hook**

Create `apps/dashboard/hooks/use-verticals.ts`:

```typescript
"use client"

import { useQuery } from "@tanstack/react-query"

interface VerticalOption {
  id: string
  slug: string
  nameAr: string
  nameEn: string | null
}

async function fetchVerticals(): Promise<VerticalOption[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/verticals`, {
    credentials: "include",
  })
  if (!res.ok) throw new Error("Failed to fetch verticals")
  return res.json() as Promise<VerticalOption[]>
}

export function useVerticals() {
  return useQuery({
    queryKey: ["verticals"],
    queryFn: fetchVerticals,
    staleTime: 60 * 60 * 1000, // 1 hour — verticals rarely change
  })
}
```

- [ ] **Step 2: Create Step 1 — Business + Vertical**

Create `apps/dashboard/components/features/onboarding/onboarding-step-1-business.tsx`:

```typescript
"use client"

import { Button, Input, Label } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useVerticals } from "@/hooks/use-verticals"

export interface Step1Data {
  businessNameAr: string
  businessNameEn: string
  verticalSlug: string
}

interface Props {
  data: Step1Data
  onChange: (data: Step1Data) => void
  onNext: () => void
}

export function OnboardingStep1Business({ data, onChange, onNext }: Props) {
  const { t } = useLocale()
  const { data: verticals = [], isLoading } = useVerticals()

  const isValid = data.businessNameAr.trim().length >= 2 && data.verticalSlug.length > 0

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">{t("onboarding.step1.title")}</h2>

      <div className="space-y-1">
        <Label htmlFor="ob-nameAr">{t("onboarding.step1.businessNameAr")}</Label>
        <Input
          id="ob-nameAr"
          value={data.businessNameAr}
          onChange={(e) => onChange({ ...data, businessNameAr: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="ob-nameEn">{t("onboarding.step1.businessNameEn")}</Label>
        <Input
          id="ob-nameEn"
          value={data.businessNameEn}
          onChange={(e) => onChange({ ...data, businessNameEn: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="ob-vertical">{t("onboarding.step1.vertical")}</Label>
        <select
          id="ob-vertical"
          value={data.verticalSlug}
          onChange={(e) => onChange({ ...data, verticalSlug: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          disabled={isLoading}
        >
          <option value="">{t("onboarding.step1.verticalPlaceholder")}</option>
          {verticals.map((v) => (
            <option key={v.slug} value={v.slug}>
              {v.nameAr}
            </option>
          ))}
        </select>
      </div>

      <Button className="w-full" onClick={onNext} disabled={!isValid}>
        {t("onboarding.next")}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Create Step 2 — Branding**

Create `apps/dashboard/components/features/onboarding/onboarding-step-2-branding.tsx`:

```typescript
"use client"

import { Button, Input, Label } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"

export interface Step2Data {
  primaryColor: string
  logoUrl: string
}

interface Props {
  data: Step2Data
  onChange: (data: Step2Data) => void
  onNext: () => void
  onBack: () => void
}

export function OnboardingStep2Branding({ data, onChange, onNext, onBack }: Props) {
  const { t } = useLocale()

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">{t("onboarding.step2.title")}</h2>

      <div className="space-y-1">
        <Label htmlFor="ob-color">{t("onboarding.step2.primaryColor")}</Label>
        <div className="flex items-center gap-3">
          <input
            id="ob-color"
            type="color"
            value={data.primaryColor || "#354FD8"}
            onChange={(e) => onChange({ ...data, primaryColor: e.target.value })}
            className="h-10 w-16 cursor-pointer rounded-lg border border-border bg-background"
          />
          <Input
            value={data.primaryColor || "#354FD8"}
            onChange={(e) => onChange({ ...data, primaryColor: e.target.value })}
            className="flex-1 font-mono"
            maxLength={7}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>{t("onboarding.step2.logo")}</Label>
        <p className="text-xs text-muted-foreground">{t("onboarding.step2.logoHint")}</p>
        <Button variant="outline" type="button" className="w-full">
          {t("onboarding.step2.uploadLogo")}
        </Button>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          {t("onboarding.back")}
        </Button>
        <Button className="flex-1" onClick={onNext}>
          {t("onboarding.next")}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create Step 3 — Branch + Hours**

Create `apps/dashboard/components/features/onboarding/onboarding-step-3-branch.tsx`:

```typescript
"use client"

import { Button, Input, Label } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"

export interface DayHours {
  enabled: boolean
  open: string
  close: string
}

export interface Step3Data {
  branchName: string
  city: string
  hours: Record<number, DayHours>
}

const defaultHours = (): Record<number, DayHours> =>
  Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map((d) => [d, { enabled: d >= 0 && d <= 4, open: "09:00", close: "18:00" }])
  )

export const defaultStep3Data: Step3Data = {
  branchName: "",
  city: "",
  hours: defaultHours(),
}

interface Props {
  data: Step3Data
  onChange: (data: Step3Data) => void
  onNext: () => void
  onBack: () => void
}

export function OnboardingStep3Branch({ data, onChange, onNext, onBack }: Props) {
  const { t } = useLocale()

  const isValid = data.branchName.trim().length >= 2 && data.city.trim().length >= 2

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">{t("onboarding.step3.title")}</h2>

      <div className="space-y-1">
        <Label htmlFor="ob-branch">{t("onboarding.step3.branchName")}</Label>
        <Input
          id="ob-branch"
          value={data.branchName}
          onChange={(e) => onChange({ ...data, branchName: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="ob-city">{t("onboarding.step3.city")}</Label>
        <Input
          id="ob-city"
          value={data.city}
          onChange={(e) => onChange({ ...data, city: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("onboarding.step3.businessHours")}</Label>
        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
          const h = data.hours[day]
          return (
            <div key={day} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={h.enabled}
                onChange={(e) =>
                  onChange({
                    ...data,
                    hours: { ...data.hours, [day]: { ...h, enabled: e.target.checked } },
                  })
                }
                className="size-4 cursor-pointer"
              />
              <span className="w-20 text-sm text-foreground">{t(`onboarding.step3.day.${day}`)}</span>
              {h.enabled && (
                <>
                  <Input
                    type="time"
                    value={h.open}
                    onChange={(e) =>
                      onChange({ ...data, hours: { ...data.hours, [day]: { ...h, open: e.target.value } } })
                    }
                    className="w-28"
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="time"
                    value={h.close}
                    onChange={(e) =>
                      onChange({ ...data, hours: { ...data.hours, [day]: { ...h, close: e.target.value } } })
                    }
                    className="w-28"
                  />
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          {t("onboarding.back")}
        </Button>
        <Button className="flex-1" onClick={onNext} disabled={!isValid}>
          {t("onboarding.next")}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create Step 4 — Confirm**

Create `apps/dashboard/components/features/onboarding/onboarding-step-4-confirm.tsx`:

```typescript
"use client"

import { Button } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"

interface Props {
  onStart: () => void
  onBack: () => void
  isLoading: boolean
}

export function OnboardingStep4Confirm({ onStart, onBack, isLoading }: Props) {
  const { t } = useLocale()

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success/10">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success" />
        </svg>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground">{t("onboarding.step4.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("onboarding.step4.trialInfo")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Button className="w-full" onClick={onStart} disabled={isLoading}>
          {isLoading ? t("onboarding.saving") : t("onboarding.step4.start")}
        </Button>
        <Button variant="outline" className="w-full" onClick={onBack} disabled={isLoading}>
          {t("onboarding.back")}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create the wizard page orchestrator**

Create `apps/dashboard/app/onboarding/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/auth-provider"
import { OnboardingStep1Business, type Step1Data } from "@/components/features/onboarding/onboarding-step-1-business"
import { OnboardingStep2Branding, type Step2Data } from "@/components/features/onboarding/onboarding-step-2-branding"
import { OnboardingStep3Branch, defaultStep3Data, type Step3Data } from "@/components/features/onboarding/onboarding-step-3-branch"
import { OnboardingStep4Confirm } from "@/components/features/onboarding/onboarding-step-4-confirm"
import { getAccessToken } from "@/lib/api"

const API = process.env.NEXT_PUBLIC_API_URL

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  const [step1, setStep1] = useState<Step1Data>({ businessNameAr: "", businessNameEn: "", verticalSlug: "" })
  const [step2, setStep2] = useState<Step2Data>({ primaryColor: "#354FD8", logoUrl: "" })
  const [step3, setStep3] = useState<Step3Data>(defaultStep3Data)

  if (!user) {
    router.replace("/")
    return null
  }

  const authHeader = { Authorization: `Bearer ${getAccessToken() ?? ""}`, "Content-Type": "application/json" }

  const handleStep1Next = async () => {
    setIsLoading(true)
    try {
      await fetch(`${API}/api/v1/dashboard/organization/branding`, {
        method: "POST",
        headers: authHeader,
        credentials: "include",
        body: JSON.stringify({ organizationNameAr: step1.businessNameAr, organizationNameEn: step1.businessNameEn || null }),
      })
      if (step1.verticalSlug) {
        await fetch(`${API}/api/v1/public/verticals/${step1.verticalSlug}/seed`, {
          method: "POST",
          headers: authHeader,
          credentials: "include",
        })
      }
    } finally {
      setIsLoading(false)
    }
    setStep(2)
  }

  const handleStep2Next = async () => {
    setIsLoading(true)
    try {
      await fetch(`${API}/api/v1/dashboard/organization/branding`, {
        method: "POST",
        headers: authHeader,
        credentials: "include",
        body: JSON.stringify({ primaryColor: step2.primaryColor, logoUrl: step2.logoUrl || null }),
      })
    } finally {
      setIsLoading(false)
    }
    setStep(3)
  }

  const handleStep3Next = async () => {
    setIsLoading(true)
    try {
      const branchRes = await fetch(`${API}/api/v1/dashboard/organization/branches`, {
        method: "POST",
        headers: authHeader,
        credentials: "include",
        body: JSON.stringify({ nameAr: step3.branchName, city: step3.city, isMain: true }),
      })
      const branch = await branchRes.json() as { id: string }
      const enabledDays = Object.entries(step3.hours)
        .filter(([, h]) => h.enabled)
        .map(([day, h]) => ({ dayOfWeek: Number(day), startTime: h.open, endTime: h.close }))
      if (enabledDays.length > 0) {
        await fetch(`${API}/api/v1/dashboard/organization/branches/${branch.id}/hours`, {
          method: "PUT",
          headers: authHeader,
          credentials: "include",
          body: JSON.stringify({ hours: enabledDays }),
        })
      }
    } finally {
      setIsLoading(false)
    }
    setStep(4)
  }

  const handleStart = async () => {
    setIsLoading(true)
    try {
      await fetch(`${API}/api/v1/dashboard/organization/mark-onboarded`, {
        method: "PATCH",
        headers: authHeader,
        credentials: "include",
      })
      router.push("/")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="mb-6 flex justify-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-2 w-8 rounded-full transition-colors ${n <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {step === 1 && (
            <OnboardingStep1Business data={step1} onChange={setStep1} onNext={handleStep1Next} />
          )}
          {step === 2 && (
            <OnboardingStep2Branding data={step2} onChange={setStep2} onNext={handleStep2Next} onBack={() => setStep(1)} />
          )}
          {step === 3 && (
            <OnboardingStep3Branch data={step3} onChange={setStep3} onNext={handleStep3Next} onBack={() => setStep(2)} />
          )}
          {step === 4 && (
            <OnboardingStep4Confirm onStart={handleStart} onBack={() => setStep(3)} isLoading={isLoading} />
          )}
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 7: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck
```

Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/hooks/use-verticals.ts apps/dashboard/components/features/onboarding/ apps/dashboard/app/onboarding/
git commit -m "feat(dashboard): add 4-step onboarding wizard"
```

---

## Task 10: Dashboard — `TrialBanner` + dashboard layout guard

**Files:**
- Create: `apps/dashboard/components/trial-banner.tsx`
- Modify: `apps/dashboard/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create TrialBanner**

Create `apps/dashboard/components/trial-banner.tsx`:

```typescript
"use client"

import Link from "next/link"
import { useBilling } from "@/lib/billing/billing-context"
import { useLocale } from "@/components/locale-provider"

export function TrialBanner() {
  const { status, subscription } = useBilling()
  const { t } = useLocale()

  if (!status || status === "ACTIVE" || status === "CANCELED") return null

  if (status === "TRIALING" && subscription?.trialEndsAt) {
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / 86_400_000)
    )
    const message =
      daysLeft <= 1
        ? t("trialBanner.trialingLastDay")
        : t("trialBanner.trialing").replace("{days}", String(daysLeft))

    return (
      <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-sm text-warning">
        {message}
        {" · "}
        <Link href="/settings/billing" className="font-medium underline underline-offset-4">
          {t("trialBanner.subscribe")}
        </Link>
      </div>
    )
  }

  if (status === "PAST_DUE" || status === "SUSPENDED") {
    const message = status === "SUSPENDED" ? t("trialBanner.suspended") : t("trialBanner.pastDue")
    return (
      <div className="border-b border-error/30 bg-error/10 px-4 py-2 text-center text-sm text-error">
        {message}
        {" · "}
        <Link href="/settings/billing" className="font-medium underline underline-offset-4">
          {t("trialBanner.subscribe")}
        </Link>
      </div>
    )
  }

  return null
}
```

- [ ] **Step 2: Add TrialBanner + onboarding guard to dashboard layout**

Open `apps/dashboard/app/(dashboard)/layout.tsx`. Read the full file.

Add import at the top:
```typescript
import { TrialBanner } from "@/components/trial-banner"
```

The layout currently wraps in `AuthGate > BillingShell > SidebarProvider`. We need to:

1. Add the onboarding guard inside `AuthGate` (after user is confirmed) but it needs access to user data. We'll use `AuthGate` to check via the `useAuth()` hook and redirect. The cleanest pattern is a new `OnboardingGuard` component.

Add a new component at the top of the file (above `DashboardLayout`):

```typescript
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/auth-provider"

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && !(user as unknown as { onboardingCompletedAt?: string }).onboardingCompletedAt) {
      router.replace("/onboarding")
    }
  }, [user, router])

  return <>{children}</>
}
```

Update `DashboardLayout` to include `TrialBanner` and `OnboardingGuard`:

```typescript
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <OnboardingGuard>
        <BillingShell>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="min-h-0 relative z-[1]">
              <Header />
              <TrialBanner />
              <div className="flex-1 overflow-y-auto p-4 md:px-8 md:py-7">
                {children}
              </div>
              <CommandPalette />
            </SidebarInset>
            <MobileSidebarTrigger />
          </SidebarProvider>
        </BillingShell>
      </OnboardingGuard>
    </AuthGate>
  )
}
```

- [ ] **Step 3: Expose `onboardingCompletedAt` from `/auth/me` endpoint**

The `/auth/me` response currently returns the user profile but the `onboardingCompletedAt` is on `Organization`, not `User`. We need to surface it. Open `apps/backend/src/modules/identity/get-current-user/get-current-user.handler.ts` and check what it returns. If it doesn't include the org's `onboardingCompletedAt`, we need to add it.

Read the file:
```bash
cat apps/backend/src/modules/identity/get-current-user/get-current-user.handler.ts
```

If it does not include organization data, add a query for `membership.organization.onboardingCompletedAt` and include it in the return. The pattern: in the handler's `execute()`, after fetching the user, fetch the active membership and include `organization: { select: { onboardingCompletedAt: true } }`.

Add to the return value: `onboardingCompletedAt: membership?.organization?.onboardingCompletedAt ?? null`.

Also update `apps/dashboard/lib/api/auth.ts` — the `AuthUser` type (imported from `@deqah/api-client`) may need an update. Check `packages/api-client/src/` to add `onboardingCompletedAt?: string | null` to `UserPayload`.

- [ ] **Step 4: Run typecheck**

```bash
cd apps/dashboard && npm run typecheck && cd ../backend && npm run typecheck
```

Expected: 0 errors in both

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/trial-banner.tsx apps/dashboard/app/\(dashboard\)/layout.tsx
git commit -m "feat(dashboard): add TrialBanner + onboarding redirect guard to dashboard layout"
```

---

## Task 11: End-to-end smoke test + i18n verification

- [ ] **Step 1: Run backend tests**

```bash
cd apps/backend && npm run test
```

Expected: all tests pass, coverage thresholds met (≥40% branch, ≥50% fn/line)

- [ ] **Step 2: Run dashboard typecheck + lint**

```bash
cd apps/dashboard && npm run typecheck && npm run lint
```

Expected: 0 errors, 0 warnings

- [ ] **Step 3: Verify i18n parity**

```bash
cd apps/dashboard && npm run i18n:verify
```

Expected: 0 parity drift

- [ ] **Step 4: Start dev servers and manual QA**

```bash
# Terminal 1
cd apps/backend && npm run dev

# Terminal 2
cd apps/dashboard && npm run dev
```

**Manual QA checklist:**
1. Navigate to `http://localhost:5103/register`
2. Fill out the form with valid data — confirm redirect to `/onboarding`
3. Complete the 4 wizard steps — confirm redirect to dashboard
4. Check that the trial banner appears in the dashboard header
5. Try registering with the same email again — confirm 409 error message appears
6. Open Network tab — confirm `POST /api/v1/public/tenants/register` returns 201 with accessToken
7. Try navigating to `/(dashboard)/` without completing onboarding — confirm redirect to `/onboarding`

- [ ] **Step 5: Commit final state**

```bash
git add .
git commit -m "feat(self-signup): complete tenant self-signup + onboarding wizard + trial banner"
```

---

## Deqah Plan Notes

- **Path**: STANDARD (multi-file, no worktree required)
- **Owner-only touches**: none — this feature does not touch payments, ZATCA, or auth secrets
- **Migration**: `add_onboarding_completed_at_to_organization` — single nullable column addition; rollback = `ALTER TABLE "Organization" DROP COLUMN "onboardingCompletedAt"` — add to `apps/backend/prisma/NOTES.md`
- **i18n**: AR+EN added in Task 6 (`ar.register.ts` / `en.register.ts`) — verified by `npm run i18n:verify`
- **No Page Anatomy law** — `/register` and `/onboarding` are not list pages
- **Kiwi TestPlan**: `Deqah / Identity / Manual QA`
- **Semantic tokens**: all — no hex colors in components (`bg-warning/10`, `text-error`, etc.)
- **staleTime**: set on `useVerticals` (1 hour)
