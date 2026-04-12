# Test Coverage 85% — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** رفع التغطية من 53.53% إلى 85%+ عبر تغطية الـ dashboard controllers وما تبقى من modules ضعيفة.

**Architecture:** Controllers في NestJS هي thin wrappers تستدعي handlers — اختبارها يعني mock لكل handler وتحقق أن الـ controller يمرر الـ arguments الصحيحة. نستخدم نفس نمط الـ pure-unit mock (بدون `@nestjs/testing`). كل controller له spec file واحد.

**Tech Stack:** Jest, pure constructor mocks (no NestJS testing module), TypeScript strict.

**نقطة البداية:** 53.53% → الهدف 85% يتطلب +31.5%.

**الاستراتيجية:** Controllers تمثل ~1152 سطر بدون تغطية تقريباً (5.48%) — تغطيتها وحدها ترفع الرقم ~15%. الـ 16% المتبقية من modules متوسطة التغطية.

---

## خريطة الملفات

### ملفات جديدة (specs)
| الملف | يغطي |
|-------|------|
| `src/api/dashboard/bookings.controller.spec.ts` | `bookings.controller.ts` (188 سطر) |
| `src/api/dashboard/people.controller.spec.ts` | `people.controller.ts` (124 سطر) |
| `src/api/dashboard/finance.controller.spec.ts` | `finance.controller.ts` (87 سطر) |
| `src/api/dashboard/comms.controller.spec.ts` | `comms.controller.ts` (128 سطر) |
| `src/api/dashboard/ops.controller.spec.ts` | `ops.controller.ts` (46 سطر) |
| `src/api/dashboard/ai.controller.spec.ts` | `ai.controller.ts` (64 سطر) |
| `src/api/dashboard/platform.controller.spec.ts` | `platform.controller.ts` (72 سطر) |
| `src/api/dashboard/organization-settings.controller.spec.ts` | `organization-settings.controller.ts` (139 سطر) |
| `src/api/dashboard/organization-branches.controller.spec.ts` | `organization-branches.controller.ts` (58 سطر) |
| `src/api/dashboard/organization-categories.controller.spec.ts` | `organization-categories.controller.ts` (48 سطر) |
| `src/api/dashboard/organization-departments.controller.spec.ts` | `organization-departments.controller.ts` (48 سطر) |
| `src/api/dashboard/organization-hours.controller.spec.ts` | `organization-hours.controller.ts` (68 سطر) |
| `src/infrastructure/ai/chat.adapter.spec.ts` | `chat.adapter.ts` |
| `src/infrastructure/ai/embedding.adapter.spec.ts` | `embedding.adapter.ts` |
| `src/modules/ops/generate-report/revenue-report.builder.spec.ts` | `revenue-report.builder.ts` |
| `src/modules/ops/generate-report/activity-report.builder.spec.ts` | `activity-report.builder.ts` |

---

## نمط اختبار الـ Controllers

كل controller spec يتبع هذا النمط الموحد:

```typescript
// نموذج: بناء mock handler بسيط
const buildHandler = <T>(result: T) => ({ execute: jest.fn().mockResolvedValue(result) });
const TENANT = 'tenant-1';
const USER = 'user-1';

// استدعاء الـ endpoint مباشرة (تجاوز HTTP layer — نختبر المنطق فقط)
const controller = new XyzController(handler1, handler2, ...);
const result = await controller.someEndpoint(TENANT, body, query);
```

الـ controller لا تحتوي منطقاً — نتحقق فقط من:
1. أن `handler.execute` استُدعي
2. أن `tenantId` مُرر صحيحاً
3. أن date strings حُوّلت إلى `Date` objects (حيث ينطبق)

---

## Task 1: Dashboard Bookings Controller

**Files:**
- Create: `src/api/dashboard/bookings.controller.spec.ts`

- [ ] **Step 1: اقرأ الملف بالكامل**

```bash
cd apps/backend && cat src/api/dashboard/bookings.controller.ts
```

- [ ] **Step 2: اكتب الـ spec**

