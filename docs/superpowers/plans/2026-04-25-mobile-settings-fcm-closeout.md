# Mobile Settings Sync + FCM Closeout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two real remaining gaps in the mobile↔backend wiring audit (2026-04-25): (1) persist client preferences (`preferredLocale`, `pushEnabled`) on the server so they survive re-install and govern push behavior; (2) make FCM push notifications actually work end-to-end — token registration on login, token storage on backend, lookup at send time, respect of `pushEnabled`, unregistration on logout.

**Architecture:**
- **Backend:** add two columns to `Client` (`preferredLocale`, `pushEnabled`) and a new tenant-scoped `FcmToken` model in the comms cluster. Two new endpoints under `mobile/client/notifications` (POST/DELETE `fcm-token`) using vertical slices. Update reminder/cancellation/payment-failed reaction handlers to fetch tokens from DB and skip when `pushEnabled=false`.
- **Mobile:** extend `clientProfileService` to PATCH the new fields. `settings.tsx` PATCHes on toggle in addition to writing AsyncStorage. Wire `registerForPushAsync()` after login/OTP/register success and on app start (when authed). Wire `unregisterPushAsync()` on logout. Fix the mobile call path for fcm-token to match the new endpoint.
- **Out of scope (separate plans):** employee video-call (Zoom SDK), invoice mapper (dashboard).

**Tech Stack:** NestJS 11, Prisma 7, React Native 0.83 / Expo SDK 55, expo-notifications, expo-device, Redux Toolkit, AsyncStorage. Backend cluster: `comms/`. Mobile services: `services/client/profile.ts`, `services/notifications.ts`, `services/push.ts`.

---

## File Structure

### Backend (apps/backend)

**Create**
- `prisma/migrations/20260425200000_client_preferences_and_fcm_tokens/migration.sql` — adds `Client.preferredLocale`, `Client.pushEnabled`, and `FcmToken` table.
- `src/modules/comms/fcm-tokens/register-fcm-token.dto.ts`
- `src/modules/comms/fcm-tokens/register-fcm-token.handler.ts`
- `src/modules/comms/fcm-tokens/register-fcm-token.handler.spec.ts`
- `src/modules/comms/fcm-tokens/unregister-fcm-token.handler.ts`
- `src/modules/comms/fcm-tokens/unregister-fcm-token.handler.spec.ts`
- `src/modules/comms/fcm-tokens/get-client-push-targets.handler.ts` — returns `{ tokens, pushEnabled }` for a client.
- `src/modules/comms/fcm-tokens/get-client-push-targets.handler.spec.ts`

**Modify**
- `prisma/schema/people.prisma` — extend `Client` model.
- `prisma/schema/comms.prisma` — add `FcmToken` model.
- `src/modules/people/clients/update-client.dto.ts` — accept `preferredLocale`, `pushEnabled`.
- `src/modules/people/clients/update-client.handler.ts` — write the new fields.
- `src/modules/people/clients/client.serializer.ts` — expose the new fields.
- `src/api/mobile/client/profile.controller.ts` — extend `MobileUpdateProfileBody`.
- `src/api/mobile/client/notifications.controller.ts` — add POST + DELETE `fcm-token`.
- `src/modules/comms/comms.module.ts` — register the three new handlers and export them.
- `src/infrastructure/database/prisma.service.ts` — add `FcmToken` to `SCOPED_MODELS`.
- `src/modules/comms/events/on-booking-reminder.handler.ts` — fetch tokens via `GetClientPushTargetsHandler`; respect `pushEnabled`.
- `src/modules/comms/events/on-booking-cancelled.handler.ts` — same.
- `src/modules/comms/events/on-payment-failed.handler.ts` — same.
- `src/modules/comms/events/on-group-session-payment-links-ready.handler.ts` — same if it pushes.

### Mobile (apps/mobile)

**Modify**
- `services/client/profile.ts` — add `preferredLocale`, `pushEnabled` to `ClientProfileUpdate` + `ClientProfile`.
- `services/notifications.ts` — fix path: `/mobile/client/notifications/fcm-token`.
- `app/(client)/settings.tsx` — call `clientProfileService.updateProfile` on language change and on push toggle, alongside AsyncStorage writes.
- `app/(auth)/login.tsx` — fire-and-forget `registerForPushAsync()` after `setCredentials`.
- `app/(auth)/otp-verify.tsx` — same.
- `app/(auth)/register.tsx` — same.
- `app/_layout.tsx` — on mount, if Redux has a hydrated user, call `registerForPushAsync()`.
- `stores/slices/auth-slice.ts` — no logic change; document that `logout()` consumers must also call `unregisterPushAsync()`.
- `app/(client)/(tabs)/profile.tsx` — wrap the existing `dispatch(logout())` so it awaits `unregisterPushAsync()` first.

