# Phase 7 — Chat & Realtime Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 15 tagged E2E tests covering the AI chatbot, staff↔client chat, and notifications (API + dashboard sidebar badge) so they auto-appear in the CareKit test-report dashboard under three new modules (`AI`, `CH`, `NT`).

**Architecture:** Four test files (3 backend Jest E2E, 1 Playwright). Backend tests follow the existing `clients.e2e-spec.ts` pattern — they reuse `createTestApp()` from `test/setup/app.setup.ts` which already stubs external adapters. The `ChatAdapter` override must be upgraded to match the real interface (`complete`/`stream`/`isAvailable`) so AI tests exercise the full handler path without a live LLM. The Playwright spec seeds notifications via backend API, then verifies the sidebar badge and mark-as-read flow in the browser. `test-reports/scripts/tag_tests.py` gets three new module prefixes and a generalised `-UI-` rollup.

**Tech Stack:** Jest 30 + supertest (backend), Playwright (dashboard), NestJS Testing, Prisma 7, TanStack Query polling (notifications badge), `test-reports/scripts/tag_tests.py` (Python) for report rollup.

---

## File Structure

**Create:**
- `apps/backend/test/e2e/ai/chatbot-chat.e2e-spec.ts` — 4 tests (AI-001..004)
- `apps/backend/test/e2e/comms/chat.e2e-spec.ts` — 4 tests (CH-001..004)
- `apps/backend/test/e2e/comms/notifications-realtime.e2e-spec.ts` — 4 tests (NT-001..004)
- `apps/dashboard/test/e2e/notifications/notifications-sidebar.e2e-spec.ts` — 3 tests (NT-UI-005..007)
- `apps/dashboard/test/e2e/setup/seed-notification.ts` — helper matching `seed-client.ts` pattern

**Modify:**
- `apps/backend/test/setup/app.setup.ts:113-114` — fix `ChatAdapter` override to expose real interface (`complete`, `stream`, `isAvailable`)
- `test-reports/scripts/tag_tests.py:25-32` — add `AI`, `CH`, `NT` prefixes
- `test-reports/scripts/tag_tests.py:133-136` — generalise `-UI-` rollup beyond `CL`
- `apps/dashboard/components/header.tsx` — add `data-testid="notifications-badge"` to the badge span, `data-testid="notifications-bell"` to the trigger
- `apps/dashboard/components/features/notifications/notification-dropdown.tsx` — add `data-testid="notification-item"` on each row and `data-testid="mark-all-read"` on the mark-all button

**No changes to:**
- Any handler, controller, DTO, or Prisma schema
- `jest-e2e.json`, `playwright.config.ts`, or any build config
- Existing tests or existing test helpers

---

## Key Facts Pinned From Exploration

These are verified against the current codebase — use them verbatim:

- **AI endpoint is `POST /dashboard/ai/chat`**, NOT `/chat-completion`. Handler returns JSON `{ sessionId, reply, sourcesUsed }`, NOT SSE. AI-002 therefore verifies _both user+assistant messages persist in one call_ (the realtime-adjacent invariant that actually exists), not chunked streaming. Streaming is deferred.
- **`ChatAdapter` global stub in `app.setup.ts:113-114` uses `.chat()` but the real interface is `.complete() + .stream() + .isAvailable()`** — the override must be corrected or all AI tests will throw `BadRequestException('ChatAdapter is not available')`.
- **Notifications controller uses `recipientId = user.sub`.** The seeded `adminUser.id = 'user-admin-e2e'` — all NT-00x tests must create `Notification` rows with `recipientId: 'user-admin-e2e'` and `tenantId: TEST_TENANT_ID`.
- **`NotificationType` + `RecipientType` enums** live in `comms.prisma`. Use `recipientType: 'STAFF'` and a safe type like `'APPOINTMENT_REMINDER'` — the test will look up the actual enum values from Prisma client in Task 0.
- **Chat endpoints**: `POST /dashboard/comms/chat/conversations/:id/messages`, `GET /dashboard/comms/chat/conversations`, `PATCH /dashboard/comms/chat/conversations/:id/close`. There is no "create conversation" endpoint in the current dashboard controller — CH-001 creates the conversation directly in the DB via `testPrisma.chatConversation.create`, which matches how walk-in clients are seeded elsewhere.
- **ChatSession + ChatMessage** (AI) and **ChatConversation + CommsChatMessage** (staff chat) are SEPARATE Prisma models — don't conflate.
- **Header badge** in `apps/dashboard/components/header.tsx:154-156` renders `{unreadCount! > 9 ? "9+" : unreadCount}` when `unreadCount > 0`. It uses `useUnreadCount()` from TanStack Query — polling interval determines realtime latency.
- **Playwright seed pattern** — `apps/dashboard/test/e2e/setup/seed-client.ts` logs in as `admin@carekit-test.com` / `Admin@1234` against `NEXT_PUBLIC_API_URL`, caches the token. New `seed-notification.ts` follows the same structure.
- **Test runner commands** — backend: `cd apps/backend && npx jest --config test/jest-e2e.json path/to/spec.ts`. Dashboard: `cd apps/dashboard && npx playwright test test/e2e/notifications/notifications-sidebar.e2e-spec.ts`.

---

## Task 0: Verify Prisma enum values for notifications

**Files:**
- Read: `apps/backend/prisma/schema/comms.prisma`

- [ ] **Step 1: Read `NotificationType` and `RecipientType` enum values**

Run:
```bash
grep -A 20 "enum NotificationType\|enum RecipientType" apps/backend/prisma/schema/comms.prisma
```

Expected: two enum blocks with their allowed values (e.g. `STAFF`, `CLIENT` for `RecipientType`; `APPOINTMENT_REMINDER`, `NEW_BOOKING`, etc. for `NotificationType`).

- [ ] **Step 2: Record the exact identifiers** in a one-line note at the top of `notifications-realtime.e2e-spec.ts` when you write it (Task 3), e.g.:

```ts
// Enum values verified from comms.prisma Task 0: RecipientType.STAFF, NotificationType.APPOINTMENT_REMINDER
```

No commit for this task — it's a read-only preflight.

---

## Task 1: Fix `ChatAdapter` test override

**Files:**
- Modify: `apps/backend/test/setup/app.setup.ts:113-114`

**Why:** The real `ChatAdapter` exposes `complete(messages): Promise<string>`, `stream(messages): AsyncIterable<string>`, `isAvailable(): boolean`. The current override only defines `chat()`, so `ChatCompletionHandler.execute()` throws `BadRequestException('ChatAdapter is not available')` the moment AI tests call it.

- [ ] **Step 1: Replace the `ChatAdapter` override block**

In `apps/backend/test/setup/app.setup.ts`, find:
```ts
    .overrideProvider(ChatAdapter)
    .useValue({ chat: jest.fn().mockResolvedValue({ content: 'test response' }) })
```

Replace with:
```ts
    .overrideProvider(ChatAdapter)
    .useValue({
      isAvailable: () => true,
      complete: jest.fn(async (messages: Array<{ role: string; content: string }>) => {
        const last = messages[messages.length - 1]?.content ?? '';
        return `test reply for: ${last}`;
      }),
      stream: jest.fn(async function* () {
        yield 'test ';
        yield 'reply';
      }),
    })
```

- [ ] **Step 2: Run the existing AI unit spec to confirm nothing else broke**