```typescript
// src/api/dashboard/bookings.controller.spec.ts
import { DashboardBookingsController } from './bookings.controller';
import { CancellationReason } from '@prisma/client';

const TENANT = 'tenant-1';
const USER = 'user-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const create = fn({ id: 'book-1' });
  const createRecurring = fn({ ids: ['book-1'] });
  const list = fn({ data: [], meta: {} });
  const get = fn({ id: 'book-1' });
  const cancel = fn({ id: 'book-1' });
  const reschedule = fn({ id: 'book-1' });
  const confirm = fn({ id: 'book-1' });
  const checkIn = fn({ id: 'book-1' });
  const complete = fn({ id: 'book-1' });
  const noShow = fn({ id: 'book-1' });
  const waitlist = fn({ id: 'wl-1' });
  const availability = fn({ available: true });
  const controller = new DashboardBookingsController(
    create as never, createRecurring as never, list as never, get as never,
    cancel as never, reschedule as never, confirm as never, checkIn as never,
    complete as never, noShow as never, waitlist as never, availability as never,
  );
  return { controller, create, createRecurring, list, get, cancel, reschedule, confirm, checkIn, complete, noShow, waitlist, availability };
}

describe('DashboardBookingsController', () => {
  it('createBooking — passes tenantId and converts date strings to Date', async () => {
    const { controller, create } = buildController();
    await controller.createBooking(TENANT, {
      scheduledAt: '2026-06-01T10:00:00Z',
      clientId: 'c-1', employeeId: 'e-1', serviceId: 's-1',
      branchId: 'b-1', durationMins: 60, bookingType: 'INDIVIDUAL',
    } as never);
    expect(create.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, scheduledAt: expect.any(Date) }),
    );
  });

  it('listBookings — passes tenantId and default pagination', async () => {
    const { controller, list } = buildController();
    await controller.listBookings(TENANT, {} as never);
    expect(list.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, page: 1 }),
    );
  });

  it('getBooking — passes tenantId and bookingId', async () => {
    const { controller, get } = buildController();
    await controller.getBooking(TENANT, 'book-1');
    expect(get.execute).toHaveBeenCalledWith({ tenantId: TENANT, bookingId: 'book-1' });
  });

  it('cancelBooking — passes tenantId, bookingId, and changedBy', async () => {
    const { controller, cancel } = buildController();
    await controller.cancelBooking(TENANT, USER, 'book-1', { reason: CancellationReason.CLIENT_REQUESTED } as never);
    expect(cancel.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, bookingId: 'book-1', changedBy: USER }),
    );
  });

  it('confirmBooking — passes tenantId and bookingId', async () => {
    const { controller, confirm } = buildController();
    await controller.confirmBooking(TENANT, USER, 'book-1');
    expect(confirm.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, bookingId: 'book-1' }),
    );
  });

  it('checkInBooking — passes tenantId and bookingId', async () => {
    const { controller, checkIn } = buildController();
    await controller.checkInBooking(TENANT, USER, 'book-1');
    expect(checkIn.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, bookingId: 'book-1' }),
    );
  });

  it('completeBooking — passes tenantId and bookingId', async () => {
    const { controller, complete } = buildController();
    await controller.completeBooking(TENANT, USER, 'book-1', {} as never);
    expect(complete.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, bookingId: 'book-1' }),
    );
  });

  it('noShowBooking — passes tenantId and bookingId', async () => {
    const { controller, noShow } = buildController();
    await controller.noShowBooking(TENANT, USER, 'book-1');
    expect(noShow.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, bookingId: 'book-1' }),
    );
  });

  it('addToWaitlist — passes tenantId', async () => {
    const { controller, waitlist } = buildController();
    await controller.addToWaitlist(TENANT, { serviceId: 's-1' } as never);
    expect(waitlist.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('checkAvailability — passes tenantId', async () => {
    const { controller, availability } = buildController();
    await controller.checkAvailability(TENANT, {} as never);
    expect(availability.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('rescheduleBooking — converts new date string to Date', async () => {
    const { controller, reschedule } = buildController();
    await controller.rescheduleBooking(TENANT, USER, 'book-1', { newScheduledAt: '2026-07-01T09:00:00Z' } as never);
    expect(reschedule.execute).toHaveBeenCalledWith(
      expect.objectContaining({ newScheduledAt: expect.any(Date) }),
    );
  });
});
```

- [ ] **Step 3: شغّل الاختبار**

```bash
cd apps/backend && npx jest bookings.controller --no-coverage
```
Expected: 1 suite, 11 tests, all PASS

- [ ] **Step 4: Commit**

```bash
git add src/api/dashboard/bookings.controller.spec.ts
git commit -m "test(backend/api): add spec for dashboard bookings controller"
```

---

## Task 2: Dashboard People Controller

**Files:**
- Create: `src/api/dashboard/people.controller.spec.ts`

- [ ] **Step 1: اقرأ الملف**

```bash
cd apps/backend && cat src/api/dashboard/people.controller.ts
```

- [ ] **Step 2: اكتب الـ spec**

```typescript
// src/api/dashboard/people.controller.spec.ts
import { DashboardPeopleController } from './people.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createClient = fn({ id: 'c-1' });
  const updateClient = fn({ id: 'c-1' });
  const listClients = fn({ data: [], meta: {} });
  const getClient = fn({ id: 'c-1' });
  const createEmployee = fn({ id: 'e-1' });
  const listEmployees = fn({ data: [], meta: {} });
  const getEmployee = fn({ id: 'e-1' });
  const updateAvailability = fn({ slots: [] });
  const employeeOnboarding = fn({ id: 'e-1' });
  const controller = new DashboardPeopleController(
    createClient as never, updateClient as never, listClients as never, getClient as never,
    createEmployee as never, listEmployees as never, getEmployee as never,
    updateAvailability as never, employeeOnboarding as never,
  );
  return { controller, createClient, updateClient, listClients, getClient, createEmployee, listEmployees, getEmployee, updateAvailability, employeeOnboarding };
}

describe('DashboardPeopleController', () => {
  it('createClientEndpoint — passes tenantId', async () => {
    const { controller, createClient } = buildController();
    await controller.createClientEndpoint(TENANT, { nameAr: 'أحمد', phone: '+966500000000' } as never);
    expect(createClient.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listClientsEndpoint — passes tenantId and defaults page/limit', async () => {
    const { controller, listClients } = buildController();
    await controller.listClientsEndpoint(TENANT, {} as never);
    expect(listClients.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, page: 1, limit: 20 }),
    );
  });

  it('getClientEndpoint — passes tenantId and id', async () => {
    const { controller, getClient } = buildController();
    await controller.getClientEndpoint(TENANT, 'c-1');
    expect(getClient.execute).toHaveBeenCalledWith({ tenantId: TENANT, clientId: 'c-1' });
  });

  it('updateClientEndpoint — passes tenantId and id', async () => {
    const { controller, updateClient } = buildController();
    await controller.updateClientEndpoint(TENANT, 'c-1', { nameAr: 'محمد' } as never);
    expect(updateClient.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, clientId: 'c-1' }),
    );
  });

  it('createEmployeeEndpoint — passes tenantId', async () => {
    const { controller, createEmployee } = buildController();
    await controller.createEmployeeEndpoint(TENANT, { nameAr: 'سارة' } as never);
    expect(createEmployee.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listEmployeesEndpoint — passes tenantId and defaults pagination', async () => {
    const { controller, listEmployees } = buildController();
    await controller.listEmployeesEndpoint(TENANT, {} as never);
    expect(listEmployees.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, page: 1 }),
    );
  });

  it('getEmployeeEndpoint — passes tenantId and id', async () => {
    const { controller, getEmployee } = buildController();
    await controller.getEmployeeEndpoint(TENANT, 'e-1');
    expect(getEmployee.execute).toHaveBeenCalledWith({ tenantId: TENANT, employeeId: 'e-1' });
  });

  it('updateAvailabilityEndpoint — passes tenantId and employeeId', async () => {
    const { controller, updateAvailability } = buildController();
    await controller.updateAvailabilityEndpoint(TENANT, 'e-1', { slots: [] } as never);
    expect(updateAvailability.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, employeeId: 'e-1' }),
    );
  });

  it('employeeOnboardingEndpoint — passes tenantId and employeeId', async () => {
    const { controller, employeeOnboarding } = buildController();
    await controller.employeeOnboardingEndpoint(TENANT, 'e-1', {} as never);
    expect(employeeOnboarding.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, employeeId: 'e-1' }),
    );
  });
});
```

