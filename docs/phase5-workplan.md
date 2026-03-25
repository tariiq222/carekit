# Phase 5 — خطة العمل التفصيلية للفريق

> **تاريخ الإنشاء:** 2026-03-24
> **المرجع:** نتائج تدقيق الداشبورد الشامل
> **الحالة الحالية:** 5 صفحات (1 متصلة بالـ API + 4 mock) — نسبة الإنجاز: ~12%
> **الهدف:** داشبورد مكتمل الوظائف + متوافق مع الـ Design System

---

## ملخص الوضع الحالي

```
الصفحات الموجودة:     5 صفحات (Dashboard, Bookings, Patients, Practitioners, Settings)
الصفحات المطلوبة:     12 صفحة
التغطية API:          12 من 117 endpoint (10%)
حالة الـ Mock:        4 صفحات تعمل ببيانات وهمية
loading.tsx:          0 ملفات
error.tsx:            0 ملفات
مخالفات RTL:         23 ملف
TanStack Query:       غير مُثبت
```

---

## هيكل الفريق والمسؤوليات

```
المايسترو (طارق) — مراجعة + قرارات التصميم + الموافقة النهائية
    │
    ├── 👤 FE-1 (Frontend Core) — البنية التحتية + DS + Data Fetching
    ├── 👤 FE-2 (Frontend Pages) — بناء الصفحات الجديدة + ربط API
    └── 👤 FE-3 (Frontend Polish) — RTL + States + UX + Responsive
```

---

## المراحل الفرعية (Sprints)

### Sprint 5.0 — البنية التحتية (يجب أن تنتهي أولاً)

> **المسؤول:** FE-1
> **المدة المقترحة:** 2-3 أيام
> **يُنجز قبل أي عمل آخر — كل شيء يعتمد عليه**

| # | المهمة | التفاصيل | الملفات | الأولوية |
|---|--------|----------|---------|----------|
| 5.0.1 | تثبيت TanStack Query | `npm i @tanstack/react-query @tanstack/react-query-devtools` + إنشاء `QueryProvider` في `providers/` + لفه في `layout.tsx` | `providers/query-provider.tsx`, `layout.tsx` | CRITICAL |
| 5.0.2 | إنشاء API Layer موحد | ملف API client لكل module: `lib/api/patients.ts`, `lib/api/practitioners.ts`, `lib/api/payments.ts`, `lib/api/invoices.ts`, `lib/api/services.ts`, `lib/api/users.ts`, `lib/api/roles.ts`, `lib/api/reports.ts`, `lib/api/notifications.ts`, `lib/api/whitelabel.ts` | `lib/api/*.ts` | CRITICAL |
| 5.0.3 | إنشاء Custom Hooks (TanStack Query) | hook لكل module يستخدم `useQuery` + `useMutation`: `hooks/use-patients.ts`, `hooks/use-practitioners.ts`, إلخ — مبني على نفس نمط `use-bookings.ts` لكن بـ TanStack Query | `hooks/*.ts` | CRITICAL |
| 5.0.4 | إنشاء Types لكل Module | تعريف TypeScript interfaces لكل entity: `Patient`, `Practitioner`, `Service`, `Invoice`, `Payment`, `User`, `Role`, `Notification` | `lib/types/*.ts` | CRITICAL |
| 5.0.5 | إعادة بناء `use-bookings.ts` على TanStack Query | تحويل الـ hook الحالي من `useState` + `useEffect` إلى `useQuery` + `useMutation` | `hooks/use-bookings.ts` | HIGH |
| 5.0.6 | إنشاء `loading.tsx` و `error.tsx` | ملف `loading.tsx` (skeleton) + `error.tsx` (error boundary + retry) لكل route group | `app/(dashboard)/loading.tsx`, `app/(dashboard)/error.tsx` | HIGH |
| 5.0.7 | 401 Interceptor + Auto Refresh | إضافة interceptor في `lib/api.ts` يعمل auto-refresh للـ token عند 401 + redirect لـ login عند فشل الـ refresh | `lib/api.ts` | HIGH |
| 5.0.8 | إضافة `/auth/me` + Logout | استدعاء `GET /auth/me` عند تحميل التطبيق بدل قراءة من localStorage + تنفيذ `POST /auth/logout` | `lib/api/auth.ts`, `providers/auth-provider.tsx` | HIGH |