Run: `cd apps/backend && npx jest src/modules/ai/chat-completion/chat-completion.handler.spec.ts`
Expected: PASS (the handler unit test doesn't hit this override but gives a quick sanity signal).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/test/setup/app.setup.ts
git commit -m "test(setup): fix ChatAdapter override to match real interface"
```

---

## Task 2: Add `AI-` module prefix to tag_tests.py

**Files:**
- Modify: `test-reports/scripts/tag_tests.py:25-32`

- [ ] **Step 1: Extend `ID_TO_MODULE`**

In `test-reports/scripts/tag_tests.py`, find the block starting `ID_TO_MODULE = {` (line 25) and update it to:

```py
ID_TO_MODULE = {
    "CL": "Clients",
    "EM": "Employees",
    "BK": "Bookings",
    "PY": "Payments",
    "AU": "Auth",
    "SV": "Services",
    "AI": "AI Chatbot",
    "CH": "Chat",
    "NT": "Notifications",
}
```

- [ ] **Step 2: Generalise the `-UI-` rollup**

Find the block around line 133-136 (currently:)
```py
module = ID_TO_MODULE.get(prefix_code, "Uncategorized")
# لـ CL-UI-###  نجعل الـ module = Clients لكن prefix_code = CL
if prefix_code == "CL" and "UI" in tid:
    module = "Clients"
```

Replace the `if prefix_code == "CL"` line with a generic version:
```py
module = ID_TO_MODULE.get(prefix_code, "Uncategorized")
# Generic -UI- rollup: NT-UI-### rolls up under Notifications, same shape as CL-UI-
if "UI" in tid and prefix_code in ID_TO_MODULE:
    module = ID_TO_MODULE[prefix_code]
```

- [ ] **Step 3: Smoke-run the report regeneration**

Run: `npm run test:report`
Expected: script exits 0 (may report no new tests yet — that's fine). No Python tracebacks.

- [ ] **Step 4: Commit**

```bash
git add test-reports/scripts/tag_tests.py
git commit -m "chore(test-report): add AI/CH/NT module prefixes and generic -UI- rollup"
```

---

## Task 3: Notifications API E2E (NT-001..004)

**Files:**
- Create: `apps/backend/test/e2e/comms/notifications-realtime.e2e-spec.ts`

- [ ] **Step 1: Write the full spec file**

Create `apps/backend/test/e2e/comms/notifications-realtime.e2e-spec.ts`:

```ts
import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

// Enum values verified from comms.prisma Task 0: RecipientType.STAFF, NotificationType.APPOINTMENT_REMINDER
const TENANT = TEST_TENANT_ID;
const RECIPIENT = adminUser.id;

async function seedNotification(overrides: Partial<{ title: string; body: string; isRead: boolean }> = {}) {
  return (testPrisma as any).notification.create({
    data: {
      tenantId: TENANT,
      recipientId: RECIPIENT,
      recipientType: 'STAFF',
      type: 'APPOINTMENT_REMINDER',
      title: overrides.title ?? 'Test notification',
      body: overrides.body ?? 'Body text',
      isRead: overrides.isRead ?? false,
    },
  });
}

describe('Notifications realtime API (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
  });

  beforeEach(async () => {
    await cleanTables(['Notification']);
  });

  afterAll(async () => {
    await cleanTables(['Notification']);
    await closeTestApp();
  });

  it('[NT-001][Notifications/list-notifications][P1-High] Create notification يظهر في list', async () => {
    await seedNotification({ title: 'إشعار جديد' });

    const res = await req
      .get('/dashboard/comms/notifications')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('إشعار جديد');
    expect(res.body.data[0].isRead).toBe(false);
  });

  it('[NT-002][Notifications/get-unread-count][P1-High] get-unread-count يعكس الحالة', async () => {
    await seedNotification();
    await seedNotification();
    await seedNotification({ isRead: true });

    const res = await req
      .get('/dashboard/comms/notifications/unread-count')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });

  it('[NT-003][Notifications/mark-read][P1-High] mark-read يخفّض العداد', async () => {
    const n1 = await seedNotification();
    await seedNotification();

    const res = await req
      .patch('/dashboard/comms/notifications/mark-read')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ ids: [n1.id] });

    expect(res.status).toBe(204);

    const countRes = await req
      .get('/dashboard/comms/notifications/unread-count')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(countRes.body.count).toBe(1);

    const inDb = await (testPrisma as any).notification.findUnique({ where: { id: n1.id } });
    expect(inDb.isRead).toBe(true);
    expect(inDb.readAt).not.toBeNull();
  });

  it('[NT-004][Notifications/mark-read][P2-Medium] mark-all-read (بدون ids) يصفّر العداد', async () => {
    await seedNotification();
    await seedNotification();
    await seedNotification();

    const res = await req
      .patch('/dashboard/comms/notifications/mark-read')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({});

    expect(res.status).toBe(204);

    const countRes = await req
      .get('/dashboard/comms/notifications/unread-count')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(countRes.body.count).toBe(0);
  });
});
```

- [ ] **Step 2: Run the spec and confirm all 4 tests pass**

Run:
```bash
cd apps/backend && npx jest --config test/jest-e2e.json test/e2e/comms/notifications-realtime.e2e-spec.ts
```

Expected: 4 passing. If NT-004 fails with "ids required" — the `MarkReadDto` may mandate `ids`; read `apps/backend/src/modules/comms/notifications/mark-read.dto.ts` and if `ids` is required, change NT-004 body to pass all three seeded IDs explicitly instead of `{}`.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/test/e2e/comms/notifications-realtime.e2e-spec.ts
git commit -m "test(e2e): add Notifications realtime API coverage (NT-001..004)"
```