- [ ] **Step 3: شغّل الاختبار**

```bash
cd apps/backend && npx jest people.controller --no-coverage
```
Expected: 1 suite, 9 tests, all PASS

- [ ] **Step 4: Commit**

```bash
git add src/api/dashboard/people.controller.spec.ts
git commit -m "test(backend/api): add spec for dashboard people controller"
```

---

## Task 3: Dashboard Finance + Comms Controllers

**Files:**
- Create: `src/api/dashboard/finance.controller.spec.ts`
- Create: `src/api/dashboard/comms.controller.spec.ts`

- [ ] **Step 1: اقرأ الملفين**

```bash
cd apps/backend && cat src/api/dashboard/finance.controller.ts && echo "===" && cat src/api/dashboard/comms.controller.ts
```

- [ ] **Step 2: اكتب spec لـ Finance controller**

```typescript
// src/api/dashboard/finance.controller.spec.ts
import { DashboardFinanceController } from './finance.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createInvoice = fn({ id: 'inv-1' });
  const getInvoice = fn({ id: 'inv-1' });
  const processPayment = fn({ id: 'pay-1' });
  const listPayments = fn({ data: [], meta: {} });
  const applyCoupon = fn({ discount: 10 });
  const zatcaSubmit = fn({ status: 'ok' });
  const controller = new DashboardFinanceController(
    createInvoice as never, getInvoice as never, processPayment as never,
    listPayments as never, applyCoupon as never, zatcaSubmit as never,
  );
  return { controller, createInvoice, getInvoice, processPayment, listPayments, applyCoupon, zatcaSubmit };
}

describe('DashboardFinanceController', () => {
  it('createInv — passes tenantId and converts dueAt to Date', async () => {
    const { controller, createInvoice } = buildController();
    await controller.createInv(TENANT, { dueAt: '2026-07-01', bookingId: 'b-1' } as never);
    expect(createInvoice.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, dueAt: expect.any(Date) }),
    );
  });

  it('createInv — handles missing dueAt', async () => {
    const { controller, createInvoice } = buildController();
    await controller.createInv(TENANT, { bookingId: 'b-1' } as never);
    expect(createInvoice.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, dueAt: undefined }),
    );
  });

  it('getInv — passes tenantId and invoiceId', async () => {
    const { controller, getInvoice } = buildController();
    await controller.getInv(TENANT, 'inv-1');
    expect(getInvoice.execute).toHaveBeenCalledWith({ tenantId: TENANT, invoiceId: 'inv-1' });
  });

  it('processPaymentEndpoint — passes tenantId', async () => {
    const { controller, processPayment } = buildController();
    await controller.processPaymentEndpoint(TENANT, { invoiceId: 'inv-1', method: 'CARD' } as never);
    expect(processPayment.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listPaymentsEndpoint — passes tenantId', async () => {
    const { controller, listPayments } = buildController();
    await controller.listPaymentsEndpoint(TENANT, {} as never);
    expect(listPayments.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('applyCouponEndpoint — passes tenantId', async () => {
    const { controller, applyCoupon } = buildController();
    await controller.applyCouponEndpoint(TENANT, { code: 'SAVE10', invoiceId: 'inv-1' } as never);
    expect(applyCoupon.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('zatcaSubmitEndpoint — passes tenantId and invoiceId', async () => {
    const { controller, zatcaSubmit } = buildController();
    await controller.zatcaSubmitEndpoint(TENANT, 'inv-1', {} as never);
    expect(zatcaSubmit.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, invoiceId: 'inv-1' }),
    );
  });
});
```

- [ ] **Step 3: اكتب spec لـ Comms controller**