**معيار الإتمام:**
- [ ] TanStack Query يعمل مع DevTools
- [ ] كل module له API client + types + hook
- [ ] 401 auto-refresh يعمل
- [ ] كل route له loading + error states

---

### Sprint 5.1 — الصفحات الأساسية (Core Admin Pages)

> **المسؤول:** FE-2
> **المدة المقترحة:** 5-7 أيام
> **يبدأ بعد إتمام Sprint 5.0**

| # | الصفحة | التفاصيل | API Endpoints | الأولوية |
|---|--------|----------|---------------|----------|
| 5.1.1 | **Patients — ربط API + CRUD** | تحويل البيانات الوهمية إلى API حقيقي. إضافة: بحث، فلترة، pagination. إنشاء `PatientDetailSheet` (سجل المواعيد + المدفوعات + الملف الطبي) | `GET /patients`, `GET /patients/:id`, `GET /patients/:id/stats` | CRITICAL |
| 5.1.2 | **Practitioners — ربط API + CRUD + إدارة** | تحويل لـ API. إضافة: إنشاء ممارس جديد، تعديل، حذف. `PractitionerDetailSheet` (ملف + جدول العمل + الخدمات + التقييمات + الإجازات) | `GET/POST/PATCH/DELETE /practitioners`, `GET/PUT /practitioners/:id/availability`, `GET/POST/DELETE /practitioners/:id/vacations`, `GET/POST /practitioners/:id/services` | CRITICAL |
| 5.1.3 | **Services & Specialties (صفحة جديدة)** | صفحة كتالوج الخدمات: `StatsGrid` (عدد الخدمات، الفئات، الفعالة، المعطلة). `DataTable` للخدمات مع فلاتر. `CreateServiceDialog` + `ServiceDetailSheet`. قسم منفصل للتخصصات | `GET/POST/PATCH/DELETE /services`, `GET/POST/PATCH/DELETE /specialties` | CRITICAL |
| 5.1.4 | **Users & Roles (صفحة جديدة)** | Tab 1: إدارة المستخدمين — قائمة + إنشاء + تعديل + حذف + تعيين أدوار. Tab 2: إدارة الأدوار — قائمة أدوار + إنشاء دور + مصفوفة الصلاحيات التفاعلية (modules × permissions matrix) | `GET/POST/PATCH/DELETE /users`, `GET/POST/PATCH/DELETE /roles`, `GET /permissions` | CRITICAL |
| 5.1.5 | **Payments (صفحة جديدة)** | `StatsGrid` (إجمالي، معلق، مدفوع، مسترد). `DataTable` مع فلاتر (حالة، طريقة الدفع، تاريخ). `PaymentDetailSheet` مع معلومات الحجز. قسم خاص: مراجعة التحويلات البنكية (عرض الإيصال + AI tags + approve/reject) | `GET /payments`, `GET /payments/stats`, `GET /payments/:id`, `PATCH /payments/:id/status`, `POST /payments/:id/refund`, `PATCH /payments/receipts/:id/review` | CRITICAL |
| 5.1.6 | **Invoices (صفحة جديدة)** | `StatsGrid` (إجمالي، ZATCA submitted، pending، failed). `DataTable` مع فلاتر. `InvoiceDetailSheet` (تفاصيل الفاتورة + حالة ZATCA + QR). زر إرسال فاتورة بالإيميل | `GET /invoices`, `GET /invoices/stats`, `GET /invoices/:id`, `GET /invoices/:id/html`, `PATCH /invoices/:id/send` | CRITICAL |

**معيار الإتمام:**
- [ ] كل صفحة متصلة بـ API حقيقي
- [ ] كل صفحة فيها: Loading skeleton + Empty state + Error state
- [ ] كل صفحة تتبع هيكل `ListPageShell > PageHeader > StatsGrid > DataTable`
- [ ] CRUD يعمل (إنشاء + تعديل + حذف) مع تأكيد الحذف
- [ ] Pagination + Search + Filters تعمل

---