---

## Task 4: Staff↔Client Chat E2E (CH-001..004)

**Files:**
- Create: `apps/backend/test/e2e/comms/chat.e2e-spec.ts`

- [ ] **Step 1: Write the full spec file**

```ts
import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedClient } from '../../setup/seed.helper';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;
const OTHER_TENANT = 'other-tenant-ch-e2e';

describe('Staff↔Client Chat API (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
  });

  beforeEach(async () => {
    await cleanTables(['CommsChatMessage', 'ChatConversation', 'Client']);
  });

  afterAll(async () => {
    await cleanTables(['CommsChatMessage', 'ChatConversation', 'Client']);
    await closeTestApp();
  });

  it('[CH-001][Chat/create-conversation][P1-High] إنشاء محادثة جديدة عبر DB وظهورها في list', async () => {
    const client = await seedClient({ tenantId: TENANT });
    await (testPrisma as any).chatConversation.create({
      data: { tenantId: TENANT, clientId: client.id, status: 'OPEN' },
    });

    const res = await req
      .get('/dashboard/comms/chat/conversations')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].clientId).toBe(client.id);
    expect(res.body.data[0].status).toBe('OPEN');
  });

  it('[CH-002][Chat/send-staff-message][P1-High] إرسال رسالة من الموظف وعرضها في list-messages', async () => {
    const client = await seedClient({ tenantId: TENANT });
    const conv = await (testPrisma as any).chatConversation.create({
      data: { tenantId: TENANT, clientId: client.id, status: 'OPEN' },
    });

    const sendRes = await req
      .post(`/dashboard/comms/chat/conversations/${conv.id}/messages`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ content: 'مرحبا' });

    expect(sendRes.status).toBe(201);

    const listRes = await req
      .get(`/dashboard/comms/chat/conversations/${conv.id}/messages`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].content).toBe('مرحبا');
  });

  it('[CH-003][Chat/close-conversation][P2-Medium] قفل محادثة يغيّر status إلى CLOSED', async () => {
    const client = await seedClient({ tenantId: TENANT });
    const conv = await (testPrisma as any).chatConversation.create({
      data: { tenantId: TENANT, clientId: client.id, status: 'OPEN' },
    });

    const res = await req
      .patch(`/dashboard/comms/chat/conversations/${conv.id}/close`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    const inDb = await (testPrisma as any).chatConversation.findUnique({ where: { id: conv.id } });
    expect(inDb.status).toBe('CLOSED');
  });

  it('[CH-004][Chat/list-conversations][P2-Medium] list-conversations يحترم tenant isolation', async () => {
    const myClient = await seedClient({ tenantId: TENANT });
    const otherClient = await seedClient({ tenantId: OTHER_TENANT });
    await (testPrisma as any).chatConversation.create({
      data: { tenantId: TENANT, clientId: myClient.id, status: 'OPEN' },
    });
    await (testPrisma as any).chatConversation.create({
      data: { tenantId: OTHER_TENANT, clientId: otherClient.id, status: 'OPEN' },
    });

    const res = await req
      .get('/dashboard/comms/chat/conversations')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].clientId).toBe(myClient.id);
  });
});
```