```typescript
// src/api/dashboard/comms.controller.spec.ts
import { DashboardCommsController } from './comms.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const listNotifications = fn({ data: [], meta: {} });
  const markRead = fn({ updated: 1 });
  const listEmailTemplates = fn({ data: [] });
  const getEmailTemplate = fn({ id: 'tpl-1' });
  const createEmailTemplate = fn({ id: 'tpl-1' });
  const updateEmailTemplate = fn({ id: 'tpl-1' });
  const listConversations = fn({ data: [] });
  const listMessages = fn({ data: [] });
  const controller = new DashboardCommsController(
    listNotifications as never, markRead as never, listEmailTemplates as never,
    getEmailTemplate as never, createEmailTemplate as never, updateEmailTemplate as never,
    listConversations as never, listMessages as never,
  );
  return { controller, listNotifications, markRead, listEmailTemplates, getEmailTemplate, createEmailTemplate, updateEmailTemplate, listConversations, listMessages };
}

describe('DashboardCommsController', () => {
  it('listNotificationsEndpoint — passes tenantId with defaults', async () => {
    const { controller, listNotifications } = buildController();
    await controller.listNotificationsEndpoint(TENANT, {} as never);
    expect(listNotifications.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, page: 1, limit: 20 }),
    );
  });

  it('markReadEndpoint — passes tenantId', async () => {
    const { controller, markRead } = buildController();
    await controller.markReadEndpoint(TENANT, { ids: ['n-1'] } as never);
    expect(markRead.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listEmailTemplatesEndpoint — passes tenantId', async () => {
    const { controller, listEmailTemplates } = buildController();
    await controller.listEmailTemplatesEndpoint(TENANT, {} as never);
    expect(listEmailTemplates.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('getEmailTemplateEndpoint — passes tenantId and id', async () => {
    const { controller, getEmailTemplate } = buildController();
    await controller.getEmailTemplateEndpoint(TENANT, 'tpl-1');
    expect(getEmailTemplate.execute).toHaveBeenCalledWith({ tenantId: TENANT, templateId: 'tpl-1' });
  });

  it('createEmailTemplateEndpoint — passes tenantId', async () => {
    const { controller, createEmailTemplate } = buildController();
    await controller.createEmailTemplateEndpoint(TENANT, { type: 'BOOKING_CONFIRMED' } as never);
    expect(createEmailTemplate.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('updateEmailTemplateEndpoint — passes tenantId and id', async () => {
    const { controller, updateEmailTemplate } = buildController();
    await controller.updateEmailTemplateEndpoint(TENANT, 'tpl-1', { subject: 'Updated' } as never);
    expect(updateEmailTemplate.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, templateId: 'tpl-1' }),
    );
  });

  it('listConversationsEndpoint — passes tenantId', async () => {
    const { controller, listConversations } = buildController();
    await controller.listConversationsEndpoint(TENANT, {} as never);
    expect(listConversations.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listMessagesEndpoint — passes tenantId and conversationId', async () => {
    const { controller, listMessages } = buildController();
    await controller.listMessagesEndpoint(TENANT, 'conv-1', {} as never);
    expect(listMessages.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, conversationId: 'conv-1' }),
    );
  });
});
```

- [ ] **Step 4: شغّل الاختبارات**

```bash
cd apps/backend && npx jest finance.controller comms.controller --no-coverage
```
Expected: 2 suites, ~15 tests, all PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/dashboard/finance.controller.spec.ts \
        src/api/dashboard/comms.controller.spec.ts
git commit -m "test(backend/api): add specs for dashboard finance and comms controllers"
```

---

## Task 4: Dashboard Ops + AI + Platform Controllers

**Files:**
- Create: `src/api/dashboard/ops.controller.spec.ts`
- Create: `src/api/dashboard/ai.controller.spec.ts`
- Create: `src/api/dashboard/platform.controller.spec.ts`

- [ ] **Step 1: اقرأ الملفات**

```bash
cd apps/backend
cat src/api/dashboard/ops.controller.ts
cat src/api/dashboard/ai.controller.ts
cat src/api/dashboard/platform.controller.ts
```

- [ ] **Step 2: اكتب spec لـ Ops controller**

```typescript
// src/api/dashboard/ops.controller.spec.ts
import { DashboardOpsController } from './ops.controller';
import { ReportFormat } from '@prisma/client';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const generateReport = fn({ reportId: 'r-1', format: ReportFormat.JSON, data: {}, status: 'COMPLETED' });
  const listActivity = fn({ data: [] });
  const controller = new DashboardOpsController(generateReport as never, listActivity as never);
  return { controller, generateReport, listActivity };
}

const buildRes = () => ({
  setHeader: jest.fn(),
  send: jest.fn(),
});

