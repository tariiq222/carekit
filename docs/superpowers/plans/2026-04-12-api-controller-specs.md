# API Controller Specs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write specs for all 16 controller files that currently lack tests, covering success · error · auth scenarios for every endpoint.

**Architecture:** Pure unit tests — no NestJS bootstrap, no database. Each spec instantiates the controller directly with jest mock handlers (`{ execute: jest.fn() }`) or a mock `PrismaService`. Guards are verified via decorator metadata reflection. Pattern matches existing specs in `src/api/dashboard/`.

**Tech Stack:** Jest, NestJS reflect-metadata, `@prisma/client` enums, bcryptjs (for auth controller only)

---

## File Map

| Task | Spec to Create | Controller |
|------|---------------|------------|
| 1 | `src/api/public/auth.controller.spec.ts` | `AuthController` |
| 2 | `src/api/public/catalog.controller.spec.ts` | `PublicCatalogController` |
| 3 | `src/api/public/slots.controller.spec.ts` | `PublicSlotsController` |
| 4 | `src/api/public/branding.controller.spec.ts` | `PublicBrandingController` |
| 5 | `src/api/mobile/client/bookings.controller.spec.ts` | `MobileClientBookingsController` |
| 6 | `src/api/mobile/client/profile.controller.spec.ts` | `MobileClientProfileController` |
| 7 | `src/api/mobile/client/payments.controller.spec.ts` | `MobileClientPaymentsController` |
| 8 | `src/api/mobile/client/chat.controller.spec.ts` | `MobileClientChatController` |
| 9 | `src/api/mobile/client/notifications.controller.spec.ts` | `MobileClientNotificationsController` |
| 10 | `src/api/mobile/client/portal/home.controller.spec.ts` | `MobileClientHomeController` |
| 11 | `src/api/mobile/client/portal/upcoming.controller.spec.ts` | `MobileClientUpcomingController` |
| 12 | `src/api/mobile/client/portal/summary.controller.spec.ts` | `MobileClientSummaryController` |
| 13 | `src/api/mobile/employee/schedule.controller.spec.ts` | `MobileEmployeeScheduleController` |
| 14 | `src/api/mobile/employee/clients.controller.spec.ts` | `MobileEmployeeClientsController` |
| 15 | `src/api/mobile/employee/earnings.controller.spec.ts` | `MobileEmployeeEarningsController` |
| 16 | `src/api/dashboard/organization.controller.spec.ts` | re-export barrel |

---

## Task 1: auth.controller.spec.ts

**Files:**
- Create: `src/api/public/auth.controller.spec.ts`

> Note: `AuthController` inlines refresh/logout logic using `PrismaService` + `bcryptjs`. We mock both and simulate the token-matching loop.

- [ ] **Step 1: Write the spec**

```typescript
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

const HASHED = '$2b$10$hashedtoken';
const RAW_TOKEN = 'raw-refresh-token';

// bcryptjs is a real dependency — mock it at module level
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));
import * as bcrypt from 'bcryptjs';

function buildPrisma(overrides: Partial<{
  refreshTokens: unknown[];
  user: unknown;
}> = {}) {
  const tokens = overrides.refreshTokens ?? [
    { id: 'rt-1', tokenHash: HASHED, userId: 'u-1', tenantId: TENANT },
  ];
  const user = overrides.user ?? {
    id: 'u-1', isActive: true, customRole: { permissions: [] },
  };
  return {
    refreshToken: {
      findMany: jest.fn().mockResolvedValue(tokens),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
    },
  };
}

function buildController(prismaOverrides = {}) {
  const login = fn({ accessToken: 'at', refreshToken: 'rt' });
  const logout = fn({});
  const tokens = { issueTokenPair: jest.fn().mockResolvedValue({ accessToken: 'at2', refreshToken: 'rt2' }) };
  const prisma = buildPrisma(prismaOverrides);
  const controller = new AuthController(
    login as never,
    logout as never,
    prisma as never,
    tokens as never,
  );
  return { controller, login, logout, tokens, prisma };
}

describe('AuthController', () => {
  beforeEach(() => {
    (bcrypt.compare as jest.Mock).mockReset();
  });

  // ── login ──────────────────────────────────────────────────────────────
  it('loginEndpoint — delegates to LoginHandler', async () => {
    const { controller, login } = buildController();
    await controller.loginEndpoint(TENANT, { email: 'a@b.com', password: 'pass' } as never);
    expect(login.execute).toHaveBeenCalledWith({ tenantId: TENANT, email: 'a@b.com', password: 'pass' });
  });

  it('loginEndpoint — bubbles error from handler', async () => {
    const { controller, login } = buildController();
    login.execute.mockRejectedValueOnce(new UnauthorizedException('bad credentials'));
    await expect(
      controller.loginEndpoint(TENANT, { email: 'x', password: 'y' } as never),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ── refresh ────────────────────────────────────────────────────────────
  it('refreshEndpoint — issues new token pair when token matches', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const { controller, tokens } = buildController();
    const result = await controller.refreshEndpoint({ refreshToken: RAW_TOKEN } as never);
    expect(tokens.issueTokenPair).toHaveBeenCalled();
    expect(result).toEqual({ accessToken: 'at2', refreshToken: 'rt2' });
  });

  it('refreshEndpoint — throws UnauthorizedException when no token matches', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const { controller } = buildController();
    await expect(
      controller.refreshEndpoint({ refreshToken: RAW_TOKEN } as never),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refreshEndpoint — throws when user is inactive', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const { controller } = buildController({ user: { id: 'u-1', isActive: false } });
    await expect(
      controller.refreshEndpoint({ refreshToken: RAW_TOKEN } as never),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ── logout ─────────────────────────────────────────────────────────────
  it('logoutEndpoint — delegates to LogoutHandler when token matches', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const { controller, logout } = buildController();
    await controller.logoutEndpoint({ refreshToken: RAW_TOKEN } as never);
    expect(logout.execute).toHaveBeenCalledWith({ userId: 'u-1', tenantId: TENANT });
  });

  it('logoutEndpoint — throws UnauthorizedException when no token matches', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const { controller } = buildController();
    await expect(
      controller.logoutEndpoint({ refreshToken: RAW_TOKEN } as never),
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/backend && npx jest src/api/public/auth.controller.spec.ts --no-coverage
```