- [ ] **Step 2: Run and confirm**

Run:
```bash
cd apps/backend && npx jest --config test/jest-e2e.json test/e2e/comms/chat.e2e-spec.ts
```

Expected: 4 passing. If CH-002 fails with validation error on `content`, read `apps/backend/src/modules/comms/chat/send-staff-message.dto.ts` and adjust the body field name.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/test/e2e/comms/chat.e2e-spec.ts
git commit -m "test(e2e): add Staff↔Client Chat coverage (CH-001..004)"
```

---

## Task 5: AI Chatbot E2E (AI-001..004)

**Files:**
- Create: `apps/backend/test/e2e/ai/chatbot-chat.e2e-spec.ts`

- [ ] **Step 1: Write the full spec file**

```ts
import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;

describe('AI Chatbot chat endpoint (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
  });

  beforeEach(async () => {
    await cleanTables(['ChatMessage', 'ChatSession']);
  });

  afterAll(async () => {
    await cleanTables(['ChatMessage', 'ChatSession']);
    await closeTestApp();
  });

  it('[AI-001][AI Chatbot/chat-completion][P1-High] إرسال رسالة للـ chatbot وتلقي رد', async () => {
    const res = await req
      .post('/dashboard/ai/chat')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ userMessage: 'ما ساعات عمل العيادة؟', userId: adminUser.id });

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.reply).toMatch(/test reply for:/);
    expect(res.body.sourcesUsed).toBe(0);
  });

  it('[AI-002][AI Chatbot/chat-completion][P1-High] رسالة واحدة تحفظ user+assistant في DB', async () => {
    const res = await req
      .post('/dashboard/ai/chat')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ userMessage: 'سؤال', userId: adminUser.id });

    expect(res.status).toBe(200);
    const sessionId = res.body.sessionId;

    const messages = await (testPrisma as any).chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('سؤال');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toMatch(/test reply for:/);
  });

  it('[AI-003][AI Chatbot/chat-completion][P2-Medium] New conversation بدون sessionId يبدأ جلسة جديدة', async () => {
    const first = await req
      .post('/dashboard/ai/chat')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ userMessage: 'أول رسالة', userId: adminUser.id });

    const second = await req
      .post('/dashboard/ai/chat')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ userMessage: 'محادثة ثانية مستقلة', userId: adminUser.id });

    expect(first.body.sessionId).not.toBe(second.body.sessionId);

    const sessions = await (testPrisma as any).chatSession.count({ where: { tenantId: TENANT } });
    expect(sessions).toBe(2);
  });

  it('[AI-004][AI Chatbot/chat-completion][P2-Medium] Conversation history — نفس sessionId يراكم الرسائل', async () => {
    const first = await req
      .post('/dashboard/ai/chat')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ userMessage: 'الرسالة الأولى', userId: adminUser.id });

    const sessionId = first.body.sessionId;

    await req
      .post('/dashboard/ai/chat')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ userMessage: 'الرسالة الثانية', sessionId, userId: adminUser.id });

    const messages = await (testPrisma as any).chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    expect(messages).toHaveLength(4);
    expect(messages.map((m: { content: string }) => m.content)).toEqual([
      'الرسالة الأولى',
      expect.stringMatching(/test reply for:/),
      'الرسالة الثانية',
      expect.stringMatching(/test reply for:/),
    ]);
  });
});
```

- [ ] **Step 2: Run and confirm**

Run:
```bash
cd apps/backend && npx jest --config test/jest-e2e.json test/e2e/ai/chatbot-chat.e2e-spec.ts
```

Expected: 4 passing. If any test fails with `BadRequestException('ChatAdapter is not available')`, Task 1 wasn't applied — re-check `app.setup.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/test/e2e/ai/chatbot-chat.e2e-spec.ts
git commit -m "test(e2e): add AI Chatbot chat-completion coverage (AI-001..004)"
```

---

## Task 6: Add dashboard test-ids for notifications badge + dropdown

**Files:**
- Modify: `apps/dashboard/components/header.tsx`
- Modify: `apps/dashboard/components/features/notifications/notification-dropdown.tsx`

**Why:** Playwright selectors need stable `data-testid` hooks — the current markup has none on the badge or bell.

- [ ] **Step 1: Add test-ids to header.tsx**

In `apps/dashboard/components/header.tsx`, locate the bell trigger and badge (around line 154). Add:
- `data-testid="notifications-bell"` to the `<Button>`/trigger element that opens the dropdown
- `data-testid="notifications-badge"` to the badge `<span>` that renders `{unreadCount! > 9 ? "9+" : unreadCount}`

Read the file first to pick exact anchor points; don't invent new wrapper elements.

- [ ] **Step 2: Add test-ids to notification-dropdown.tsx**

In `apps/dashboard/components/features/notifications/notification-dropdown.tsx`:
- Add `data-testid="notification-item"` to each rendered notification row (inside the map)
- Add `data-testid="mark-all-read"` to the "mark all as read" button
- Add `data-testid="notification-mark-read"` to the per-item mark-read action (inside the row)

- [ ] **Step 3: Typecheck and lint**

Run:
```bash
cd apps/dashboard && npm run typecheck && npm run lint
```

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/components/header.tsx apps/dashboard/components/features/notifications/notification-dropdown.tsx
git commit -m "test(dashboard): add stable data-testids to notifications header + dropdown"
```

