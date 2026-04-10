# Payments & Invoices — Bug Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إصلاح خمسة عيوب موثقة في نظام المدفوعات والفواتير: غياب الفاتورة عند الاعتماد اليدوي، عدم تناظر unique constraint للمجموعات، تباين حساب VAT في webhook المجموعة، race condition في `createGroupInvoice`، وعدم تغليف `processGroupPaymentFailed` في transaction.

**Architecture:** كل إصلاح معزول في ملف واحد بحد أقصى. إصلاحات الـ schema تتطلب migration جديدة. الاختبارات تُكتب أولاً (TDD).

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, Jest (unit tests في `test/unit/payments/`)

---

## File Map

| الملف | العملية |
|-------|---------|
| `backend/src/modules/payments/payments.service.ts` | تعديل — إضافة `createInvoice` في `updateStatus` عند paid |
| `backend/src/modules/invoices/invoice-creator.service.ts` | تعديل — تغليف idempotency check في `createGroupInvoice` بـ upsert |
| `backend/src/modules/payments/moyasar-webhook.service.ts` | تعديل — توحيد حساب VAT + تغليف `processGroupPaymentFailed` في transaction |
| `backend/prisma/schema/payments.prisma` | تعديل — إضافة `@unique` على `Payment.groupEnrollmentId` |
| `backend/prisma/migrations/` | إنشاء — migration لإضافة unique constraint |
| `backend/test/unit/payments/payments.create.spec.ts` | تعديل — إضافة اختبارات updateStatus→paid→invoice |
| `backend/test/unit/payments/moyasar-webhook.service.spec.ts` | تعديل — اختبار توحيد VAT وfailed transaction |

---

## Task 1: إصلاح `updateStatus` — إنشاء الفاتورة عند الاعتماد اليدوي

