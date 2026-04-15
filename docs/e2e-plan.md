# خطة E2E الشاملة — CareKit Dashboard (Playwright)

> المرجع: هذا الملف هو المصدر الوحيد للحقيقة لخطة تغطية E2E.  
> الأداة: Playwright + Chromium.  
> البيئة: Next.js Dashboard على `:5103`، NestJS API على `:5100`.

---

## الوضع الحالي

### ما يوجد الآن

| الملف | ما يغطي | النوع |
|-------|---------|-------|
| `clients/clients.e2e-spec.ts` | تحميل الصفحة، console errors، skeleton | Smoke |
| `clients/clients-interactions.e2e-spec.ts` | بحث، نموذج، RTL، navigation | Interaction |
| `clients/clients-with-data.e2e-spec.ts` | toggle active، delete dialog، filter reset | Data-driven |
| `employees/employees.e2e-spec.ts` | تحميل الصفحة | Smoke |
| `employees/employees-interactions.e2e-spec.ts` | عرض مبدئي | Interaction |
| `bookings/bookings.e2e-spec.ts` | تحميل الصفحة | Smoke |
| `bookings/bookings-interactions.e2e-spec.ts` | عرض مبدئي | Interaction |
| `services/services.e2e-spec.ts` | تحميل الصفحة | Smoke |
| `services/services-interactions.e2e-spec.ts` | عرض مبدئي | Interaction |
| `services/service-branch-feature-flag.e2e-spec.ts` | ربط الخدمة بالفرع | Feature Flag |
| `branches/branches.e2e-spec.ts` | تحميل الصفحة | Smoke |
| `branches/branches-interactions.e2e-spec.ts` | عرض مبدئي | Interaction |
| `coupons/coupons.e2e-spec.ts` | تحميل الصفحة | Smoke |
| `coupons/coupons-interactions.e2e-spec.ts` | عرض مبدئي | Interaction |
| `intake-forms/intake-forms.e2e-spec.ts` | تحميل الصفحة | Smoke |
| `intake-forms/intake-forms-interactions.e2e-spec.ts` | عرض مبدئي | Interaction |
| `group-sessions/group-sessions.e2e-spec.ts` | تحميل الصفحة | Smoke |
| `group-sessions/group-sessions-create.e2e-spec.ts` | تدفق الإنشاء | Flow |
| `invoices/invoices.e2e-spec.ts` | تحميل الصفحة | Smoke |
| `payments/payments.e2e-spec.ts` | تحميل الصفحة | Smoke |
| `ratings/ratings.e2e-spec.ts` | تحميل الصفحة | Smoke |
| `chatbot/chatbot.e2e-spec.ts` | تبويبات الـ chatbot | Smoke |
| `chatbot/chatbot-interactions.e2e-spec.ts` | تفاعلات مبدئية | Interaction |
| `reports/reports.e2e-spec.ts` | تحميل الصفحة | Smoke |
| `reports/reports-interactions.e2e-spec.ts` | تفاعلات مبدئية | Interaction |
| `settings/settings.e2e-spec.ts` | تحميل الصفحة | Smoke |
| `settings/settings-interactions.e2e-spec.ts` | تفاعلات مبدئية | Interaction |
| `settings/activity-log.e2e-spec.ts` | تحميل السجل | Smoke |
| `settings/notifications.e2e-spec.ts` | تحميل الإشعارات | Smoke |
| `settings/notifications-interactions.e2e-spec.ts` | تفاعلات مبدئية | Interaction |
| `settings/whitelabel.e2e-spec.ts` | تحميل الصفحة | Smoke |
| `settings/whitelabel-interactions.e2e-spec.ts` | تفاعلات مبدئية | Interaction |
| `settings/zatca.e2e-spec.ts` | تحميل صفحة ZATCA | Smoke |
| `users/users.e2e-spec.ts` | تحميل الصفحة | Smoke |
| `users/users-interactions.e2e-spec.ts` | تفاعلات مبدئية | Interaction |
| `auth/home.e2e-spec.ts` | الصفحة الرئيسية | Smoke |