---

## Task 7: Notifications seed helper for Playwright

**Files:**
- Create: `apps/dashboard/test/e2e/setup/seed-notification.ts`

- [ ] **Step 1: Write the helper**

Mirror the `seed-client.ts` pattern exactly:

```ts
/**
 * Seed helpers — create/delete notifications via the backend for the logged-in admin.
 * Used by Playwright specs that verify sidebar badge + mark-as-read UI.
 */

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:5100/api/v1';
const TENANT_ID =
  process.env['NEXT_PUBLIC_TENANT_ID'] ?? 'b46accb4-dd8a-4f34-a2fd-1bac26119e1c';
const ADMIN_EMAIL = process.env['TEST_ADMIN_EMAIL'] ?? 'admin@carekit-test.com';
const ADMIN_PASSWORD = process.env['TEST_ADMIN_PASSWORD'] ?? 'Admin@1234';

let cachedToken: string | null = null;
let cachedUserId: string | null = null;

async function login(): Promise<{ token: string; userId: string }> {
  if (cachedToken && cachedUserId) return { token: cachedToken, userId: cachedUserId };
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = (await res.json()) as { accessToken: string; user: { id: string } };
  cachedToken = data.accessToken;
  cachedUserId = data.user.id;
  return { token: cachedToken, userId: cachedUserId };
}

export interface SeededNotification {
  id: string;
  title: string;
}

export async function seedNotification(
  overrides: Partial<{ title: string; body: string }> = {},
): Promise<SeededNotification> {
  const { token, userId } = await login();
  const res = await fetch(`${API_URL}/internal/test/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': TENANT_ID,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipientId: userId,
      recipientType: 'STAFF',
      type: 'APPOINTMENT_REMINDER',
      title: overrides.title ?? `E2E notification ${Date.now()}`,
      body: overrides.body ?? 'E2E body',
    }),
  });
  if (!res.ok) {
    // Fallback: this project may not expose an internal seeding route.
    // In that case we use the public dashboard create endpoint via the handler if wired,
    // else we fail loudly so the test author adds the route.
    throw new Error(
      `seedNotification failed: ${res.status}. If no seeding endpoint exists, ` +
        `add one under /internal/test/notifications (see Task 7 note).`,
    );
  }
  const data = (await res.json()) as { id: string; title: string };
  return { id: data.id, title: data.title };
}

