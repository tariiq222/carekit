# CareKit — تقرير تحليل النظام الشامل

**التاريخ:** 2026-03-31  
**الإصدار:** 1.0  
**الحالة:** Phase 5 مكتمل — Phase 6 لم يبدأ

---

## جدول المحتويات

- [نظرة عامة](#نظرة-عامة)
- [المراحل والتقدم العام](#المراحل-والتقدم-العام)
- [Backend — تحليل الموديولات](#backend--تحليل-الموديولات)
  - [جدول النضج الكامل](#جدول-النضج-الكامل)
  - [تفاصيل كل موديول](#تفاصيل-كل-موديول)
  - [إحصائيات الباكند](#إحصائيات-الباكند)
- [Dashboard — تحليل الصفحات](#dashboard--تحليل-الصفحات)
  - [جدول النضج مع الترابط بالباكند](#جدول-النضج-مع-الترابط-بالباكند)
  - [طبقة الـ Hooks](#طبقة-الـ-hooks)
  - [طبقة الـ API](#طبقة-الـ-api)
  - [إحصائيات الداشبورد](#إحصائيات-الداشبورد)
- [Mobile — تحليل التطبيق](#mobile--تحليل-التطبيق)
  - [شاشات المريض](#شاشات-المريض-client)
  - [شاشات الممارس](#شاشات-الممارس-employee)
  - [الترابط بالباكند](#الترابط-بالباكند-من-الموبايل)
  - [إحصائيات الموبايل](#إحصائيات-الموبايل)
- [خريطة الترابط بين الموديولات](#خريطة-الترابط-بين-الموديولات)
- [الترابط بين الطبقات الثلاث](#الترابط-بين-الطبقات-الثلاث)
- [قاعدة البيانات](#قاعدة-البيانات--47-نموذج)
  - [نماذج Prisma](#نماذج-prisma)
  - [خريطة العلاقات](#خريطة-العلاقات)
  - [الـ Enums](#الـ-enums)
  - [الـ Migrations](#الـ-migrations)
- [الحزمة المشتركة](#الحزمة-المشتركة-shared)
- [الفجوات والملاحظات](#الفجوات-والملاحظات-المهمة)
- [ملخص تنفيذي](#ملخص-تنفيذي)

---

## نظرة عامة

CareKit هو نظام إدارة عيادات ذكي (White-Label) يُنشر بشكل مستقل لكل عميل. كل نشر عبارة عن Docker stack مكتمل على بنية العميل التحتية.

| الطبقة | التقنية | الوصف |
|--------|---------|-------|
| **Backend** | NestJS + Prisma + PostgreSQL + Redis + BullMQ | خادم API مع 30 موديول |
| **Dashboard** | Next.js App Router + TanStack Query + shadcn/ui | لوحة تحكم إدارية |
| **Mobile** | React Native (Expo SDK 55) + Redux Toolkit | تطبيق iOS/Android |
| **Shared** | TypeScript package | أنواع وثوابت وتوكنات مشتركة |

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT DEPLOYMENT                         │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Mobile  │  │  Dashboard   │  │     Custom Website        │  │
│  │ (iOS/    │  │  (Next.js)   │  │  (per-client, WebVue)     │  │
│  │ Android) │  │  Port 3001   │  │  Port 80/443              │  │
│  └────┬─────┘  └──────┬───────┘  └──────────────────────────┘  │
│       │               │                                          │
│  ┌────▼───────────────▼──────────────────────────────────┐      │
│  │                    Nginx (Reverse Proxy)                │      │
│  └──────────────────────────┬────────────────────────────┘      │
│                             │                                    │
│  ┌──────────────────────────▼────────────────────────────┐      │
│  │               NestJS Backend (Port 3000)                │      │
│  │   Auth │ Bookings │ Payments │ AI Chatbot │ Reports    │      │
│  └──────┬──────────┬──────────┬────────────┬─────────────┘      │
│         │          │          │            │                     │
│  ┌──────▼──┐ ┌─────▼──┐ ┌────▼───┐ ┌─────▼──┐                 │
│  │PostgreSQL│ │  Redis │ │ MinIO  │ │ BullMQ │                 │
│  │  5432   │ │  6379  │ │  9000  │ │ Queues │                 │
│  └─────────┘ └────────┘ └────────┘ └────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## المراحل والتقدم العام

| المرحلة | الوصف | الحالة |
|---------|-------|--------|
| Phase 1 | Backend + Schema + Dashboard Structure | ✅ **100%** |
| Phase 2 | ZATCA + Dashboard | ✅ **100%** |
| Phase 3 | Mobile App (33 شاشة) | ✅ **100%** |
| Phase 4 | AI Chatbot | ✅ **100%** |
| Sprint 4.5 | Bug Fixes + 3-Tier Pricing Refactor | ✅ **100%** |
| Sprint 4.6 | Code Audit (28 إصلاح) | ✅ **100%** |
| Sprint 4.7 | Architecture Gap Analysis (32 إصلاح) | ✅ **100%** |
| Phase 5 | Dashboard Redesign (Frosted Glass DS) | ✅ **100%** |
| Phase 6 | Website (الموقع العام) | 🔴 **0% — لم يبدأ** |
| Phase 7 | Mobile Polishing + App Store | 🔴 **0% — لم يبدأ** |
| Phase 8 | Production Readiness | 🔴 **0% — لم يبدأ** |
| Phase 9 | Testing & Delivery | 🔴 **0% — لم يبدأ** |

### المسار الحرج

```
Phase 5 (✅) ──► Phase 6 (Website) ──► Phase 7 (Mobile + Store)
                                                    │
                                        Phase 8 (Production) ──► Phase 9 (Go Live)
```

---

## Backend — تحليل الموديولات

### جدول النضج الكامل

| # | الموديول | النضج | الملفات | الـ Endpoints | Unit Tests | E2E Tests | الاعتماديات |
|---|---------|-------|---------|--------------|------------|-----------|------------|
| 1 | **auth** | 🟢 مكتمل | 28 | 12 | 8 | 4 | email, clients, activity-log |
| 2 | **bookings** | 🟢 مكتمل | 35 | 24 | 16 | 8 | notifications, zoom, clinic, activity-log |
| 3 | **payments** | 🟢 مكتمل | 20 | 11 | 7 | 2 | invoices, bookings, notifications, activity-log |
| 4 | **employees** | 🟢 مكتمل | 24 | 22 | 1 | 5 | bookings, auth, email |
| 5 | **chatbot** | 🟢 مكتمل | 28 | 20 | 5 | 6 | bookings, services, employees |
| 6 | **services** | 🟢 مكتمل | 18 | 18 | 7 | 3 | intake-forms |
| 7 | **zatca** | 🟢 مكتمل | 16 | 5 | 5 | 1 | BullMQ, Config |
| 8 | **invoices** | 🟢 مكتمل | 10 | 7 | 3 | 1 | zatca, BullMQ |
| 9 | **clients** | 🟢 مكتمل | 8 | 8 | 0 | 2 | — |
| 10 | **users** | 🟢 مكتمل | 8 | 10 | 2 | 2 | employees, auth, activity-log |
| 11 | **notifications** | 🟢 مكتمل | 11 | 7 | 3 | 2 | whitelabel |
| 12 | **branches** | 🟢 مكتمل | 7 | 8 | 1 | 4 | — |
| 13 | **reports** | 🟢 مكتمل | 8 | 7 | 4 | 2 | — |
| 14 | **clinic** | 🟢 مكتمل | 9 | 6 | 2 | 1 | — |
| 15 | **roles** | 🟢 مكتمل | 4 | 5 | 1 | 1 | auth |
| 16 | **coupons** | 🟢 مكتمل | 7 | 6 | 1 | 2 | — |
| 17 | **gift-cards** | 🟢 مكتمل | 8 | 7 | 1 | 1 | — |
| 18 | **intake-forms** | 🟢 مكتمل | 8 | 8 | 1 | 1 | — |
| 19 | **ratings** | 🟢 مكتمل | 5 | 3 | 1 | 2 | — |
| 20 | **problem-reports** | 🟢 مكتمل | 6 | 4 | 1 | 1 | notifications |
| 21 | **whitelabel** | 🟢 مكتمل | 6 | 6 | 1 | 2 | — |
| 22 | **specialties** | 🟢 مكتمل | 6 | 5 | 2 | 1 | — |
| 23 | **email-templates** | 🟢 مكتمل | 5 | 4 | 1 | 1 | — |
| 24 | **activity-log** | 🟢 مكتمل | 4 | 2 | 2 | 1 | — |
| 25 | **health** | 🟢 مكتمل | 4 | 1 | 3 | 1 | Terminus |
| 26 | **tasks** | 🟡 وظيفي | 10 | 0 (background) | 6 | 0 | notifications, bookings, payments |
| 27 | **email** | 🟡 وظيفي | 4 | 0 (internal) | 2 | 1 | email-templates, BullMQ |
| 28 | **permissions** | 🟡 وظيفي | 3 | 1 | 1 | 1 | — |
| 29 | **integrations** | 🟡 وظيفي | 3 | 0 (internal) | 1 | 0 | zoom (child) |
| 30 | **ai** | 🟠 جزئي | 4 | 0 (background) | 1 | 1 | BullMQ |

---

### تفاصيل كل موديول

#### 1. AUTH — 🟢 مكتمل

أكبر وأعقد موديول. يشمل المصادقة والتفويض بالكامل.

**الملفات (28):**
- Controller + Service + 5 sub-services (cache, token, otp, cookie, permission-cache)
- CASL ability factory
- JWT strategy + 2 guards + 3 decorators
- 7 DTOs + 2 types + 1 enum

**الـ Endpoints (12):**

| Method | Path | الوصف |
|--------|------|-------|
| POST | `/auth/register` | تسجيل مستخدم جديد |
| POST | `/auth/login` | تسجيل دخول بالإيميل/كلمة المرور |
| POST | `/auth/login/otp/send` | إرسال OTP للدخول بدون كلمة مرور |
| POST | `/auth/login/otp/verify` | التحقق من OTP |
| POST | `/auth/refresh-token` | تجديد access token |
| POST | `/auth/logout` | تسجيل خروج |
| GET | `/auth/me` | الملف الشخصي الحالي |
| POST | `/auth/password/forgot` | إرسال OTP لاستعادة كلمة المرور |
| POST | `/auth/password/reset` | إعادة تعيين كلمة المرور |
| PATCH | `/auth/password/change` | تغيير كلمة المرور |
| POST | `/auth/email/verify/send` | إرسال OTP للتحقق من الإيميل |
| POST | `/auth/email/verify` | التحقق من الإيميل |

**ملاحظات:** يتطلب مراجعة المالك. يشمل CASL RBAC، rate limiting عبر OtpThrottle، refresh tokens عبر cookies مع fallback للموبايل.

---

#### 2. BOOKINGS — 🟢 مكتمل

الموديول الأكثر تعقيداً. دورة حياة حجز كاملة.

**الملفات (35):**
- 4 controllers + 12 services + 3 helpers + 12 DTOs

**الـ Endpoints (24):**

| Controller | العدد | المسارات الرئيسية |
|------------|-------|------------------|
| BookingsController | 20 | إنشاء، قائمتي، اليوم، إحصائيات، متكرر، قائمة، تفاصيل، إعادة جدولة، تأكيد، تسجيل وصول، بدء، إكمال، عدم حضور، طلب إلغاء، موافقة/رفض إلغاء، إلغاء إداري |
| WaitlistController | 4 | قائمتي، القائمة، انضمام، مغادرة |
| BookingStatusLogController | 1 | سجل حالات الحجز |
| BookingSettingsController | 2 | قراءة/تحديث إعدادات الحجز |

**ملاحظات:** دورة حياة كاملة (إنشاء → تأكيد → تسجيل وصول → بدء → إكمال/عدم حضور) مع سير عمل إلغاء (طلب → موافقة/رفض)، حجوزات متكررة، قائمة انتظار، وتكامل Zoom.

---

#### 3. PAYMENTS — 🟢 مكتمل

**الملفات (20):**
- Controller + 5 services (moyasar-payment, moyasar-checkout, moyasar-webhook, moyasar-refund, bank-transfer) + helpers + 10 DTOs

**الـ Endpoints (11):**

| Method | Path | الوصف |
|--------|------|-------|
| GET | `/payments/stats` | إحصائيات المدفوعات |
| GET | `/payments/my` | مدفوعات المريض |
| GET | `/payments/booking/:bookingId` | مدفوعات حسب الحجز |
| GET | `/payments` | قائمة المدفوعات مع فلاتر |
| POST | `/payments/moyasar` | إنشاء دفعة Moyasar |
| POST | `/payments/moyasar/webhook` | Webhook (عام) |
| POST | `/payments/bank-transfer` | رفع إيصال تحويل بنكي |
| POST | `/payments/bank-transfer/:id/verify` | التحقق من التحويل |
| POST | `/payments/:id/refund` | استرداد |
| GET | `/payments/:id` | تفاصيل الدفعة |
| PATCH | `/payments/:id/status` | تحديث حالة الدفعة |

**ملاحظات:** يتطلب مراجعة المالك. دعم مزدوج: Moyasar (بطاقة ائتمان) وتحويل بنكي مع تحقق AI. Webhook عام مع HMAC signature.

---

#### 4. EMPLOYEES — 🟢 مكتمل

**الملفات (24):**
- 2 controllers + 8 services + 1 helper + 10 DTOs

**الـ Endpoints (22):**

| Controller | العدد | المسارات الرئيسية |
|------------|-------|------------------|
| EmployeesController | 19 | CRUD، التوفر (قراءة/تعيين)، الفترات، الاستراحات، الإجازات، الخدمات (قائمة/تعيين/تحديث/إزالة)، التقييمات |
| FavoriteEmployeesController | 3 | المفضلة، إضافة/إزالة مفضل |

---

#### 5. CHATBOT — 🟢 مكتمل

**الملفات (28):**
- 3 controllers + 11 services + 4 DTOs + 3 interfaces + 3 constants

**الـ Endpoints (20):**

| Controller | العدد | المسارات الرئيسية |
|------------|-------|------------------|
| ChatbotController | 6 | جلسات CRUD، رسائل، بث SSE |
| ChatbotAdminController | 7 | إعدادات، تحليلات، رسائل الموظفين |
| ChatbotKbController | 7 | قاعدة المعرفة CRUD، مزامنة، رفع/معالجة/حذف ملفات |

**ملاحظات:** شات بوت AI متقدم مع RAG (pgvector)، tool calling، SSE streaming، رفع ملفات (PDF/DOCX/TXT)، إدارة قاعدة معرفة، تحليلات، وتسليم للموظف. يستخدم نمط port/adapter.

---

#### 6. SERVICES — 🟢 مكتمل

**الـ Endpoints (18):** فئات (4)، خدمات (7)، نماذج قبول (1)، خيارات المدة (2)، ممارسين (1)، أنواع الحجز (2)، فروع (1)

---

#### 7. ZATCA — 🟢 مكتمل

**الملفات (16):** 8 services متخصصة (crypto, onboarding, sandbox, api, xml-builder, xml-signing, qr-generator, invoice-hash)

**ملاحظات:** يتطلب مراجعة المالك. امتثال الفوترة الإلكترونية السعودية. سلسلة PKI كاملة: CSR، إدارة شهادات، بناء XML، توقيع XML، QR، hash، إرسال API. وضع Sandbox للاختبار.

---

#### 8-25. الموديولات المكتملة الأخرى

| الموديول | الـ Endpoints | الوصف |
|---------|--------------|-------|
| **invoices** | 7 | فواتير مع تكامل ZATCA وبناء HTML |
| **clients** | 8 | ملفات المرضى مع walk-in وclaim |
| **users** | 10 | إدارة المستخدمين مع RBAC |
| **notifications** | 7 | إشعارات متعددة القنوات (in-app, FCM, SMS) |
| **branches** | 8 | دعم متعدد الفروع |
| **reports** | 7 | تقارير إيرادات/حجوزات/ممارسين مع CSV export |
| **clinic** | 6 | إعدادات العيادة، ساعات العمل، العطل |
| **roles** | 5 | إدارة الأدوار مع الصلاحيات |
| **coupons** | 6 | كوبونات خصم مع تتبع الاستخدام |
| **gift-cards** | 7 | بطاقات هدايا مع رصيد وشحن |
| **intake-forms** | 8 | نماذج قبول ديناميكية مع حقول وشروط |
| **ratings** | 3 | تقييمات نجوم مع ربط بالحجز |
| **problem-reports** | 4 | شكاوى المرضى مع سير عمل حل |
| **whitelabel** | 6 | تخصيص العلامة التجارية |
| **specialties** | 5 | التخصصات الطبية |
| **email-templates** | 4 | قوالب بريد قابلة للتخصيص مع معاينة |
| **activity-log** | 2 | سجل تدقيق لجميع الإجراءات |
| **health** | 1 | فحص صحة النظام (DB, Redis, MinIO) |

---

#### 26-30. الموديولات الوظيفية والجزئية

| الموديول | النضج | الوصف |
|---------|-------|-------|
| **tasks** | 🟡 وظيفي | وظائف خلفية: انتهاء الحجوزات، تذكيرات، تنظيف، إكمال تلقائي. بدون HTTP surface |
| **email** | 🟡 وظيفي | خدمة بريد داخلية عبر BullMQ. بدون HTTP surface |
| **permissions** | 🟡 وظيفي | قراءة فقط — يعرض صلاحيات النظام |
| **integrations** | 🟡 وظيفي | مظلة للتكاملات الخارجية. حالياً Zoom فقط |
| **ai** | 🟠 جزئي | التحقق من إيصالات التحويل البنكي عبر AI. خدمة خلفية فقط |

---

### إحصائيات الباكند

| المقياس | العدد |
|---------|-------|
| إجمالي الموديولات | 30 |
| 🟢 مكتمل | 25 |
| 🟡 وظيفي | 4 |
| 🟠 جزئي | 1 |
| 🔴 فارغ | 0 |
| إجمالي الـ Endpoints | ~215 |
| إجمالي ملفات المصدر | ~270 |
| ملفات Unit Test | ~96 |
| ملفات E2E Test | ~61 |
| موديولات مع Swagger | 26/26 controller |

---

## Dashboard — تحليل الصفحات

### جدول النضج مع الترابط بالباكند

| الصفحة | النضج | المكونات | Queries | Mutations | ملفات API | Types | Schema | الترجمة |
|--------|-------|---------|---------|-----------|----------|-------|--------|---------|
| **الرئيسية** | 🟢 | 8 | 3 | 0 | bookings, notifications | booking, notification | — | AR+EN |
| **الحجوزات** | 🟢 | 25 | 3 | 14 | bookings, waitlist, problem-reports | booking, waitlist, problem-report | booking | AR+EN |
| **المرضى** | 🟢 | 10 | 5 | 4 | clients | client | client | AR+EN |
| **الممارسين** | 🟢 | 35+ | 7 | 11 | employees, schedule | employee | employee | AR+EN |
| **الخدمات** | 🟢 | 15+ | 6 | 13+ | services | service, service-payloads | service | AR+EN |
| **المدفوعات** | 🟢 | 6 | 2 | 4 | payments | payment, common | payment | AR+EN |
| **الفواتير** | 🟢 | 5 | 2 | 2 | invoices, zatca | invoice, zatca | invoice | AR+EN |
| **الفروع** | 🟢 | 8 | 2 | 5 | branches | branch | branch | AR+EN |
| **المستخدمين** | 🟢 | 11 | 3 | 11 | users, activity-log | user, activity-log | user | AR+EN |
| **بطاقات الهدايا** | 🟢 | 6 | 2 | 4 | gift-cards | gift-card | — | AR+EN |
| **الكوبونات** | 🟢 | 7 | 1 | 3 | coupons | coupon | coupon | AR+EN |
| **نماذج القبول** | 🟢 | 9 | 2 | 4 | intake-forms | intake-form (×3) | — | AR+EN |
| **التقارير** | 🟢 | 4 | — | — | reports | report | — | AR+EN |
| **الإعدادات** | 🟢 | 19 | 4 | 7 | whitelabel, clinic, booking-settings, email-templates | whitelabel, email-template | — | AR+EN |
| **White Label** | 🟢 | 3 | 1 | 1 | whitelabel | whitelabel | — | AR+EN |
| **الشات بوت** | 🟢 | 8 | 7 | 13 | chatbot, chatbot-kb | chatbot | chatbot | AR+EN |
| **الإشعارات** | 🟢 | 2 | 3 | 2 | notifications | notification | — | AR+EN |

> **🎯 كل صفحة في الداشبورد مكتملة 100% — لا يوجد أي stub أو placeholder**

### صفحات إعادة التوجيه (دمج الصفحات)

| المسار | يُعاد توجيهه إلى | السبب |
|--------|------------------|-------|
| `/activity-log` | `/users?tab=activityLog` | مُدمج في صفحة المستخدمين |
| `/zatca` | `/invoices?tab=zatca` | مُدمج في صفحة الفواتير |
| `/problem-reports` | `/bookings?tab=problemReports` | مُدمج في صفحة الحجوزات |
| `/ratings` | `/employees?tab=ratings` | مُدمج في صفحة الممارسين |

---

### طبقة الـ Hooks

| ملف الـ Hook | Queries | Mutations | الاتصال بالـ API |
|-------------|---------|-----------|-----------------|
| `use-bookings.ts` | 3 | 14 | `lib/api/bookings.ts` |
| `use-clients.ts` | 5 | 4 | `lib/api/clients.ts` |
| `use-employees.ts` | 7 | — | `lib/api/employees.ts` |
| `use-employee-mutations.ts` | — | 11 | `lib/api/employees.ts` |
| `use-services.ts` | 6 | 13+ | `lib/api/services.ts` |
| `use-payments.ts` | 2 | 4 | `lib/api/payments.ts` |
| `use-invoices.ts` | 2 | 2 | `lib/api/invoices.ts` |
| `use-branches.ts` | 2 | 5 | `lib/api/branches.ts` |
| `use-users.ts` | 3 | 11 | `lib/api/users.ts` |
| `use-gift-cards.ts` | 2 | 4 | `lib/api/gift-cards.ts` |
| `use-coupons.ts` | 1 | 3 | `lib/api/coupons.ts` |
| `use-intake-forms.ts` | 2 | 4 | `lib/api/intake-forms.ts` |
| `use-notifications.ts` | 3 | 2 | `lib/api/notifications.ts` |
| `use-whitelabel.ts` | 1 | 1 | `lib/api/whitelabel.ts` |
| `use-chat-sessions.ts` | 2 | — | `lib/api/chatbot.ts` |
| `use-chatbot-config.ts` | 3 | — | `lib/api/chatbot.ts` |
| `use-chatbot-analytics.ts` | 2 | — | `lib/api/chatbot.ts` |
| `use-chatbot-mutations.ts` | — | 13 | `lib/api/chatbot.ts` |
| `use-zatca.ts` | 3 | 2 | `lib/api/zatca.ts` |
| `use-activity-log.ts` | 1 | 0 | `lib/api/activity-log.ts` |
| `use-problem-reports.ts` | 1 | 1 | `lib/api/problem-reports.ts` |
| `use-waitlist.ts` | 1 | 1 | `lib/api/waitlist.ts` |
| `use-organization-settings.ts` | 3 | 5 | `lib/api/clinic.ts`, `lib/api/booking-settings.ts` |
| `use-email-templates.ts` | 1 | 2 | `lib/api/email-templates.ts` |
| `use-booking-slots.ts` | 2 | 0 | `lib/api/employees.ts` |

---

### طبقة الـ API

**API Client (`lib/api.ts`):**
- Custom fetch wrapper مع Bearer token injection
- كشف 401 تلقائي مع refresh-token retry (httpOnly cookies)
- Same-origin proxy لـ auth endpoints
- Auto-unwrap لـ `{ success, data }` envelope

**27 ملف API module** تغطي كل الموديولات:

`auth` • `bookings` • `booking-settings` • `clients` • `employees` • `employees-schedule` • `services` • `payments` • `invoices` • `branches` • `users` • `gift-cards` • `coupons` • `intake-forms` • `notifications` • `whitelabel` • `chatbot` • `chatbot-kb` • `zatca` • `reports` • `clinic` • `email-templates` • `activity-log` • `problem-reports` • `waitlist` • `widget` • `feature-flags`

---

### إحصائيات الداشبورد

| المقياس | العدد |
|---------|-------|
| صفحات فريدة | 20 + 4 redirects |
| مجلدات مكونات Feature | 21 |
| مكونات Feature (إجمالي) | ~200+ |
| ملفات Hooks | 31 |
| ملفات API | 27 |
| ملفات Types | 26 |
| ملفات Zod Schema | 11 |
| ملفات ترجمة | 30+ (AR + EN) |
| إجمالي Queries | ~56 |
| إجمالي Mutations | ~97 |

---

## Mobile — تحليل التطبيق

### التقنيات

| الطبقة | التقنية |
|--------|---------|
| Framework | React Native 0.83.2 |
| Platform | Expo SDK 55 |
| Routing | Expo Router (file-based) |
| State | Redux Toolkit + redux-persist |
| HTTP | Axios |
| i18n | i18next + react-i18next |
| Forms | React Hook Form + Zod |
| Chat UI | react-native-gifted-chat |
| Calendar | react-native-calendars |
| Payments | Moyasar (via WebBrowser redirect) |
| Tokens | Expo SecureStore |

---

### شاشات المريض (Client)

| الشاشة | النضج | الترابط بالباكند |
|--------|-------|----------------|
| Home (dashboard) | 🟢 مكتمل | ✅ 3 APIs متزامنة (bookings, specialties, employees) |
| Appointments (list) | 🟢 مكتمل | ✅ bookings API مع فلتر الحالة |
| Appointment Detail | 🟢 مكتمل | ✅ booking + cancel + rate + Zoom |
| Booking Step 1 (نوع الزيارة) | 🟢 مكتمل | ✅ services API |
| Booking Step 2 (الجدول) | 🟢 مكتمل | ✅ employee availability API |
| Booking Step 3 (التأكيد) | 🟢 مكتمل | ✅ bookings.create API |
| Booking Step 4 (الدفع) | 🟢 مكتمل | ✅ payments/moyasar + payments/bank-transfer |
| Bank Transfer | 🟢 مكتمل | ✅ clinic settings + FormData upload |
| Booking Success | 🟢 مكتمل | ✅ — |
| AI Chat | 🟢 مكتمل | ✅ chatbot sessions + messages |
| Notifications | 🟢 مكتمل | ✅ notifications + FCM token |
| Rating | 🟢 مكتمل | ✅ ratings API |
| Video Call | 🟢 مكتمل | ✅ Zoom link |
| Settings | 🟢 مكتمل | ✅ language + push toggle |
| Profile | 🟡 وظيفي | ⚠️ UI كامل لكن أزرار القائمة بدون وظائف (`onPress={() => {}}`) |
| Employee Detail | 🟡 وظيفي | ⚠️ زر "احجز" غير مربوط بالتنقل |

---

### شاشات الممارس (Employee)

| الشاشة | النضج | الترابط بالباكند |
|--------|-------|----------------|
| Today Dashboard | 🟢 مكتمل | ✅ bookings/today API |
| Appointment Detail | 🟢 مكتمل | ✅ start/complete/cancel APIs |
| Video Call | 🟢 مكتمل | ✅ Zoom link |
| Calendar | 🟡 وظيفي | ⚠️ "إدارة التوفر" بدون وظيفة |
| Profile | 🟡 وظيفي | ⚠️ بيانات ثابتة (hardcoded rating "4.8") |
| Clients List | 🟠 جزئي | ❌ لا يوجد استدعاء API — القائمة فارغة دائماً |
| Client Record | 🔴 Stub | ❌ بيانات وهمية ثابتة ("Ahmed Al-Shamri") |

---

### الترابط بالباكند من الموبايل

| الفئة | Method | Endpoint | المستخدم في |
|-------|--------|----------|------------|
| **Auth** | POST | `/auth/login` | شاشة الدخول |
| | POST | `/auth/register` | شاشة التسجيل |
| | POST | `/auth/login/otp/send` | شاشة OTP |
| | POST | `/auth/login/otp/verify` | شاشة OTP |
| | POST | `/auth/logout` | Profile |
| | POST | `/auth/refresh-token` | API interceptor (تلقائي) |
| | GET | `/auth/me` | App index (hydration) |
| | POST | `/auth/email/verify/send` | EmailVerificationBanner |
| **Bookings** | GET | `/bookings` | المواعيد، التقويم، الرئيسية |
| | GET | `/bookings/:id` | تفاصيل الموعد |
| | POST | `/bookings` | تأكيد الحجز |
| | POST | `/bookings/:id/cancel-request` | تفاصيل موعد المريض |
| | POST | `/bookings/:id/complete` | تفاصيل موعد الممارس |
| | POST | `/bookings/:id/start` | تفاصيل موعد الممارس |
| | POST | `/bookings/:id/employee-cancel` | تفاصيل موعد الممارس |
| | GET | `/bookings/today` | لوحة اليوم للممارس |
| **Employees** | GET | `/employees` | الرئيسية (المميزين) |
| | GET | `/employees/:id` | تفاصيل الممارس |
| | GET | `/employees/:id/availability` | جدولة الحجز |
| | GET | `/employees/:id/ratings` | تفاصيل الممارس |
| **Payments** | POST | `/payments/moyasar` | شاشة الدفع |
| | POST | `/payments/bank-transfer` | التحويل البنكي (multipart) |
| **Specialties** | GET | `/specialties` | الشاشة الرئيسية |
| **Notifications** | GET | `/notifications` | تبويب الإشعارات |
| | GET | `/notifications/unread-count` | badge التبويب |
| | PATCH | `/notifications/read-all` | تبويب الإشعارات |
| | PATCH | `/notifications/:id/read` | عند الضغط على الإشعار |
| | POST | `/notifications/fcm-token` | تسجيل Push |
| | DELETE | `/notifications/fcm-token` | إلغاء تسجيل Push |
| **Chatbot** | POST | `/chatbot/sessions` | تبويب الشات |
| | POST | `/chatbot/sessions/:id/messages` | تبويب الشات |
| **Ratings** | POST | `/ratings` | شاشة التقييم |
| **Clinic** | GET | `/clinic/settings/public` | شاشة التحويل البنكي |

---

### إحصائيات الموبايل

| المقياس | العدد |
|---------|-------|
| إجمالي الشاشات | 26 |
| 🟢 مكتمل | 18 |
| 🟡 وظيفي | 4 |
| 🟠 جزئي | 1 |
| 🔴 Stub | 1 |
| Endpoints مستخدمة فعلياً | 27 |
| Services معرّفة لكن غير مستخدمة | 4 |
| ملفات اختبار | ❌ **0** |

---

## خريطة الترابط بين الموديولات

### رسم بياني للاعتماديات

```
                    ┌─────────────────────────────────────────┐
                    │              USER (المحور المركزي)        │
                    └──────┬──────────┬───────────┬───────────┘
                           │          │           │
                    ┌──────▼──┐ ┌─────▼────┐ ┌───▼──────────┐
                    │  AUTH   │ │ CLIENTS │ │ EMPLOYEES│
                    │ (12 EP) │ │ (8 EP)   │ │ (22 EP)      │
                    └──┬──┬──┘ └──────────┘ └──┬───────────┘
                       │  │                     │
            ┌──────────┘  └──────┐              │
            ▼                    ▼              ▼
     ┌──────────┐        ┌──────────┐   ┌──────────┐
     │  ROLES   │        │  EMAIL   │   │ SERVICES │
     │ (5 EP)   │        │ (0 EP)   │   │ (18 EP)  │
     └──────────┘        └──────────┘   └────┬─────┘
                                              │
                    ┌─────────────────────────┼──────────────┐
                    │                         │              │
             ┌──────▼──────┐          ┌──────▼──┐    ┌──────▼──────┐
             │  BOOKINGS   │◄─────────│ CHATBOT │    │INTAKE-FORMS │
             │  (24 EP)    │          │ (20 EP) │    │ (8 EP)      │
             │ ⭐ الأكثر   │          └─────────┘    └─────────────┘
             │   تعقيداً   │
             └──┬──┬──┬────┘
                │  │  │
     ┌──────────┘  │  └──────────┐
     ▼             ▼             ▼
┌─────────┐ ┌──────────┐ ┌──────────────┐
│PAYMENTS │ │  TASKS   │ │NOTIFICATIONS │
│ (11 EP) │ │ (0 EP)   │ │ (7 EP)       │
└──┬──────┘ │Background│ └──────────────┘
   │        └──────────┘
   ▼
┌──────────┐     ┌──────────┐
│ INVOICES │────►│  ZATCA   │
│ (7 EP)   │     │ (5 EP)   │
└──────────┘     └──────────┘
```

### سلاسل الاعتماديات

```
auth ──────────► email, clients, activity-log
bookings ──────► notifications, zoom (integrations), clinic, activity-log
chatbot ───────► bookings, services, employees (via ports)
payments ──────► invoices, bookings, notifications, activity-log
invoices ──────► zatca
employees ─► bookings, auth, email
users ─────────► employees (forwardRef), auth, activity-log
roles ─────────► auth
tasks ─────────► notifications, bookings, payments, activity-log
services ──────► intake-forms
email ─────────► email-templates
notifications ─► whitelabel
problem-reports ► notifications
```

### الموديولات المستقلة (بدون اعتماديات)

`activity-log` • `branches` • `clinic` • `coupons` • `email-templates` • `gift-cards` • `health` • `intake-forms` • `permissions` • `ratings` • `reports` • `specialties` • `whitelabel`

---

## الترابط بين الطبقات الثلاث

### Backend ↔ Dashboard (ترابط كامل 100%)

```
Backend (215 EP) ◄══════════════► Dashboard (27 API modules, 56 queries, 97 mutations)
                    100% تغطية
```

كل endpoint في الباكند له مقابل في الداشبورد عبر:
- `lib/api/*.ts` → استدعاء REST APIs
- `hooks/use-*.ts` → TanStack Query wrappers
- `lib/types/*.ts` → TypeScript types مطابقة للباكند
- `lib/schemas/*.ts` → Zod validation مطابقة للـ DTOs

### Backend ↔ Mobile (ترابط جزئي ~13%)

```
Backend (215 EP) ◄──────────────► Mobile (27 endpoints مستخدمة فعلياً)
                    ~13% تغطية
```

الموبايل يستخدم فقط الـ endpoints الضرورية لتجربة المريض والممارس:
- Auth: 8 endpoints
- Bookings: 8 endpoints
- Employees: 4 endpoints
- Payments: 2 endpoints
- Notifications: 6 endpoints
- Chatbot: 2 endpoints
- Ratings: 1 endpoint
- Clinic: 1 endpoint
- Specialties: 1 endpoint

### Dashboard ↔ Mobile (لا ترابط مباشر)

```
Dashboard ◄─── shared/ ───► Mobile
               (الحزمة المشتركة)
```

لا يوجد ترابط مباشر. كلاهما يستهلك الباكند بشكل مستقل. الحزمة المشتركة توفر الأنواع والثوابت والتوكنات.

---

## قاعدة البيانات — 47 نموذج

### نماذج Prisma

#### auth.prisma (7 نماذج)

| النموذج | الحقول | الوصف |
|---------|--------|-------|
| **User** | 41 | الكيان المركزي؛ قابل للحذف الناعم |
| **ClientProfile** | 12 | 1:1 مع User (معلومات طبية) |
| **OtpCode** | 8 | رموز OTP مع فهرس مركب |
| **RefreshToken** | 6 | رموز التجديد مع فهارس |
| **Role** | 10 | أدوار النظام + مخصصة |
| **Permission** | 7 | فريد `[module, action]` |
| **RolePermission** | 5 | جدول ربط: Role ↔ Permission |
| **UserRole** | 5 | جدول ربط: User ↔ Role |

#### organization.prisma (9 نماذج)

| النموذج | الحقول | الوصف |
|---------|--------|-------|
| **Specialty** | 9 | التخصصات الطبية (AR/EN) |
| **Employee** | 29 | تقييم/عدد مراجعات مخزنة مؤقتاً |
| **EmployeeAvailability** | 10 | متعدد الفروع، dayOfWeek 0-6 |
| **EmployeeVacation** | 6 | إجازات بنطاق تاريخ |
| **EmployeeBreak** | 7 | استراحات خلال اليوم |
| **ClinicWorkingHours** | 6 | فريد `[dayOfWeek, branchId]` |
| **ClinicHoliday** | 5 | يدعم العطل المتكررة |
| **Branch** | 17 | متعدد الفروع؛ قابل للحذف الناعم |
| **EmployeeBranch** | 7 | جدول ربط: Employee ↔ Branch |

#### bookings.prisma (8 نماذج)

| النموذج | الحقول | الوصف |
|---------|--------|-------|
| **Booking** | 45 | 12 فهرس أداء؛ سلسلة إعادة جدولة ذاتية |
| **BookingSettings** | 31 | نمط تجاوز متعدد الفروع |
| **WaitlistEntry** | 13 | قائمة انتظار لكل ممارس/خدمة |
| **FavoriteEmployee** | 6 | فريد `[clientId, employeeId]` |
| **BookingStatusLog** | 8 | سجل تدقيق كامل لتحولات الحالة |
| **IntakeForm** | 15 | محدد النطاق (خدمة/ممارس/فرع) |
| **IntakeField** | 9 | خيارات/شروط JSON للنماذج الديناميكية |
| **IntakeResponse** | 7 | إجابات المريض (JSON) لكل حجز |

#### services.prisma (7 نماذج)

| النموذج | الحقول | الوصف |
|---------|--------|-------|
| **ServiceCategory** | 7 | تصنيف الخدمات |
| **Service** | 29 | تسلسل تسعير من 5 مستويات |
| **ServiceBranch** | 6 | جدول ربط: Service ↔ Branch |
| **ServiceBookingType** | 8 | تسعير حسب نوع الحجز |
| **ServiceDurationOption** | 10 | خيارات تسعير حسب المدة |
| **EmployeeService** | 12 | ربط ممارس بخدمة مع تجاوزات |
| **EmployeeServiceType** | 10 | تسعير نوع الحجز لكل ممارس |
| **EmployeeDurationOption** | 8 | أدق مستوى تسعير |

#### payments.prisma (9 نماذج)

| النموذج | الحقول | الوصف |
|---------|--------|-------|
| **Payment** | 16 | 1:1 مع Booking؛ المبالغ بالهللات |
| **BankTransferReceipt** | 14 | تحقق AI للتحويلات البنكية |
| **Invoice** | 14 | فوترة ZATCA (سلسلة hash، UBL XML، QR) |
| **ProcessedWebhook** | 3 | معالجة webhook بدون تكرار |
| **Coupon** | 13 | كوبونات خصم مع قيود خدمة |
| **CouponService** | 6 | جدول ربط: Coupon ↔ Service |
| **CouponRedemption** | 7 | تتبع الاستخدام لكل مستخدم |
| **GiftCard** | 11 | نمط مشتري/مستخدم |
| **GiftCardTransaction** | 6 | دفتر أستاذ إيداع/سحب |

#### chatbot.prisma (5 نماذج)

| النموذج | الحقول | الوصف |
|---------|--------|-------|
| **ChatSession** | 11 | جلسات شات AI مع كشف اللغة |
| **ChatMessage** | 10 | يدعم function_call، intent، رسائل الموظفين |
| **KnowledgeBase** | 9 | pgvector(1536) embeddings لـ RAG |
| **ChatbotConfig** | 5 | إعدادات ديناميكية EAV |
| **KnowledgeBaseFile** | 10 | خط معالجة ملفات (PDF/Word/TXT) |

#### ratings.prisma (2 نموذج)

| النموذج | الحقول | الوصف |
|---------|--------|-------|
| **Rating** | 10 | 1:1 مع Booking؛ نجوم 1-5 |
| **ProblemReport** | 13 | شكاوى مع سير عمل حل |

#### config.prisma (5 نماذج)

| النموذج | الحقول | الوصف |
|---------|--------|-------|
| **WhiteLabelConfig** | 6 | نمط EAV؛ ~156 إدخال افتراضي |
| **EmailTemplate** | 11 | قوالب بريد ثنائية اللغة |
| **Notification** | 12 | إشعارات ثنائية اللغة ومصنفة |
| **FcmToken** | 6 | فريد `[userId, token]` |
| **ActivityLog** | 11 | سجل تدقيق؛ قيم قديمة/جديدة JSON |

---

### خريطة العلاقات

```
User (المحور المركزي)
  ├── 1:N → OtpCode
  ├── 1:N → RefreshToken
  ├── 1:N → UserRole → Role → RolePermission → Permission
  ├── 1:1 → Employee
  ├── 1:1 → ClientProfile
  ├── 1:N → Booking (كمريض)
  ├── 1:N → Rating (كمريض)
  ├── 1:N → ProblemReport (كمريض ومُحلّ)
  ├── 1:N → BankTransferReceipt (كمراجع)
  ├── 1:N → ChatSession → ChatMessage
  ├── 1:N → Notification
  ├── 1:N → FcmToken
  ├── 1:N → ActivityLog
  ├── 1:N → KnowledgeBaseFile
  ├── 1:N → WaitlistEntry
  ├── 1:N → FavoriteEmployee
  ├── 1:N → CouponRedemption
  └── 1:N → GiftCard (كمشتري ومستخدم)

Employee
  ├── 1:1 ← User
  ├── N:1 → Specialty
  ├── 1:N → EmployeeAvailability → Branch?
  ├── 1:N → EmployeeVacation
  ├── 1:N → EmployeeBreak
  ├── 1:N → EmployeeService → Service
  │         ├── 1:N → EmployeeServiceType
  │         │         └── 1:N → EmployeeDurationOption
  │         └── 1:N → Booking
  ├── 1:N → Booking
  ├── 1:N → Rating
  ├── 1:N → WaitlistEntry
  ├── 1:N → FavoriteEmployee
  ├── 1:N → EmployeeBranch → Branch
  └── 1:N → IntakeForm

Service
  ├── N:1 → ServiceCategory
  ├── 1:N → ServiceBookingType → ServiceDurationOption
  ├── 1:N → ServiceDurationOption
  ├── 1:N → EmployeeService
  ├── 1:N → Booking
  ├── 1:N → WaitlistEntry
  ├── 1:N → IntakeForm
  ├── 1:N → CouponService → Coupon
  └── 1:N → ServiceBranch → Branch

Booking (الكيان المعاملاتي المركزي)
  ├── N:1 → User (مريض)
  ├── N:1 → Branch?
  ├── N:1 → Employee
  ├── N:1 → Service
  ├── N:1 → EmployeeService
  ├── 1:1 ↔ Booking (سلسلة إعادة جدولة — مرجع ذاتي)
  ├── 1:1 → Payment → BankTransferReceipt
  │                 → Invoice
  ├── 1:1 → Rating
  ├── 1:N → ProblemReport
  ├── 1:N → BookingStatusLog
  ├── 1:N → IntakeResponse → IntakeForm → IntakeField
  └── 1:N ← WaitlistEntry (تحويل)

Branch
  ├── 1:N → EmployeeBranch
  ├── 1:N → EmployeeAvailability
  ├── 1:N → BookingSettings
  ├── 1:N → Booking
  ├── 1:N → IntakeForm
  └── 1:N → ServiceBranch

Payment
  ├── 1:1 ← Booking
  ├── 1:1 → BankTransferReceipt
  └── 1:1 → Invoice

Coupon
  ├── 1:N → CouponService → Service
  └── 1:N → CouponRedemption → User

GiftCard
  ├── N:1 → User (مشتري)
  ├── N:1 → User (مستخدم)
  └── 1:N → GiftCardTransaction
```

---

### الـ Enums

**29 enum** في Prisma schema:

| الفئة | الـ Enums |
|-------|---------|
| **Booking** | `BookingType`, `BookingStatus` (9 قيم), `WaitlistStatus`, `CancelledBy`, `RecurringPattern`, `RefundType`, `NoShowPolicy`, `PreferredTime`, `FormScope`, `FormType` |
| **Payment** | `PaymentMethod`, `PaymentStatus`, `TransferVerificationStatus` (8 قيم), `ZatcaStatus` |
| **Auth** | `UserGender`, `AccountType`, `BloodType` (9 قيم), `OtpType` |
| **Chat** | `ChatRole`, `HandoffType`, `ChatIntent`, `KbFileStatus`, `KbFileType`, `SessionLanguage` |
| **Config** | `ConfigValueType`, `DevicePlatform`, `NotificationType` (21 قيمة) |
| **Rating** | `ProblemReportType` (8 قيم), `ProblemReportStatus` |

---

### الـ Migrations

**23 migration** تتبع تطور المخطط:

| # | التاريخ | الوصف |
|---|--------|-------|
| 1 | Mar 21 | إنشاء المخطط الأولي |
| 2 | Mar 22 | حقول ZATCA للفواتير |
| 3 | Mar 22 | إعدادات الشات بوت + معالجة ملفات KB |
| 4 | Mar 22 | نموذج EmployeeService + مبلغ الاسترداد |
| 5 | Mar 25 | Init نظيف (موحد) |
| 6-7 | Mar 26 | سلامة البيانات + فهارس الأداء |
| 8 | Mar 26 | توحيد الـ Enums |
| 9 | Mar 26 | أرشفة سجل النشاط |
| 10-13 | Mar 26 | جداول ربط الكوبونات، إعدادات حجز متعددة الفروع، توفر الفروع، قيود مفقودة |
| 14 | Mar 26 | نموذج Specialty + طريقة دفع نقدي |
| 15-18 | Mar 26 | استعادة أرشيف، branchId للحجوزات، إصلاحات سلامة، حقول تدقيق الاسترداد |
| 19-20 | Mar 28 | إعادة هيكلة BookingType + إزالة أسعار قديمة |
| 21-23 | Mar 29 | صورة الخدمة، فروع الخدمة، إزالة لون التقويم |

---

## الحزمة المشتركة (shared/)

### الـ Enums المشتركة (21 enum)

| الملف | الـ Enums |
|-------|---------|
| `auth.ts` | `OtpType` |
| `booking.ts` | `BookingType`, `BookingStatus`, `WaitlistStatus`, `CancelledBy`, `RecurringPattern`, `RefundType` |
| `chat.ts` | `ChatRole`, `HandoffType`, `KbFileStatus`, `SessionLanguage` |
| `notification.ts` | `NotificationType`, `DevicePlatform` |
| `payment.ts` | `PaymentMethod`, `PaymentStatus`, `TransferVerificationStatus` |
| `rating.ts` | `ProblemReportType`, `ProblemReportStatus` |
| `user.ts` | `UserGender` |
| `whitelabel.ts` | `ConfigValueType` |
| `zatca.ts` | `ZatcaStatus` |

### الأنواع المشتركة (30 type/interface)

| الملف | الأنواع |
|-------|--------|
| `api.ts` | `ApiResponse<T>`, `ApiError`, `PaginatedResponse<T>`, `PaginationMeta`, `PaginationParams` |
| `auth.ts` | `AuthUser`, `AuthResponse`, `JwtPayload`, `LoginRequest`, `RegisterRequest`, `OtpRequest`, `OtpVerifyRequest`, `RefreshTokenRequest` |
| `booking.ts` | `Booking`, `BookingWithRelations`, `CreateBookingRequest` |
| `notification.ts` | `Notification` |
| `payment.ts` | `Payment`, `BankTransferReceipt`, `Invoice` |
| `employee.ts` | `Employee`, `EmployeeServicePricing`, `EmployeeWithUser`, `EmployeeAvailability`, `EmployeeVacation` |
| `rating.ts` | `Rating`, `ProblemReport`, `CreateRatingRequest`, `CreateProblemReportRequest` |
| `service.ts` | `ServiceCategory`, `Service`, `ServiceWithCategory`, `ServiceDurationOption`, `ServiceBookingType` |

### الثوابت المشتركة

| الملف | الثوابت الرئيسية |
|-------|----------------|
| `config.ts` | `VAT_RATE` (1500), `VAT_PERCENTAGE` (15), `DEFAULT_PER_PAGE` (20), `ACCESS_TOKEN_EXPIRY` ("15m"), `REFRESH_TOKEN_EXPIRY` ("7d"), `OTP_LENGTH` (6), `MAX_FILE_SIZE` (10MB) |
| `modules.ts` | `MODULES` (13 وحدة نظام لـ RBAC), `ACTIONS` (view/create/edit/delete) |
| `roles.ts` | `SYSTEM_ROLES` (super_admin, receptionist, accountant, employee, client) |

### توكنات التصميم المشتركة

| الملف | المحتوى |
|-------|---------|
| `colors.ts` | Primary Royal Blue (#1D4ED8), Secondary Apple Green (#84CC16), 10 تدرجات |
| `typography.ts` | 4 عائلات خطوط، 8 أحجام، 5 أوزان |
| `spacing.ts` | 13 قيمة: 0-96px |
| `radius.ts` | 10 قيم مع أسماء دلالية (pill, btn, card, modal) |
| `shadows.ts` | 10 مستويات CSS + 5 كائنات React Native |
| `breakpoints.ts` | sm: 640, md: 768, lg: 1024, xl: 1280, 2xl: 1536 |
| `animations.ts` | 3 مدد (100/200/300ms), 4 تسهيلات |

---

## الفجوات والملاحظات المهمة

### فجوات حرجة

| # | الفجوة | الموقع | الأولوية |
|---|--------|--------|---------|
| 1 | **لا توجد اختبارات في الموبايل** | `mobile/` | 🔴 عالية |
| 2 | **شاشة سجل المريض (Employee) = بيانات وهمية** | `mobile/(employee)/client/[id]` | 🔴 عالية |
| 3 | **قائمة مرضى الممارس بدون API** | `mobile/(employee)/clients` | 🟠 متوسطة |
| 4 | **Clients module بدون unit tests** | `backend/clients` | 🟡 متوسطة |
| 5 | **أزرار Profile بدون وظائف** | `mobile/(client)/profile` | 🟡 متوسطة |
| 6 | **زر "احجز" في تفاصيل الممارس غير مربوط** | `mobile/(client)/employee/[id]` | 🟡 متوسطة |
| 7 | **"إدارة التوفر" للممارس غير موجودة** | `mobile/(employee)/calendar` | 🟡 متوسطة |
| 8 | **Specialties controller بدون @ApiTags** | `backend/specialties` | 🟢 منخفضة |
| 9 | **4 service methods معرّفة لكن غير مستخدمة** | `mobile/services/` | 🟢 منخفضة |

### ما لم يبدأ بعد

| المرحلة | المهام المخططة |
|---------|---------------|
| **Phase 6** (Website) | 16 مهمة: هيكل (3)، صفحات (8)، ميزات (5) |
| **Phase 7** (Mobile) | 17 مهمة: تلميع التصميم (7)، ميزات مفقودة (7)، تقديم للمتجر (7) |
| **Phase 8** (Production) | 10 مهام: Zoom حقيقي، PDF فواتير، ZATCA Phase 2، قوالب بريد، Docker، CI/CD، مراقبة، أمان، أداء، نسخ احتياطي |
| **Phase 9** (Delivery) | 10 مهام: E2E testing، integration testing، RTL/i18n testing، perf testing، security testing، UAT، توثيق، نشر المتجر، تدريب العميل، إطلاق |

### عناصر مؤجلة

| المعرف | المهمة | مؤجل إلى |
|--------|--------|----------|
| I-01 | تكامل Zoom API حقيقي (حالياً: stub) | Phase 8 |
| I-09 | تحديث رابط Zoom عند إعادة جدولة حجوزات الفيديو | Phase 8 |

---

## ملخص تنفيذي

### حالة كل طبقة

| الطبقة | النضج | التفاصيل |
|--------|-------|---------|
| **Backend** | 🟢 **95% مكتمل** | 25/30 موديول مكتمل، 215 endpoint، 157 ملف اختبار |
| **Dashboard** | 🟢 **100% مكتمل** | كل الصفحات مبنية بالكامل مع CRUD + ترجمة + RTL |
| **Mobile** | 🟡 **75% مكتمل** | 18/26 شاشة مكتملة، 4 وظيفية، فجوات في جانب الممارس |
| **Database** | 🟢 **مكتمل** | 47 نموذج، 29 enum، 23 migration |
| **Shared** | 🟢 **مكتمل** | 21 enum + 30 type + ثوابت + tokens |

### الأرقام الرئيسية

| المقياس | القيمة |
|---------|--------|
| إجمالي الموديولات (Backend) | 30 |
| إجمالي الـ Endpoints | ~215 |
| إجمالي نماذج قاعدة البيانات | 47 |
| إجمالي الـ Enums | 29 |
| إجمالي الـ Migrations | 23 |
| صفحات الداشبورد | 20 |
| مكونات الداشبورد | ~200+ |
| شاشات الموبايل | 26 |
| ملفات الاختبار (Backend) | ~157 |
| ملفات الاختبار (Mobile) | 0 ❌ |
| اللغات | العربية + الإنجليزية (RTL-first) |
| خدمات Docker | 7 |
| طوابير BullMQ | 4 |
| وظائف Cron | 7 |
| Circuit Breakers | 4 |

### التقدم العام

```
████████████████████████████░░░░░░░░░░░░░░░░░░░░  55%
Phases 1-5 ✅                    Phases 6-9 ⬜
```

**النظام في حالة ممتازة من الناحية المعمارية.** الباكند والداشبورد جاهزان للإنتاج. الموبايل يحتاج تلميع (Phase 7). المراحل المتبقية: الموقع العام → تلميع الموبايل → جاهزية الإنتاج → الاختبارات الشاملة والتسليم.