### Sprint 5.2 — الصفحات الثانوية والإدارية

> **المسؤول:** FE-2
> **المدة المقترحة:** 4-5 أيام
> **يبدأ بعد إتمام Sprint 5.1**

| # | الصفحة | التفاصيل | API Endpoints | الأولوية |
|---|--------|----------|---------------|----------|
| 5.2.1 | **Dashboard Home — ربط API** | تحويل كل البيانات الوهمية إلى API حقيقي: `TodayOverview` من `/bookings/stats` + `/reports/revenue`. `TodayTimeline` من `/bookings?date=today`. `ActivityFeed` من `/notifications?limit=5`. `AttentionAlerts` من `/payments?status=pending` + `/bookings?status=pending_cancellation` | `GET /bookings/stats`, `GET /reports/revenue`, `GET /bookings`, `GET /notifications`, `GET /payments` | HIGH |
| 5.2.2 | **Reports (صفحة جديدة)** | Tab 1: تقارير الإيرادات — chart (Recharts) + فلتر بالفترة + مقارنة بالفترة السابقة. Tab 2: تقارير الحجوزات — chart + breakdown بالنوع والحالة. Tab 3: تقارير الممارسين — أداء كل ممارس | `GET /reports/revenue`, `GET /reports/bookings`, `GET /reports/practitioners/:id` | HIGH |
| 5.2.3 | **Notifications (صفحة جديدة)** | قائمة إشعارات مع: مقروءة/غير مقروءة، فلترة بالنوع، تحديد الكل كمقروء. عداد الإشعارات في الـ Header (badge) | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read` | HIGH |
| 5.2.4 | **Settings — ربط API + توسيع** | ربط الفورم الحالي بـ WhiteLabel API (حفظ فعلي). إضافة الـ tabs الناقصة: Integrations (Zoom + Moyasar keys)، Email Templates، Cancellation Policy، ZATCA Settings | `GET /whitelabel`, `PATCH /whitelabel`, `GET/PATCH /whitelabel/email-templates`, `GET/PATCH /whitelabel/cancellation-policy` | HIGH |
| 5.2.5 | **Chatbot Management (صفحة جديدة)** | Tab 1: المحادثات — قائمة sessions مع الرسائل. Tab 2: Knowledge Base — إدارة المحتوى (CRUD) + Sync. Tab 3: الإعدادات — model config، fallback settings. Tab 4: التحليلات — إحصائيات الاستخدام | `GET/POST /chatbot/sessions`, `GET/POST/PATCH/DELETE /chatbot/knowledge-base`, `POST /chatbot/knowledge-base/sync` | MEDIUM |

**معيار الإتمام:**
- [ ] Dashboard Home يعرض بيانات حقيقية
- [ ] Reports فيها charts تفاعلية مع فلترة
- [ ] Settings يحفظ فعلياً عبر API
- [ ] Notifications مع عداد في Header

---

### Sprint 5.3 — التوافق مع الـ Design System وإصلاح المخالفات

> **المسؤول:** FE-3
> **المدة المقترحة:** 3-4 أيام
> **يبدأ بالتوازي مع Sprint 5.1**

| # | المهمة | التفاصيل | الملفات المتأثرة | الأولوية |
|---|--------|----------|------------------|----------|
| 5.3.1 | **إصلاح مخالفات RTL (23 ملف)** | تحويل كل `left-*`/`right-*` إلى `start-*`/`end-*`. تحويل `pl-`/`pr-`/`ml-`/`mr-` إلى `ps-`/`pe-`/`ms-`/`me-`. تحويل `text-left`/`text-right` إلى `text-start`/`text-end`. تحويل `rounded-l`/`rounded-r` إلى `rounded-s`/`rounded-e` | 23 ملف (sidebar, sheet, dialog, header, booking-columns, booking-filters, booking-overview, activity-feed, attention-alerts, quick-actions, today-overview, today-timeline, login-form, auth-gate, patients/page, practitioners/page, bookings/page, command, input-group, select, dropdown-menu, button, tabs) | HIGH |
| 5.3.2 | **إصلاح مخالفات الـ Spacing (8px grid)** | تحويل `gap-1` → `gap-2`. تحويل `p-1` → `p-2`. إزالة `px-1.5`, `py-1.5`, `py-0.5` واستبدالها بقيم على الـ grid. مراجعة كل ملف | 20+ ملف | MEDIUM |
| 5.3.3 | **إصلاح القيم العشوائية** | إزالة `text-[0.8rem]` → `text-xs`. إزالة `rounded-[2px]` → `rounded-sm`. إزالة الـ hex `#6C47FF` من Settings | button.tsx, calendar.tsx, tooltip.tsx, settings/page.tsx | MEDIUM |
| 5.3.4 | **إضافة `font-numeric` class** | تطبيق `font-numeric` على كل الأرقام والتواريخ والمبالغ المالية في كل الصفحات | كل ملفات الصفحات + stat-card + data-table columns | MEDIUM |
| 5.3.5 | **Empty States لكل صفحة** | التأكد أن كل صفحة تعرض `EmptyState` component عندما لا توجد بيانات — مع رسالة واضحة + action button (مثل "إضافة أول مريض") | كل ملفات الصفحات | HIGH |
| 5.3.6 | **توحيد Toast/Feedback** | استخدام Sonner toast لكل العمليات: نجاح (إنشاء/تعديل/حذف)، خطأ (فشل API)، تحذير (حذف مع تأكيد). نمط موحد للرسائل | كل الصفحات + components | MEDIUM |