**المشكلة:** [`payments.service.ts:174-179`](../../../backend/src/modules/payments/payments.service.ts#L174-L179) يؤكد الحجز عند paid لكن لا ينشئ فاتورة. أي دفعة يُعتمدها الأدمن يدوياً تُنتج حجزاً مؤكداً بلا فاتورة.

**Files:**
- Modify: `backend/src/modules/payments/payments.service.ts`
- Modify: `backend/test/unit/payments/payments.create.spec.ts`

- [ ] **Step 1.1: اكتب الاختبار الفاشل**

أضف describe block جديد في `backend/test/unit/payments/payments.create.spec.ts` بعد آخر describe:

```typescript
describe('PaymentsService — updateStatus', () => {
  let service: PaymentsService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockInvoicesService: { createInvoice: jest.Mock };

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    mockInvoicesService = { createInvoice: jest.fn().mockResolvedValue({ id: 'inv-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MoyasarPaymentService, useValue: createMockMoyasarService() },
        { provide: BankTransferService, useValue: createMockBankTransferService() },
        { provide: BookingStatusService, useValue: mockBookingStatusService },
        { provide: 'InvoicesService', useValue: mockInvoicesService },
      ],
    }).compile();
    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  it('should create invoice when manually marking payment as paid with transactionRef', async () => {
    const pendingPayment = { ...mockPayment, status: 'pending', bookingId: mockBookingId };
    mockPrisma.payment.findUnique.mockResolvedValue(pendingPayment);
    mockPrisma.payment.update.mockResolvedValue({ ...pendingPayment, status: 'paid' });

    await service.updateStatus(mockPaymentId, {
      status: 'paid',
      transactionRef: 'TXN-123',
    });

    expect(mockInvoicesService.createInvoice).toHaveBeenCalledWith({
      paymentId: mockPaymentId,
    });
  });

  it('should not fail if invoice already exists (ConflictException swallowed)', async () => {
    const { ConflictException } = await import('@nestjs/common');
    const pendingPayment = { ...mockPayment, status: 'pending', bookingId: mockBookingId };
    mockPrisma.payment.findUnique.mockResolvedValue(pendingPayment);
    mockPrisma.payment.update.mockResolvedValue({ ...pendingPayment, status: 'paid' });
    mockInvoicesService.createInvoice.mockRejectedValue(new ConflictException('exists'));

    await expect(
      service.updateStatus(mockPaymentId, { status: 'paid', transactionRef: 'TXN-123' }),
    ).resolves.not.toThrow();
  });

  it('should NOT create invoice when transitioning to failed', async () => {
    const pendingPayment = { ...mockPayment, status: 'pending', bookingId: mockBookingId };
    mockPrisma.payment.findUnique.mockResolvedValue(pendingPayment);
    mockPrisma.payment.update.mockResolvedValue({ ...pendingPayment, status: 'failed' });

    await service.updateStatus(mockPaymentId, { status: 'failed' });

    expect(mockInvoicesService.createInvoice).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 1.2: شغّل الاختبار وتأكد أنه يفشل**

```bash
cd backend && npm run test -- --testPathPattern="payments.create.spec" --verbose 2>&1 | tail -20
```

المتوقع: `FAIL` بسبب `InvoicesService` غير معرّف في module.

- [ ] **Step 1.3: عدّل `payments.service.ts` لإضافة InvoicesService وإنشاء الفاتورة**

أضف الـ import في أعلى الملف بعد `BookingStatusService`:

```typescript
import { InvoicesService } from '../invoices/invoices.service.js';
import { ConflictException } from '@nestjs/common';
```

عدّل `@Injectable()` class لإضافة الـ dependency:

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly moyasarService: MoyasarPaymentService,
  private readonly bankTransferService: BankTransferService,
  private readonly bookingStatusService: BookingStatusService,
  private readonly invoicesService: InvoicesService,
) {}
```

عدّل الكود من السطر 174 في الدالة `updateStatus` — استبدل:

```typescript
if (dto.status === 'paid' && payment.bookingId) {
  try {
    await this.bookingStatusService.confirm(payment.bookingId);
  } catch {
    // Best-effort — booking may already be confirmed
  }
}
```

بـ:

```typescript
if (dto.status === 'paid') {
  // Create invoice — best-effort, ConflictException means it already exists
  try {
    await this.invoicesService.createInvoice({ paymentId: id });
  } catch (err) {
    if (!(err instanceof ConflictException)) {
      this.logger.error(
        `Invoice creation failed for manually-paid payment ${id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (payment.bookingId) {
    try {
      await this.bookingStatusService.confirm(payment.bookingId);
    } catch {
      // Best-effort — booking may already be confirmed
    }
  }
}
```

- [ ] **Step 1.4: أضف `InvoicesService` لـ `PaymentsModule` في `payments.module.ts`**

تحقق أن `InvoicesModule` مستورد في `imports[]` وأن `InvoicesService` في `providers[]` أو مصدَّر من `InvoicesModule`. ابحث:

```bash
grep -n "InvoicesModule\|InvoicesService" backend/src/modules/payments/payments.module.ts
```

إذا لم يكن موجوداً أضف `InvoicesModule` في `imports[]`:

```typescript
import { InvoicesModule } from '../invoices/invoices.module.js';
// في imports[]:
InvoicesModule,
```

- [ ] **Step 1.5: شغّل الاختبارات وتأكد أنها تنجح**

```bash
cd backend && npm run test -- --testPathPattern="payments.create.spec" --verbose 2>&1 | tail -20
```

المتوقع: `PASS` لجميع tests.

- [ ] **Step 1.6: شغّل كل tests المدفوعات**

```bash
cd backend && npm run test -- --testPathPattern="payments" --verbose 2>&1 | tail -30
```

المتوقع: جميعها `PASS` دون regressions.

- [ ] **Step 1.7: Commit**

```bash
cd backend && git add src/modules/payments/payments.service.ts test/unit/payments/payments.create.spec.ts src/modules/payments/payments.module.ts
git commit -m "fix(payments): create invoice when manually marking payment as paid via updateStatus"
```

---

## Task 2: إضافة `@unique` على `Payment.groupEnrollmentId`

**المشكلة:** [`payments.prisma:8`](../../../backend/prisma/schema/payments.prisma#L8) — `groupEnrollmentId` بلا `@unique` يسمح بوجود عدة Payment records لنفس enrollment. القيد مفروض فقط من `GroupEnrollment.paymentId` طرف واحد.

**Files:**
- Modify: `backend/prisma/schema/payments.prisma`
- Create: migration جديدة

- [ ] **Step 2.1: عدّل `payments.prisma` لإضافة `@unique`**

في [`payments.prisma:8`](../../../backend/prisma/schema/payments.prisma#L8) استبدل:

```prisma
groupEnrollmentId String?      @map("group_enrollment_id")
```

بـ:

```prisma
groupEnrollmentId String?      @unique @map("group_enrollment_id")
```

- [ ] **Step 2.2: أنشئ migration**

```bash
cd backend && npm run prisma:migrate -- --name add_unique_payment_group_enrollment 2>&1
```

المتوقع: migration جديدة في `prisma/migrations/` باسم يشمل `add_unique_payment_group_enrollment`.

**ملاحظة:** إذا كانت هناك بيانات مكررة في الـ DB، ستفشل. للتحقق:
```bash
# في psql أو Prisma Studio:
# SELECT group_enrollment_id, COUNT(*) FROM payments WHERE group_enrollment_id IS NOT NULL GROUP BY group_enrollment_id HAVING COUNT(*) > 1;
```

- [ ] **Step 2.3: تشغيل كل الـ tests للتأكد من عدم وجود regressions**

```bash
cd backend && npm run test 2>&1 | tail -20
```

- [ ] **Step 2.4: Commit**

```bash
cd backend && git add prisma/schema/payments.prisma prisma/migrations/
git commit -m "fix(schema): add @unique constraint on Payment.groupEnrollmentId"
```

---

## Task 3: توحيد حساب VAT في `processGroupPaymentSuccess`

**المشكلة:** [`moyasar-webhook.service.ts:265`](../../../backend/src/modules/payments/moyasar-webhook.service.ts#L265) يستخدم `Math.round(webhookAmount * 0.15)` بدلاً من `applyVat` المعرّف في `payments.helpers.ts`. هذا يعني أن VAT rate الـ hardcoded قد يتعارض مع `VAT_RATE_DEFAULT` في المستقبل.

**Files:**
- Modify: `backend/src/modules/payments/moyasar-webhook.service.ts`
- Modify: `backend/test/unit/payments/moyasar-webhook.service.spec.ts`

- [ ] **Step 3.1: اكتب الاختبار الفاشل في `moyasar-webhook.service.spec.ts`**

ابحث عن الـ describe block الخاص بـ `processGroupPaymentSuccess` وأضف test:

```typescript
it('should use applyVat helper to calculate VAT amounts (not hardcoded 0.15)', async () => {
  // applyVat(10000) = { amount: 10000, vatAmount: 1500, totalAmount: 11500 }
  // If hardcoded: vatAmount = Math.round(11500 * 0.15) = 1725 — WRONG (applies VAT on totalAmount)
  // Correct: vatAmount on base amount only
  const baseAmount = 10000; // 100 SAR base
  const expectedVat = Math.round(baseAmount * 15 / 100); // 1500

  // Setup: webhookAmount = baseAmount (بدون VAT) — هذا هو المبلغ المُرسل من Moyasar
  // نتحقق أن payment.vatAmount === expectedVat
  const webhookEvent = buildGroupWebhookEvent({ amount: baseAmount, status: 'paid' });
  // ... mock setup لـ groupPayment وenrollment
  // بعد الاستدعاء:
  const paymentCreate = mockPrisma.payment.create.mock.calls[0][0];
  expect(paymentCreate.data.vatAmount).toBe(expectedVat);
  expect(paymentCreate.data.amount).toBe(baseAmount);
  expect(paymentCreate.data.totalAmount).toBe(baseAmount + expectedVat);
});
```

> **ملاحظة:** اقرأ بنية الـ mocks الموجودة في الملف أولاً لتتبع نفس النمط. الاختبار يتحقق من أن `payment.create` يُستدعى بـ `amount = webhookAmount`, `vatAmount = Math.round(webhookAmount * 15/100)`.

- [ ] **Step 3.2: شغّل ليتأكد الفشل**

```bash
cd backend && npm run test -- --testPathPattern="moyasar-webhook.service.spec" --verbose 2>&1 | tail -20
```

- [ ] **Step 3.3: عدّل `moyasar-webhook.service.ts` لاستخدام `applyVat`**

أضف الـ import في أعلى الملف (إذا لم يكن موجوداً):

```typescript
import { applyVat } from './payments.helpers.js';
```

استبدل السطور 264-276 من `processGroupPaymentSuccess`:

```typescript
// قبل:
const vatAmount = Math.round(webhookAmount * 0.15);
const payment = await tx.payment.create({
  data: {
    groupEnrollmentId: enrollmentId,
    amount: webhookAmount - vatAmount,
    vatAmount,
    totalAmount: webhookAmount,
    method: 'moyasar',
    status: 'paid',
    moyasarPaymentId: eventId,
  },
});
```

```typescript
// بعد:
const { amount, vatAmount, totalAmount } = applyVat(webhookAmount);
const payment = await tx.payment.create({
  data: {
    groupEnrollmentId: enrollmentId,
    amount,
    vatAmount,
    totalAmount,
    method: 'moyasar',
    status: 'paid',
    moyasarPaymentId: eventId,
  },
});
```

**تحذير:** `applyVat` تأخذ `baseAmount` (قبل الضريبة). تأكد أن `webhookAmount` هو المبلغ الأساسي وليس الإجمالي. ارجع إلى كيف تُنشئ `GroupPayment` وما هو المبلغ المُخزن فيها (`totalAmount`). إذا كان `webhookAmount` هو `totalAmount` (بعد الضريبة) فالمعادلة الصحيحة هي:
```typescript
const baseAmount = Math.round(webhookAmount / 1.15);
const { amount, vatAmount, totalAmount } = applyVat(baseAmount);
```

تحقق من `GroupPayment` في `groups.prisma` لفهم ماذا يعني `totalAmount`.

- [ ] **Step 3.4: شغّل الاختبارات**

```bash
cd backend && npm run test -- --testPathPattern="moyasar-webhook" --verbose 2>&1 | tail -20
```

- [ ] **Step 3.5: Commit**

```bash
cd backend && git add src/modules/payments/moyasar-webhook.service.ts test/unit/payments/moyasar-webhook.service.spec.ts
git commit -m "fix(payments): unify VAT calculation in processGroupPaymentSuccess using applyVat helper"
```

---

## Task 4: تغليف `processGroupPaymentFailed` في Transaction

**المشكلة:** [`moyasar-webhook.service.ts:315-328`](../../../backend/src/modules/payments/moyasar-webhook.service.ts#L315-L328) — `groupPayment.updateMany` و`processedWebhook.create` منفصلتان. إذا نجح الأول وفشل الثاني، يُعاد معالجة الـ webhook.

**Files:**
- Modify: `backend/src/modules/payments/moyasar-webhook.service.ts`
- Modify: `backend/test/unit/payments/moyasar-webhook.service.spec.ts`

- [ ] **Step 4.1: اكتب الاختبار الفاشل**

في describe block خاص بـ `processGroupPaymentFailed`:

```typescript
it('should create processedWebhook atomically with groupPayment update', async () => {
  // Setup: groupPayment pending
  mockPrisma.groupPayment.findUnique.mockResolvedValue({
    id: 'gp-1',
    enrollmentId: 'enr-1',
    status: 'pending',
    totalAmount: 10000,
  });

  // Simulate: processedWebhook.create fails
  mockPrisma.$transaction.mockImplementationOnce(async (fn: Function) => fn(mockPrisma));
  mockPrisma.groupPayment.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.processedWebhook.create.mockRejectedValue(new Error('DB error'));

  // Should throw — the transaction rolls back
  await expect(
    service['processGroupPaymentFailed']('gp-1', 'evt-1'),
  ).rejects.toThrow('DB error');

  // groupPayment update should NOT be committed independently
});

it('should be idempotent — P2002 on processedWebhook is swallowed', async () => {
  mockPrisma.$transaction.mockImplementationOnce(async (fn: Function) => fn(mockPrisma));
  mockPrisma.groupPayment.updateMany.mockResolvedValue({ count: 0 });
  const p2002 = Object.assign(new Error('Unique'), { code: 'P2002' });
  mockPrisma.processedWebhook.create.mockRejectedValue(p2002);

  await expect(
    service['processGroupPaymentFailed']('gp-1', 'evt-1'),
  ).resolves.not.toThrow();
});
```

- [ ] **Step 4.2: شغّل ليتأكد الفشل**

```bash
cd backend && npm run test -- --testPathPattern="moyasar-webhook.service.spec" --verbose 2>&1 | tail -20
```

- [ ] **Step 4.3: عدّل `processGroupPaymentFailed` لاستخدام `$transaction`**

استبدل الدالة كاملاً [`moyasar-webhook.service.ts:315-328`](../../../backend/src/modules/payments/moyasar-webhook.service.ts#L315-L328):

```typescript
private async processGroupPaymentFailed(groupPaymentId: string, eventId: string): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    await tx.groupPayment.updateMany({
      where: { id: groupPaymentId, status: 'pending' },
      data: { status: 'failed' },
    });

    await tx.processedWebhook.create({
      data: { eventId, processedAt: new Date() },
    }).catch((e: unknown) => {
      if ((e as { code?: string }).code !== 'P2002') throw e;
    });
  });
}
```

- [ ] **Step 4.4: شغّل الاختبارات**

```bash
cd backend && npm run test -- --testPathPattern="moyasar-webhook" --verbose 2>&1 | tail -20
```

- [ ] **Step 4.5: Commit**

```bash
cd backend && git add src/modules/payments/moyasar-webhook.service.ts test/unit/payments/moyasar-webhook.service.spec.ts
git commit -m "fix(payments): wrap processGroupPaymentFailed in $transaction for atomicity"
```

---

## Task 5: إصلاح Race Condition في `createGroupInvoice`

**المشكلة:** [`invoice-creator.service.ts:202-210`](../../../backend/src/modules/invoices/invoice-creator.service.ts#L202-L210) — `findUnique` ثم `invoice.create` خارج transaction. طلبان متزامنان يمران الـ check معاً ثم الثاني يُنتج P2002 غير مُصطاد.

**الحل:** استبدال `findUnique + create` بـ `createOrSkip` pattern: حاول `create` مباشرة وصطد P2002.

**Files:**
- Modify: `backend/src/modules/invoices/invoice-creator.service.ts`
- Modify: `backend/test/unit/payments/moyasar-webhook.service.spec.ts` (اختبار الـ race condition)

- [ ] **Step 5.1: اكتب الاختبار**

```typescript
// في test/unit/payments/moyasar-webhook.service.spec.ts أو ملف مستقل
it('should swallow P2002 from createGroupInvoice race condition', async () => {
  // الـ webhook يُعالج مرتين بشكل شبه متزامن
  // المحاولة الثانية لإنشاء invoice تُنتج P2002
  // يجب ألا يُرمى error للخارج
  mockInvoicesService.createGroupInvoice.mockRejectedValue(
    Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
  );

  // لا exception يُرمى
  await expect(service['createGroupInvoiceAfterPayment']('enr-1')).resolves.not.toThrow();
});
```

- [ ] **Step 5.2: عدّل `createGroupInvoice` في `invoice-creator.service.ts`**

استبدل السطور 202-212 (findUnique + ConflictException):

```typescript
// قبل:
const existing = await this.prisma.invoice.findUnique({
  where: { groupEnrollmentId: enrollmentId },
});

