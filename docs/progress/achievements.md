# CareKit — سجل المنجزات

> كل ما تم بناؤه وإنجازه في المشروع — موثق بناءً على الكود الفعلي
> آخر تحديث: 2026-03-26

---

## Phase 1 — الأساسيات (Backend + Schema + Dashboard هيكل) ✅

### Backend — 18 Module فعلي (NestJS + Prisma)

| الوحدة | ماذا تفعل | الملفات الرئيسية |
|--------|-----------|-----------------|
| **Auth** | تسجيل دخول JWT + OTP بالإيميل، refresh tokens، تسجيل مستخدم جديد، CASL للصلاحيات الديناميكية | `auth.service.ts`, `otp.service.ts`, `token.service.ts`, `casl-ability.factory.ts` (26 ملف) |
| **Users** | إدارة المستخدمين + ربط الأدوار + تعديل الملف الشخصي | `users.service.ts`, `user-roles.service.ts` (7 ملفات) |
| **Roles** | أدوار ديناميكية (super_admin, receptionist, accountant, practitioner, patient) + أدوار مخصصة | `roles.service.ts`, `roles.controller.ts` (4 ملفات) |
| **Permissions** | صلاحيات دقيقة (view, create, edit, delete) لكل module عبر CASL | `permissions.controller.ts` (2 ملف) |
| **Practitioners** | إدارة الأطباء: ملف شخصي، أوقات العمل، الإجازات، خدمات الممارس مع تسعير 3 مستويات | `practitioners.service.ts`, `practitioner-availability.service.ts`, `practitioner-vacation.service.ts`, `practitioner-service.service.ts` (14 ملف) |
| **Specialties** | التخصصات الطبية (CRUD) | `specialties.service.ts` (6 ملفات) |
| **Services** | كتالوج الخدمات الطبية مع فئات + أسعار + فلترة isActive | `services.service.ts` (10 ملفات) |
| **Bookings** | نظام حجز كامل: 3 أنواع (عيادة/هاتف/فيديو)، حماية من الحجز المزدوج، إلغاء بموافقة الأدمن، buffer times، pagination | `bookings.service.ts`, `booking-cancellation.service.ts`, `booking-validation.helper.ts`, `zoom.service.ts` (15 ملف) |
| **Payments** | Moyasar (Mada/Apple Pay/Visa) + تحويل بنكي مع AI للتحقق من الإيصالات + تسعير 3 مستويات (PractitionerService → Practitioner → Service) | `payments.service.ts`, `moyasar-payment.service.ts`, `bank-transfer.service.ts`, `payments.helpers.ts` (17 ملف) |
| **Invoices** | إنشاء فواتير تلقائي مع ZATCA، إحصائيات، ثوابت ضريبية | `invoices.service.ts`, `invoice-creator.service.ts`, `invoice-stats.service.ts` (11 ملف) |
| **Notifications** | إشعارات داخلية + FCM push، إشعارات تلقائية عند تأكيد/إتمام/إلغاء الحجز + إشعار الممارس | `notifications.service.ts` (9 ملفات) |
| **WhiteLabel** | إعدادات العلامة البيضاء: لوقو، ألوان، خطوط، مفاتيح الدفع، Zoom، قوالب البريد، سياسة الإلغاء | `whitelabel.service.ts` (7 ملفات) |
| **Patients** | إدارة المرضى + بحث بالاسم + ملف طبي | `patients.service.ts` (4 ملفات) |
| **Ratings** | تقييم نجوم (1-5) + ملاحظات + بلاغات مشاكل + إخفاء اسم المريض في التقييمات العامة | `ratings.service.ts` (5 ملفات) |
| **Reports** | تقارير الإيرادات + الحجوزات مع فلترة بالتاريخ | `reports.service.ts` (4 ملفات) |
| **AI (Receipt)** | التحقق من إيصالات التحويل البنكي بالذكاء الاصطناعي (OpenRouter Vision API) → tags: matched/amount_differs/suspicious | `receipt-verification.service.ts`, `receipt-verification.processor.ts` (5 ملفات) |
| **ZATCA** | فوتكة إلكترونية سعودية كاملة: XML UBL 2.1، SHA-256 hash، QR TLV، Sandbox API، compliance checks | `zatca.service.ts` + 4 sub-services (16 ملف) |
| **Chatbot** | ذكاء اصطناعي محادثي: RAG + pgvector + OpenRouter + 9 أدوات (حجز/إلغاء/تعديل/بحث)، Knowledge Base، analytics، file processing | 11 service + 5 DTO + 3 interface + 3 constant (24 ملف) |

### Database Schema — Prisma