### ما لا يوجد (فجوات)

| الوحدة | الفجوة |
|--------|--------|
| **Identity** | تدفق login/logout، roles، permissions — لا data-driven tests |
| **Employees** | إدارة المواعيد، الإجازات، ربط الخدمات — smoke فقط |
| **Bookings** | تغيير الحالة (confirm/check-in/complete)، recurring، waitlist |
| **Finance** | تفاصيل الدفع، refund، verify، ZATCA config |
| **Org-Config** | departments، categories، business hours — لا يوجد شيء |
| **Comms** | email templates — لا يوجد شيء |
| **Platform** | feature flags، integrations، problem reports — لا يوجد شيء |
| **AI** | knowledge base، chatbot config — لا يوجد شيء |
| **Media** | رفع الملفات — لا يوجد شيء |
| **Critical Flows** | مسارات متكاملة تشمل أكثر من وحدة — لا يوجد شيء |

---

## البنية التحتية الحالية

```
test/e2e/
├── setup/
│   ├── fixtures.ts          ← adminPage + goto (per-test login)
│   ├── global-setup.ts      ← مرجع فقط، غير مستخدم
│   └── seed-client.ts       ← createClient / deleteClient
├── auth/
├── clients/
├── employees/
├── bookings/
├── services/
├── branches/
├── coupons/
├── intake-forms/
├── group-sessions/
├── invoices/
├── payments/
├── ratings/
├── chatbot/
├── reports/
├── settings/
└── users/
```

---

## المرحلة 1 — البنية التحتية (Infrastructure)

> **الهدف:** بناء القاعدة التي تعتمد عليها كل المراحل التالية.  
> **الملفات المستهدفة:** `test/e2e/setup/`

### 1.1 توحيد Seeds في مجلد واحد

```
test/e2e/setup/seeds/
├── index.ts              ← يصدّر كل factories
├── seed-client.ts        ← موجود، يُنقل هنا
├── seed-employee.ts      ← جديد
├── seed-service.ts       ← جديد
├── seed-branch.ts        ← جديد
├── seed-booking.ts       ← جديد
├── seed-coupon.ts        ← جديد
└── seed-user.ts          ← جديد
```

**واجهة كل seed:**
```typescript
// نمط موحد لكل factory
export interface Seeded<T> { id: string; data: T; cleanup: () => Promise<void> }
export async function createEmployee(overrides?: Partial<EmployeeDto>): Promise<Seeded<Employee>>
export async function deleteEmployee(id: string): Promise<void>
```

**نقاط API لكل seed:**

| Entity | Method | Endpoint |
|--------|--------|----------|
| Employee | POST | `/dashboard/people/employees` |
| Service | POST | `/dashboard/organization/services` |
| Branch | POST | `/dashboard/organization/branches` |
| Booking | POST | `/dashboard/bookings` |
| Coupon | POST | `/dashboard/finance/coupons` |
| User | POST | `/dashboard/identity/users` |

### 1.2 تحديث fixtures.ts

**إضافات مطلوبة:**
```typescript
type Fixtures = {
  adminPage: Page;
  goto: (url: string) => Promise<void>;
  // جديد:
  waitForToast: (text: string | RegExp) => Promise<void>;
  closeDialog: () => Promise<void>;
};
```

- `waitForToast(text)` — ينتظر Sonner toast ويتحقق من النص
- `closeDialog()` — يغلق أي dialog مفتوح (Escape أو زر الإغلاق)

### 1.3 نظام Tags

كل test يحمل tag واحداً أو أكثر عبر `test.describe` أو `test`:

```typescript
// في playwright.config.ts — projects
projects: [
  { name: 'smoke',    grep: /@smoke/ },
  { name: 'critical', grep: /@critical/ },
  { name: 'full',     grep: /.*/ },      // nightly
]
```