describe('DashboardOpsController', () => {
  it('generateReportEndpoint — passes tenantId', async () => {
    const { controller, generateReport } = buildController();
    const res = buildRes();
    await controller.generateReportEndpoint(TENANT, { type: 'REVENUE', from: '2026-01-01', to: '2026-01-31', requestedBy: 'u-1' } as never, res as never);
    expect(generateReport.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('generateReportEndpoint — sends Excel buffer when format is EXCEL', async () => {
    const excelBuffer = Buffer.from('excel-data');
    const generateReport = fn({ reportId: 'r-1', format: ReportFormat.EXCEL, excelBuffer, status: 'COMPLETED' });
    const listActivity = fn();
    const controller = new DashboardOpsController(generateReport as never, listActivity as never);
    const res = buildRes();
    await controller.generateReportEndpoint(TENANT, { type: 'REVENUE', from: '2026-01-01', to: '2026-01-31', requestedBy: 'u-1' } as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.send).toHaveBeenCalledWith(excelBuffer);
  });

  it('listActivityEndpoint — passes tenantId', async () => {
    const { controller, listActivity } = buildController();
    await controller.listActivityEndpoint(TENANT, {} as never);
    expect(listActivity.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });
});
```

- [ ] **Step 3: اكتب spec لـ AI controller**

```typescript
// src/api/dashboard/ai.controller.spec.ts
import { DashboardAiController } from './ai.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });
const kbFn = () => ({
  listDocuments: jest.fn().mockResolvedValue({ data: [] }),
  getDocument: jest.fn().mockResolvedValue({ id: 'doc-1' }),
  updateDocument: jest.fn().mockResolvedValue({ id: 'doc-1' }),
  deleteDocument: jest.fn().mockResolvedValue(undefined),
});

function buildController() {
  const knowledgeBase = kbFn();
  const chatCompletion = fn({ content: 'Hello' });
  const controller = new DashboardAiController(knowledgeBase as never, chatCompletion as never);
  return { controller, knowledgeBase, chatCompletion };
}

describe('DashboardAiController', () => {
  it('listDocuments — passes tenantId', async () => {
    const { controller, knowledgeBase } = buildController();
    await controller.listDocuments(TENANT, {} as never);
    expect(knowledgeBase.listDocuments).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('getDocument — passes tenantId and id', async () => {
    const { controller, knowledgeBase } = buildController();
    await controller.getDocument(TENANT, 'doc-1');
    expect(knowledgeBase.getDocument).toHaveBeenCalledWith({ tenantId: TENANT, documentId: 'doc-1' });
  });

  it('updateDocument — passes tenantId and id', async () => {
    const { controller, knowledgeBase } = buildController();
    await controller.updateDocument(TENANT, 'doc-1', { isActive: false } as never);
    expect(knowledgeBase.updateDocument).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, documentId: 'doc-1' }),
    );
  });

  it('deleteDocument — passes tenantId and id', async () => {
    const { controller, knowledgeBase } = buildController();
    await controller.deleteDocument(TENANT, 'doc-1');
    expect(knowledgeBase.deleteDocument).toHaveBeenCalledWith({ tenantId: TENANT, documentId: 'doc-1' });
  });

  it('chatCompletionEndpoint — passes tenantId', async () => {
    const { controller, chatCompletion } = buildController();
    await controller.chatCompletionEndpoint(TENANT, { messages: [] } as never);
    expect(chatCompletion.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });
});
```

- [ ] **Step 4: اكتب spec لـ Platform controller**

```typescript
// src/api/dashboard/platform.controller.spec.ts
import { DashboardPlatformController } from './platform.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createProblemReport = fn({ id: 'pr-1' });
  const listProblemReports = fn({ data: [] });
  const updateProblemReportStatus = fn({ id: 'pr-1' });
  const upsertIntegration = fn({ id: 'int-1' });
  const listIntegrations = fn({ data: [] });
  const controller = new DashboardPlatformController(
    createProblemReport as never, listProblemReports as never,
    updateProblemReportStatus as never, upsertIntegration as never, listIntegrations as never,
  );
  return { controller, createProblemReport, listProblemReports, updateProblemReportStatus, upsertIntegration, listIntegrations };
}

describe('DashboardPlatformController', () => {
  it('createProblemReportEndpoint — passes tenantId', async () => {
    const { controller, createProblemReport } = buildController();
    await controller.createProblemReportEndpoint(TENANT, { title: 'Bug' } as never);
    expect(createProblemReport.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listProblemReportsEndpoint — passes tenantId', async () => {
    const { controller, listProblemReports } = buildController();
    await controller.listProblemReportsEndpoint(TENANT, {} as never);
    expect(listProblemReports.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('updateProblemReportStatusEndpoint — passes tenantId and id', async () => {
    const { controller, updateProblemReportStatus } = buildController();
    await controller.updateProblemReportStatusEndpoint(TENANT, 'pr-1', { status: 'RESOLVED' } as never);
    expect(updateProblemReportStatus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, id: 'pr-1' }),
    );
  });

  it('upsertIntegrationEndpoint — passes tenantId', async () => {
    const { controller, upsertIntegration } = buildController();
    await controller.upsertIntegrationEndpoint(TENANT, { provider: 'zoom' } as never);
    expect(upsertIntegration.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listIntegrationsEndpoint — passes tenantId', async () => {
    const { controller, listIntegrations } = buildController();
    await controller.listIntegrationsEndpoint(TENANT);
    expect(listIntegrations.execute).toHaveBeenCalledWith({ tenantId: TENANT });
  });
});
```

- [ ] **Step 5: شغّل الاختبارات**

```bash
cd apps/backend && npx jest ops.controller ai.controller platform.controller --no-coverage
```
Expected: 3 suites, ~13 tests, all PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/dashboard/ops.controller.spec.ts \
        src/api/dashboard/ai.controller.spec.ts \
        src/api/dashboard/platform.controller.spec.ts
git commit -m "test(backend/api): add specs for dashboard ops, AI, and platform controllers"
```

---

## Task 5: Dashboard Organization Controllers (4 controllers)

**Files:**
- Create: `src/api/dashboard/organization-settings.controller.spec.ts`
- Create: `src/api/dashboard/organization-branches.controller.spec.ts`
- Create: `src/api/dashboard/organization-categories.controller.spec.ts`
- Create: `src/api/dashboard/organization-departments.controller.spec.ts`
- Create: `src/api/dashboard/organization-hours.controller.spec.ts`

- [ ] **Step 1: اقرأ الملفات**

```bash
cd apps/backend
cat src/api/dashboard/organization-settings.controller.ts
cat src/api/dashboard/organization-branches.controller.ts
cat src/api/dashboard/organization-categories.controller.ts
cat src/api/dashboard/organization-departments.controller.ts
cat src/api/dashboard/organization-hours.controller.ts
```

- [ ] **Step 2: اكتب spec لـ Organization Settings controller**

```typescript
// src/api/dashboard/organization-settings.controller.spec.ts
import { DashboardOrganizationSettingsController } from './organization-settings.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createService = fn({ id: 'svc-1' });
  const updateService = fn({ id: 'svc-1' });
  const listServices = fn({ data: [] });
  const archiveService = fn({ id: 'svc-1' });
  const upsertBranding = fn({ id: 'br-1' });
  const getBranding = fn({ id: 'br-1' });
  const createIntakeForm = fn({ id: 'if-1' });
  const getIntakeForm = fn({ id: 'if-1' });
  const listIntakeForms = fn({ data: [] });
  const submitRating = fn({ id: 'r-1' });
  const listRatings = fn({ data: [] });
  const controller = new DashboardOrganizationSettingsController(
    createService as never, updateService as never, listServices as never, archiveService as never,
    upsertBranding as never, getBranding as never,
    createIntakeForm as never, getIntakeForm as never, listIntakeForms as never,
    submitRating as never, listRatings as never,
  );
  return { controller, createService, updateService, listServices, archiveService, upsertBranding, getBranding, createIntakeForm, getIntakeForm, listIntakeForms, submitRating, listRatings };
}

describe('DashboardOrganizationSettingsController', () => {
  it('createServiceEndpoint — passes tenantId', async () => {
    const { controller, createService } = buildController();
    await controller.createServiceEndpoint(TENANT, { nameAr: 'خدمة' } as never);
    expect(createService.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listServicesEndpoint — passes tenantId', async () => {
    const { controller, listServices } = buildController();
    await controller.listServicesEndpoint(TENANT, {} as never);
    expect(listServices.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('updateServiceEndpoint — passes tenantId and id', async () => {
    const { controller, updateService } = buildController();
    await controller.updateServiceEndpoint(TENANT, 'svc-1', {} as never);
    expect(updateService.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, serviceId: 'svc-1' }),
    );
  });

  it('archiveServiceEndpoint — passes tenantId and id', async () => {
    const { controller, archiveService } = buildController();
    await controller.archiveServiceEndpoint(TENANT, 'svc-1');
    expect(archiveService.execute).toHaveBeenCalledWith({ tenantId: TENANT, serviceId: 'svc-1' });
  });

  it('upsertBrandingEndpoint — passes tenantId', async () => {
    const { controller, upsertBranding } = buildController();
    await controller.upsertBrandingEndpoint(TENANT, { logoUrl: 'https://example.com/logo.png' } as never);
    expect(upsertBranding.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('getBrandingEndpoint — passes tenantId', async () => {
    const { controller, getBranding } = buildController();
    await controller.getBrandingEndpoint(TENANT);
    expect(getBranding.execute).toHaveBeenCalledWith({ tenantId: TENANT });
  });

  it('createIntakeFormEndpoint — passes tenantId', async () => {
    const { controller, createIntakeForm } = buildController();
    await controller.createIntakeFormEndpoint(TENANT, { title: 'Form' } as never);
    expect(createIntakeForm.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listIntakeFormsEndpoint — passes tenantId', async () => {
    const { controller, listIntakeForms } = buildController();
    await controller.listIntakeFormsEndpoint(TENANT, {} as never);
    expect(listIntakeForms.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('submitRatingEndpoint — passes tenantId', async () => {
    const { controller, submitRating } = buildController();
    await controller.submitRatingEndpoint(TENANT, { bookingId: 'b-1', score: 5 } as never);
    expect(submitRating.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listRatingsEndpoint — passes tenantId', async () => {
    const { controller, listRatings } = buildController();
    await controller.listRatingsEndpoint(TENANT, {} as never);
    expect(listRatings.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });
});
```

- [ ] **Step 3: اكتب specs للـ Branches / Categories / Departments / Hours controllers** (بعد قراءة الملفات في Step 1)

نمط موحد لكل منها:
```typescript
// src/api/dashboard/organization-branches.controller.spec.ts
import { DashboardOrganizationBranchesController } from './organization-branches.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  // بعد القراءة، ابنِ handler mocks بناءً على constructor الفعلي
  // مثال إذا كان: constructor(private create, private list, private get, private update)
  const create = fn({ id: 'br-1' });
  const list = fn({ data: [] });
  const get = fn({ id: 'br-1' });
  const update = fn({ id: 'br-1' });
  const controller = new DashboardOrganizationBranchesController(
    create as never, list as never, get as never, update as never,
  );
  return { controller, create, list, get, update };
}

describe('DashboardOrganizationBranchesController', () => {
  it('create — passes tenantId', async () => {
    const { controller, create } = buildController();
    await controller.createBranch(TENANT, { nameAr: 'فرع' } as never);
    expect(create.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('list — passes tenantId', async () => {
    const { controller, list } = buildController();
    await controller.listBranches(TENANT, {} as never);
    expect(list.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('get — passes tenantId and id', async () => {
    const { controller, get } = buildController();
    await controller.getBranch(TENANT, 'br-1');
    expect(get.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('update — passes tenantId and id', async () => {
    const { controller, update } = buildController();
    await controller.updateBranch(TENANT, 'br-1', {} as never);
    expect(update.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT }),
    );
  });
});
```

اطبق نفس النمط لـ Categories, Departments, Hours — اقرأ الـ controller أولاً لتعرف أسماء الـ methods الفعلية.

- [ ] **Step 4: شغّل الاختبارات**

```bash
cd apps/backend && npx jest organization-settings.controller organization-branches.controller organization-categories.controller organization-departments.controller organization-hours.controller --no-coverage
```
Expected: 5 suites, all PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/dashboard/organization-settings.controller.spec.ts \
        src/api/dashboard/organization-branches.controller.spec.ts \
        src/api/dashboard/organization-categories.controller.spec.ts \
        src/api/dashboard/organization-departments.controller.spec.ts \
        src/api/dashboard/organization-hours.controller.spec.ts
git commit -m "test(backend/api): add specs for dashboard organization controllers"
```

---

## Task 6: Infrastructure AI Adapters

**Files:**
- Create: `src/infrastructure/ai/chat.adapter.spec.ts`
- Create: `src/infrastructure/ai/embedding.adapter.spec.ts`

- [ ] **Step 1: اقرأ الملفين بالكامل**

```bash
cd apps/backend
cat src/infrastructure/ai/chat.adapter.ts
cat src/infrastructure/ai/embedding.adapter.ts
cat src/infrastructure/ai/ai.config.ts
```

- [ ] **Step 2: اكتب spec لـ ChatAdapter**

```typescript
// src/infrastructure/ai/chat.adapter.spec.ts
import { ChatAdapter } from './chat.adapter';

const buildConfig = (openrouterApiKey = 'or-key') => ({
  get: jest.fn().mockReturnValue({
    openrouterApiKey,
    openrouterBaseUrl: 'https://openrouter.ai/api/v1',
    chatModel: 'openai/gpt-4o-mini',
    embeddingModel: 'text-embedding-3-small',
  }),
});

describe('ChatAdapter', () => {
  it('isAvailable returns false when OPENROUTER_API_KEY not set', () => {
    const adapter = new ChatAdapter(buildConfig('') as never);
    adapter.onModuleInit();
    expect(adapter.isAvailable()).toBe(false);
  });

  it('isAvailable returns true after onModuleInit with valid key', () => {
    const adapter = new ChatAdapter(buildConfig('or-key') as never);
    adapter.onModuleInit();
    expect(adapter.isAvailable()).toBe(true);
  });

  it('complete throws when adapter is not available', async () => {
    const adapter = new ChatAdapter(buildConfig('') as never);
    adapter.onModuleInit();
    await expect(adapter.complete([{ role: 'user', content: 'Hello' }])).rejects.toThrow(/not available/);
  });

  it('stream throws when adapter is not available', async () => {
    const adapter = new ChatAdapter(buildConfig('') as never);
    adapter.onModuleInit();
    const gen = adapter.stream([{ role: 'user', content: 'Hello' }]);
    await expect(gen[Symbol.asyncIterator]().next()).rejects.toThrow(/not available/);
  });

  it('complete calls OpenAI client and returns content', async () => {
    const adapter = new ChatAdapter(buildConfig() as never);
    adapter.onModuleInit();
    // Replace internal client with mock
    (adapter as unknown as Record<string, unknown>)['client'] = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Hi there' } }],
          }),
        },
      },
    };
    const result = await adapter.complete([{ role: 'user', content: 'Hello' }]);
    expect(result).toBe('Hi there');
  });
});
```

- [ ] **Step 3: اكتب spec لـ EmbeddingAdapter**

```typescript
// src/infrastructure/ai/embedding.adapter.spec.ts
import { EmbeddingAdapter } from './embedding.adapter';

const buildConfig = (openaiApiKey = 'oai-key') => ({
  get: jest.fn().mockReturnValue({
    openaiApiKey,
    embeddingModel: 'text-embedding-3-small',
    openrouterApiKey: '',
    openrouterBaseUrl: '',
    chatModel: 'gpt-4o-mini',
  }),
});

describe('EmbeddingAdapter', () => {
  it('isAvailable returns false when OPENAI_API_KEY not set', () => {
    const adapter = new EmbeddingAdapter(buildConfig('') as never);
    adapter.onModuleInit();
    expect(adapter.isAvailable()).toBe(false);
  });

  it('isAvailable returns true after onModuleInit with valid key', () => {
    const adapter = new EmbeddingAdapter(buildConfig() as never);
    adapter.onModuleInit();
    expect(adapter.isAvailable()).toBe(true);
  });

  it('embed throws when adapter is not available', async () => {
    const adapter = new EmbeddingAdapter(buildConfig('') as never);
    adapter.onModuleInit();
    await expect(adapter.embed(['text'])).rejects.toThrow(/not available/);
  });

  it('embed calls OpenAI and returns float arrays', async () => {
    const adapter = new EmbeddingAdapter(buildConfig() as never);
    adapter.onModuleInit();
    (adapter as unknown as Record<string, unknown>)['client'] = {
      embeddings: {
        create: jest.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
        }),
      },
    };
    const result = await adapter.embed(['hello', 'world']);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([0.1, 0.2, 0.3]);
  });
});
```

- [ ] **Step 4: شغّل الاختبارات**

```bash
cd apps/backend && npx jest chat.adapter embedding.adapter --no-coverage
```
Expected: 2 suites, ~9 tests, all PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/ai/chat.adapter.spec.ts \
        src/infrastructure/ai/embedding.adapter.spec.ts
git commit -m "test(backend/infrastructure): add specs for AI chat and embedding adapters"
```