- **29 Model**: User, Practitioner, PractitionerService, PractitionerAvailability, PractitionerVacation, Specialty, ServiceCategory, Service, Booking, Payment, BankTransferReceipt, Invoice, Rating, ProblemReport, ChatSession, ChatMessage, KnowledgeBase, KnowledgeBaseFile, ChatbotConfig, WhiteLabelConfig, Role, Permission, Notification, FcmToken, ActivityLog, OtpCode, RefreshToken...
- **13 Enum**: BookingType, BookingStatus, PaymentMethod, PaymentStatus, TransferVerificationStatus, NotificationType, ProblemReportType, ProblemReportStatus, ChatRole, HandoffType, ConfigValueType, UserGender, ZatcaStatus
- **Migrations**: 5 migration files مُطبقة

### Design & Planning

- ERD: 29 model + 13 enum مُصمم ومُنفذ
- API Spec: `docs/api-spec.md` — توثيق كامل لكل الـ endpoints
- PRD: `docs/CareKit-PRD-EN.md` — متطلبات المنتج الكاملة بالإنجليزية
- Monorepo structure + Docker infrastructure

---

## Phase 2 — ZATCA + Dashboard ✅

### ZATCA Module (6 services)

نظام الفوتكة الإلكترونية السعودي متوافق مع هيئة الزكاة والضريبة:
- **XmlBuilderService**: بناء فواتير UBL 2.1 XML
- **InvoiceHashService**: SHA-256 hashing للفواتير
- **QrGeneratorService**: QR code بتنسيق TLV (اسم البائع، الرقم الضريبي، التاريخ، المبلغ، الضريبة)
- **ZatcaApiService**: اتصال بـ ZATCA API (compliance + reporting + clearance)
- **ZatcaSandboxService**: بيئة اختبار ZATCA
- **InvoiceCreatorService**: إنشاء فواتير مدمج مع ZATCA تلقائياً

### Dashboard — 15 صفحة + Login (Next.js 14 + shadcn/ui)

| الصفحة | ماذا تعرض |
|--------|-----------|
| **Login** | تسجيل دخول بالبريد + كلمة المرور |
| **Dashboard Home** | إحصائيات عامة: حجوزات اليوم، إيرادات، مدفوعات معلقة، نشاط حديث |
| **Appointments** | جدول المواعيد مع فلترة بالحالة والتاريخ والممارس |
| **Practitioners** | قائمة الأطباء + تفاصيل كل طبيب (ملف، جدول، تقييمات، خدمات) |
| **Patients** | قائمة المرضى + تفاصيل (سجل المواعيد، المدفوعات) |
| **Services** | كتالوج الخدمات الطبية مع الفئات والأسعار |
| **Invoices + ZATCA** | الفواتير مع حالة ZATCA + إحصائيات |
| **Payments** | المدفوعات + مراجعة إيصالات التحويل البنكي |
| **Reports** | تقارير الإيرادات والحجوزات (Recharts) |
| **Users** | إدارة المستخدمين (إنشاء/تعديل/حذف) |
| **Roles** | إدارة الأدوار + مصفوفة الصلاحيات التفاعلية |
| **Notifications** | ⚠️ placeholder فاضي |
| **Chatbot** | محادثات + تحليلات + إعدادات (6 أقسام) + Knowledge Base editor |
| **Settings** | إعدادات White Label (7 tabs): عام، ألوان، بريد، دفع، Zoom، شات بوت، إلغاء |

**البنية التقنية:**
- 52 component: 33 UI (shadcn/ui) + 14 Feature + 4 Layout + 1 Provider
- 12 API module في `lib/api/`
- 15 custom hook في `hooks/`
- i18n كامل (AR + EN) مع RTL
- 13/15 صفحة متصلة بالـ API فعلياً

### Unit Tests — 455 test في 21 suite

تغطية: ZATCA (5 suites, 85 test)، Invoices (18 test)، Patients (16 test)، Ratings (15 test)، وغيرها

---

## Phase 3 — Mobile App ✅

### تطبيق React Native (Expo SDK 54) — 33 شاشة

**شاشات Auth (3):**
- Login (بريد + كلمة مرور)
- Register (تسجيل مريض جديد)
- OTP Verify (تحقق بالرمز)