if (existing) {
  throw new ConflictException({
    statusCode: 409,
    message: 'Invoice already exists for this group enrollment',
    error: 'CONFLICT',
  });
}
```

```typescript
// بعد: لا يوجد findUnique منفصل — سيُصطاد P2002 من create داخل $transaction
// احذف الـ findUnique block بالكامل
```

وفي `createGroupInvoiceAfterPayment` ([`moyasar-webhook.service.ts:302-313`](../../../backend/src/modules/payments/moyasar-webhook.service.ts#L302-L313)) عدّل catch:

```typescript
private async createGroupInvoiceAfterPayment(enrollmentId: string): Promise<void> {
  try {
    await this.invoicesService.createGroupInvoice(enrollmentId);
  } catch (err) {
    // P2002 = race condition — invoice already created by concurrent request
    const isConflict = err instanceof ConflictException || (err as { code?: string }).code === 'P2002';
    if (!isConflict) {
      this.logger.error(
        `Group invoice creation failed for enrollment ${enrollmentId}`,
        err,
      );
    }
  }
}
```

وفي `createGroupInvoice` نفسه في transaction، تأكد أن P2002 من `invoice.create` يُصطاد بشكل صحيح داخل `$transaction`:

```typescript
// بداخل $transaction في createGroupInvoice:
return tx.invoice.create({ data: { ... } }).catch((e: unknown) => {
  if ((e as { code?: string }).code === 'P2002') {
    throw new ConflictException({
      statusCode: 409,
      message: 'Invoice already exists for this group enrollment',
      error: 'CONFLICT',
    });
  }
  throw e;
});
```

- [ ] **Step 5.3: شغّل الاختبارات**

```bash
cd backend && npm run test -- --testPathPattern="moyasar-webhook|invoice" --verbose 2>&1 | tail -30
```

- [ ] **Step 5.4: Commit**

```bash
cd backend && git add src/modules/invoices/invoice-creator.service.ts src/modules/payments/moyasar-webhook.service.ts test/unit/payments/moyasar-webhook.service.spec.ts
git commit -m "fix(invoices): fix race condition in createGroupInvoice by removing check-then-create pattern"
```

---

## Task 6: تشغيل كل الاختبارات والتحقق النهائي

- [ ] **Step 6.1: شغّل كل الـ unit tests**

```bash
cd backend && npm run test 2>&1 | tail -30
```

المتوقع: جميعها PASS، coverage لا تنخفض تحت الحد الأدنى (40% branch, 50% fn/line).

- [ ] **Step 6.2: تحقق من coverage**

```bash
cd backend && npm run test:cov 2>&1 | grep -E "payments|invoices|All files" | tail -15
```

- [ ] **Step 6.3: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -20
```

المتوقع: لا أخطاء.

---

## ملاحظة: ما لم يُدرج في هذه الخطة

**Credit Note لـ ZATCA عند الاسترداد** — مشروع مستقل يتطلب تصميم schema وUBL XML جديد. يجب أن يكون في خطة منفصلة بعد التنسيق مع متطلبات ZATCA Phase 2.

**نافذة زمنية في التحويل البنكي** (إنشاء invoice خارج transaction) — المشكلة موثقة في الكود ومقبولة بوعي ([`bank-transfer.service.ts:187-190`](../../../backend/src/modules/payments/bank-transfer.service.ts#L187-L190)). تضمين `createInvoice` داخل transaction يتطلب refactor كبير لـ ZATCA hash chaining لأن `zatcaService.generateForInvoice` async وطويل. تُؤجَّل.