**Tags المعتمدة:**
- `@smoke` — page load + basic visibility
- `@critical` — happy path end-to-end
- `@regression` — edge cases + error states
- `@data` — tests that require seeded data

---

## المرحلة 2 — تعميق التغطية الموجودة

> **الهدف:** الوحدات التي لديها smoke فقط — نضيف data-driven + interaction.

### 2.1 Employees

**الملفات الجديدة:**
```
test/e2e/employees/
├── employees.e2e-spec.ts              ← موجود
├── employees-interactions.e2e-spec.ts ← موجود
└── employees-with-data.e2e-spec.ts    ← جديد
```

**`employees-with-data.e2e-spec.ts` — Test Cases:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| EM-001 | إنشاء موظف بالحد الأدنى من البيانات → يظهر في القائمة | `@critical @data` |
| EM-002 | تعديل اسم موظف موجود → يظهر التغيير فوراً | `@critical @data` |
| EM-003 | تعطيل موظف → شارة "معطّل" تظهر + toast | `@data` |
| EM-004 | إضافة إجازة لموظف → تظهر في جدول الإجازات | `@data` |
| EM-005 | حذف إجازة → تختفي من الجدول | `@data` |
| EM-006 | تحديد مواعيد متاحة (availability) → تُحفظ | `@data` |
| EM-007 | ربط خدمة بالموظف → تظهر في قائمة خدماته | `@data` |
| EM-008 | فصل خدمة عن الموظف → تختفي من قائمة خدماته | `@data` |

### 2.2 Bookings

**الملفات الجديدة:**
```
test/e2e/bookings/
├── bookings.e2e-spec.ts              ← موجود
├── bookings-interactions.e2e-spec.ts ← موجود
└── bookings-with-data.e2e-spec.ts    ← جديد
```

**`bookings-with-data.e2e-spec.ts` — Test Cases:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| BK-001 | إنشاء حجز جديد → يظهر في القائمة بحالة "معلّق" | `@critical @data` |
| BK-002 | تأكيد حجز (confirm) → الحالة تتغير → toast | `@critical @data` |
| BK-003 | تسجيل وصول (check-in) → الحالة تتغير | `@data` |
| BK-004 | إنهاء الحجز (complete) → الحالة تتغير | `@data` |
| BK-005 | إلغاء حجز مع سبب → الحالة تتغير → toast | `@data` |
| BK-006 | إعادة جدولة → التاريخ الجديد يظهر | `@data` |
| BK-007 | no-show → الحالة تتغير | `@data` |
| BK-008 | حجز متكرر (recurring) → يُنشئ أكثر من حجز | `@data` |
| BK-009 | إضافة لـ Waitlist → يظهر في قائمة الانتظار | `@data` |
| BK-010 | حذف من Waitlist → يختفي | `@data` |

### 2.3 Finance — Coupons

**الملفات الجديدة:**
```
test/e2e/coupons/
└── coupons-with-data.e2e-spec.ts   ← جديد
```

| ID | السيناريو | النوع |
|----|-----------|-------|
| CP-001 | إنشاء كوبون بنسبة مئوية → يظهر في القائمة | `@critical @data` |
| CP-002 | إنشاء كوبون بمبلغ ثابت → يظهر في القائمة | `@data` |
| CP-003 | تعطيل كوبون → شارة "معطّل" | `@data` |
| CP-004 | حذف كوبون → يختفي من القائمة | `@data` |

### 2.4 Services

**الملفات الجديدة:**
```
test/e2e/services/
└── services-with-data.e2e-spec.ts   ← جديد
```

| ID | السيناريو | النوع |
|----|-----------|-------|
| SV-001 | إنشاء خدمة جديدة → تظهر في القائمة | `@critical @data` |
| SV-002 | تعديل سعر خدمة → يُحفظ | `@data` |
| SV-003 | تعطيل خدمة → شارة "معطّل" | `@data` |
| SV-004 | ربط خدمة بفرع (feature flag) | `@data` |

---

## المرحلة 3 — الوحدات غير المغطاة