Expected: 6 tests pass.

- [ ] **Step 3: Commit**

```bash
cd apps/backend && git add src/api/public/auth.controller.spec.ts
git commit -m "test(backend): add auth.controller spec — login/refresh/logout"
```

---

## Task 2: catalog.controller.spec.ts

**Files:**
- Create: `src/api/public/catalog.controller.spec.ts`

> `PublicCatalogController` queries Prisma directly — mock `PrismaService`.

- [ ] **Step 1: Write the spec**

```typescript
import { PublicCatalogController } from './catalog.controller';

const TENANT = 'tenant-1';

function buildPrisma() {
  return {
    department: { findMany: jest.fn().mockResolvedValue([{ id: 'd-1' }]) },
    serviceCategory: { findMany: jest.fn().mockResolvedValue([{ id: 'cat-1' }]) },
    service: { findMany: jest.fn().mockResolvedValue([{ id: 's-1', durationOptions: [] }]) },
  };
}

describe('PublicCatalogController', () => {
  it('getCatalog — queries all three entities for the tenant', async () => {
    const prisma = buildPrisma();
    const controller = new PublicCatalogController(prisma as never);
    const result = await controller.getCatalog(TENANT);
    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT }) }),
    );
    expect(prisma.serviceCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT }) }),
    );
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT }) }),
    );
    expect(result).toMatchObject({ departments: expect.any(Array), categories: expect.any(Array), services: expect.any(Array) });
  });

  it('getCatalog — returns empty arrays when no data', async () => {
    const prisma = {
      department: { findMany: jest.fn().mockResolvedValue([]) },
      serviceCategory: { findMany: jest.fn().mockResolvedValue([]) },
      service: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const controller = new PublicCatalogController(prisma as never);
    const result = await controller.getCatalog(TENANT);
    expect(result).toEqual({ departments: [], categories: [], services: [] });
  });

  it('getCatalog — bubbles database error', async () => {
    const prisma = buildPrisma();
    prisma.department.findMany.mockRejectedValueOnce(new Error('DB_DOWN'));
    const controller = new PublicCatalogController(prisma as never);
    await expect(controller.getCatalog(TENANT)).rejects.toThrow('DB_DOWN');
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/backend && npx jest src/api/public/catalog.controller.spec.ts --no-coverage
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api/public/catalog.controller.spec.ts
git commit -m "test(backend): add catalog.controller spec"
```

---

## Task 3: slots.controller.spec.ts

