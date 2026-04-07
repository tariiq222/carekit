# Settings Fixes Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إصلاح 5 مشاكل جديدة اكتُشفت في الجولة الثانية من تحليل صفحة الإعدادات.

**Architecture:** إصلاحات متفرقة: باند أيبان في Payment tab، ترجمات EN ناقصة، مفتاح AR مفقود، onError صامت في EmailTemplateEditor، ومفتاح `notifyWaitlist` مفقود من EN.

**Tech Stack:** Next.js 15, TypeScript strict, i18n (AR/EN)

---

## ملف الخريطة

| الملف | التغيير |
|-------|---------|
| `dashboard/components/features/settings/settings-payment-tab.tsx` | `handleSaveBank` يتجاهل `bank_iban`/`bank_account_holder` إذا كانت `"***"` |
| `dashboard/components/features/settings/email-template-editor.tsx` | إضافة `onError` toast لـ `handleSave` و`handlePreview` |
| `dashboard/lib/translations/en.settings.ts` | إضافة 10 مفاتيح ناقصة: `adminCanBookOutsideHours`، `maxRecurrences`، المتكررة، `notifyReminders`، `notifyWaitlist` |
| `dashboard/lib/translations/ar.settings.ts` | ~~إضافة `notifyWaitlist` label الناقص~~ (موجود بالفعل — لا تغيير مطلوب) |

---

## Task 1: Dashboard — Bank IBAN write-only (تجنب إرسال "***")

**Files:**
- Modify: `dashboard/components/features/settings/settings-payment-tab.tsx`

**السياق:** `handleSaveBank` يقرأ `bankAccounts[0].iban` و`bankAccounts[0].holderName` مباشرة من state التي تُحمَّل من `configMap`. الباكند يُقنّع `bank_iban` و`bank_account_holder` (موجودان في SENSITIVE_KEYS) بـ `"***"` — فإذا فتح المستخدم التاب وضغط Save بدون تعديل، سيُخزَّن `"***"` في DB.

الحل: في `handleSaveBank`، الـ `bank_accounts` JSON يُرسَل كما هو (يحتوي على كائنات BankAccount)، لكن يجب تنظيف `iban` و`holderName` من كل account إذا كانت قيمتها `"***"`. أيضاً الـ legacy keys (`bank_iban`, `bank_account_holder`) لا تُرسَل إذا كانت `"***"`.

- [ ] **Step 1: قراءة handleSaveBank الحالية**

```bash
grep -n "handleSaveBank\|bank_iban\|bank_account_holder\|bank_accounts" dashboard/components/features/settings/settings-payment-tab.tsx
```

Expected: السطور 101-117 تحتوي على `handleSaveBank` ترسل legacy keys مباشرة.

- [ ] **Step 2: تعديل handleSaveBank**

في `dashboard/components/features/settings/settings-payment-tab.tsx`، ابحث عن:
```ts
  const handleSaveBank = () => {
    const first = bankAccounts[0]
    const firstName = first ? (SAUDI_BANKS.find((b) => b.id === first.bankId)?.nameEn ?? "") : ""
    updateConfig.mutate(
      { configs: [
        { key: "bank_transfer_enabled", value: String(bankEnabled), type: "boolean" as const },
        { key: "bank_accounts", value: serializeBankAccounts(bankAccounts), type: "json" as const },
        { key: "bank_name", value: firstName },
        { key: "bank_iban", value: first?.iban ?? "" },
        { key: "bank_account_holder", value: first?.holderName ?? "" },
      ]},
```
غيّره إلى:
```ts
  const handleSaveBank = () => {
    const first = bankAccounts[0]
    const firstName = first ? (SAUDI_BANKS.find((b) => b.id === first.bankId)?.nameEn ?? "") : ""
    // Sanitize masked values — IBAN and holder are in SENSITIVE_KEYS and return as "***"
    const cleanedAccounts = bankAccounts.map((a) => ({
      ...a,
      iban: a.iban === "***" ? "" : a.iban,
      holderName: a.holderName === "***" ? "" : a.holderName,
    }))
    const configs: { key: string; value: string; type?: "string" | "boolean" | "number" | "json" }[] = [
      { key: "bank_transfer_enabled", value: String(bankEnabled), type: "boolean" },
      { key: "bank_accounts", value: serializeBankAccounts(cleanedAccounts), type: "json" },
      { key: "bank_name", value: firstName },
    ]
    if (first?.iban && first.iban !== "***") {
      configs.push({ key: "bank_iban", value: first.iban })
    }
    if (first?.holderName && first.holderName !== "***") {
      configs.push({ key: "bank_account_holder", value: first.holderName })
    }
    updateConfig.mutate(
      { configs },
```
Keep the rest of `handleSaveBank` (onSuccess/onError) unchanged.