---

## Task 7: Generate Report Builders

**Files:**
- Create: `src/modules/ops/generate-report/revenue-report.builder.spec.ts`
- Create: `src/modules/ops/generate-report/activity-report.builder.spec.ts`

- [ ] **Step 1: اقرأ الملفين بالكامل**

```bash
cd apps/backend
cat src/modules/ops/generate-report/revenue-report.builder.ts
cat src/modules/ops/generate-report/activity-report.builder.ts
```

- [ ] **Step 2: اكتب spec لـ Revenue Report Builder**

```typescript
// src/modules/ops/generate-report/revenue-report.builder.spec.ts
import { buildRevenueReport } from './revenue-report.builder';
import { BookingStatus, PaymentStatus } from '@prisma/client';

const from = new Date('2026-01-01');
const to = new Date('2026-01-31');

const buildPrisma = () => ({
  booking: {
    findMany: jest.fn().mockResolvedValue([
      { id: 'b-1', branchId: 'br-1', employeeId: 'e-1', status: BookingStatus.COMPLETED, scheduledAt: new Date('2026-01-10'), price: 300, currency: 'SAR' },
      { id: 'b-2', branchId: 'br-1', employeeId: 'e-2', status: BookingStatus.CANCELLED, scheduledAt: new Date('2026-01-15'), price: 200, currency: 'SAR' },
    ]),
    count: jest.fn().mockResolvedValue(2),
  },
  payment: {
    findMany: jest.fn().mockResolvedValue([
      { id: 'p-1', amount: 300, status: PaymentStatus.PAID, paidAt: new Date('2026-01-10') },
    ]),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 300 } }),
  },
});

describe('buildRevenueReport', () => {
  it('returns period with from and to', async () => {
    const prisma = buildPrisma();
    const result = await buildRevenueReport(prisma as never, { tenantId: 'tenant-1', from, to });
    expect(result.period.from).toBe(from.toISOString());
    expect(result.period.to).toBe(to.toISOString());
  });

  it('returns summary with totalRevenue and counts', async () => {
    const prisma = buildPrisma();
    const result = await buildRevenueReport(prisma as never, { tenantId: 'tenant-1', from, to });
    expect(result.summary).toMatchObject({
      totalBookings: expect.any(Number),
      completedBookings: expect.any(Number),
      cancelledBookings: expect.any(Number),
    });
  });

  it('scopes query to tenantId', async () => {
    const prisma = buildPrisma();
    await buildRevenueReport(prisma as never, { tenantId: 'tenant-99', from, to });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-99' }) }),
    );
  });

  it('filters by branchId when provided', async () => {
    const prisma = buildPrisma();
    await buildRevenueReport(prisma as never, { tenantId: 'tenant-1', from, to, branchId: 'br-1' });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: 'br-1' }) }),
    );
  });

  it('returns byBranch and byEmployee breakdowns', async () => {
    const prisma = buildPrisma();
    const result = await buildRevenueReport(prisma as never, { tenantId: 'tenant-1', from, to });
    expect(Array.isArray(result.byBranch)).toBe(true);
    expect(Array.isArray(result.byEmployee)).toBe(true);
  });
});
```