### 3.1 Identity — Auth, Roles, Permissions

**الملفات الجديدة:**
```
test/e2e/identity/
├── login.e2e-spec.ts
├── users-with-data.e2e-spec.ts
├── roles.e2e-spec.ts
└── permissions.e2e-spec.ts
```

**`login.e2e-spec.ts`:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| AUTH-001 | login صحيح → redirect للداشبورد | `@smoke @critical` |
| AUTH-002 | كلمة مرور خاطئة → رسالة خطأ واضحة | `@smoke` |
| AUTH-003 | حقول فارغة → validation قبل الإرسال | `@smoke` |
| AUTH-004 | logout → redirect لـ login | `@critical` |
| AUTH-005 | زيارة صفحة محمية بدون auth → redirect لـ login | `@smoke` |

**`users-with-data.e2e-spec.ts`:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| USR-001 | إنشاء مستخدم جديد بدور محدد → يظهر في القائمة | `@critical @data` |
| USR-002 | تعطيل مستخدم → شارة "معطّل" + toast | `@data` |
| USR-003 | تفعيل مستخدم → شارة "نشط" + toast | `@data` |
| USR-004 | تعيين دور لمستخدم → يظهر الدور في الصف | `@data` |
| USR-005 | إزالة دور من مستخدم | `@data` |

**`roles.e2e-spec.ts`:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| ROLE-001 | الصفحة تحمل وتعرض قائمة الأدوار | `@smoke` |
| ROLE-002 | إنشاء دور جديد → يظهر في القائمة | `@critical @data` |
| ROLE-003 | إضافة صلاحيات للدور | `@data` |
| ROLE-004 | حذف دور → يختفي | `@data` |

### 3.2 Org-Config — Departments, Categories, Hours

**الملفات الجديدة:**
```
test/e2e/org-config/
├── departments.e2e-spec.ts
├── categories.e2e-spec.ts
└── business-hours.e2e-spec.ts
```

**`departments.e2e-spec.ts`:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| DEP-001 | الصفحة تحمل وتعرض القائمة أو empty state | `@smoke` |
| DEP-002 | إنشاء قسم جديد → يظهر | `@critical @data` |
| DEP-003 | تعديل اسم قسم → يُحفظ | `@data` |
| DEP-004 | حذف قسم | `@data` |

**`categories.e2e-spec.ts`:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| CAT-001 | الصفحة تحمل | `@smoke` |
| CAT-002 | إنشاء فئة جديدة → تظهر | `@critical @data` |
| CAT-003 | حذف فئة | `@data` |

**`business-hours.e2e-spec.ts`:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| BH-001 | الصفحة تحمل وتعرض أيام الأسبوع | `@smoke` |
| BH-002 | تغيير وقت فتح يوم → يُحفظ | `@critical` |
| BH-003 | إغلاق يوم → يُحدّث | `@data` |
| BH-004 | إضافة يوم عطلة | `@data` |
| BH-005 | حذف يوم عطلة | `@data` |

### 3.3 Comms — Email Templates

**الملفات الجديدة:**
```
test/e2e/comms/
├── email-templates.e2e-spec.ts
└── notifications-with-data.e2e-spec.ts
```

**`email-templates.e2e-spec.ts`:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| ET-001 | الصفحة تحمل وتعرض قائمة القوالب | `@smoke` |
| ET-002 | فتح قالب للتعديل | `@smoke` |
| ET-003 | تعديل محتوى القالب → يُحفظ + toast | `@critical` |
| ET-004 | معاينة (preview) القالب → modal يظهر | `@data` |

**`notifications-with-data.e2e-spec.ts`:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| NOT-001 | إشعار غير مقروء يظهر بتمييز | `@data` |
| NOT-002 | mark as read → التمييز يختفي | `@critical @data` |
| NOT-003 | mark all as read → كل الإشعارات مقروءة | `@data` |
| NOT-004 | عداد الإشعارات غير المقروءة يتحدث | `@data` |