- [ ] **Step 3: typecheck**

```bash
cd dashboard && npm run typecheck 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
# (run from repo root)
git add dashboard/components/features/settings/settings-payment-tab.tsx
git commit -m "fix(settings): skip masked bank IBAN and holder on save to prevent overwriting with placeholder"
```

---

## Task 2: Dashboard — Email Template Editor silent failures

**Files:**
- Modify: `dashboard/components/features/settings/email-template-editor.tsx`

**السياق:** `handleSave` يستدعي `updateMut.mutate(...)` بدون `onError` — إذا فشل الطلب، المستخدم لا يرى أي رسالة. كذلك `handlePreview` بدون `onError`.

- [ ] **Step 1: إضافة onError لـ handleSave**

في `dashboard/components/features/settings/email-template-editor.tsx`، ابحث عن:
```ts
  const handleSave = () => {
    updateMut.mutate(
      { id: template.id, subjectEn, subjectAr, bodyEn, bodyAr, isActive },
      {
        onSuccess: () => {
          toast.success(t("settings.emailTemplates.saved"))
          onBack()
        },
      },
    )
  }
```
غيّره إلى:
```ts
  const handleSave = () => {
    updateMut.mutate(
      { id: template.id, subjectEn, subjectAr, bodyEn, bodyAr, isActive },
      {
        onSuccess: () => {
          toast.success(t("settings.emailTemplates.saved"))
          onBack()
        },
        onError: () => {
          toast.error(t("settings.error"))
        },
      },
    )
  }
```

- [ ] **Step 2: إضافة onError لـ handlePreview**

ابحث عن:
```ts
  const handlePreview = () => {
    const sampleContext: Record<string, string> = {}
    for (const v of variables) sampleContext[v] = `[${v}]`
    previewMut.mutate(
      { slug: template.slug, context: sampleContext, lang: locale as "ar" | "en" },
      { onSuccess: (data) => setPreview(data) },
    )
  }
```
غيّره إلى:
```ts
  const handlePreview = () => {
    const sampleContext: Record<string, string> = {}
    for (const v of variables) sampleContext[v] = `[${v}]`
    previewMut.mutate(
      { slug: template.slug, context: sampleContext, lang: locale as "ar" | "en" },
      {
        onSuccess: (data) => setPreview(data),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }
```

- [ ] **Step 3: typecheck**

```bash
cd dashboard && npm run typecheck 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
# (run from repo root)
git add dashboard/components/features/settings/email-template-editor.tsx
git commit -m "fix(settings): add onError toast to email template save and preview mutations"
```

---

## Task 3: Translations — إصلاح المفاتيح الناقصة في EN و AR

**Files:**
- Modify: `dashboard/lib/translations/en.settings.ts`
- Modify: `dashboard/lib/translations/ar.settings.ts`

**السياق:**

**EN ناقص:**
- `settings.adminCanBookOutsideHours` — الكود يستخدم هذا المفتاح، لكن EN يملك `settings.adminBookOutside` فقط
- `settings.adminCanBookOutsideHoursDesc` — نفس المشكلة
- `settings.maxRecurrences` — موجود في AR، غائب في EN
- `settings.maxRecurrencesDesc` — موجود في AR، غائب في EN
- `settings.allowedRecurringPatterns` — موجود في AR، غائب في EN
- `settings.allowedRecurringPatternsDesc` — موجود في AR، غائب في EN
- `settings.recurringPattern.daily` → `settings.recurringPattern.monthly` (6 مفاتيح) — موجودة في AR، غائبة في EN
- `settings.notifyReminders` (label بدون Desc) — موجود في AR (سطر 225)، غائب في EN
- `settings.notifyWaitlist` (label بدون Desc) — موجود في AR (سطر 227)، غائب في EN

**AR ناقص:** لا شيء — `notifyReminders` و`notifyWaitlist` موجودان في AR.