**معيار الإتمام:**
- [ ] 0 مخالفات RTL
- [ ] كل الـ spacing على 8px grid
- [ ] كل صفحة فيها empty state مناسب
- [ ] Toast متسق في كل العمليات

---

### Sprint 5.4 — تحسينات UX النهائية

> **المسؤول:** FE-3
> **المدة المقترحة:** 3-4 أيام
> **يبدأ بعد Sprint 5.3**

| # | المهمة | التفاصيل | الأولوية |
|---|--------|----------|----------|
| 5.4.1 | **Responsive Design** | اختبار + إصلاح كل الصفحات على tablet (768px–1024px). Sidebar يتحول لـ drawer على الشاشات الصغيرة. Tables تتحول لـ cards على mobile | HIGH |
| 5.4.2 | **Dark Mode Audit** | اختبار كل الصفحات في dark mode. التأكد أن كل الألوان تستخدم semantic tokens (لا ألوان ثابتة). إصلاح أي contrast issues | HIGH |
| 5.4.3 | **Breadcrumbs** | إضافة breadcrumbs في كل الصفحات الداخلية (مثل: Dashboard > Patients > Patient Detail) | MEDIUM |
| 5.4.4 | **Keyboard Shortcuts** | `Ctrl+K` → Command Palette (بحث سريع). `N` → إنشاء جديد (حسب الصفحة). `Esc` → إغلاق الـ sheets/dialogs | LOW |
| 5.4.5 | **Page Transitions** | انتقالات ناعمة بين الصفحات باستخدام Framer Motion أو CSS transitions | LOW |
| 5.4.6 | **Notification Badge في Header** | عداد الإشعارات غير المقروءة بجانب أيقونة الجرس في Header — يتحدث auto عبر polling أو refetchInterval | MEDIUM |

**معيار الإتمام:**
- [ ] كل الصفحات تعمل على tablet
- [ ] Dark mode متسق 100%
- [ ] Breadcrumbs في كل الصفحات الداخلية

---

## الجدول الزمني المقترح

```
الأسبوع 1:
├── Sprint 5.0 (FE-1) ████████████████ البنية التحتية
└── Sprint 5.3 (FE-3) ████████████     إصلاح DS (يبدأ بعد يوم 1)

الأسبوع 2:
├── Sprint 5.1 (FE-2) ████████████████████████ الصفحات الأساسية
├── Sprint 5.0 (FE-1) ████                     إنهاء البنية
└── Sprint 5.3 (FE-3) ████████████             إكمال DS fixes

الأسبوع 3:
├── Sprint 5.1 (FE-2) ████████████████         إكمال الصفحات الأساسية
├── Sprint 5.2 (FE-2) ████████                 بدء الصفحات الثانوية
└── Sprint 5.4 (FE-3) ████████████████         UX improvements

الأسبوع 4:
├── Sprint 5.2 (FE-2) ████████████████████████ إكمال كل الصفحات
├── Sprint 5.4 (FE-3) ████████████             إكمال UX
└── مراجعة نهائية     ████████████             تدقيق + إصلاح

المجموع: ~4 أسابيع
```