**Create**
- `services/__tests__/push-callsite.test.ts` (optional — only if the existing `push.test.ts` does not cover the call sites).

---

## Tasks

### Task 1: Backend — extend Prisma schema (Client + FcmToken)

**Files:**
- Modify: `apps/backend/prisma/schema/people.prisma:34-76`
- Modify: `apps/backend/prisma/schema/comms.prisma`

- [ ] **Step 1: Add preference columns to `Client`**

Edit `apps/backend/prisma/schema/people.prisma`, inside `model Client { ... }`, after the existing `notes` line:

```prisma
  preferredLocale   String?           @db.VarChar(8)
  pushEnabled       Boolean           @default(true)
```

- [ ] **Step 2: Add `FcmToken` model**

Append to `apps/backend/prisma/schema/comms.prisma`:

```prisma
model FcmToken {
  id             String   @id @default(uuid())
  organizationId String
  clientId       String
  token          String
  platform       String   @db.VarChar(8)
  lastSeenAt     DateTime @default(now())
  createdAt      DateTime @default(now())

  @@unique([clientId, token], name: "fcm_token_per_client")
  @@index([organizationId])
  @@index([clientId])
}
```

- [ ] **Step 3: Generate migration SQL by hand (immutable migration policy)**

Create `apps/backend/prisma/migrations/20260425200000_client_preferences_and_fcm_tokens/migration.sql`:

```sql
-- Client preferences
ALTER TABLE "Client"
  ADD COLUMN "preferredLocale" VARCHAR(8),
  ADD COLUMN "pushEnabled" BOOLEAN NOT NULL DEFAULT true;

-- FCM tokens (tenant-scoped)
CREATE TABLE "FcmToken" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" VARCHAR(8) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FcmToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fcm_token_per_client" ON "FcmToken"("clientId", "token");
CREATE INDEX "FcmToken_organizationId_idx" ON "FcmToken"("organizationId");
CREATE INDEX "FcmToken_clientId_idx" ON "FcmToken"("clientId");
```

- [ ] **Step 4: Apply migration locally**

Run from `apps/backend`:

```bash
npm run prisma:migrate
```

Expected: migration `20260425200000_client_preferences_and_fcm_tokens` applied; Prisma client regenerated.

- [ ] **Step 5: Register `FcmToken` as tenant-scoped**

Edit `apps/backend/src/infrastructure/database/prisma.service.ts`. Locate the `SCOPED_MODELS` constant and add `'FcmToken'` (alphabetical or grouped with comms models — match existing style).

- [ ] **Step 6: Typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/prisma/schema/people.prisma \
        apps/backend/prisma/schema/comms.prisma \
        apps/backend/prisma/migrations/20260425200000_client_preferences_and_fcm_tokens \
        apps/backend/src/infrastructure/database/prisma.service.ts
git commit -m "feat(backend/comms): add Client preferences + FcmToken model"
```

---

### Task 2: Backend — `RegisterFcmTokenHandler`

**Files:**
- Create: `apps/backend/src/modules/comms/fcm-tokens/register-fcm-token.dto.ts`
- Create: `apps/backend/src/modules/comms/fcm-tokens/register-fcm-token.handler.ts`
- Test: `apps/backend/src/modules/comms/fcm-tokens/register-fcm-token.handler.spec.ts`

- [ ] **Step 1: Write the DTO**

`register-fcm-token.dto.ts`:

```ts
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterFcmTokenDto {
  @ApiProperty({ description: 'Device push token (FCM/APNs)', example: 'eXampleToken123' })
  @IsString() @IsNotEmpty() @MaxLength(512)
  token!: string;

  @ApiProperty({ description: 'Device platform', enum: ['ios', 'android'], example: 'ios' })
  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';
}
```

- [ ] **Step 2: Write the failing handler test**

`register-fcm-token.handler.spec.ts`:

```ts
import { RegisterFcmTokenHandler } from './register-fcm-token.handler';