### 3.4 Platform — Feature Flags, Problem Reports, Integrations

**الملفات الجديدة:**
```
test/e2e/platform/
├── feature-flags.e2e-spec.ts
├── problem-reports.e2e-spec.ts
└── integrations.e2e-spec.ts
```

**`feature-flags.e2e-spec.ts`:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| FF-001 | الصفحة تحمل وتعرض قائمة الـ flags | `@smoke` |
| FF-002 | تفعيل flag → toggle يتغير + toast | `@critical` |
| FF-003 | تعطيل flag → toggle يتغير | `@critical` |
| FF-004 | تفعيل branch-services flag → خيار الفروع يظهر في صفحة الخدمات | `@critical @regression` |

**`problem-reports.e2e-spec.ts`:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| PR-001 | الصفحة تحمل | `@smoke` |
| PR-002 | تغيير status تقرير → يُحدّث | `@data` |
| PR-003 | فلترة التقارير بالحالة | `@data` |

**`integrations.e2e-spec.ts`:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| INT-001 | الصفحة تحمل وتعرض الـ integrations | `@smoke` |
| INT-002 | إضافة integration جديدة | `@data` |

### 3.5 Finance — Payments & ZATCA

**الملفات الجديدة:**
```
test/e2e/finance/
├── payments-with-data.e2e-spec.ts
└── zatca-config.e2e-spec.ts
```

**`payments-with-data.e2e-spec.ts`:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| PAY-001 | الصفحة تحمل وتعرض القائمة أو empty state | `@smoke` |
| PAY-002 | verify دفعة → الحالة تتغير + toast | `@critical @data` |
| PAY-003 | refund دفعة → الحالة تتغير | `@data` |
| PAY-004 | stats تظهر بأرقام منطقية | `@data` |

**`zatca-config.e2e-spec.ts`:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| ZT-001 | الصفحة تحمل وتعرض نموذج الإعداد | `@smoke` |
| ZT-002 | حفظ إعدادات ZATCA | `@critical` |
| ZT-003 | محاولة رفع فاتورة | `@data` |

### 3.6 AI — Knowledge Base

**الملفات الجديدة:**
```
test/e2e/ai/
├── knowledge-base.e2e-spec.ts
└── chatbot-config.e2e-spec.ts
```

**`knowledge-base.e2e-spec.ts`:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| KB-001 | الصفحة تحمل | `@smoke` |
| KB-002 | رفع مستند جديد → يظهر في القائمة | `@critical @data` |
| KB-003 | حذف مستند → يختفي | `@data` |

**`chatbot-config.e2e-spec.ts`:**

| ID | السيناريو | النوع |
|----|-----------|-------|
| CC-001 | الصفحة تحمل وتعرض الإعدادات | `@smoke` |
| CC-002 | تعديل system prompt → يُحفظ | `@critical` |
| CC-003 | تفعيل/تعطيل الـ chatbot | `@critical` |

### 3.7 Invoices (توسعة)

```
test/e2e/invoices/
└── invoices-with-data.e2e-spec.ts   ← جديد
```

| ID | السيناريو | النوع |
|----|-----------|-------|
| INV-001 | عرض تفاصيل فاتورة → sheet يفتح | `@critical @data` |
| INV-002 | تنزيل PDF للفاتورة | `@data` |
| INV-003 | فلترة الفواتير بالتاريخ | `@data` |

---

## المرحلة 4 — Critical User Journeys (مسارات متكاملة)

> **الهدف:** اختبار مسارات حقيقية تشمل أكثر من وحدة.  
> **الأولوية:** هذه أهم اختبارات في المشروع — إذا فشلت، الـ app لا يعمل.

```
test/e2e/flows/
├── new-client-booking.e2e-spec.ts
├── employee-onboarding.e2e-spec.ts
├── coupon-on-booking.e2e-spec.ts
└── full-settings-setup.e2e-spec.ts
```

### `new-client-booking.e2e-spec.ts` `@critical`