export async function clearNotifications(): Promise<void> {
  const { token } = await login();
  await fetch(`${API_URL}/internal/test/notifications`, {
    method: 'DELETE',
    headers: { 'X-Tenant-ID': TENANT_ID, Authorization: `Bearer ${token}` },
  });
}
```

- [ ] **Step 2: Confirm whether a test-seed endpoint exists**

Run:
```bash
grep -rn "internal/test/notifications\|@Post.*notifications.*test\|TestSeeding" apps/backend/src
```

- **If found**: proceed — the helper works as-is.
- **If NOT found**: the project does not have a test-only seeding route, which is expected. Fall back to direct Prisma access from within the Playwright spec via a small worker-side shim. Replace the `seedNotification` body above with an approach that `POST`s through the live `CreateNotificationHandler` exposed on a dashboard route — OR if neither exists, **stop and ask the user** whether to (a) add a test-only endpoint, or (b) seed via direct DB connection from the Playwright process using `pg`. Do NOT invent endpoints.

- [ ] **Step 3: Commit only if the helper is actually usable**

If the seed path resolved cleanly in Step 2:
```bash
git add apps/dashboard/test/e2e/setup/seed-notification.ts
git commit -m "test(dashboard): add notification seed helper for Playwright"
```

If blocked, skip the commit and raise the decision to the user before Task 8.

---

## Task 8: Notifications sidebar Playwright spec (NT-UI-005..007)

**Files:**
- Create: `apps/dashboard/test/e2e/notifications/notifications-sidebar.e2e-spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';
import { seedNotification, clearNotifications } from '../setup/seed-notification';

const ADMIN_EMAIL = process.env['TEST_ADMIN_EMAIL'] ?? 'admin@carekit-test.com';
const ADMIN_PASSWORD = process.env['TEST_ADMIN_PASSWORD'] ?? 'Admin@1234';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in|تسجيل الدخول/i }).click();
  await page.waitForURL('**/dashboard**');
}

test.describe('Notifications sidebar badge', () => {
  test.afterEach(async () => {
    await clearNotifications();
  });

  test('[NT-UI-005][Notifications/sidebar-badge][P1-High] Sidebar badge يظهر العدد بعد إشعار جديد', async ({ page }) => {
    await login(page);
    const badge = page.getByTestId('notifications-badge');
    await expect(badge).toBeHidden();

    await seedNotification({ title: 'إشعار UI' });

    await expect(badge).toBeVisible({ timeout: 15_000 });
    await expect(badge).toHaveText(/^1$/);
  });

  test('[NT-UI-006][Notifications/mark-read-ui][P1-High] فتح القائمة + mark as read يُخفي البادج', async ({ page }) => {
    await seedNotification();
    await login(page);

    const badge = page.getByTestId('notifications-badge');
    await expect(badge).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('notifications-bell').click();
    await page.getByTestId('notification-mark-read').first().click();

    await expect(badge).toBeHidden({ timeout: 15_000 });
  });

  test('[NT-UI-007][Notifications/mark-all-read-ui][P2-Medium] mark all as read يصفّر البادج فوراً', async ({ page }) => {
    await seedNotification();
    await seedNotification();
    await seedNotification();
    await login(page);

    const badge = page.getByTestId('notifications-badge');
    await expect(badge).toBeVisible({ timeout: 15_000 });
    await expect(badge).toHaveText(/^3$/);

    await page.getByTestId('notifications-bell').click();
    await page.getByTestId('mark-all-read').click();

    await expect(badge).toBeHidden({ timeout: 15_000 });
  });
});
```

- [ ] **Step 2: Run with the dashboard dev server + backend already running**

Preflight:
```bash
cd apps/backend && npm run dev    # in a separate terminal, running on :5100
cd apps/dashboard && npm run dev  # in a separate terminal, running on :5103
```

Then:
```bash
cd apps/dashboard && npx playwright test test/e2e/notifications/notifications-sidebar.e2e-spec.ts
```

Expected: 3 passing. The 15s timeout accommodates the TanStack Query refetch interval.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/test/e2e/notifications/notifications-sidebar.e2e-spec.ts
git commit -m "test(e2e): add Notifications sidebar badge coverage (NT-UI-005..007)"
```

