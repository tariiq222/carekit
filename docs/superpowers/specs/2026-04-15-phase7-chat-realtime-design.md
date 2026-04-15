# Phase 7 — Chat & Realtime E2E Tests

**Date:** 2026-04-15
**Owner:** test-writer (advanced)
**Duration:** 3–4 days
**New tests:** ~15

## Goal

Add end-to-end coverage for three realtime-adjacent feature areas:
1. AI Chatbot (RAG-backed assistant for clinic staff)
2. Staff ↔ Client chat (conversations between employees and clients)
3. Notifications (API + dashboard sidebar badge)

Tests must auto-surface in the test-report dashboard via the existing tagged-test workflow.

## Scope

| Suite | File | Tests | Type |
|---|---|---|---|
| AI Chatbot | `apps/backend/test/e2e/ai/chatbot-chat.e2e-spec.ts` | 4 | Backend Jest E2E |
| Staff↔Client Chat | `apps/backend/test/e2e/comms/chat.e2e-spec.ts` | 4 | Backend Jest E2E |
| Notifications API | `apps/backend/test/e2e/comms/notifications-realtime.e2e-spec.ts` | 4 | Backend Jest E2E |
| Notifications UI | `apps/dashboard/test/e2e/notifications/notifications-sidebar.e2e-spec.ts` | 3 | Playwright |

## Test IDs and Priorities

Each test name follows the mandatory tagged format:
`[TestID][Module/slice][Priority] العنوان`

### AI Chatbot (`AI-`) — 4 tests

| ID | Priority | Title |
|---|---|---|
| AI-001 | P1-High | إرسال رسالة للـ chatbot وتلقي رد |
| AI-002 | P1-High | Streaming response — chunks تصل متتابعة |
| AI-003 | P2-Medium | New conversation يبدأ context فاضي |
| AI-004 | P2-Medium | Conversation history يحفظ الرسائل |

### Staff ↔ Client Chat (`CH-`) — 4 tests

| ID | Priority | Title |
|---|---|---|
| CH-001 | P1-High | إنشاء محادثة جديدة |
| CH-002 | P1-High | إرسال رسالة وعرضها في list-messages |
| CH-003 | P2-Medium | قفل محادثة (close-conversation) |
| CH-004 | P2-Medium | list-conversations يحترم tenant isolation |

### Notifications API (`NT-`) — 4 tests

| ID | Priority | Title |
|---|---|---|
| NT-001 | P1-High | Create notification يظهر في list |
| NT-002 | P1-High | get-unread-count يعكس الحالة |
| NT-003 | P1-High | mark-read يخفّض العداد |
| NT-004 | P2-Medium | mark-all-read يصفّر العداد |

### Notifications UI (`NT-UI-`) — 3 tests

| ID | Priority | Title |
|---|---|---|
| NT-UI-005 | P1-High | Sidebar badge يظهر العدد بعد إشعار جديد |
| NT-UI-006 | P1-High | فتح القائمة + mark as read يُخفي البادج |
| NT-UI-007 | P2-Medium | mark all as read يصفّر البادج فوراً |

## Infra and Setup Pattern

All backend specs follow the existing pattern from `apps/backend/test/e2e/people/clients.e2e-spec.ts`:

- `beforeAll` — bootstrap Nest app, connect Prisma, seed tenant + admin user.
- `beforeEach` — login admin → acquire JWT → set `Authorization` + `X-Tenant-Id` headers.
- `afterEach` — delete records created by the test (no shared state between tests).
- `afterAll` — close Nest app, disconnect Prisma.

Playwright spec reuses `apps/dashboard/test/e2e/setup/seed-client.ts` pattern:
- Notification is created via backend API call.
- Verification runs against the real dashboard UI.
- Cleanup in `afterEach` deletes the seeded notification via backend.

Per-test UI login is used (not shared `storageState`), per project convention: backend rotates refresh tokens.

## Streaming Strategy (AI-002)

`POST /dashboard/ai/chat-completion` returns `text/event-stream`. Jest collects chunks via supertest buffer parser:

```ts
const chunks: string[] = [];
await request(app.getHttpServer())
  .post('/dashboard/ai/chat-completion')
  .set('Authorization', `Bearer ${token}`)
  .set('X-Tenant-Id', tenantId)
  .send({ message: 'مرحبا', conversationId })
  .buffer(true)
  .parse((res, cb) => {
    res.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
    res.on('end', () => cb(null, chunks));
  });

expect(chunks.length).toBeGreaterThan(1);
expect(chunks.join('')).toMatch(/assistant|رد/);
```

Success signal: `Content-Type: text/event-stream` + more than one chunk received.

**Fallback:** if the test environment does not have a live LLM provider wired (no API key), the AI-00x tests call the handler with a stubbed provider via Nest override. If neither live nor stub is available on the current branch, AI-001/002/004 are marked `it.skip` with a visible TODO and `P3-Low` priority, preserving the test IDs in the report.

## Realtime Strategy (NT-UI-005/006/007)

The sidebar badge currently refetches via TanStack Query polling (verified empirically — no WebSocket wiring on the dashboard today). Playwright flow:

1. Login and navigate to `/dashboard`.
2. Capture the initial badge state (may be absent or `0`).
3. Via `request.context()` POST a notification for the same tenant through the backend API.
4. `await expect(sidebar.getByTestId('notifications-badge')).toHaveText('1')` — polling reflects within the refetch interval (≤ 10s default).
5. Click the bell icon → panel opens → click a single notification's mark-as-read action → `await expect(sidebar.getByTestId('notifications-badge')).toBeHidden()`.
6. For NT-UI-007: seed 3 notifications, click "Mark all as read" → badge hides within one refetch cycle.

**If polling is replaced with SSE/WebSocket later:** switch from `toHaveText` polling to `page.waitForEvent('response', …)` matching the SSE endpoint. Design is forward-compatible.

## `tag_tests.py` Update

Extend `test-reports/scripts/tag_tests.py` (currently at lines 25–32):

```py
ID_TO_MODULE = {
    "CL": "Clients",
    "EM": "Employees",
    "BK": "Bookings",
    "PY": "Payments",
    "AU": "Auth",
    "SV": "Services",
    "AI": "AI Chatbot",       # Phase 7
    "CH": "Chat",             # Phase 7
    "NT": "Notifications",    # Phase 7
}
```

Generalize the `-UI-` rollup logic (currently hardcoded for `CL` around line 135) so `NT-UI-###` rolls up to its `NT-###` parent automatically. Smallest safe change: replace the `prefix_code == "CL" and "UI" in tid` branch with a generic `"UI" in tid` branch that preserves the existing module.

No other changes to the tag script.

## Success Criteria

- `cd apps/backend && npm run test:e2e` passes with 12 new backend tests.
- `cd apps/dashboard && npm run test:e2e` passes with 3 new Playwright tests.
- `npm run test:report:open` shows three new modules in the dashboard: **AI Chatbot**, **Chat**, **Notifications**.
- `NT-UI-###` rolls up under the `NT-###` parent (same way `CL-UI-###` rolls up under `CL-###`).
- Zero `any` in new TypeScript, no edits to production source code outside `tag_tests.py`.
- File sizes ≤ 350 lines each.

## Risks and Open Issues

1. **LLM provider availability** — if no Anthropic key in CI/dev, AI tests must either stub the provider via Nest `overrideProvider` or skip with a P3 TODO. Decision: try stubbing first; fall back to skip if the handler's dependencies are not easily overridable.
2. **Polling vs WebSocket assumption** — design assumes current TanStack Query polling. If the notifications module moves to WebSocket/SSE between now and implementation, NT-UI tests switch to `page.waitForEvent` without changing IDs.
3. **Tenant isolation for CH-004** — requires seeding a second tenant. Reuse the multi-tenant seed pattern from `clients.e2e-spec.ts`.
4. **Badge test-id** — `notifications-badge` test id may not exist on the sidebar component today. If missing, add it as part of Phase 7 (small dashboard edit, not feature work).

## Out of Scope

- Mobile app notifications / FCM push.
- Websocket infrastructure changes.
- Email notifications (covered by separate email-templates tests).
- AI knowledge base seeding tests (covered by `modules/ai/manage-knowledge-base`).
