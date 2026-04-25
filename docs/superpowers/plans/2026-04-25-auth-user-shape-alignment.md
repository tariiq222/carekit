# Auth User Shape Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the long-standing drift where `apps/mobile` consumes `user.firstName`, `user.lastName`, and `user.organizationId` from `/auth/login`, but the backend's login endpoint returns none of those — so the mobile UI silently renders `undefined` strings and the auth slice writes `null` for the active org.

**Architecture:** Fix at the source: `/auth/login` and `/auth/me` are made consistent with the same `firstName`/`lastName` derivation already used by `GetCurrentUserHandler`, and both endpoints attach the resolved `organizationId` from the active `Membership`. Then propagate the new fields through `@carekit/api-client`'s canonical `UserPayload` and tighten the mobile `User` type to import from there. No mobile screens have to change — they will simply start receiving the values they were already trying to read.

**Tech Stack:** NestJS 11, Prisma 7, Jest (backend specs), Vitest (api-client + dashboard), @carekit/api-client TypeScript types.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/backend/src/api/public/auth.controller.ts` (modify) | Login + /me endpoints — extend response with `firstName`, `lastName`, `organizationId` |
| `apps/backend/src/api/public/auth.controller.spec.ts` (create or extend) | Integration-style spec pinning the new login/me response shape |
| `apps/backend/src/modules/identity/login/login.handler.ts` (modify) | Already resolves membership; expose its `organizationId` to the controller via the returned shape |
| `apps/backend/src/modules/identity/get-current-user/get-current-user.handler.ts` (modify) | Add `organizationId` from active membership |
| `apps/backend/src/modules/identity/get-current-user/get-current-user.handler.spec.ts` (modify) | Pin new shape |
| `packages/api-client/src/types/auth.ts` (modify) | Extend `UserPayload` with `firstName`, `lastName`, `organizationId` |
| `packages/api-client/src/modules/__tests__/auth.test.ts` (modify) | Update fakeUser to include new fields |
| `apps/dashboard/test/unit/lib/auth-api.spec.ts` (modify) | Update fakeUser fixture |
| `apps/mobile/types/auth.ts` (modify) | Drop the local `User` interface in favour of importing canonical `UserPayload`; keep the mobile-only helpers (`MobileRole`, `splitName`, etc.) |
| `apps/mobile/services/__tests__/auth.test.ts` (modify) | Update `baseUser` to canonical shape |

**Out of scope:** mobile screens that read `user.firstName`/`lastName`/`organizationId` — they keep working unchanged once the backend includes those fields. The shared `<EmailPasswordFields/>` primitive and the 42 dashboard React-19 lint failures remain in their own follow-up plans.

---

## Task 1: Pin current `/auth/login` shape with a failing integration spec

**Files:**
- Read: `apps/backend/src/api/public/auth.controller.ts:55-100`
- Create or extend: `apps/backend/src/api/public/auth.controller.spec.ts`

- [ ] **Step 1: Locate or create the controller spec**

Run: `ls apps/backend/src/api/public/auth.controller.spec.ts 2>/dev/null || echo MISSING`

If MISSING, create the file with this scaffold:

```typescript
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { LoginHandler } from '../../modules/identity/login/login.handler';
import { LogoutHandler } from '../../modules/identity/logout/logout.handler';
import { PrismaService } from '../../infrastructure/database';
import { TokenService } from '../../modules/identity/shared/token.service';
import { GetCurrentUserHandler } from '../../modules/identity/get-current-user/get-current-user.handler';
import { ChangePasswordHandler } from '../../modules/identity/users/change-password.handler';
import { ListMembershipsHandler } from '../../modules/identity/list-memberships/list-memberships.handler';
import { SwitchOrganizationHandler } from '../../modules/identity/switch-organization/switch-organization.handler';