**Files:**
- Create: `src/api/public/slots.controller.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { PublicSlotsController } from './slots.controller';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

describe('PublicSlotsController', () => {
  it('getSlots — converts date string to Date and delegates to handler', async () => {
    const checkAvailability = fn({ slots: ['09:00', '10:00'] });
    const controller = new PublicSlotsController(checkAvailability as never);
    await controller.getSlots({
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      branchId: 'branch-1',
      date: '2026-06-01',
    } as never);
    expect(checkAvailability.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: expect.any(Date),
      }),
    );
  });

  it('getSlots — passes optional durationMins and serviceId', async () => {
    const checkAvailability = fn({ slots: [] });
    const controller = new PublicSlotsController(checkAvailability as never);
    await controller.getSlots({
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      branchId: 'branch-1',
      date: '2026-06-01',
      durationMins: 30,
      serviceId: 'svc-1',
    } as never);
    expect(checkAvailability.execute).toHaveBeenCalledWith(
      expect.objectContaining({ durationMins: 30, serviceId: 'svc-1' }),
    );
  });

  it('getSlots — bubbles error from handler', async () => {
    const checkAvailability = fn();
    checkAvailability.execute.mockRejectedValueOnce(new Error('employee not found'));
    const controller = new PublicSlotsController(checkAvailability as never);
    await expect(
      controller.getSlots({ tenantId: 't', employeeId: 'e', branchId: 'b', date: '2026-01-01' } as never),
    ).rejects.toThrow('employee not found');
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/backend && npx jest src/api/public/slots.controller.spec.ts --no-coverage
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api/public/slots.controller.spec.ts
git commit -m "test(backend): add slots.controller spec"
```

---

## Task 4: branding.controller.spec.ts

**Files:**
- Create: `src/api/public/branding.controller.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { PublicBrandingController } from './branding.controller';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

describe('PublicBrandingController', () => {
  it('getBrandingEndpoint — delegates to GetBrandingHandler with tenantId', async () => {
    const getBranding = fn({ primaryColor: '#354FD8' });
    const controller = new PublicBrandingController(getBranding as never);
    const result = await controller.getBrandingEndpoint('tenant-1');
    expect(getBranding.execute).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    expect(result).toMatchObject({ primaryColor: '#354FD8' });
  });

  it('getBrandingEndpoint — bubbles NotFoundException when tenant not found', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    const getBranding = fn();
    getBranding.execute.mockRejectedValueOnce(new NotFoundException('tenant not found'));
    const controller = new PublicBrandingController(getBranding as never);
    await expect(controller.getBrandingEndpoint('unknown-tenant')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/backend && npx jest src/api/public/branding.controller.spec.ts --no-coverage
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api/public/branding.controller.spec.ts
git commit -m "test(backend): add branding.controller spec"
```

---

## Task 5: mobile/client/bookings.controller.spec.ts

**Files:**
- Create: `src/api/mobile/client/bookings.controller.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { MobileClientBookingsController } from './bookings.controller';
import { CancellationReason } from '@prisma/client';

const TENANT = 'tenant-1';
const USER = { sub: 'client-1', tenantId: TENANT, role: 'CLIENT' };
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function build() {
  const list = fn({ data: [], meta: {} });
  const get = fn({ id: 'book-1' });
  const create = fn({ id: 'book-1' });
  const cancel = fn({ id: 'book-1' });
  const reschedule = fn({ id: 'book-1' });
  const controller = new MobileClientBookingsController(
    list as never, get as never, create as never, cancel as never, reschedule as never,
  );
  return { controller, list, get, create, cancel, reschedule };
}

describe('MobileClientBookingsController', () => {
  it('createBooking — passes tenantId, clientId from JWT, converts scheduledAt to Date', async () => {
    const { controller, create } = build();
    await controller.createBooking(TENANT, USER, {
      branchId: 'b-1', employeeId: 'e-1', serviceId: 's-1',
      scheduledAt: '2026-06-01T10:00:00Z',
    } as never);
    expect(create.execute).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT,
      clientId: USER.sub,
      scheduledAt: expect.any(Date),
    }));
  });

  it('listMyBookings — defaults page=1 limit=20 and passes clientId', async () => {
    const { controller, list } = build();
    await controller.listMyBookings(TENANT, USER, {} as never);
    expect(list.execute).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT, clientId: USER.sub, page: 1, limit: 20,
    }));
  });

  it('getBooking — passes tenantId and bookingId', async () => {
    const { controller, get } = build();
    await controller.getBooking(TENANT, 'book-1');
    expect(get.execute).toHaveBeenCalledWith({ tenantId: TENANT, bookingId: 'book-1' });
  });

  it('cancelBooking — passes reason and changedBy from JWT', async () => {
    const { controller, cancel } = build();
    await controller.cancelBooking(TENANT, USER, 'book-1', {
      reason: CancellationReason.CLIENT_REQUEST,
    } as never);
    expect(cancel.execute).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: 'book-1',
      changedBy: USER.sub,
      source: 'client',
      reason: CancellationReason.CLIENT_REQUEST,
    }));
  });

  it('rescheduleBooking — passes new date and changedBy', async () => {
    const { controller, reschedule } = build();
    await controller.rescheduleBooking(TENANT, USER, 'book-1', {
      newScheduledAt: '2026-06-10T09:00:00Z',
    } as never);
    expect(reschedule.execute).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: 'book-1',
      changedBy: USER.sub,
      newScheduledAt: expect.any(Date),
    }));
  });

  it('createBooking — bubbles error from handler', async () => {
    const { controller, create } = build();
    create.execute.mockRejectedValueOnce(new Error('slot taken'));
    await expect(
      controller.createBooking(TENANT, USER, { scheduledAt: '2026-06-01T10:00:00Z' } as never),
    ).rejects.toThrow('slot taken');
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/backend && npx jest src/api/mobile/client/bookings.controller.spec.ts --no-coverage
```