---

## ترتيب الأولويات (لو الوقت ضيق)

### يجب أن ينتهي — MVP Blockers:
1. Sprint 5.0 (البنية التحتية) — **بدونه لا شيء يعمل**
2. Patients + Practitioners API integration — **الوظائف الأساسية**
3. Payments + Invoices pages — **لا يمكن تشغيل عيادة بدون مالية**
4. Services page — **إعداد العيادة**
5. Users & Roles page — **إدارة الموظفين**
6. RTL fixes — **المستخدم الأساسي عربي**

### مهم لكن يمكن تأجيله أسبوع:
7. Dashboard Home API integration
8. Reports page
9. Settings API integration
10. Notifications page

### يمكن تأجيله لنهاية Phase 5:
11. Chatbot management
12. Keyboard shortcuts
13. Page transitions
14. Breadcrumbs

---

## قواعد صارمة أثناء التنفيذ

### الكود
1. **لا يتجاوز أي ملف 350 سطر** — قسّم فوراً
2. **لا بيانات وهمية** — كل شيء من API
3. **لا `any`** — كل شيء مُعرف النوع
4. **كل صفحة 4 حالات:** Loading + Data + Empty + Error
5. **كل mutation** (إنشاء/تعديل/حذف) يعرض toast للنتيجة

### الـ Design System
6. **ألوان semantic فقط** — لا hex، لا `text-gray-*`
7. **spacing على 8px grid** — لا `p-1`، لا `gap-3`
8. **RTL-first** — `start`/`end` فقط، لا `left`/`right`
9. **shadcn components فقط** — لا raw HTML inputs
10. **`font-numeric`** على كل الأرقام والتواريخ والمبالغ

### الـ Data Fetching
11. **TanStack Query لكل شيء** — لا `useState` + `useEffect` للـ API
12. **Query keys منظمة:** `['patients']`, `['patients', id]`, `['patients', { filters }]`
13. **Mutations مع `onSuccess`** — invalidate الـ query بعد النجاح
14. **Error handling في الـ hook** — لا try/catch في كل component

### الهيكل
15. **كل صفحة:** `ListPageShell > PageHeader > StatsGrid > DataTable`
16. **كل detail view:** `Sheet` (side panel)، لا صفحة منفصلة
17. **كل form:** `react-hook-form` + `zod` validation
18. **كل dialog/sheet** يُفصل في component خاص (لا inline في الصفحة)

---

## ملفات يجب قراءتها قبل البدء

| الملف | السبب |
|-------|-------|
| `dashboard/design-system-rules.md` | قواعد الـ DS |
| `dashboard/tokens.md` | الـ tokens المعتمدة |
| `dashboard/components-policy.md` | سياسة المكونات |
| `CLAUDE.md` | المعايير العامة للمشروع |
| `docs/api-spec.md` | توثيق كل الـ API endpoints |
| `dashboard/app/(dashboard)/bookings/page.tsx` | النمط المعتمد للصفحات |
| `dashboard/hooks/use-bookings.ts` | النمط المعتمد للـ hooks |
| `dashboard/lib/api/bookings.ts` | النمط المعتمد للـ API layer |

---

## Checklist نهاية Phase 5

- [ ] 12 صفحة مكتملة ومتصلة بالـ API
- [ ] 0 بيانات وهمية
- [ ] TanStack Query في كل مكان
- [ ] Loading + Empty + Error states في كل صفحة
- [ ] 0 مخالفات RTL
- [ ] 0 مخالفات DS (spacing, colors, typography)
- [ ] Dark mode يعمل على كل الصفحات
- [ ] Responsive على tablet
- [ ] Toast متسق لكل العمليات
- [ ] `font-numeric` على كل الأرقام
- [ ] لا ملف يتجاوز 350 سطر
- [ ] لا `any` types

---

*CareKit — WebVue Technology Solutions — Phase 5 Work Plan — 2026-03-24*