describe('AuthController.loginEndpoint', () => {
  let controller: AuthController;
  let prisma: { user: { findUnique: jest.Mock }; membership: { findFirst: jest.Mock } };
  let login: { execute: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      membership: { findFirst: jest.fn() },
    };
    login = { execute: jest.fn() };
    config = { get: jest.fn().mockReturnValue('15m') };

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: LoginHandler, useValue: login },
        { provide: LogoutHandler, useValue: { execute: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: { issueTokenPair: jest.fn() } },
        { provide: GetCurrentUserHandler, useValue: { execute: jest.fn() } },
        { provide: ChangePasswordHandler, useValue: { execute: jest.fn() } },
        { provide: ListMembershipsHandler, useValue: { execute: jest.fn() } },
        { provide: SwitchOrganizationHandler, useValue: { execute: jest.fn() } },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('returns user.firstName, user.lastName, user.organizationId in the response', async () => {
    login.execute.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'admin@c.sa',
      name: 'Tariq Al Walidi',
      phone: null,
      gender: null,
      avatarUrl: null,
      isActive: true,
      role: 'OWNER',
      customRoleId: null,
      customRole: { permissions: [{ action: 'manage', subject: 'Booking' }] },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.membership.findFirst.mockResolvedValue({ id: 'm1', organizationId: 'org_1' });

    const result = await controller.loginEndpoint({
      email: 'admin@c.sa',
      password: 'pw',
    });

    expect(result.user).toMatchObject({
      firstName: 'Tariq',
      lastName: 'Al Walidi',
      organizationId: 'org_1',
    });
  });
});
```

- [ ] **Step 2: Run the spec and confirm it fails**

Run: `cd apps/backend && npx jest src/api/public/auth.controller.spec.ts -t "firstName"`
Expected: FAIL with "expected to have property firstName" — or shape mismatch on organizationId.

- [ ] **Step 3: Commit (red)**

```bash
git add apps/backend/src/api/public/auth.controller.spec.ts
git commit -m "test(auth): pin firstName/lastName/organizationId on login response (red)"
```

---

## Task 2: Make `/auth/login` include `firstName`, `lastName`, `organizationId` (green)

**Files:**
- Modify: `apps/backend/src/api/public/auth.controller.ts:72-100`

- [ ] **Step 1: Update `loginEndpoint`**

Find the existing `loginEndpoint` method (apps/backend/src/api/public/auth.controller.ts:72-100) and replace its body with:

```typescript
async loginEndpoint(@Body() body: LoginDto) {
  const tokens = await this.login.execute({ email: body.email, password: body.password });
  const user = await this.prisma.user.findUnique({
    where: { email: body.email },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      gender: true,
      avatarUrl: true,
      isActive: true,
      role: true,
      customRoleId: true,
      customRole: { include: { permissions: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return {
      ...tokens,
      user,
      expiresIn: this.parseTtlSeconds(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m'),
    };
  }

  // Resolve active membership so the response carries organizationId for
  // mobile/dashboard consumers without forcing them to decode the JWT.
  const membership = await this.prisma.membership.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { organizationId: true },
  });

  // Match GetCurrentUserHandler: firstName/lastName are derived from `name`
  // by splitting on the first whitespace run.
  const [firstName = '', ...rest] = (user.name ?? '').trim().split(/\s+/);

  return {
    ...tokens,
    user: {
      ...user,
      firstName,
      lastName: rest.join(' '),
      isSuperAdmin: user.role === 'SUPER_ADMIN',
      organizationId: membership?.organizationId ?? null,
      permissions: flattenPermissions(user),
    },
    expiresIn: this.parseTtlSeconds(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m'),
  };
}
```

- [ ] **Step 2: Run the spec — should now pass**

Run: `cd apps/backend && npx jest src/api/public/auth.controller.spec.ts -t "firstName"`
Expected: PASS.

- [ ] **Step 3: Run the existing login handler spec to confirm no regression**

Run: `cd apps/backend && npx jest src/modules/identity/login/login.handler.spec.ts`
Expected: all tests pass (handler is untouched; only controller composition changed).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/api/public/auth.controller.ts
git commit -m "feat(auth): include firstName/lastName/organizationId in /auth/login response

mobile + dashboard consumers were already reading these fields; they
existed only on /auth/me. Login now returns the same canonical user
shape as /me, with organizationId resolved from the active membership."
```

---

## Task 3: Add `organizationId` to `/auth/me`

**Files:**
- Modify: `apps/backend/src/modules/identity/get-current-user/get-current-user.handler.ts`
- Modify: `apps/backend/src/modules/identity/get-current-user/get-current-user.handler.spec.ts`

- [ ] **Step 1: Update the spec first (red)**

Read `apps/backend/src/modules/identity/get-current-user/get-current-user.handler.spec.ts`. After the existing "returns user with first/last name split" test, append:

```typescript
it('returns organizationId from the active membership', async () => {
  prisma.user.findUnique.mockResolvedValue({
    id: 'u1',
    email: 'a@b.c',
    name: 'Tariq',
    customRole: null,
  } as never);
  prisma.membership.findFirst.mockResolvedValue({ organizationId: 'org_42' } as never);

  const result = await handler.execute({ userId: 'u1' });

  expect(result.organizationId).toBe('org_42');
});

it('returns organizationId=null when user has no active membership', async () => {
  prisma.user.findUnique.mockResolvedValue({
    id: 'u1',
    email: 'a@b.c',
    name: 'Tariq',
    customRole: null,
  } as never);
  prisma.membership.findFirst.mockResolvedValue(null);

  const result = await handler.execute({ userId: 'u1' });

  expect(result.organizationId).toBeNull();
});
```

If the existing spec mocks Prisma without a `membership` object, extend the mock factory to include `membership: { findFirst: jest.fn() }`. Show the full diff in the commit message.

- [ ] **Step 2: Run — fails on missing organizationId**

Run: `cd apps/backend && npx jest src/modules/identity/get-current-user/get-current-user.handler.spec.ts`
Expected: 2 new tests fail with "expected 'org_42' to equal undefined".

- [ ] **Step 3: Update the handler**

Replace `apps/backend/src/modules/identity/get-current-user/get-current-user.handler.ts` with:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { GetCurrentUserQuery } from './get-current-user.query';

@Injectable()
export class GetCurrentUserHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetCurrentUserQuery) {
    const user = await this.prisma.user.findUnique({
      where: { id: query.userId },
      include: { customRole: { include: { permissions: true } } },
      omit: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: { organizationId: true },
    });

    const [firstName = '', ...rest] = (user.name ?? '').trim().split(/\s+/);
    return {
      ...user,
      firstName,
      lastName: rest.join(' '),
      organizationId: membership?.organizationId ?? null,
    };
  }
}
```

- [ ] **Step 4: Run — should now pass**

Run: `cd apps/backend && npx jest src/modules/identity/get-current-user/get-current-user.handler.spec.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/identity/get-current-user/get-current-user.handler.ts \
        apps/backend/src/modules/identity/get-current-user/get-current-user.handler.spec.ts
git commit -m "feat(auth): /auth/me returns organizationId from active membership"
```

---

## Task 4: Extend canonical `UserPayload` in `@carekit/api-client`

**Files:**
- Modify: `packages/api-client/src/types/auth.ts`
- Modify: `packages/api-client/src/modules/__tests__/auth.test.ts`

- [ ] **Step 1: Extend the type**

Read `packages/api-client/src/types/auth.ts` and replace the `UserPayload` interface with:

```typescript
export interface UserPayload {
  id: string
  email: string
  name: string
  // Derived from `name` by the backend (split on first whitespace run); kept
  // optional because legacy tokens issued before the SaaS-04 alignment may
  // still be in flight.
  firstName?: string
  lastName?: string
  phone: string | null
  gender: string | null
  avatarUrl: string | null
  isActive: boolean
  role: string
  customRoleId: string | null
  isSuperAdmin: boolean
  permissions: string[]
  // Resolved from the user's active Membership. Null when the user has no
  // active membership yet (e.g. freshly created super-admin in seed data).
  organizationId: string | null
  createdAt?: string
  updatedAt?: string
}
```

- [ ] **Step 2: Update the auth contract test fixture**

Read `packages/api-client/src/modules/__tests__/auth.test.ts:9-21`. Replace the `fakeUser` literal with:

```typescript
const fakeUser: UserPayload = {
  id: 'usr_1',
  email: 'admin@carekit.app',
  name: 'Admin Owner',
  firstName: 'Admin',
  lastName: 'Owner',
  phone: null,
  gender: null,
  avatarUrl: null,
  isActive: true,
  role: 'OWNER',
  customRoleId: null,
  isSuperAdmin: false,
  permissions: ['booking:read'],
  organizationId: 'org_1',
}
```

- [ ] **Step 3: Run api-client tests**

Run: `cd packages/api-client && npx vitest run`
Expected: 14 / 14 PASS.

- [ ] **Step 4: typecheck**

Run: `cd packages/api-client && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: typecheck downstream apps**

Run: `npm run typecheck --workspace=apps/admin && npm run typecheck --workspace=apps/dashboard`
Expected: 0 errors. (`isSuperAdmin` becomes required on `UserPayload`, which all apps already populate; `organizationId` becomes required, also fine because the dashboard never reads it directly off `UserPayload` and admin only reads `isSuperAdmin`.)

- [ ] **Step 6: Commit**

```bash
git add packages/api-client/src/types/auth.ts \
        packages/api-client/src/modules/__tests__/auth.test.ts
git commit -m "feat(api-client): UserPayload exposes firstName/lastName/organizationId

Matches the now-aligned /auth/login + /auth/me response shape from the
backend. firstName/lastName stay optional to tolerate legacy tokens
during the rollout window."
```

---

## Task 5: Update dashboard auth-api fixture

**Files:**
- Modify: `apps/dashboard/test/unit/lib/auth-api.spec.ts`

- [ ] **Step 1: Update fakeUser**

Read `apps/dashboard/test/unit/lib/auth-api.spec.ts:43-55`. Replace the `fakeUser` const with:

```typescript
const fakeUser = {
  id: "1",
  email: "a@b.com",
  name: "A B",
  firstName: "A",
  lastName: "B",
  phone: null,
  gender: null,
  avatarUrl: null,
  isActive: true,
  role: "OWNER",
  customRoleId: null,
  isSuperAdmin: false,
  permissions: [],
  organizationId: "org_test",
}
```

- [ ] **Step 2: Run dashboard auth tests**

Run: `npm run test --workspace=apps/dashboard -- test/unit/lib/auth-api.spec.ts`
Expected: 12 / 12 PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/test/unit/lib/auth-api.spec.ts
git commit -m "test(dashboard): align auth-api fixture with new UserPayload fields"
```

---

## Task 6: Tighten `apps/mobile/types/auth.ts` to import canonical `UserPayload`

**Files:**
- Modify: `apps/mobile/types/auth.ts`
- Modify: `apps/mobile/services/__tests__/auth.test.ts` (only the `baseUser` literal)

- [ ] **Step 1: Audit consumers of mobile `User`**

Run:
```bash
grep -rn "type { User\|from '@/types/auth'\|import { User" apps/mobile --include="*.ts" --include="*.tsx" | grep -v __tests__ | wc -l
```
Note the count and the consumer files. **Do not delete `User` if any consumer would break.** The plan keeps `User` as a re-export alias, so existing imports keep working.

- [ ] **Step 2: Replace the local `User` interface with a re-export**

Read `apps/mobile/types/auth.ts:14-29`. Replace the existing `UserRoleItem` + `User` interfaces with:

```typescript
import type { UserPayload } from '@carekit/api-client'

// Mobile previously declared its own User shape. We now rely on the
// canonical UserPayload returned by /auth/login + /auth/me — re-exported
// here as `User` so existing screens (~12 sites) keep working without
// import churn.
export type User = UserPayload

// Mobile-only enum used by getPrimaryRole — staff vs client buckets the
// app uses for navigation, distinct from backend's UserRole.
export type UserRole = 'client' | 'employee' | 'super_admin' | 'receptionist' | 'accountant';

/** Mobile-only nav helper. Maps backend `role` (e.g. CLINIC_OWNER) to the
 * client/employee/staff bucket used by the bottom-tab routing. */
export function getPrimaryRole(user: User): UserRole {
  const role = user.role?.toLowerCase()
  if (!role) return 'client'
  if (role === 'super_admin') return 'super_admin'
  if (role === 'receptionist') return 'receptionist'
  if (role === 'accountant') return 'accountant'
  if (role === 'clinic_owner' || role === 'employee' || role.startsWith('clinic')) {
    return 'employee'
  }
  return 'client'
}
```

> The old `getPrimaryRole` read `user.roles[0].slug` — but `roles[]` never existed in the backend response. This rewrite uses the canonical `role` string field that DOES exist (and the screens that called `getPrimaryRole` were operating on the same broken type before).

- [ ] **Step 3: Update mobile auth test fixture**

Read `apps/mobile/services/__tests__/auth.test.ts` and find the `baseUser: User` literal. Update it to match the canonical shape (drop `roles[]`, add `name`, `firstName`, `lastName`, `isSuperAdmin`, `customRoleId`, `organizationId`):

```typescript
const baseUser: User = {
  id: 'u1',
  email: 'a@b.c',
  name: 'A B',
  firstName: 'A',
  lastName: 'B',
  phone: null,
  gender: null,
  avatarUrl: null,
  isActive: true,
  role: 'CLIENT',
  customRoleId: null,
  isSuperAdmin: false,
  permissions: [],
  organizationId: 'org_1',
};
```

- [ ] **Step 4: Run mobile tests**

Run: `npm run test --workspace=apps/mobile -- services/__tests__/auth.test.ts`
Expected: 15 / 15 PASS.

- [ ] **Step 5: typecheck mobile**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: 0 errors. If errors surface in screens reading `user.firstName` / `user.lastName` / `user.organizationId`: those fields exist on the new `UserPayload`, so the issue is more likely missing fields elsewhere — fix in place, do not loosen the type.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/types/auth.ts apps/mobile/services/__tests__/auth.test.ts
git commit -m "refactor(mobile): User type now re-exports canonical @carekit/api-client UserPayload

Drops the home-grown User interface that promised firstName/lastName/
organizationId/roles[] but never received them at runtime. Now that the
backend /auth/login response carries those fields (Tasks 2-3), the
mobile screens reading user.firstName etc. start receiving real values
instead of undefined.

getPrimaryRole rewritten to read user.role (the field that ALWAYS
existed) instead of user.roles[0].slug (the field that never did)."
```

---

## Task 7: End-to-end verification

- [ ] **Step 1: Run all auth-related tests across the monorepo**

```bash
cd apps/backend && npx jest src/modules/identity src/api/public/auth.controller.spec.ts
cd /Users/tariq/code/carekit
npm run test --workspace=packages/api-client
npm run test --workspace=apps/dashboard -- test/unit/lib/auth-api.spec.ts test/unit/auth/ test/unit/components/login-form.spec.tsx
npm run test --workspace=apps/website -- features/auth
npm run test --workspace=apps/mobile -- services/__tests__/auth.test.ts
```
Expected: every suite green.

- [ ] **Step 2: Typecheck all touched apps**

```bash
npm run typecheck --workspace=apps/backend
npm run typecheck --workspace=packages/api-client || (cd packages/api-client && npx tsc --noEmit)
npm run typecheck --workspace=apps/admin
npm run typecheck --workspace=apps/dashboard
cd apps/mobile && npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Confirm mobile screens render real values via spot-check**

Run: `grep -rn "user\.firstName\|user\.lastName\|user\.organizationId" apps/mobile --include="*.ts" --include="*.tsx" | grep -v __tests__`

For each match, confirm the field is now part of `UserPayload`. If any match references a different field name (e.g. `user.fullName`), file a follow-up issue — do not patch in this plan.

- [ ] **Step 4: Open the rolled-up PR**

Title: `feat(auth): align /auth/login + /auth/me response with mobile + dashboard expectations`
Body:
- Backend: `/auth/login` and `/auth/me` now return `firstName`, `lastName`, `organizationId`.
- api-client: canonical `UserPayload` extended with those fields.
- mobile: drops the home-grown `User` interface; re-exports `UserPayload`. Fixes the silent runtime drift where 12 screens read fields that never existed.
- dashboard + website + admin: no functional change, fixtures updated.

Test plan:
- [ ] backend identity + auth.controller specs green
- [ ] api-client 14 / 14 green
- [ ] dashboard auth-api 52 / 52 green
- [ ] website auth 22 / 22 green
- [ ] mobile auth 15 / 15 green
- [ ] manual: log in on mobile (client + employee), confirm profile name + org id render correctly