**شاشات المريض (17 شاشة):**
- Home: الحجوزات القادمة + التخصصات + الأطباء المميزين
- Appointments: قائمة المواعيد مع فلترة بالحالة
- Booking Flow (5 شاشات): اختيار خدمة → جدول → تأكيد → دفع → نجاح
- Payment: اختيار طريقة الدفع (Moyasar/تحويل بنكي)
- Bank Transfer: رفع إيصال التحويل
- Practitioner Detail: ملف الطبيب + تقييمات + حجز
- Appointment Detail: تفاصيل الموعد + إلغاء
- Rating: تقييم بعد الموعد (نجوم + ملاحظات + بلاغ)
- Chat: محادثة ذكاء اصطناعي (GiftedChat + Quick Actions + Typing Indicator)
- Notifications: إشعارات مجمعة بالتاريخ مع badge
- Video Call: شاشة مكالمة فيديو (Zoom link)
- Settings: إعدادات (لغة، ثيم، إشعارات)
- Profile: الملف الشخصي

**شاشات الممارس (8 شاشات):**
- Today: جدول اليوم
- Calendar: عرض تقويمي
- Patients: قائمة المرضى
- Appointment Detail: تفاصيل الموعد (عرض الطبيب)
- Patient Detail: ملف المريض (عرض الطبيب)
- Video Call: مكالمة فيديو
- Profile: الملف الشخصي

**البنية التقنية:**
- 8 API services (api, auth, bookings, practitioners, specialties, payments, notifications, chatbot)
- 10 components (3 UI + 5 Feature + 2 Chat)
- Redux Toolkit + Persist (2 slices: auth, chat)
- 4 type files (models, api, auth, chat)
- 3 custom hooks
- Theme system (RTL-first + light/dark)
- i18n كامل (AR + EN)
- Expo Router v6 file-based routing

---

## Phase 4 — AI Chatbot ✅

### Backend (24 ملف)

- **ChatbotService**: أوركستريتر رئيسي — يدير المحادثات ويوجه الردود
- **ChatbotAiService**: اتصال بـ OpenRouter API مع function calling + system prompt ديناميكي
- **ChatbotRagService**: RAG pipeline — pgvector embeddings + semantic search في Knowledge Base
- **ChatbotToolsService**: 9 أدوات AI (حجز، إلغاء، تعديل موعد، بحث أطباء، عرض مواعيد، handoff...)
- **ChatbotConfigService**: إعدادات ديناميكية (6 أقسام: شخصية، قواعد، handoff، مزامنة، AI، عام)
- **ChatbotAnalyticsService**: إحصائيات المحادثات + الأسئلة الشائعة + استخدام الأدوات
- **ChatbotFileService**: معالجة ملفات (PDF/Word/TXT → chunks → embeddings)
- **ChatbotController**: 20 endpoint كامل مع Swagger

### Mobile Chat UI

- GiftedChat مع RTL support
- Quick Actions ديناميكية من config
- Typing indicator متحرك
- Redux slice لإدارة حالة المحادثة

### Dashboard Chatbot (3 tabs)

- Conversations: عرض المحادثات + تفاصيل كل محادثة
- Analytics: إحصائيات + رسوم بيانية
- Settings: 6 أقسام إعدادات + Knowledge Base editor مع رفع ملفات

### Tests — 39 unit test (4 suites)

---

## Sprint 4.5 — Bug Fixes + Pricing Refactor ✅

### 9 إصلاحات حرجة

1. **Availability validation**: التحقق من جدول الممارس والإجازات عند الحجز
2. **Date filter**: فلترة السلوتات بالتاريخ بدل تحميل الكل
3. **Slot overlap**: عرض السلوتات المحجوزة كـ unavailable
4. **PractitionerService join**: ربط ممارس-خدمة مع تحقق عند الحجز
5. **Partial refund**: دعم استرداد جزئي بمبلغ محدد (بدل full فقط)
6. **Category delete**: حساب الخدمات المحذوفة soft عند حذف الفئة
7. **Zoom stub**: تحذير واضح أن Zoom لا يزال stub
8. **Notifications**: إشعارات تلقائية عند تأكيد/إتمام/إلغاء الحجز
9. **Patient anonymization**: إخفاء اسم العائلة في التقييمات العامة ("أحمد م.")

### Pricing Refactor — تسعير 3 مستويات

نقل الأسعار من `Practitioner` إلى `PractitionerService`:
- كل ممارس × خدمة = أسعار مستقلة (clinic/phone/video) + مدة مخصصة + buffer
- `availableTypes`: منع حجز نوع غير مدعوم (مثلاً: تنظيف أسنان عن بُعد)
- 4 endpoints جديدة: CRUD لخدمات الممارس
- 3 migrations + 5 ملفات جديدة + 10 معدّلة

---

## Sprint 4.6 — Code Audit & Hardening ✅

28 إصلاح شامل:

| الفئة | العدد | أبرز الإصلاحات |
|-------|-------|----------------|
| **Bugs** | 8 | إصلاح notification enum، midnight wrap في buffer، transaction في availability، ownership check في chatbot، timezone handling، price 0 vs null، فلتر isActive |
| **Security** | 4 | نقل RBAC من controller للـ service، validation على duration، ownership check، تحسين token storage |
| **Incomplete** | 6 | حفظ adminNotes، payment check قبل confirm، pagination، إشعار الممارس، booking_completed enum، إزالة redundant query |
| **Performance** | 4 | تقليل DB queries، فلتر تاريخ الإجازات، whitelist لـ sortBy، batching embeddings |
| **Quality** | 8 | تقسيم ملفات كبيرة، توحيد helpers، إصلاح type casts، حذف duplication، توحيد bookingInclude |

**3 مؤجلة لـ Phase 5:** Zoom API الفعلي، Zoom link update عند reschedule، صفحة Notifications في Dashboard

---

## Sprint 4.7 — Architecture Gap Analysis & Hardening ✅

تحليل معماري شامل كشف 32 ثغرة (18 أصلية + 14 مكتشفة بالتدقيق) — كلها مُصلحة:

| الفئة | العدد | أبرز الإصلاحات |
|-------|-------|----------------|
| **Critical** | 3 | Race condition في الحجز (serializable tx + DB unique index)، Nginx reverse proxy + SSL، MinIO backup |
| **High** | 6 | Token invalidation عند تغيير كلمة المرور/الأدوار، Redis noeviction، Circuit breaker لـ 4 APIs خارجية، SMS channel (Unifonic/Twilio)، Dashboard middleware |
| **Medium** | 6 | مزامنة shared enums (4 updated + 4 new)، @MaxLength على 80+ DTO field، embedding validation، per-endpoint rate limiting، Zoom token → Redis، shared Redis module (5→1 connection) |
| **Low** | 3 | إزالة dev credentials من source، migration rollback runbook، Sentry + Prometheus |
| **Post-Audit** | 14 | Redis error handler، E.164 phone validation، metrics IP restriction، Nginx security headers inheritance، circuit breaker half-open race fix، Node.js engines constraint، metrics label explosion fix، Prisma error Sentry filter، chatbot-rag resilientFetch، server_tokens off، Twilio parsing fix، Sentry sampling fix |

**وثائق جديدة:**
- `docs/system-architecture.md` — خريطة تشغيل النظام الكاملة
- `docs/gap-analysis-report.md` — تقرير الثغرات والإصلاحات
- `docs/security-audit-summary.md` — ملخص التدقيق الأمني
- `docs/migration-rollback-runbook.md` — إجراء طوارئ الـ migrations

**586 test passed | 31 suites | 0 failures**

---

## إحصائيات عامة

| المقياس | القيمة |
|---------|--------|
| Backend modules | 33 |
| Prisma models | 35 |
| Prisma enums | 18 |
| Dashboard pages | 16 + login |
| Dashboard components | 52+ (UI + Feature + Layout + Providers) |
| Dashboard hooks | 15 |
| Dashboard API modules | 14 |
| Mobile screens | 26 |
| Mobile services | 8 |
| Mobile components | 10 |
| Unit tests | 586 (31 suites) |
| Migrations | 16 |
| Docker services (prod) | 7 (nginx + backend + postgres + redis + minio + 2 backup) |
| BullMQ queues | 4 |
| Cron jobs | 7 |
| Circuit breakers | 4 (moyasar, zoom, openrouter, sms) |
| Notification channels | 3 (in-app DB + FCM push + SMS) |
| Security layers | 8 |
| Languages | Arabic + English (RTL-first) |

---

## سجل الإنجازات بالتاريخ

| التاريخ | الإنجاز |
|---------|---------|
| 2026-03 | Phase 1: Backend 18 module + Prisma 29 model/13 enum + ERD + API Spec + PRD |
| 2026-03 | Phase 2: ZATCA 6 services + Dashboard 16 صفحة + 455 test |
| 2026-03 | Phase 3: Mobile 33 شاشة + Payment + Notifications + Video Call + Settings |
| 2026-03 | Refactor: تقسيم 5 service files كبيرة — 455 test يمرّون |
| 2026-03 | Dashboard API: 13/15 صفحة متصلة بالـ API |
| 2026-03-22 | Phase 4: AI Chatbot — Backend 24 ملف + Mobile chat + Dashboard 3 tabs + 39 test |
| 2026-03-23 | Sprint 4.5: 9 bugs + Pricing Refactor (3-tier pricing + 4 endpoints + 3 migrations) |
| 2026-03-23 | Sprint 4.6: Code Audit — 28 إصلاح (bugs + security + performance + quality) |
| 2026-03-24 | Sprint 4.7: Architecture Gap Analysis — 32 ثغرة مكتشفة ومُصلحة + 4 وثائق معمارية |

---

CareKit — WebVue Technology Solutions