- [ ] **Step 1: إضافة المفاتيح الناقصة لـ EN**

في `dashboard/lib/translations/en.settings.ts`، ابحث عن:
```ts
  "settings.adminBookOutside": "Admin Book Outside Hours",
  "settings.adminBookOutsideDesc": "If enabled, admins can create appointments outside the clinic's official working hours (evenings, holidays, etc).",
```
**استبدل** هذين السطرين بـ (الكود يستخدم `adminCanBookOutsideHours` — المفتاح القديم `adminBookOutside` لم يعد مستخدمًا):
```ts
  "settings.adminCanBookOutsideHours": "Admin Book Outside Hours",
  "settings.adminCanBookOutsideHoursDesc": "If enabled, admins can create appointments outside the clinic's official working hours (evenings, holidays, etc).",
```

ثم ابحث عن:
```ts
  "settings.allowRecurring": "Allow Recurring Bookings",
  "settings.allowRecurringDesc": "Allows patients to book a series of appointments on a fixed schedule — e.g. weekly sessions.",
```
بعد هذين السطرين، أضف:
```ts
  "settings.maxRecurrences": "Max Recurrences",
  "settings.maxRecurrencesDesc": "Maximum number of appointments in a recurring series. Example: 12 = up to 12 sessions.",
  "settings.allowedRecurringPatterns": "Allowed Patterns",
  "settings.allowedRecurringPatternsDesc": "Select which recurrence patterns patients can choose when booking a recurring series.",
  "settings.recurringPattern.daily": "Daily",
  "settings.recurringPattern.every_2_days": "Every 2 days",
  "settings.recurringPattern.every_3_days": "Every 3 days",
  "settings.recurringPattern.weekly": "Weekly",
  "settings.recurringPattern.biweekly": "Biweekly",
  "settings.recurringPattern.monthly": "Monthly",
```

ثم ابحث عن:
```ts
  "settings.notifyRemindersDesc": "Send reminders before upcoming appointments",
  "settings.notifyWaitlistDesc": "Notify patients when a waitlist slot becomes available",
```
قبل `notifyRemindersDesc`، أضف:
```ts
  "settings.notifyReminders": "Appointment Reminders",
  "settings.notifyWaitlist": "Waitlist Notifications",
```
بحيث تصبح:
```ts
  "settings.notifyReminders": "Appointment Reminders",
  "settings.notifyRemindersDesc": "Send reminders before upcoming appointments",
  "settings.notifyWaitlist": "Waitlist Notifications",
  "settings.notifyWaitlistDesc": "Notify patients when a waitlist slot becomes available",
```

- [ ] **Step 2: typecheck**

```bash
cd dashboard && npm run typecheck 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
# (run from repo root)
git add dashboard/lib/translations/en.settings.ts
git commit -m "fix(i18n): add missing EN translation keys for recurring, adminCanBookOutsideHours, notifyReminders, notifyWaitlist"
```

---

## Self-Review

### Spec Coverage

| المشكلة | Task |
|---------|------|
| Bank IBAN يُرسَل كـ "***" عند الحفظ | Task 1 ✅ |
| Email Template Editor — حفظ صامت عند الخطأ | Task 2 ✅ |
| EN مفاتيح ناقصة (adminCanBookOutsideHours + recurring + notifyReminders + notifyWaitlist) | Task 3 ✅ |

### ملاحظات
- **notifyWaitlist في EN**: الملف الحالي يملك `notifyWaitlistDesc` لكن ليس `notifyWaitlist` label — Task 3 يضيفه.
- **AR**: `notifyWaitlist` و`notifyReminders` موجودان بالفعل (سطور 225-228 في ar.settings.ts) — لا تغيير مطلوب في AR.
- **FeaturesTab الكود الميت**: يُترك عمداً — ليس bug، قرار product أن لا يُعرض حتى الآن.
- **Widget origin في script snippet**: مشكلة تصميم/security تحتاج قرار product — خارج نطاق هذه الإصلاحات.

### Placeholder Scan
لا يوجد TBD أو TODO.

### Type Consistency
جميع الـ `configs` arrays بنفس النوع المُعرَّف في Task 1.
`handleSave`/`handlePreview` في Task 2 — النوع `onError: () => void` متوافق مع TanStack Query mutation callbacks.