Expected: 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api/mobile/client/bookings.controller.spec.ts
git commit -m "test(backend): add mobile client bookings.controller spec"
```

---

## Task 6: mobile/client/profile.controller.spec.ts

**Files:**
- Create: `src/api/mobile/client/profile.controller.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { MobileClientProfileController } from './profile.controller';

const TENANT = 'tenant-1';
const USER = { sub: 'client-1', tenantId: TENANT, role: 'CLIENT' };
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function build() {
  const getClient = fn({ id: 'client-1', name: 'أحمد' });
  const updateClient = fn({ id: 'client-1', name: 'محمد' });
  const controller = new MobileClientProfileController(getClient as never, updateClient as never);
  return { controller, getClient, updateClient };
}

describe('MobileClientProfileController', () => {
  it('getProfile — passes tenantId and clientId from JWT', async () => {
    const { controller, getClient } = build();
    await controller.getProfile(TENANT, USER);
    expect(getClient.execute).toHaveBeenCalledWith({ tenantId: TENANT, clientId: USER.sub });
  });

  it('updateProfile — passes tenantId, clientId, and body fields', async () => {
    const { controller, updateClient } = build();
    await controller.updateProfile(TENANT, USER, { name: 'محمد' } as never);
    expect(updateClient.execute).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT, clientId: USER.sub, name: 'محمد',
    }));
  });

  it('getProfile — bubbles NotFoundException', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    const { controller, getClient } = build();
    getClient.execute.mockRejectedValueOnce(new NotFoundException());
    await expect(controller.getProfile(TENANT, USER)).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/backend && npx jest src/api/mobile/client/profile.controller.spec.ts --no-coverage
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api/mobile/client/profile.controller.spec.ts
git commit -m "test(backend): add mobile client profile.controller spec"
```

---

## Task 7: mobile/client/payments.controller.spec.ts

**Files:**
- Create: `src/api/mobile/client/payments.controller.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { MobileClientPaymentsController } from './payments.controller';

const TENANT = 'tenant-1';
const USER = { sub: 'client-1', tenantId: TENANT, role: 'CLIENT' };
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function build() {
  const listPayments = fn({ data: [], meta: {} });
  const getInvoice = fn({ id: 'inv-1', total: 500 });
  const controller = new MobileClientPaymentsController(listPayments as never, getInvoice as never);
  return { controller, listPayments, getInvoice };
}

describe('MobileClientPaymentsController', () => {
  it('listMyPayments — passes tenantId, clientId, defaults page/limit', async () => {
    const { controller, listPayments } = build();
    await controller.listMyPayments(TENANT, USER, {} as never);
    expect(listPayments.execute).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT, clientId: USER.sub, page: 1, limit: 20,
    }));
  });

  it('getInvoiceEndpoint — passes tenantId and invoiceId', async () => {
    const { controller, getInvoice } = build();
    await controller.getInvoiceEndpoint(TENANT, 'inv-1');
    expect(getInvoice.execute).toHaveBeenCalledWith({ tenantId: TENANT, invoiceId: 'inv-1' });
  });

  it('listMyPayments — bubbles error', async () => {
    const { controller, listPayments } = build();
    listPayments.execute.mockRejectedValueOnce(new Error('db error'));
    await expect(controller.listMyPayments(TENANT, USER, {} as never)).rejects.toThrow('db error');
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/backend && npx jest src/api/mobile/client/payments.controller.spec.ts --no-coverage
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api/mobile/client/payments.controller.spec.ts
git commit -m "test(backend): add mobile client payments.controller spec"
```

---

## Task 8: mobile/client/chat.controller.spec.ts

**Files:**
- Create: `src/api/mobile/client/chat.controller.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { MobileClientChatController } from './chat.controller';

const TENANT = 'tenant-1';
const USER = { sub: 'client-1', tenantId: TENANT, role: 'CLIENT' };
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function build() {
  const chatCompletion = fn({ reply: 'مرحباً' });
  const listConversations = fn({ data: [], meta: {} });
  const listMessages = fn({ data: [], cursor: null });
  const controller = new MobileClientChatController(
    chatCompletion as never, listConversations as never, listMessages as never,
  );
  return { controller, chatCompletion, listConversations, listMessages };
}

describe('MobileClientChatController', () => {
  it('chat — passes tenantId, clientId, and userMessage', async () => {
    const { controller, chatCompletion } = build();
    await controller.chat(TENANT, USER, { userMessage: 'مرحبا', sessionId: 'sess-1' } as never);
    expect(chatCompletion.execute).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT, clientId: USER.sub, userMessage: 'مرحبا', sessionId: 'sess-1',
    }));
  });

  it('listConversationsEndpoint — passes tenantId, clientId, defaults', async () => {
    const { controller, listConversations } = build();
    await controller.listConversationsEndpoint(TENANT, USER, {} as never);
    expect(listConversations.execute).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT, clientId: USER.sub, page: 1, limit: 20,
    }));
  });

  it('listMessagesEndpoint — passes tenantId and conversationId', async () => {
    const { controller, listMessages } = build();
    await controller.listMessagesEndpoint(TENANT, 'conv-1', { limit: 30 } as never);
    expect(listMessages.execute).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT, conversationId: 'conv-1', limit: 30,
    }));
  });

  it('chat — bubbles error from handler', async () => {
    const { controller, chatCompletion } = build();
    chatCompletion.execute.mockRejectedValueOnce(new Error('AI unavailable'));
    await expect(controller.chat(TENANT, USER, { userMessage: 'hi' } as never)).rejects.toThrow('AI unavailable');
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/backend && npx jest src/api/mobile/client/chat.controller.spec.ts --no-coverage
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api/mobile/client/chat.controller.spec.ts
git commit -m "test(backend): add mobile client chat.controller spec"
```

---

## Task 9: mobile/client/notifications.controller.spec.ts

**Files:**
- Create: `src/api/mobile/client/notifications.controller.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { MobileClientNotificationsController } from './notifications.controller';

const TENANT = 'tenant-1';
const USER = { sub: 'client-1', tenantId: TENANT, role: 'CLIENT' };
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function build() {
  const listNotifications = fn({ data: [], meta: {} });
  const markRead = fn({ updated: 3 });
  const controller = new MobileClientNotificationsController(listNotifications as never, markRead as never);
  return { controller, listNotifications, markRead };
}

describe('MobileClientNotificationsController', () => {
  it('listNotificationsEndpoint — passes tenantId, recipientId, defaults', async () => {
    const { controller, listNotifications } = build();
    await controller.listNotificationsEndpoint(TENANT, USER, {} as never);
    expect(listNotifications.execute).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT, recipientId: USER.sub, page: 1, limit: 20,
    }));
  });

  it('listNotificationsEndpoint — passes unreadOnly filter', async () => {
    const { controller, listNotifications } = build();
    await controller.listNotificationsEndpoint(TENANT, USER, { unreadOnly: true } as never);
    expect(listNotifications.execute).toHaveBeenCalledWith(expect.objectContaining({ unreadOnly: true }));
  });

  it('markReadEndpoint — passes tenantId and recipientId from JWT', async () => {
    const { controller, markRead } = build();
    await controller.markReadEndpoint(TENANT, USER);
    expect(markRead.execute).toHaveBeenCalledWith({ tenantId: TENANT, recipientId: USER.sub });
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/backend && npx jest src/api/mobile/client/notifications.controller.spec.ts --no-coverage
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api/mobile/client/notifications.controller.spec.ts
git commit -m "test(backend): add mobile client notifications.controller spec"
```

---

## Task 10: mobile/client/portal/home.controller.spec.ts

**Files:**
- Create: `src/api/mobile/client/portal/home.controller.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { MobileClientHomeController } from './home.controller';

const TENANT = 'tenant-1';
const USER = { sub: 'client-1', tenantId: TENANT, role: 'CLIENT' };
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function build() {
  const listBookings = fn({ data: [{ id: 'b-1' }] });
  const listNotifications = fn({ data: [{ id: 'n-1' }] });
  const listPayments = fn({ data: [{ id: 'p-1' }] });
  const getClient = fn({ id: 'client-1', name: 'أحمد' });
  const controller = new MobileClientHomeController(
    listBookings as never, listNotifications as never, listPayments as never, getClient as never,
  );
  return { controller, listBookings, listNotifications, listPayments, getClient };
}

describe('MobileClientHomeController', () => {
  it('home — calls all four handlers in parallel and returns composite result', async () => {
    const { controller, listBookings, listNotifications, listPayments, getClient } = build();
    const result = await controller.home(TENANT, USER);
    expect(listBookings.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT, clientId: USER.sub }));
    expect(listNotifications.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT, recipientId: USER.sub }));
    expect(listPayments.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT, clientId: USER.sub }));
    expect(getClient.execute).toHaveBeenCalledWith({ tenantId: TENANT, clientId: USER.sub });
    expect(result).toMatchObject({
      profile: expect.objectContaining({ id: 'client-1' }),
      upcomingBookings: expect.any(Array),
      unreadNotifications: expect.any(Array),
      recentPayments: expect.any(Array),
    });
  });

  it('home — bubbles error if any handler fails', async () => {
    const { controller, getClient } = build();
    getClient.execute.mockRejectedValueOnce(new Error('client not found'));
    await expect(controller.home(TENANT, USER)).rejects.toThrow('client not found');
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/backend && npx jest src/api/mobile/client/portal/home.controller.spec.ts --no-coverage
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api/mobile/client/portal/home.controller.spec.ts
git commit -m "test(backend): add mobile portal home.controller spec"
```

---

## Task 11: mobile/client/portal/upcoming.controller.spec.ts

**Files:**
- Create: `src/api/mobile/client/portal/upcoming.controller.spec.ts`

> `MobileClientUpcomingController` uses Prisma directly — mock `findMany` and `count`.

- [ ] **Step 1: Write the spec**

```typescript
import { MobileClientUpcomingController } from './upcoming.controller';

const TENANT = 'tenant-1';
const USER = { sub: 'client-1', tenantId: TENANT, role: 'CLIENT' };

function buildPrisma(bookings = [{ id: 'b-1' }], count = 1) {
  return {
    booking: {
      findMany: jest.fn().mockResolvedValue(bookings),
      count: jest.fn().mockResolvedValue(count),
    },
  };
}

describe('MobileClientUpcomingController', () => {
  it('upcoming — queries bookings for tenant and client, returns paginated result', async () => {
    const prisma = buildPrisma();
    const controller = new MobileClientUpcomingController(prisma as never);
    const result = await controller.upcoming(TENANT, USER, {} as never);
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT, clientId: USER.sub }),
      }),
    );
    expect(result).toMatchObject({ data: expect.any(Array), meta: expect.objectContaining({ total: 1 }) });
  });

  it('upcoming — respects page and limit query params', async () => {
    const prisma = buildPrisma([], 0);
    const controller = new MobileClientUpcomingController(prisma as never);
    await controller.upcoming(TENANT, USER, { page: 2, limit: 5 } as never);
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });

  it('upcoming — bubbles database error', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany.mockRejectedValueOnce(new Error('db error'));
    const controller = new MobileClientUpcomingController(prisma as never);
    await expect(controller.upcoming(TENANT, USER, {} as never)).rejects.toThrow('db error');
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/backend && npx jest src/api/mobile/client/portal/upcoming.controller.spec.ts --no-coverage
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api/mobile/client/portal/upcoming.controller.spec.ts
git commit -m "test(backend): add mobile portal upcoming.controller spec"
```

---

## Task 12: mobile/client/portal/summary.controller.spec.ts

**Files:**
- Create: `src/api/mobile/client/portal/summary.controller.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { MobileClientSummaryController } from './summary.controller';

const TENANT = 'tenant-1';
const USER = { sub: 'client-1', tenantId: TENANT, role: 'CLIENT' };

function buildPrisma() {
  return {
    booking: {
      count: jest.fn().mockResolvedValue(5),
      findFirst: jest.fn().mockResolvedValue({ scheduledAt: new Date('2026-03-01') }),
    },
    invoice: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { total: 1500 } }),
    },
  };
}