---

## Task 9: Full suite run + report regeneration

- [ ] **Step 1: Run the backend E2E suite**

Run:
```bash
cd apps/backend && npm run test:e2e
```

Expected: all existing tests plus 12 new ones pass. `test-results-clients.json` (and whichever new JSON files the runner emits) are written.

- [ ] **Step 2: Run the dashboard Playwright suite**

Run:
```bash
cd apps/dashboard && npm run test:e2e
```

Expected: all existing Playwright tests plus 3 new ones pass.

- [ ] **Step 3: Regenerate the HTML report and verify the three new modules appear**

Run:
```bash
npm run test:report
```

Then open `test-reports/output/test-report.html` in a browser and confirm:
- **AI Chatbot** module present with 4 tests (AI-001..004)
- **Chat** module present with 4 tests (CH-001..004)
- **Notifications** module present with 7 tests — 4 API (NT-001..004) + 3 UI (NT-UI-005..007), with the `-UI-` variants rolled up under the `NT-###` parents just like `CL-UI-` rolls up under `CL-`

If any module is missing or rollup is wrong: re-check Task 2 (prefix table + generalised UI rollup logic).

- [ ] **Step 4: Final commit (only if JSON results were re-emitted and you want them tracked)**

The JSON files are gitignored per the memory note — so no commit here. If the report HTML is tracked, commit it:
```bash
git add test-reports/output/test-report.html 2>/dev/null || true
git status  # confirm what changed
# commit only if there are tracked changes:
# git commit -m "chore(test-report): regenerate with Phase 7 coverage"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- AI-001..004 → Task 5 ✅
- CH-001..004 → Task 4 ✅
- NT-001..004 → Task 3 ✅
- NT-UI-005..007 → Task 8 ✅
- `tag_tests.py` prefixes + UI rollup → Task 2 ✅
- `ChatAdapter` stub fix (risk #1 from spec) → Task 1 ✅
- `data-testid` addition (risk #4 from spec) → Task 6 ✅
- Playwright seed helper → Task 7 ✅

**Deviations from spec:**
- AI-002 title changed from "Streaming response — chunks تصل متتابعة" to "رسالة واحدة تحفظ user+assistant في DB". **Reason:** the current `/dashboard/ai/chat` endpoint returns plain JSON, not SSE. Streaming is not wired. Filing a real stream test now would either require fake setup against non-existent code, or `it.skip` placeholders that pollute the report. The replacement verifies the strongest realtime-adjacent invariant that actually exists: both turns are persisted atomically.

**Placeholder scan:** no TBD/TODO/"handle edge cases" text remains.

**Type consistency:** endpoint paths, DTO field names (`userMessage`, `sessionId`, `userId`, `ids`), Prisma model names (`Notification`, `ChatSession`, `ChatMessage`, `ChatConversation`, `CommsChatMessage`), and `data-testid` names are used identically across tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-15-phase7-chat-realtime.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