describe('RegisterFcmTokenHandler', () => {
  const baseClient = { id: 'c1', organizationId: 'org1' };
  let prisma: {
    client: { findFirst: jest.Mock };
    fcmToken: { upsert: jest.Mock };
  };
  let handler: RegisterFcmTokenHandler;

  beforeEach(() => {
    prisma = {
      client: { findFirst: jest.fn().mockResolvedValue(baseClient) },
      fcmToken: { upsert: jest.fn().mockResolvedValue({ id: 't1' }) },
    };
    handler = new RegisterFcmTokenHandler(prisma as never);
  });

  it('upserts the (clientId, token) pair with current org', async () => {
    await handler.execute({ clientId: 'c1', token: 'tok-A', platform: 'ios' });
    expect(prisma.fcmToken.upsert).toHaveBeenCalledWith({
      where: { fcm_token_per_client: { clientId: 'c1', token: 'tok-A' } },
      create: {
        organizationId: 'org1',
        clientId: 'c1',
        token: 'tok-A',
        platform: 'ios',
      },
      update: { platform: 'ios', lastSeenAt: expect.any(Date) },
    });
  });

  it('throws when client does not exist', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    await expect(
      handler.execute({ clientId: 'c1', token: 'tok-A', platform: 'ios' }),
    ).rejects.toThrow(/Client not found/);
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

```bash
cd apps/backend && npx jest src/modules/comms/fcm-tokens/register-fcm-token.handler.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `RegisterFcmTokenHandler`**

`register-fcm-token.handler.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { RegisterFcmTokenDto } from './register-fcm-token.dto';

export type RegisterFcmTokenCommand = RegisterFcmTokenDto & { clientId: string };

@Injectable()
export class RegisterFcmTokenHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: RegisterFcmTokenCommand) {
    const client = await this.prisma.client.findFirst({
      where: { id: cmd.clientId, deletedAt: null },
      select: { id: true, organizationId: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    return this.prisma.fcmToken.upsert({
      where: { fcm_token_per_client: { clientId: cmd.clientId, token: cmd.token } },
      create: {
        organizationId: client.organizationId,
        clientId: cmd.clientId,
        token: cmd.token,
        platform: cmd.platform,
      },
      update: { platform: cmd.platform, lastSeenAt: new Date() },
    });
  }
}
```

- [ ] **Step 5: Re-run the test**

```bash
cd apps/backend && npx jest src/modules/comms/fcm-tokens/register-fcm-token.handler.spec.ts
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/comms/fcm-tokens/register-fcm-token.{dto,handler,handler.spec}.ts
git commit -m "feat(backend/comms): RegisterFcmTokenHandler"
```

---

### Task 3: Backend — `UnregisterFcmTokenHandler`

**Files:**
- Create: `apps/backend/src/modules/comms/fcm-tokens/unregister-fcm-token.handler.ts`
- Test: `apps/backend/src/modules/comms/fcm-tokens/unregister-fcm-token.handler.spec.ts`

- [ ] **Step 1: Write the failing test**

`unregister-fcm-token.handler.spec.ts`:

```ts
import { UnregisterFcmTokenHandler } from './unregister-fcm-token.handler';

describe('UnregisterFcmTokenHandler', () => {
  let prisma: { fcmToken: { deleteMany: jest.Mock } };
  let handler: UnregisterFcmTokenHandler;

  beforeEach(() => {
    prisma = { fcmToken: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    handler = new UnregisterFcmTokenHandler(prisma as never);
  });

  it('deletes a specific token when provided', async () => {
    const res = await handler.execute({ clientId: 'c1', token: 'tok-A' });
    expect(prisma.fcmToken.deleteMany).toHaveBeenCalledWith({
      where: { clientId: 'c1', token: 'tok-A' },
    });
    expect(res).toEqual({ deleted: 1 });
  });

  it('deletes all tokens for the client when no token provided', async () => {
    await handler.execute({ clientId: 'c1' });
    expect(prisma.fcmToken.deleteMany).toHaveBeenCalledWith({ where: { clientId: 'c1' } });
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/backend && npx jest src/modules/comms/fcm-tokens/unregister-fcm-token.handler.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`unregister-fcm-token.handler.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface UnregisterFcmTokenCommand {
  clientId: string;
  token?: string;
}

@Injectable()
export class UnregisterFcmTokenHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UnregisterFcmTokenCommand) {
    const where = cmd.token
      ? { clientId: cmd.clientId, token: cmd.token }
      : { clientId: cmd.clientId };
    const res = await this.prisma.fcmToken.deleteMany({ where });
    return { deleted: res.count };
  }
}
```

- [ ] **Step 4: Re-run test**

```bash
cd apps/backend && npx jest src/modules/comms/fcm-tokens/unregister-fcm-token.handler.spec.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/comms/fcm-tokens/unregister-fcm-token.{handler,handler.spec}.ts
git commit -m "feat(backend/comms): UnregisterFcmTokenHandler"
```

---

### Task 4: Backend — `GetClientPushTargetsHandler`

**Files:**
- Create: `apps/backend/src/modules/comms/fcm-tokens/get-client-push-targets.handler.ts`
- Test: `apps/backend/src/modules/comms/fcm-tokens/get-client-push-targets.handler.spec.ts`

- [ ] **Step 1: Failing test**

`get-client-push-targets.handler.spec.ts`:

```ts
import { GetClientPushTargetsHandler } from './get-client-push-targets.handler';

describe('GetClientPushTargetsHandler', () => {
  let prisma: {
    client: { findFirst: jest.Mock };
    fcmToken: { findMany: jest.Mock };
  };
  let handler: GetClientPushTargetsHandler;

  beforeEach(() => {
    prisma = {
      client: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', pushEnabled: true }) },
      fcmToken: { findMany: jest.fn().mockResolvedValue([{ token: 'a' }, { token: 'b' }]) },
    };
    handler = new GetClientPushTargetsHandler(prisma as never);
  });

  it('returns tokens when pushEnabled=true', async () => {
    const res = await handler.execute({ clientId: 'c1' });
    expect(res).toEqual({ pushEnabled: true, tokens: ['a', 'b'] });
  });

  it('returns empty tokens when pushEnabled=false', async () => {
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', pushEnabled: false });
    const res = await handler.execute({ clientId: 'c1' });
    expect(res).toEqual({ pushEnabled: false, tokens: [] });
    expect(prisma.fcmToken.findMany).not.toHaveBeenCalled();
  });

  it('returns empty when client not found', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    const res = await handler.execute({ clientId: 'c1' });
    expect(res).toEqual({ pushEnabled: false, tokens: [] });
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd apps/backend && npx jest src/modules/comms/fcm-tokens/get-client-push-targets.handler.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

`get-client-push-targets.handler.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetClientPushTargetsCommand {
  clientId: string;
}

export interface ClientPushTargets {
  pushEnabled: boolean;
  tokens: string[];
}

@Injectable()
export class GetClientPushTargetsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: GetClientPushTargetsCommand): Promise<ClientPushTargets> {
    const client = await this.prisma.client.findFirst({
      where: { id: cmd.clientId, deletedAt: null },
      select: { id: true, pushEnabled: true },
    });
    if (!client || !client.pushEnabled) {
      return { pushEnabled: client?.pushEnabled ?? false, tokens: [] };
    }
    const rows = await this.prisma.fcmToken.findMany({
      where: { clientId: cmd.clientId },
      select: { token: true },
    });
    return { pushEnabled: true, tokens: rows.map((r) => r.token) };
  }
}
```

- [ ] **Step 4: Re-run**

```bash
cd apps/backend && npx jest src/modules/comms/fcm-tokens/get-client-push-targets.handler.spec.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/comms/fcm-tokens/get-client-push-targets.{handler,handler.spec}.ts
git commit -m "feat(backend/comms): GetClientPushTargetsHandler"
```

---

### Task 5: Backend — register handlers in `comms.module.ts`

**Files:**
- Modify: `apps/backend/src/modules/comms/comms.module.ts`

- [ ] **Step 1: Add the three handlers to providers + exports**

Open `apps/backend/src/modules/comms/comms.module.ts`. Import:

```ts
import { RegisterFcmTokenHandler } from './fcm-tokens/register-fcm-token.handler';
import { UnregisterFcmTokenHandler } from './fcm-tokens/unregister-fcm-token.handler';
import { GetClientPushTargetsHandler } from './fcm-tokens/get-client-push-targets.handler';
```

Append to the `providers: [...]` and `exports: [...]` arrays:

```ts
RegisterFcmTokenHandler,
UnregisterFcmTokenHandler,
GetClientPushTargetsHandler,
```

- [ ] **Step 2: Build the backend**

```bash
cd apps/backend && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/comms/comms.module.ts
git commit -m "chore(backend/comms): wire fcm-token handlers in module"
```

---

### Task 6: Backend — wire `mobile/client/notifications/fcm-token` endpoints

**Files:**
- Modify: `apps/backend/src/api/mobile/client/notifications.controller.ts`

- [ ] **Step 1: Extend the controller**

Replace the controller body. Add imports:

```ts
import { Body, Delete, HttpCode, Post } from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import { RegisterFcmTokenHandler } from '../../../modules/comms/fcm-tokens/register-fcm-token.handler';
import { UnregisterFcmTokenHandler } from '../../../modules/comms/fcm-tokens/unregister-fcm-token.handler';
import { RegisterFcmTokenDto } from '../../../modules/comms/fcm-tokens/register-fcm-token.dto';
```

Inject in the constructor and add endpoints:

```ts
constructor(
  private readonly listNotifications: ListNotificationsHandler,
  private readonly markRead: MarkReadHandler,
  private readonly registerFcm: RegisterFcmTokenHandler,
  private readonly unregisterFcm: UnregisterFcmTokenHandler,
) {}

@ApiOperation({ summary: 'Register an FCM/APNs device token for the current client' })
@ApiCreatedResponse({ description: 'Token stored' })
@Post('fcm-token')
@HttpCode(201)
registerFcmEndpoint(
  @ClientSession() user: ClientSession,
  @Body() body: RegisterFcmTokenDto,
) {
  return this.registerFcm.execute({ clientId: user.id, ...body });
}

@ApiOperation({ summary: 'Remove all FCM tokens for the current client' })
@ApiNoContentResponse({ description: 'Tokens removed' })
@Delete('fcm-token')
@HttpCode(204)
async unregisterFcmEndpoint(@ClientSession() user: ClientSession) {
  await this.unregisterFcm.execute({ clientId: user.id });
}
```

- [ ] **Step 2: Regenerate OpenAPI snapshot**

```bash
cd apps/backend && npm run openapi:build-and-snapshot
```

Expected: `openapi.json` updated with two new paths.

- [ ] **Step 3: Typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/api/mobile/client/notifications.controller.ts \
        apps/backend/openapi.json
git commit -m "feat(backend/api): POST/DELETE mobile/client/notifications/fcm-token"
```

---

### Task 7: Backend — extend `update-client` for `preferredLocale` + `pushEnabled`

**Files:**
- Modify: `apps/backend/src/modules/people/clients/update-client.dto.ts`
- Modify: `apps/backend/src/modules/people/clients/update-client.handler.ts`
- Modify: `apps/backend/src/modules/people/clients/client.serializer.ts`
- Modify: `apps/backend/src/modules/people/clients/clients.handler.spec.ts`

- [ ] **Step 1: Extend DTO**

In `update-client.dto.ts`, add (after existing fields, mirror their decorators):

```ts
@ApiPropertyOptional({ description: 'Preferred locale (ISO 639-1)', example: 'ar' })
@IsOptional() @IsString() @MaxLength(8)
preferredLocale?: string;

@ApiPropertyOptional({ description: 'Whether the client receives push notifications', example: true })
@IsOptional() @IsBoolean()
pushEnabled?: boolean;
```

Add `@IsBoolean`, `@MaxLength` to the existing imports if missing.

- [ ] **Step 2: Extend handler write**

In `update-client.handler.ts`, inside the `prisma.client.update({ data: { ... } })` block, add:

```ts
preferredLocale: cmd.preferredLocale,
pushEnabled: cmd.pushEnabled,
```

- [ ] **Step 3: Extend serializer**

In `client.serializer.ts`, add `preferredLocale` and `pushEnabled` to the returned object (mirror the existing field shape).

- [ ] **Step 4: Add a regression test**

Append to `clients.handler.spec.ts` (inside the existing `describe('UpdateClientHandler')` block):

```ts
it('updates preferredLocale and pushEnabled', async () => {
  const result = await updateHandler.execute({
    clientId: 'c1',
    preferredLocale: 'en',
    pushEnabled: false,
  });
  expect(prisma.client.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ preferredLocale: 'en', pushEnabled: false }),
    }),
  );
  expect(result.preferredLocale).toBe('en');
  expect(result.pushEnabled).toBe(false);
});
```

You will need to extend the `mockClient` in the spec to include `preferredLocale: null, pushEnabled: true`, and have `prisma.client.update` resolve with the merged object.

- [ ] **Step 5: Run the spec**

```bash
cd apps/backend && npx jest src/modules/people/clients/clients.handler.spec.ts
```

Expected: PASS — including the new test.

- [ ] **Step 6: Extend `MobileUpdateProfileBody`**

In `apps/backend/src/api/mobile/client/profile.controller.ts`, append to `MobileUpdateProfileBody`:

```ts
@ApiPropertyOptional({ description: 'Preferred locale', example: 'ar' })
@IsOptional() @IsString() preferredLocale?: string;

@ApiPropertyOptional({ description: 'Push notifications enabled', example: true })
@IsOptional() @IsBoolean() pushEnabled?: boolean;
```

(Add `IsBoolean` to imports if missing.)

- [ ] **Step 7: Regenerate OpenAPI**

```bash
cd apps/backend && npm run openapi:build-and-snapshot
```

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/people/clients \
        apps/backend/src/api/mobile/client/profile.controller.ts \
        apps/backend/openapi.json
git commit -m "feat(backend/people): persist client preferredLocale and pushEnabled"
```

---

### Task 8: Backend — reaction handlers fetch tokens + respect `pushEnabled`

**Files:**
- Modify: `apps/backend/src/modules/comms/events/on-booking-reminder.handler.ts`
- Modify: `apps/backend/src/modules/comms/events/on-booking-cancelled.handler.ts`
- Modify: `apps/backend/src/modules/comms/events/on-payment-failed.handler.ts`
- Modify: `apps/backend/src/modules/comms/events/on-group-session-payment-links-ready.handler.ts` (only if it currently invokes push)
- Modify: `apps/backend/src/modules/comms/comms.events.handler.spec.ts`

- [ ] **Step 1: Extend `send-notification` to accept multiple tokens**

Open `apps/backend/src/modules/comms/send-notification/send-notification.dto.ts`. Replace `fcmToken?: string` with:

```ts
@IsOptional()
fcmTokens?: string[];
```

(Keep the old `fcmToken` field for backwards compatibility if other call sites still use it; otherwise remove and update all call sites.) In `send-notification.handler.ts`, replace the single-token dispatch:

```ts
if (dto.channels.includes('push')) {
  const tokens = dto.fcmTokens ?? (dto.fcmToken ? [dto.fcmToken] : []);
  for (const t of tokens) {
    tasks.push(this.push.execute({ token: t, title: dto.title, body: dto.body }));
  }
}
```

- [ ] **Step 2: Update `OnBookingReminderHandler`**

```ts
import { GetClientPushTargetsHandler } from '../fcm-tokens/get-client-push-targets.handler';

constructor(
  private readonly notify: SendNotificationHandler,
  private readonly pushTargets: GetClientPushTargetsHandler,
) {}

async handle(envelope: DomainEventEnvelope<BookingReminderPayload>): Promise<void> {
  const { payload } = envelope;
  const { pushEnabled, tokens } = await this.pushTargets.execute({ clientId: payload.clientId });
  const channels: ('in-app' | 'push' | 'sms')[] = ['in-app', 'sms'];
  if (pushEnabled && tokens.length > 0) channels.push('push');
  // ... existing notify.execute call, replace fcmToken with fcmTokens: tokens
}
```

Apply the same pattern to `on-booking-cancelled.handler.ts` and `on-payment-failed.handler.ts`. Drop the `fcmToken` field from each event payload interface — producers should no longer be expected to supply it.

- [ ] **Step 3: Update event-side spec**

In `comms.events.handler.spec.ts`, where mocks instantiate these handlers, inject a mock `GetClientPushTargetsHandler` returning `{ pushEnabled: true, tokens: ['tok-1'] }`. Replace assertions on `fcmToken: 'tok-1'` with `fcmTokens: ['tok-1']`. Add a case where `pushEnabled: false, tokens: []` and assert `channels` does **not** include `'push'`.

- [ ] **Step 4: Run comms tests**

```bash
cd apps/backend && npx jest src/modules/comms
```

Expected: all green.

- [ ] **Step 5: Run full backend test suite**

```bash
cd apps/backend && npm run test
```

Expected: ≥ previous baseline (1361 prior; 3 unrelated `list-get-employees` failures known per `VERIFICATION_REPORT.md`). No new failures introduced by this change.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/comms
git commit -m "feat(backend/comms): reaction handlers fetch FCM tokens + honor pushEnabled"
```

---

### Task 9: Mobile — extend `clientProfileService` types

**Files:**
- Modify: `apps/mobile/services/client/profile.ts`

- [ ] **Step 1: Add fields**

In `ClientProfileUpdate`, add:

```ts
preferredLocale?: string;
pushEnabled?: boolean;
```

In `ClientProfile`, add:

```ts
preferredLocale: string | null;
pushEnabled: boolean;
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/services/client/profile.ts
git commit -m "feat(mobile/profile): expose preferredLocale and pushEnabled"
```

---

### Task 10: Mobile — fix FCM endpoint paths

**Files:**
- Modify: `apps/mobile/services/notifications.ts:40-54`

- [ ] **Step 1: Update both paths**

Replace the two URLs to match the new backend routes:

```ts
async registerFcmToken(token: string, platform: 'ios' | 'android') {
  const response = await api.post<ApiResponse<unknown>>(
    '/mobile/client/notifications/fcm-token',
    { token, platform },
  );
  return response.data;
},

async unregisterFcmToken() {
  const response = await api.delete<ApiResponse<{ deleted: number }>>(
    '/mobile/client/notifications/fcm-token',
  );
  return response.data;
},
```

- [ ] **Step 2: Update existing push test**

Open `apps/mobile/services/push.test.ts`. The existing mock surface stays the same — only the URL changed inside the service. Re-run:

```bash
cd apps/mobile && npx jest services/push.test.ts
```

Expected: PASS — existing 4+ tests untouched.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/services/notifications.ts
git commit -m "fix(mobile/notifications): point fcm-token to mobile/client/notifications scope"
```

---

### Task 11: Mobile — Settings screen syncs language + push to backend

**Files:**
- Modify: `apps/mobile/app/(client)/settings.tsx`

- [ ] **Step 1: Import the profile service**

Add at the top:

```ts
import { clientProfileService } from '@/services/client/profile';
import { registerForPushAsync, unregisterPushAsync } from '@/services/push';
```

- [ ] **Step 2: Wrap language change**

Find the existing language-change handler that does `AsyncStorage.setItem(LANGUAGE_KEY, lang)`. Add — after the AsyncStorage write, before any restart:

```ts
clientProfileService.updateProfile({ preferredLocale: lang }).catch((err) => {
  console.warn('[Settings] Failed to sync locale to server:', err);
});
```

(Fire-and-forget — local change is the source of truth for UX; server sync is best-effort.)

- [ ] **Step 3: Wrap push toggle**

Find the push-toggle handler that does `AsyncStorage.setItem(PUSH_KEY, String(val))`. Replace with:

```ts
const togglePush = async (val: boolean) => {
  await Haptics.selectionAsync();
  setPushEnabled(val);
  await AsyncStorage.setItem(PUSH_KEY, String(val));
  try {
    await clientProfileService.updateProfile({ pushEnabled: val });
  } catch (err) {
    console.warn('[Settings] Failed to sync push pref to server:', err);
  }
  if (val) {
    await registerForPushAsync();
  } else {
    await unregisterPushAsync();
  }
};
```

(Local toggle drives optimistic UI; server sync + token (un)registration follow.)

- [ ] **Step 4: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(client\)/settings.tsx
git commit -m "feat(mobile/settings): sync language and push pref to backend"
```

---

### Task 12: Mobile — register FCM after login / OTP verify / register

**Files:**
- Modify: `apps/mobile/app/(auth)/login.tsx:95`
- Modify: `apps/mobile/app/(auth)/otp-verify.tsx:129`
- Modify: `apps/mobile/app/(auth)/register.tsx:76`

- [ ] **Step 1: login.tsx — fire-and-forget after `setCredentials`**

Add import:

```ts
import { registerForPushAsync } from '@/services/push';
```

Immediately after `dispatch(setCredentials(response.data));`:

```ts
void registerForPushAsync();
```

- [ ] **Step 2: otp-verify.tsx — same pattern**

Add the import; insert `void registerForPushAsync();` after the existing `dispatch(setCredentials(response.data));`.

- [ ] **Step 3: register.tsx — same pattern**

Add the import; insert `void registerForPushAsync();` after the existing `dispatch(setCredentials(response.data));`.

- [ ] **Step 4: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(auth\)/login.tsx \
        apps/mobile/app/\(auth\)/otp-verify.tsx \
        apps/mobile/app/\(auth\)/register.tsx
git commit -m "feat(mobile/auth): register FCM token after login / OTP / register"
```

---

### Task 13: Mobile — register FCM on app start when authed

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Add a hydration-aware effect**

Currently the root layout has a single `useEffect`. Replace the file body to add a child component that lives inside the `PersistGate` (so Redux is hydrated) and triggers push registration:

Add at top:

```ts
import { useAppSelector } from '@/hooks/use-redux';
import { registerForPushAsync } from '@/services/push';
```

Add a helper component before `RootLayout`:

```ts
function PushBootstrap() {
  const token = useAppSelector((s) => s.auth.token);
  useEffect(() => {
    if (!token) return;
    void registerForPushAsync();
  }, [token]);
  return null;
}
```

Inside `<PersistGate>`, render `<PushBootstrap />` once, e.g. just below `<QueryClientProvider>`:

```tsx
<QueryClientProvider client={queryClient}>
  <PushBootstrap />
  ...
</QueryClientProvider>
```

(The component triggers on app start whenever an auth token is hydrated, and again whenever the token changes — re-register is idempotent at the backend via the unique `(clientId, token)` upsert.)

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "feat(mobile/root): register FCM on app start for authed clients"
```

---

### Task 14: Mobile — unregister FCM on logout

**Files:**
- Modify: `apps/mobile/app/(client)/(tabs)/profile.tsx:242`

- [ ] **Step 1: Wrap logout**

Replace the existing `onPress={() => dispatch(logout())}` with a handler that unregisters first:

Add import:

```ts
import { unregisterPushAsync } from '@/services/push';
```

Add a handler near other callbacks in the component:

```ts
const handleLogout = async () => {
  try {
    await unregisterPushAsync();
  } catch {
    // best-effort; continue logout regardless
  }
  dispatch(logout());
};
```

Replace the `onPress`:

```tsx
<Glass ... onPress={handleLogout} ...>
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(client\)/\(tabs\)/profile.tsx
git commit -m "feat(mobile/profile): unregister FCM token before logout"
```

---

### Task 15: Verification — full sweep

**No files to change — this is the verification gate.**

- [ ] **Step 1: Backend test suite**

```bash
cd apps/backend && npm run test
```

Expected: ≥ baseline; the only acceptable pre-existing failures are the three `list-get-employees` cases noted in `VERIFICATION_REPORT.md`. No new failures introduced.

- [ ] **Step 2: Backend e2e**

```bash
cd apps/backend && npm run test:e2e -- --testPathPattern="comms|profile"
```

Expected: existing comms + profile e2e pass.

- [ ] **Step 3: Backend build**

```bash
cd apps/backend && npm run build
```

Expected: success.

- [ ] **Step 4: Mobile tests**

```bash
cd apps/mobile && npm run test
```

Expected: 0 failures.

- [ ] **Step 5: Mobile typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Manual smoke (Expo Go or simulator)**

Boot the backend and mobile dev server. On a real device (push requires `Device.isDevice === true`):

1. Login → check backend logs / DB: a new row exists in `FcmToken` for the client.
2. Toggle "Push" off in Settings → DB row(s) deleted; `Client.pushEnabled` is `false`.
3. Toggle "Push" on in Settings → `Client.pushEnabled` is `true`; new `FcmToken` row appears.
4. Switch language in Settings → `Client.preferredLocale` is updated.
5. Logout → all `FcmToken` rows for that client are gone.
6. Trigger a booking reminder (e.g., via a debug endpoint or by advancing the cron clock locally) → push arrives on the device.

Capture results in `docs/superpowers/qa/mobile-settings-fcm-2026-04-XX.md` per the manual-QA workflow in root `CLAUDE.md`.

- [ ] **Step 7: Sync to Kiwi**

```bash
npm run kiwi:sync-manual data/kiwi/mobile-settings-fcm-2026-04-XX.json
```

(JSON authored per the workflow in root `CLAUDE.md`.)

- [ ] **Step 8: Update memory**

Append a new memory file `mobile_settings_fcm_closeout_status.md` indexed in `MEMORY.md` documenting which mobile gaps are closed and which remain (video-call, invoice-mapper).

- [ ] **Step 9: Open the PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(mobile): close Settings sync + FCM gaps" --body "$(cat <<'EOF'
## Summary
- Added `Client.preferredLocale` and `Client.pushEnabled` (migration + DTO + handler + serializer).
- Added tenant-scoped `FcmToken` model and `mobile/client/notifications/fcm-token` POST/DELETE endpoints.
- Reaction handlers (booking reminder/cancelled, payment failed) now fetch tokens from DB and honor `pushEnabled`.
- Mobile: Settings now syncs language and push pref to backend; FCM `register/unregister` wired into login/OTP/register/app-start/logout.

## Test plan
- [ ] Backend `npm run test` ≥ baseline
- [ ] Backend `npm run test:e2e` for comms + profile
- [ ] Mobile `npm run test` green
- [ ] Manual QA on a real device (steps in plan §15) → Kiwi run synced
EOF
)"
```

---

## Out of Scope (separate plans)

| Gap | Reason |
|---|---|
| Employee video-call (Zoom SDK) | Multi-day SDK integration; needs its own brainstorm + plan |
| Invoice mapper (dashboard) | Lives in `apps/dashboard`, not the mobile↔backend wiring scope |

Both should be tracked under fresh entries in `docs/superpowers/plans/` when scheduled.