- [ ] **Step 3: اكتب spec لـ Activity Report Builder**

```typescript
// src/modules/ops/generate-report/activity-report.builder.spec.ts
import { buildActivityReport } from './activity-report.builder';

const from = new Date('2026-01-01');
const to = new Date('2026-01-31');

const buildPrisma = () => ({
  activityLog: {
    findMany: jest.fn().mockResolvedValue([
      { id: 'log-1', tenantId: 'tenant-1', action: 'CREATE', entity: 'Booking', createdAt: new Date('2026-01-05') },
      { id: 'log-2', tenantId: 'tenant-1', action: 'UPDATE', entity: 'Client', createdAt: new Date('2026-01-10') },
    ]),
    count: jest.fn().mockResolvedValue(2),
    groupBy: jest.fn().mockResolvedValue([]),
  },
});

describe('buildActivityReport', () => {
  it('returns activities array', async () => {
    const prisma = buildPrisma();
    const result = await buildActivityReport(prisma as never, { tenantId: 'tenant-1', from, to });
    expect(Array.isArray(result.activities ?? result.data ?? result.logs ?? Object.values(result)[0])).toBe(true);
  });

  it('scopes query to tenantId', async () => {
    const prisma = buildPrisma();
    await buildActivityReport(prisma as never, { tenantId: 'tenant-99', from, to });
    expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-99' }) }),
    );
  });

  it('filters by date range', async () => {
    const prisma = buildPrisma();
    await buildActivityReport(prisma as never, { tenantId: 'tenant-1', from, to });
    expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: from, lte: to }),
        }),
      }),
    );
  });
});
```