describe('MobileClientSummaryController', () => {
  it('summary — returns totalBookings, lastVisit, and outstandingBalance', async () => {
    const prisma = buildPrisma();
    const controller = new MobileClientSummaryController(prisma as never);
    const result = await controller.summary(TENANT, USER);
    expect(result).toMatchObject({
      totalBookings: 5,
      lastVisit: expect.any(Date),
      outstandingBalance: 1500,
    });
  });

  it('summary — returns lastVisit null when no completed bookings', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst.mockResolvedValueOnce(null);
    const controller = new MobileClientSummaryController(prisma as never);
    const result = await controller.summary(TENANT, USER);
    expect(result.lastVisit).toBeNull();
  });

  it('summary — returns 0 outstandingBalance when no unpaid invoices', async () => {
    const prisma = buildPrisma();
    prisma.invoice.aggregate.mockResolvedValueOnce({ _sum: { total: null } });
    const controller = new MobileClientSummaryController(prisma as never);
    const result = await controller.summary(TENANT, USER);
    expect(result.outstandingBalance).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/backend && npx jest src/api/mobile/client/portal/summary.controller.spec.ts --no-coverage
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api/mobile/client/portal/summary.controller.spec.ts
git commit -m "test(backend): add mobile portal summary.controller spec"
```

---

## Task 13: mobile/employee/schedule.controller.spec.ts

**Files:**
- Create: `src/api/mobile/employee/schedule.controller.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { MobileEmployeeScheduleController } from './schedule.controller';

const TENANT = 'tenant-1';
const USER = { sub: 'emp-1', tenantId: TENANT, role: 'EMPLOYEE' };
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function build() {
  const listBookings = fn({ data: [], meta: {} });
  const updateAvailability = fn({ windows: [] });
  const controller = new MobileEmployeeScheduleController(listBookings as never, updateAvailability as never);
  return { controller, listBookings, updateAvailability };
}

describe('MobileEmployeeScheduleController', () => {
  it('today — queries bookings for current day with employeeId from JWT', async () => {
    const { controller, listBookings } = build();
    await controller.today(TENANT, USER);
    expect(listBookings.execute).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT,
      employeeId: USER.sub,
      fromDate: expect.any(Date),
      toDate: expect.any(Date),
      limit: 50,
    }));
  });

  it('weekly — passes date range and employeeId', async () => {
    const { controller, listBookings } = build();
    await controller.weekly(TENANT, USER, {
      fromDate: '2026-06-01',
      toDate: '2026-06-07',
    } as never);
    expect(listBookings.execute).toHaveBeenCalledWith(expect.objectContaining({
      employeeId: USER.sub,
      fromDate: expect.any(Date),
      toDate: expect.any(Date),
    }));
  });

  it('updateAvailabilityEndpoint — passes employeeId and windows', async () => {
    const { controller, updateAvailability } = build();
    await controller.updateAvailabilityEndpoint(TENANT, USER, {
      windows: [{ day: 'MONDAY', startTime: '09:00', endTime: '17:00' }],
    } as never);
    expect(updateAvailability.execute).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT,
      employeeId: USER.sub,
    }));
  });

  it('today — bubbles error from handler', async () => {
    const { controller, listBookings } = build();
    listBookings.execute.mockRejectedValueOnce(new Error('employee not found'));
    await expect(controller.today(TENANT, USER)).rejects.toThrow('employee not found');
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/backend && npx jest src/api/mobile/employee/schedule.controller.spec.ts --no-coverage
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api/mobile/employee/schedule.controller.spec.ts
git commit -m "test(backend): add mobile employee schedule.controller spec"
```

---

## Task 14: mobile/employee/clients.controller.spec.ts

**Files:**
- Create: `src/api/mobile/employee/clients.controller.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { MobileEmployeeClientsController } from './clients.controller';

const TENANT = 'tenant-1';
const USER = { sub: 'emp-1', tenantId: TENANT, role: 'EMPLOYEE' };

function buildPrisma() {
  return {
    booking: {
      findMany: jest.fn()
        .mockResolvedValueOnce([{ clientId: 'c-1' }, { clientId: 'c-2' }]) // distinct client IDs
        .mockResolvedValue([{ id: 'b-1' }]), // history
    },
    client: {
      findMany: jest.fn().mockResolvedValue([{ id: 'c-1', name: 'أحمد' }]),
      count: jest.fn().mockResolvedValue(1),
    },
  };
}

describe('MobileEmployeeClientsController', () => {
  it('listMyClients — queries distinct client IDs then fetches clients', async () => {
    const prisma = buildPrisma();
    const controller = new MobileEmployeeClientsController(prisma as never);
    const result = await controller.listMyClients(TENANT, USER, {} as never);
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT, employeeId: USER.sub }) }),
    );
    expect(result).toMatchObject({ data: expect.any(Array), meta: expect.objectContaining({ total: 1 }) });
  });

  it('listMyClients — includes search filter when provided', async () => {
    const prisma = buildPrisma();
    const controller = new MobileEmployeeClientsController(prisma as never);
    await controller.listMyClients(TENANT, USER, { search: 'أحمد' } as never);
    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) }),
    );
  });

  it('clientHistory — returns bookings for specific client filtered by employeeId', async () => {
    const prisma = buildPrisma();
    const controller = new MobileEmployeeClientsController(prisma as never);
    await controller.clientHistory(TENANT, USER, 'c-1');
    // Second findMany call is the history one
    expect(prisma.booking.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT, employeeId: USER.sub, clientId: 'c-1' }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/backend && npx jest src/api/mobile/employee/clients.controller.spec.ts --no-coverage
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api/mobile/employee/clients.controller.spec.ts
git commit -m "test(backend): add mobile employee clients.controller spec"
```

---

## Task 15: mobile/employee/earnings.controller.spec.ts

**Files:**
- Create: `src/api/mobile/employee/earnings.controller.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { MobileEmployeeEarningsController } from './earnings.controller';

const TENANT = 'tenant-1';
const USER = { sub: 'emp-1', tenantId: TENANT, role: 'EMPLOYEE' };

function buildPrisma(invoices = [
  { total: '500', payments: [{ amount: '500', method: 'CARD' }] },
  { total: '300', payments: [{ amount: '300', method: 'CASH' }] },
]) {
  return {
    invoice: { findMany: jest.fn().mockResolvedValue(invoices) },
  };
}

describe('MobileEmployeeEarningsController', () => {
  it('earnings — sums totals and groups by payment method', async () => {
    const prisma = buildPrisma();
    const controller = new MobileEmployeeEarningsController(prisma as never);
    const result = await controller.earnings(TENANT, USER, {} as never);
    expect(result).toMatchObject({
      totalEarnings: 800,
      invoiceCount: 2,
      byMethod: { CARD: 500, CASH: 300 },
      period: { from: expect.any(String), to: expect.any(String) },
    });
  });

  it('earnings — uses provided from/to dates', async () => {
    const prisma = buildPrisma([]);
    const controller = new MobileEmployeeEarningsController(prisma as never);
    await controller.earnings(TENANT, USER, { from: '2026-01-01', to: '2026-01-31' } as never);
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paidAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      }),
    );
  });

  it('earnings — returns 0 totalEarnings and empty byMethod when no invoices', async () => {
    const prisma = buildPrisma([]);
    const controller = new MobileEmployeeEarningsController(prisma as never);
    const result = await controller.earnings(TENANT, USER, {} as never);
    expect(result.totalEarnings).toBe(0);
    expect(result.invoiceCount).toBe(0);
    expect(result.byMethod).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/backend && npx jest src/api/mobile/employee/earnings.controller.spec.ts --no-coverage
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api/mobile/employee/earnings.controller.spec.ts
git commit -m "test(backend): add mobile employee earnings.controller spec"
```

---

## Task 16: dashboard/organization.controller.spec.ts

**Files:**
- Create: `src/api/dashboard/organization.controller.spec.ts`

> `organization.controller.ts` is a pure barrel re-export — verify the four controllers are exported.

- [ ] **Step 1: Write the spec**

```typescript
import * as barrel from './organization.controller';

describe('organization.controller barrel', () => {
  it('exports DashboardOrganizationBranchesController', () => {
    expect(barrel.DashboardOrganizationBranchesController).toBeDefined();
  });

  it('exports DashboardOrganizationDepartmentsController', () => {
    expect(barrel.DashboardOrganizationDepartmentsController).toBeDefined();
  });

  it('exports DashboardOrganizationCategoriesController', () => {
    expect(barrel.DashboardOrganizationCategoriesController).toBeDefined();
  });

  it('exports DashboardOrganizationHoursController', () => {
    expect(barrel.DashboardOrganizationHoursController).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
cd apps/backend && npx jest src/api/dashboard/organization.controller.spec.ts --no-coverage
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api/dashboard/organization.controller.spec.ts
git commit -m "test(backend): add organization.controller barrel spec"
```

---

## Final Verification

- [ ] **Run full controller spec suite**

```bash
cd apps/backend && npx jest src/api --no-coverage
```

Expected: All 29 controller spec files pass (~120+ tests total).

- [ ] **Verify overall coverage still ≥ 90%**

```bash
cd apps/backend && npm run test:cov -- --silent 2>&1 | grep "All files"
```

Expected output contains:
```
All files  |   90+  |   90+  |   90+  |   90+
```