**المسار الكامل:**
1. إنشاء عميل جديد عبر API (seed)
2. إنشاء حجز له من صفحة الحجوزات
3. تأكيد الحجز
4. تسجيل الوصول (check-in)
5. إنهاء الحجز (complete)
6. التحقق من ظهور فاتورة

### `employee-onboarding.e2e-spec.ts` `@critical`

**المسار الكامل:**
1. إنشاء موظف جديد عبر نموذج الداشبورد
2. ربط خدمة بالموظف
3. تحديد مواعيد متاحة
4. التحقق من أن الموظف يظهر في صفحة إنشاء الحجز

### `coupon-on-booking.e2e-spec.ts` `@critical`

**المسار الكامل:**
1. إنشاء كوبون بنسبة خصم (seed)
2. إنشاء حجز (seed)
3. تطبيق الكوبون على الحجز/الفاتورة
4. التحقق من تطبيق الخصم في مبلغ الفاتورة

### `full-settings-setup.e2e-spec.ts` `@critical`

**المسار الكامل:**
1. إنشاء فرع جديد
2. تعيين ساعات العمل للفرع
3. إنشاء خدمة وربطها بالفرع
4. إنشاء موظف وربطه بالخدمة
5. التحقق من أن الحجز ممكن على هذا الفرع

---

## المرحلة 5 — CI Pipeline & Tagging

### تحديث `playwright.config.ts`

```typescript
projects: [
  {
    name: 'smoke',       // يعمل على كل PR — سريع (~2 دقيقة)
    grep: /@smoke/,
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'critical',    // يعمل قبل كل deploy (~10 دقائق)
    grep: /@critical/,
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'full',        // nightly — كل الاختبارات
    use: { ...devices['Desktop Chrome'] },
  },
],
```

### CI Workflow (GitHub Actions)

```yaml
# .github/workflows/e2e.yml
jobs:
  smoke:
    on: [pull_request]
    steps:
      - npx playwright test --project=smoke

  critical:
    on: [push to main]
    steps:
      - npx playwright test --project=critical

  full:
    on: [schedule: '0 2 * * *']   # 2 AM daily
    steps:
      - npx playwright test --project=full
```

---

## ملخص الخطة

| المرحلة | المحتوى | الملفات الجديدة | Tests تقريباً |
|---------|---------|-----------------|--------------|
| **1** | Infrastructure: seeds, fixtures, tags | ~7 ملفات | — |
| **2** | تعميق الموجود (Employees, Bookings, Finance) | ~5 ملفات | ~35 test |
| **3** | الوحدات غير المغطاة (Identity, Org-Config, Comms, Platform, AI) | ~15 ملفاً | ~70 test |
| **4** | Critical Flows (مسارات متكاملة) | ~4 ملفات | ~15 test |
| **5** | CI Pipeline & Tagging | `playwright.config.ts` + `.github/` | — |
| **المجموع** | | **~31 ملف جديد** | **~120 test** |

---

## أولوية التنفيذ

```
المرحلة 1  →  المرحلة 2 (Bookings)  →  المرحلة 3.1 (Identity)
     ↓                                         ↓
المرحلة 4 (Flows)          ←     المرحلة 3 (باقي الوحدات)
     ↓
المرحلة 5 (CI)
```

**السبب:** الـ Infrastructure ضروري أولاً، ثم Bookings لأنه أكثر وحدة تتأثر بالـ flows، ثم Identity لأن فشله يكسر كل شيء آخر.

---

## معايير الانتهاء

لكل spec file جديد:
- [ ] يعمل محلياً `npx playwright test path/to/file`
- [ ] لا يترك بيانات في الـ DB (cleanup في `afterEach`)
- [ ] يحمل tag واحد على الأقل (`@smoke`, `@critical`, `@data`)
- [ ] Test ID محدد (مثل `BK-001`) في اسم الـ test
- [ ] وقت تنفيذ أقل من 30 ثانية للـ test الواحد

---

*آخر تحديث: 2026-04-15*