- [ ] **Step 4: شغّل الاختبارات**

```bash
cd apps/backend && npx jest revenue-report.builder activity-report.builder --no-coverage
```
Expected: 2 suites, ~8 tests, all PASS. إذا فشل اختبار بسبب اختلاف في هيكل الـ return — اقرأ الـ builder وعدّل assertions الـ spec.

- [ ] **Step 5: Commit**

```bash
git add src/modules/ops/generate-report/revenue-report.builder.spec.ts \
        src/modules/ops/generate-report/activity-report.builder.spec.ts
git commit -m "test(backend/ops): add specs for revenue and activity report builders"
```

---

## Task 8: قياس التغطية النهائية وضبط الـ Threshold

- [ ] **Step 1: شغّل مجموعة الاختبارات الكاملة**

```bash
cd apps/backend && npm run test:cov 2>&1 | grep -E "^(All files|Jest:|Test Suites:|Tests:)"
```

- [ ] **Step 2: افحص أي module لا يزال دون 70%**

```bash
cd apps/backend && npm run test:cov 2>&1 | grep -E "^\s+src/" | awk -F'|' '{gsub(/ /,"",$1); gsub(/ /,"",$2); if($2+0 < 70 && $2+0 > 0) print $2"% "$1}' | sort -n
```

- [ ] **Step 3: إذا كانت التغطية الكلية 85%+، حدّث الـ threshold**

```bash
cd apps/backend && cat jest.config.ts
```

غيّر القيم لتعكس الهدف المحقق:
```typescript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 85,
    lines: 85,
    statements: 85,
  },
},
```

- [ ] **Step 4: تأكيد نهائي**

```bash
cd apps/backend && npm run test:cov 2>&1 | tail -8
```
Expected: لا رسائل "threshold not met"

- [ ] **Step 5: Commit**

```bash
git add jest.config.ts
git commit -m "test(config): raise coverage thresholds to 85% — target achieved"
```

---

## ملاحظات التنفيذ

1. **قراءة أولاً:** كل controller spec يعتمد على أسماء الـ methods الفعلية. اقرأ الملف قبل كتابة الـ spec — لا تفترض اسم method.

2. **نمط `fn()`:** استخدم `const fn = <T>(val) => ({ execute: jest.fn().mockResolvedValue(val) })` لبناء handler mocks سريعاً. للـ handlers التي لها methods متعددة (مثل `knowledgeBase`) ابنِ mock object يدوياً.

3. **Controllers لا تحتوي منطقاً:** لا تختبر الـ validation (ذلك عمل الـ DTO pipes) — فقط تحقق من أن الـ handler استُدعي بـ tenantId الصحيح وأي تحويلات على البيانات (Date, defaults).

4. **إذا فشل اختبار:** تحقق من اسم الـ method في الـ controller الفعلي — قد يختلف عما في الخطة. عدّل الـ spec لا الـ controller.

5. **`src/api/mobile` و `src/api/public`:** هذه controllers خارج نطاق Phase 2 — تغطيتها لاحقاً إذا لزم.
