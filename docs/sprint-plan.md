# CareKit — Sprint Plan & Progress Tracker

> **آخر تحديث:** 2026-03-23 (Sprint 4.6 completed)
> **المرجع الوحيد** لتتبع التقدم والمراحل والموارد — كل شيء ننجزه يُوثق هنا

---

## قواعد العمل الصارمة

1. **لا يتجاوز أي ملف 350 سطراً** — فوراً يُقسم عند الاقتراب
2. **لا كود بدون مراجعة الـ schema أولاً** — الـ Prisma schema هو مصدر الحقيقة
3. **كل migration تُراجع قبل التطبيق**
4. **كل endpoint له Swagger decorator + unit test**
5. **لا hardcoded values** — كل شيء في constants/ أو env
6. **RTL-first في كل مكون**
7. **كل رسالة commit بالإنجليزية — Conventional Commits فقط**

---

## نظرة عامة — الحالة الحالية

```
Phase 1 — الأساسيات (Backend + Schema + Dashboard هيكل)    ✅ 100%
Phase 2 — ZATCA + Dashboard Integration                     ✅ 100%
Phase 3 — Mobile App                                        ✅ 100%
Phase 4 — AI Chatbot                                        ✅ 100% (Backend + Mobile + Dashboard + Tests + Migration)
Sprint 4.5 — Bug Fixes + Pricing Refactor                   ✅ 100% (9 fixes + PractitionerService pricing)
Sprint 4.6 — Code Audit & Hardening                         ✅ 100% (28 fix: 8 bugs + 4 security + 6 incomplete + 4 perf + 8 quality — 3 مؤجلة)
Phase 5 — Production Readiness                              🔲 0%
Phase 6 — Testing & Delivery                                🔲 0%
```

---

## Phase 1 — الأساسيات ✅ مكتمل

### Backend — 18 module فعلي

| الوحدة | الملفات | الحالة |
|--------|---------|--------|
| Auth (JWT + OTP + CASL) | auth.service, otp.service, token.service, casl-ability.factory | ✅ |
| Users | users.service, user-roles.service | ✅ |
| Roles | roles.service, roles.controller | ✅ |
| Permissions | permissions.controller | ✅ |
| Practitioners | practitioners.service, practitioner-availability.service, practitioner-vacation.service, practitioner-service.service | ✅ |
| Specialties | specialties.service, specialties.controller | ✅ |
| Services | services.service, services.controller | ✅ |
| Bookings | bookings.service, booking-cancellation.service, booking-validation.helper, zoom.service | ✅ |
| Payments | payments.service, moyasar-payment.service, bank-transfer.service, payments.helpers | ✅ |
| Invoices | invoices.service, invoice-creator.service, invoice-stats.service, invoice.constants | ✅ |
| Notifications | notifications.service, notifications.controller | ✅ |
| WhiteLabel | whitelabel.service, whitelabel.controller | ✅ |
| Patients | patients.service, patients.controller | ✅ |
| Ratings | ratings.service, ratings.controller | ✅ |
| Reports | reports.service, reports.controller | ✅ |
| AI (Receipt) | receipt-verification.service, receipt-verification.processor | ✅ |
| ZATCA | zatca.service + 4 sub-services + controller | ✅ |
| Chatbot | chatbot.controller, chatbot.module | ⚠️ هيكل فاضي فقط |

### Database Schema — Prisma

| الوحدة | العدد | الحالة |
|--------|-------|--------|
| Models | 29 (User, Practitioner, PractitionerService, Booking, Payment, Invoice, Rating, etc.) | ✅ |
| Models إضافية | FcmToken, ActivityLog | ✅ |
| Enums | 13 (BookingType, BookingStatus, PaymentMethod, PaymentStatus, TransferVerificationStatus, NotificationType, ProblemReportType, ProblemReportStatus, ChatRole, HandoffType, ConfigValueType, UserGender, ZatcaStatus) | ✅ |

### Design & Planning

| الوحدة | الحالة |
|--------|--------|
| ERD: 28 model + 13 enum في Prisma | ✅ |
| API Spec: `docs/api-spec.md` | ✅ |
| PRD: `docs/CareKit-PRD-EN.md` | ✅ |
| Design System: `docs/design/` | ✅ |
| Monorepo + Docker Infrastructure | ✅ |

---

## Phase 2 — ZATCA + Dashboard Integration ✅ مكتمل

### Sprint 2.1 — ZATCA Module (Backend)

| Task | الحالة | الملف |
|------|--------|-------|
| ZatcaService | ✅ | `backend/src/modules/zatca/zatca.service.ts` |
| InvoiceHashService (SHA-256) | ✅ | `backend/src/modules/zatca/services/invoice-hash.service.ts` |
| QrGeneratorService (TLV) | ✅ | `backend/src/modules/zatca/services/qr-generator.service.ts` |
| XmlBuilderService (UBL 2.1) | ✅ | `backend/src/modules/zatca/services/xml-builder.service.ts` |
| ZatcaApiService | ✅ | `backend/src/modules/zatca/services/zatca-api.service.ts` |
| ZatcaSandboxService | ✅ | `backend/src/modules/zatca/services/zatca-sandbox.service.ts` |
| ZatcaController | ✅ | `backend/src/modules/zatca/zatca.controller.ts` |
| InvoiceCreatorService (مدمج مع ZATCA) | ✅ | `backend/src/modules/invoices/invoice-creator.service.ts` |

### Sprint 2.2 — Dashboard (15 صفحة + login)

| الصفحة | الحالة | المسار الفعلي |
|--------|--------|--------------|
| Login | ✅ | `dashboard/src/app/[locale]/(auth)/login/page.tsx` |
| Dashboard Home | ✅ | `dashboard/src/app/[locale]/(dashboard)/page.tsx` |
| Appointments | ✅ | `dashboard/src/app/[locale]/(dashboard)/appointments/page.tsx` |
| Practitioners | ✅ | `dashboard/src/app/[locale]/(dashboard)/practitioners/page.tsx` |
| Practitioner Detail | ✅ | `dashboard/src/app/[locale]/(dashboard)/practitioners/[id]/page.tsx` |
| Patients | ✅ | `dashboard/src/app/[locale]/(dashboard)/patients/page.tsx` |
| Patient Detail | ✅ | `dashboard/src/app/[locale]/(dashboard)/patients/[id]/page.tsx` |
| Services | ✅ | `dashboard/src/app/[locale]/(dashboard)/services/page.tsx` |
| Invoices + ZATCA | ✅ | `dashboard/src/app/[locale]/(dashboard)/invoices/page.tsx` |
| Payments | ✅ | `dashboard/src/app/[locale]/(dashboard)/payments/page.tsx` |
| Reports | ✅ | `dashboard/src/app/[locale]/(dashboard)/reports/page.tsx` |
| Users | ✅ | `dashboard/src/app/[locale]/(dashboard)/users/page.tsx` |
| Roles | ✅ | `dashboard/src/app/[locale]/(dashboard)/roles/page.tsx` |
| Notifications | ✅ | `dashboard/src/app/[locale]/(dashboard)/notifications/page.tsx` |
| Chatbot | ✅ | `dashboard/src/app/[locale]/(dashboard)/chatbot/page.tsx` |
| Settings (7 tabs) | ✅ | `dashboard/src/app/[locale]/(dashboard)/settings/page.tsx` |

**Dashboard Components:**
- 32 UI components (shadcn/ui)
- 13 feature components (stat-card, revenue-chart, permissions-matrix, etc.)
- 4 layout components (header, sidebar, language-switcher, theme-toggle)
- 12 hooks (use-bookings, use-invoices, use-patients, use-payments, use-services, use-practitioner, etc.)
- 11 API modules (`dashboard/src/lib/api/` — practitioners, patients, bookings, payments, invoices, users, roles, reports, whitelabel, zatca, services)
- i18n: AR + EN (`dashboard/src/i18n/`)

### Sprint 2.5 — Dashboard API Integration ⚠️ 13/15

| الصفحة | الحالة | الملاحظات |
|--------|--------|-----------|
| Dashboard Home | ✅ | `useBookingStats()` + `usePaymentStats()` |
| Appointments | ✅ | `useBookings()` — data.ts موجود لكن **غير مستخدم** |
| Practitioners List | ✅ | `usePractitioners()` — data.ts موجود لكن **غير مستخدم** |
| Practitioner Detail | ✅ | `usePractitioner(id)` + profile-tab + ratings-tab |
| Patients List | ✅ | `usePatients()` مع pagination — data.ts **غير مستخدم** |
| Patient Detail | ✅ | `usePatient(id)` + `usePatientStats(id)` |
| Services | ✅ | `useServices()` + `useCategories()` — data.ts **غير مستخدم** |
| Invoices + ZATCA | ✅ | `useInvoices()` + `useInvoiceStats()` + `markInvoiceSent()` |
| Payments | ✅ | `usePayments()` + `usePaymentStats()` + `reviewReceipt()` |
| Reports | ✅ | `useRevenueReport()` + `useBookingReport()` |
| Users | ✅ | `useUsers()` + `useRoles()` + `deleteUser()` — data.ts **غير مستخدم** |
| Roles | ✅ | `useRoles()` + `createRole()` + `deleteRole()` |
| Settings | ✅ | `useWhitelabelConfig()` + `save()` |
| Notifications | ❌ | **placeholder فاضي** — div فقط |
| Chatbot | ❌ | **placeholder فاضي** — div فقط (ينتظر Phase 4) |

**النتيجة:** 13/15 صفحة متصلة بالـ API — Notifications و Chatbot فاضيين

**تنظيف مطلوب:** 5 ملفات `data.ts` فيها mock data لكن **لا تُستخدم** (يمكن حذفها):
- `appointments/data.ts`, `practitioners/data.ts`, `patients/data.ts`, `users/data.ts`, `services/data.ts`

### Sprint 2.3 — Bug Fixes ✅

| Bug | الحالة |
|-----|--------|
| patients.service: search → firstName/lastName | ✅ |
| dashboard: apiToLocalPatient حقول خاطئة | ✅ |
| E2E: GET /reports/revenue → 400 | ✅ |
| E2E: PUT /whitelabel/config جسم خاطئ | ✅ |
| Base UI Popover: إزالة asChild | ✅ |

### Sprint 2.4 — Unit Tests ✅

| Test Suite | الاختبارات | الحالة |
|------------|-----------|--------|
| zatca.service.spec.ts | 21 | ✅ |
| qr-generator.service.spec.ts | 14 | ✅ |
| invoice-hash.service.spec.ts | 14 | ✅ |
| xml-builder.service.spec.ts | 22 | ✅ |
| zatca-sandbox.service.spec.ts | 14 | ✅ |
| invoice-creator.service.spec.ts | 18 | ✅ |
| patients.service.spec.ts | 16 | ✅ |
| ratings.service.spec.ts | 15 | ✅ |
| **المجموع** | **455 في 21 suite** | ✅ |

---

## Phase 3 — Mobile App ✅ مكتمل

### Sprint 3.1 — Auth + Navigation ✅

| Task | الحالة | الملف الفعلي |
|------|--------|-------------|
| Redux + persist + secure-storage | ✅ | `mobile/stores/store.ts`, `mobile/stores/secure-storage.ts` |
| Auth Slice | ✅ | `mobile/stores/slices/auth-slice.ts` |
| Login Screen | ✅ | `mobile/app/(auth)/login.tsx` |
| OTP Screen | ✅ | `mobile/app/(auth)/otp-verify.tsx` |
| Register Screen | ✅ | `mobile/app/(auth)/register.tsx` |
| Auth Guard + Role routing | ✅ | `mobile/app/_layout.tsx`, `mobile/app/index.tsx` |
| API Client (axios + interceptors) | ✅ | `mobile/services/api.ts` |
| Auth Service | ✅ | `mobile/services/auth.ts` |
| Theme System (RTL + light/dark) | ✅ | `mobile/theme/` (10 ملفات) |

### Sprint 3.2 — Patient Screens ✅

| Task | الحالة | الملف الفعلي |
|------|--------|-------------|
| Patient Home | ✅ | `mobile/app/(patient)/(tabs)/home.tsx` |
| Appointments List | ✅ | `mobile/app/(patient)/(tabs)/appointments.tsx` |
| Chat (placeholder) | ⚠️ | `mobile/app/(patient)/(tabs)/chat.tsx` — هيكل، ينتظر Phase 4 |
| Notifications | ✅ | `mobile/app/(patient)/(tabs)/notifications.tsx` |
| Profile | ✅ | `mobile/app/(patient)/(tabs)/profile.tsx` |
| Practitioner Detail | ✅ | `mobile/app/(patient)/practitioner/[id].tsx` |
| Booking Flow (4 شاشات) | ✅ | `mobile/app/(patient)/booking/[serviceId].tsx`, `schedule.tsx`, `confirm.tsx`, `success.tsx` |
| Appointment Detail | ✅ | `mobile/app/(patient)/appointment/[id].tsx` |
| Rating Screen | ✅ | `mobile/app/(patient)/rate/[bookingId].tsx` |

### Sprint 3.3 — Practitioner Screens ✅

| Task | الحالة | الملف الفعلي |
|------|--------|-------------|
| Today's Schedule | ✅ | `mobile/app/(practitioner)/(tabs)/today.tsx` |
| Calendar View | ✅ | `mobile/app/(practitioner)/(tabs)/calendar.tsx` |
| Patients List | ✅ | `mobile/app/(practitioner)/(tabs)/patients.tsx` |
| Practitioner Profile | ✅ | `mobile/app/(practitioner)/(tabs)/profile.tsx` |
| Appointment Detail (Doctor) | ✅ | `mobile/app/(practitioner)/appointment/[id].tsx` |
| Patient Detail (Doctor view) | ✅ | `mobile/app/(practitioner)/patient/[id].tsx` |

### Sprint 3.4 — Shared & Infrastructure ✅

| Task | الحالة | الملف الفعلي |
|------|--------|-------------|
| i18n (AR/EN) | ✅ | `mobile/i18n/index.ts`, `en.json`, `ar.json` |
| API Services | ✅ | `mobile/services/` (api, auth, bookings, practitioners, specialties) |
| Components | ✅ | `mobile/components/ui/` (Avatar, StatusPill, EmailVerificationBanner) |
| Feature Components | ✅ | `mobile/components/features/` (AppointmentCard, PractitionerCard, SpecialtyCard) |
| Types | ✅ | `mobile/types/` (api, auth, models) |
| Hooks | ✅ | `mobile/hooks/` (use-redux, use-register-form) |

### Sprint 3.5 — Payment + Notifications + Video Call + Settings ✅

| Task | الحالة | الملف الفعلي |
|------|--------|-------------|
| Payment Service | ✅ | `mobile/services/payments.ts` |
| Notifications Service | ✅ | `mobile/services/notifications.ts` |
| Payment Method Selection | ✅ | `mobile/app/(patient)/booking/payment.tsx` |
| Bank Transfer + Receipt Upload | ✅ | `mobile/app/(patient)/booking/bank-transfer.tsx` |
| Booking Confirm → Payment routing | ✅ | `mobile/app/(patient)/booking/confirm.tsx` (معدّل) |
| Success: pending approval variant | ✅ | `mobile/app/(patient)/booking/success.tsx` (معدّل) |
| Notifications Screen (full) | ✅ | `mobile/app/(patient)/(tabs)/notifications.tsx` (أعيد كتابته) |
| NotificationItem Component | ✅ | `mobile/components/features/NotificationItem.tsx` |
| Notification Hook + Date Groups | ✅ | `mobile/hooks/use-notifications.ts`, `mobile/utils/date-groups.ts` |
| Notification Badge on Tab | ✅ | `mobile/app/(patient)/(tabs)/_layout.tsx` (معدّل) |
| Video Call Screen (shared) | ✅ | `mobile/components/features/VideoCallScreen.tsx` |
| Video Call (Patient) | ✅ | `mobile/app/(patient)/video-call.tsx` |
| Video Call (Practitioner) | ✅ | `mobile/app/(practitioner)/video-call.tsx` |
| Settings Screen | ✅ | `mobile/app/(patient)/settings.tsx` |
| Settings Link from Profile | ✅ | `mobile/app/(patient)/(tabs)/profile.tsx` (معدّل) |
| i18n: payment + settings + notifications + videoCall keys | ✅ | `mobile/i18n/en.json`, `ar.json` |
| Payment + Transfer Types | ✅ | `mobile/types/models.ts` (معدّل) |
| Chat Screen | ✅ | `mobile/app/(patient)/(tabs)/chat.tsx` — GiftedChat + Quick Actions |

**إحصائيات Sprint 3.5:**
- 10 ملفات جديدة + 8 تعديلات
- 0 TypeScript errors
- كل ملف تحت 350 سطر

---

## Phase 4 — AI Chatbot ⚠️ ~80%

### Sprint 4.1 — Chatbot Backend ✅

| Task | الوصف | الحالة | الملف |
|------|-------|--------|-------|
| 4.1.1 | pgvector + embedding model + RAG | ✅ | `chatbot-rag.service.ts` |
| 4.1.2 | Knowledge Base ingestion + file upload + auto-sync | ✅ | `chatbot-rag.service.ts` |
| 4.1.3 | ChatbotService (OpenRouter + function calling) | ✅ | `chatbot-ai.service.ts`, `chatbot.service.ts` |
| 4.1.4 | Intent detection via tool_calls | ✅ | `constants/tool-definitions.ts` (9 أدوات) |
| 4.1.5 | Booking actions via chat | ✅ | `chatbot-tools.service.ts` |
| 4.1.6 | Handoff to Live Chat / Contact | ✅ | `chatbot-tools.service.ts` |
| 4.1.7 | Dynamic system prompt (White Label) | ✅ | `constants/system-prompts.ts` |
| 4.1.8 | ChatbotConfig (6 أقسام ديناميكية) | ✅ | `chatbot-config.service.ts`, `config-defaults.ts` |
| 4.1.9 | Analytics (stats + questions + tools) | ✅ | `chatbot-analytics.service.ts` |
| 4.1.10 | Controller (20 endpoint) | ✅ | `chatbot.controller.ts` |

**Backend ملفات جديدة:** 11 service + 5 DTO + 3 interface + 3 constant = 22 ملف

### Sprint 4.2 — Chatbot UI ✅

| Task | الوصف | الحالة | الملف |
|------|-------|--------|-------|
| 4.2.1 | Chat Screen (GiftedChat + RTL) | ✅ | `mobile/app/(patient)/(tabs)/chat.tsx` |
| 4.2.2 | Quick Actions (ديناميكي من config) | ✅ | `mobile/components/chat/chat-quick-actions.tsx` |
| 4.2.3 | Typing indicator (animated) | ✅ | `mobile/components/chat/chat-typing-indicator.tsx` |
| 4.2.4 | Redux Chat Slice | ✅ | `mobile/stores/slices/chat-slice.ts` |
| 4.2.5 | Chat Service + Types | ✅ | `mobile/services/chatbot.ts`, `mobile/types/chat.ts` |
| 4.2.6 | Mobile i18n (AR/EN) | ✅ | `mobile/i18n/en.json`, `ar.json` |

### Sprint 4.3 — Dashboard Chatbot ✅

| Task | الوصف | الحالة | الملف |
|------|-------|--------|-------|
| 4.3.1 | Chatbot main page (3 tabs) | ✅ | `dashboard/.../chatbot/page.tsx` |
| 4.3.2 | Conversations tab + detail sheet | ✅ | `conversations-tab.tsx` |
| 4.3.3 | Analytics tab (stats + charts) | ✅ | `analytics-tab.tsx` |
| 4.3.4 | Settings tab (6 أقسام: personality, rules, handoff, sync, AI) | ✅ | `settings-tab.tsx` |
| 4.3.5 | Knowledge Base editor + sync | ✅ | `knowledge-base/page.tsx` |
| 4.3.6 | Dashboard API + hooks | ✅ | `lib/api/chatbot.ts`, `hooks/use-chatbot.ts` |
| 4.3.7 | Dashboard i18n (AR/EN) | ✅ | `dashboard/src/i18n/en.json`, `ar.json` |

### Schema Changes
- `ChatbotConfig` — جدول جديد (key-value مع JSON + category)
- `KnowledgeBaseFile` — جدول جديد (تتبع الملفات المرفوعة)
- `ChatSession` += language, metadata
- `ChatMessage` += intent, toolName, tokenCount
- `KnowledgeBase` += source, fileId, chunkIndex

### Sprint 4.4 — Final ✅

| Task | الحالة | التفاصيل |
|------|--------|----------|
| File upload processing (PDF/Word/TXT → chunks) | ✅ | `chatbot-file.service.ts` — pdf-parse + mammoth + chunking |
| Unit Tests (39 test) | ✅ | 4 test suites: config, tools, rag, orchestrator |
| Prisma Migration | ✅ | `add_chatbot_config_and_file_support` applied |

---

## Sprint 4.5 — Bug Fixes + Pricing Refactor ✅

### Bug Fixes (9 issues) ✅

| # | المشكلة | الحل | الملف |
|---|---------|------|-------|
| 1 | لا يتحقق من جدول الممارس/الإجازات عند الحجز | `validateAvailability()` مستخرج + يُنفذ عند create/reschedule | `booking-validation.helper.ts`, `bookings.service.ts` |
| 2 | `getAvailableSlots()` لا يفلتر بالتاريخ — يحمّل كل المواعيد | إضافة `date` filter + `deletedAt: null` في query | `practitioner-availability.service.ts` |
| 3 | `getSlots()` العامة لا تحذف السلوتات المحجوزة | تحميل الحجوزات + overlap check → `available: true/false` | `practitioner-availability.service.ts` |
| 4 | لا جدول ربط بين ممارس وخدمة | `PractitionerService` join table + تحقق عند الحجز | `schema.prisma`, `bookings.service.ts` |
| 5 | `partial` refund = `full` refund (لا فرق) | `refundAmount` field + validation عند partial | `cancel-approve.dto.ts`, `booking-cancellation.service.ts`, `schema.prisma` |
| 6 | حذف الفئة hard delete + خدمات soft-deleted = FK error | الآن يحسب **كل** الخدمات (شاملة soft-deleted) | `services.service.ts` |
| 7 | Zoom stub بدون تحذير واضح | `Logger.warn()` + TODO comment مفصّل | `zoom.service.ts` |
| 8 | لا إشعارات تُرسل من نظام المواعيد | إشعارات عند confirm/complete/cancel + notify helper | `bookings.service.ts`, `booking-cancellation.service.ts`, `bookings.module.ts` |
| 9 | أسماء المرضى مكشوفة في التقييمات العامة | إخفاء اسم العائلة: "أحمد م." | `practitioners.service.ts` |

### Pricing Refactor — PractitionerService ✅

**المشكلة:** الممارس عنده 3 أسعار ثابتة لكل خدماته (priceClinic/Phone/Video على Practitioner).
**الحل:** نقل الأسعار لجدول `PractitionerService` — كل ممارس × خدمة = أسعار + مدة + buffer + أنواع حجز مستقلة.

| التغيير | التفاصيل |
|---------|----------|
| **Schema** | `PractitionerService` += priceClinic/Phone/Video (nullable), customDuration, bufferBefore/After, availableTypes, isActive |
| **Booking FK** | `practitionerServiceId` (required) على كل حجز — يثبّت السعر وقت الحجز |
| **تسعير 3 مستويات** | PractitionerService → Practitioner (legacy) → Service (catalog) — null ≠ مجاني |
| **availableTypes** | `BookingType[]` لكل خدمة — يمنع حجز نوع غير مدعوم (مثل: تنظيف أسنان عن بُعد) |
| **buffer** | `bufferBefore` (تحضير) + `bufferAfter` (تعقيم) — يوسّع الفترة المحجوزة في checkDoubleBooking |
| **4 endpoints جديدة** | `GET/POST/PATCH/DELETE /practitioners/:id/services` — إدارة الخدمات والأسعار |
| **checkOwnership** | مستخرج لـ `common/helpers/ownership.helper.ts` (كان مكرر في 3 ملفات) |
| **Chatbot** | RAG sync يعرض أسعار per-service، Tools تستخدم customDuration |

**Migrations:**
1. `enrich_practitioner_service_pricing` — الحقول الجديدة + FK optional
2. Data migration SQL — نسخ أسعار + ربط حجوزات + إنشاء records يتيمة
3. `make_practitioner_service_id_required` — تحويل FK لـ required

**ملفات جديدة (5):**
- `practitioner-service.service.ts` (CRUD — 161 سطر)
- `assign-practitioner-service.dto.ts`
- `update-practitioner-service.dto.ts`
- `ownership.helper.ts`
- `booking-validation.helper.ts`

**ملفات معدّلة (10):**
- `schema.prisma`, `payments.helpers.ts`, `bookings.service.ts`, `booking-cancellation.service.ts`, `bookings.module.ts`
- `practitioners.service.ts`, `practitioners.controller.ts`, `practitioners.module.ts`
- `chatbot-rag.service.ts`, `chatbot-tools.service.ts`
- `shared/types/practitioner.ts`

---

## Sprint 4.6 — Code Audit & Hardening ✅ مكتمل

> **تاريخ الاكتشاف:** 2026-03-23
> **المدة المقدّرة:** 5–7 أيام
> **الأولوية:** 🔴 حرجة — يجب إنهاؤها قبل Phase 5 (Production Readiness)

### المجموعة أ — أخطاء منطقية (Bugs) 🔴

| # | المشكلة | الملف | الأولوية | التقدير |
|---|---------|-------|----------|---------|
| B-01 | `complete()` يرسل إشعار `booking_confirmed` بدل `booking_completed` — enum غير موجود أصلاً | `bookings.service.ts` | 🔴 | 15 دقيقة |
| B-02 | `shiftTime` يلف حول منتصف الليل بـ `% 24` — buffer بعد 23:45 يصير 00:15 ويفشل overlap check | `bookings.service.ts` | 🔴 | 30 دقيقة |
| B-03 | `setAvailability` يحذف ثم ينشئ بدون transaction — crash بينهم = ممارس بدون أوقات | `practitioner-availability.service.ts` | 🔴 | 15 دقيقة |
| B-04 | `syncFromDatabase` يحذف الكل ثم يعيد الإنشاء — فشل embedding يترك knowledge base ناقصة | `chatbot-rag.service.ts` | 🟠 | 45 دقيقة |
| B-05 | `rescheduleBooking` في chatbot ما يتحقق أن الحجز للمريض نفسه — أي مريض يقدر يغيّر حجز غيره | `chatbot-tools.service.ts` | 🔴 | 20 دقيقة |
| B-06 | مقارنة تواريخ الإجازات حساسة للـ timezone — UTC vs server timezone | `booking-validation.helper.ts` | 🟠 | 30 دقيقة |
| B-07 | `priceClinic \|\| null` يعامل السعر `0` (مجاني) كـ null — يرجع سعر الكتالوج بدل المجاني | `payments.helpers.ts` | 🔴 | 10 دقيقة |
| B-08 | `findAll` في Services ما يفلتر `isActive` بشكل افتراضي — خدمات غير نشطة تظهر للجمهور | `services.service.ts` | 🟠 | 10 دقيقة |

### المجموعة ب — ثغرات أمنية (Security) 🔴

| # | المشكلة | الملف | الأولوية | التقدير |
|---|---------|-------|----------|---------|
| S-01 | Controller يستخدم `PrismaService` مباشرة لفحص الصلاحيات — منطق RBAC مكرر في 3 أماكن | `bookings.controller.ts` | 🟠 | ساعة |
| S-02 | `duration` query param في slots endpoint بدون حدود — يكشف جدول الممارس الكامل | `practitioners.controller.ts` | 🟠 | 15 دقيقة |
| S-03 | Chatbot reschedule بدون ownership check (= B-05) | `chatbot-tools.service.ts` | 🔴 | 20 دقيقة |
| S-04 | `localStorage` للتوكنات في وضع الويب — عرضة لـ XSS | `mobile/stores/secure-storage.ts` | 🟡 | 20 دقيقة |

### المجموعة ج — تنفيذ ناقص (Incomplete) 🟠

| # | المشكلة | الملف | الأولوية | التقدير |
|---|---------|-------|----------|---------|
| I-01 | Zoom integration كلها stub — روابط وهمية في production | `zoom.service.ts` | 🟡 يؤجل لـ Phase 5 | — |
| I-02 | `CancelRejectDto.adminNotes` يُستقبل لكن لا يُحفظ — بيانات تُهمل بصمت | `booking-cancellation.service.ts` | 🟠 | 30 دقيقة |
| I-03 | لا تحقق من الدفع قبل تأكيد الحجز — المفروض prepayment مطلوب | `bookings.service.ts` | 🔴 | 30 دقيقة |
| I-04 | `findMyBookings` و `findTodayBookings` بدون pagination — unbounded query | `bookings.service.ts` | 🟠 | 30 دقيقة |
| I-05 | لا Swagger decorators على DTOs/endpoints الجديدة | ملفات متعددة | 🟡 | ساعة |
| I-06 | `update()` في RAG يجلب السجل مرتين (redundant DB call) | `chatbot-rag.service.ts` | 🟡 | 10 دقيقة |
| I-07 | لا إشعار للممارس عند حجز جديد أو إلغاء | `bookings.service.ts` | 🟠 | 20 دقيقة |
| I-08 | لا `booking_completed` enum في NotificationType | `schema.prisma` | 🟠 | 15 دقيقة |
| I-09 | Zoom link لا يتحدث عند reschedule لحجز video | `bookings.service.ts` | 🟡 يؤجل مع I-01 | — |

### المجموعة د — أداء (Performance) 🟠

| # | المشكلة | الملف | الأولوية | التقدير |
|---|---------|-------|----------|---------|
| P-01 | N+1 في `syncFromDatabase` — HTTP call تسلسلي لكل embedding | `chatbot-rag.service.ts` | 🟡 | 45 دقيقة |
| P-02 | `findAll` bookings controller يعمل 2-3 DB queries إضافية لكل request | `bookings.controller.ts` | 🟠 | 45 دقيقة |
| P-03 | `getAvailableSlots` يحمّل **كل** الإجازات بدون فلتر تاريخ | `practitioner-availability.service.ts` | 🟠 | 15 دقيقة |
| P-04 | `sortBy` من query string بدون whitelist — يكسر Prisma runtime | `practitioners.service.ts` | 🟠 | 15 دقيقة |

### المجموعة هـ — جودة الكود (Code Quality) 🟡

| # | المشكلة | الملف | الأولوية | التقدير |
|---|---------|-------|----------|---------|
| Q-01 | `bookings.service.ts` عند 316 سطر — قريب جداً من حد الـ 350 | `bookings.service.ts` | 🟠 | 30 دقيقة |
| Q-02 | `timeSlotsOverlap` مكرر في ملفين مختلفين — انتهاك DRY | `bookings.service.ts` + `practitioner-availability.service.ts` | 🟡 | 20 دقيقة |
| Q-03 | `as never[]` type cast بدل استخدام `BookingType[]` الصحيح | `practitioner-service.service.ts` | 🟡 | 10 دقيقة |
| Q-04 | `delete()` و `softDelete()` نفس الكود — duplication بلا سبب | `practitioners.service.ts` | 🟡 | 5 دقيقة |
| Q-05 | `bookingInclude` معرّف في ملفين بمحتوى مختلف — responses غير متسقة | `bookings.service.ts` + `booking-cancellation.service.ts` | 🟠 | 15 دقيقة |
| Q-06 | `@IsNotEmpty()` على array بدل `@ArrayNotEmpty()` | `assign-practitioner-service.dto.ts` | 🟡 | 5 دقيقة |
| Q-07 | `shared/types/practitioner.ts` ناقص `deletedAt` + `availableTypes` نوعه خطأ | `shared/types/practitioner.ts` | 🟡 | 10 دقيقة |
| Q-08 | `persistTokens` parameter type يقبل `undefined` بدون guard | `mobile/services/auth.ts` | 🟡 | 5 دقيقة |

### Dashboard — مشاكل مرصودة من السكرين شوت 🟡

| # | المشكلة | الملاحظة |
|---|---------|----------|
| D-01 | صفحة الـ Chatbot Settings حقول فارغة بدون placeholder text | يحتاج UX improvement |
| D-02 | صفحة Notifications placeholder فاضي (معروف — Sprint 2.5) | ينتظر Phase 5 |

---

### خطة التنفيذ المقترحة (ترتيب حسب الأولوية)

**اليوم 1 — الأخطاء الحرجة (B + S):**

```
1. B-07: إصلاح || → ?? في payments.helpers.ts (10 دقائق)
2. B-01: إضافة booking_completed enum + إصلاح complete() (15 دقيقة + I-08)
3. B-05/S-03: إضافة ownership check في chatbot reschedule (20 دقيقة)
4. B-02: إصلاح midnight wrap في shiftTime (30 دقيقة)
5. B-03: لف setAvailability بـ $transaction (15 دقيقة)
6. I-03: إضافة payment check قبل confirm (30 دقيقة)
```

**اليوم 2 — التنفيذ الناقص + الأداء:**

```
7. I-02: حفظ adminNotes في الإلغاء (30 دقيقة)
8. I-04: إضافة pagination لـ findMyBookings/findTodayBookings (30 دقيقة)
9. I-07: إشعار الممارس عند حجز/إلغاء (20 دقيقة)
10. P-03: فلتر تاريخ على الإجازات في getAvailableSlots (15 دقيقة)
11. P-04: whitelist لـ sortBy (15 دقيقة)
12. B-08: فلتر isActive افتراضي في Services (10 دقائق)
```

**اليوم 3 — جودة الكود + Refactoring:**

```
13. Q-01+Q-02: نقل helpers مكررة لـ booking-time.helper.ts (30 دقيقة)
14. Q-05: توحيد bookingInclude في ملف مشترك (15 دقيقة)
15. Q-03: إصلاح as never[] → BookingType[] (10 دقائق)
16. Q-04: حذف softDelete duplicate (5 دقائق)
17. Q-06: @ArrayNotEmpty بدل @IsNotEmpty (5 دقائق)
18. Q-07: تحديث shared types (10 دقائق)
19. Q-08: NonNullable type في persistTokens (5 دقائق)
```

**اليوم 4 — الأمان والأداء:**

```
20. S-01: نقل RBAC logic من controller للـ service layer (ساعة)
21. S-02: validation على duration parameter (15 دقيقة)
22. P-02: تقليل DB queries في bookings controller (45 دقيقة)
23. B-06: توحيد timezone handling (30 دقيقة)
```

**اليوم 5 — التحسينات:**

```
24. B-04: transaction في syncFromDatabase (45 دقيقة)
25. P-01: batching/concurrency في embedding generation (45 دقيقة)
26. I-05: Swagger decorators للـ DTOs الجديدة (ساعة)
27. I-06: إزالة redundant findUnique في RAG update (10 دقائق)
28. S-04: تحسين token storage للويب (20 دقيقة)
```

**مؤجل لـ Phase 5:**

- I-01: Zoom API integration الفعلية
- I-09: Zoom link update عند reschedule
- D-02: صفحة Notifications كاملة

---

### معيار إتمام Sprint 4.6

- كل الأخطاء المنطقية (B-01 → B-08) مُصلحة
- كل الثغرات الأمنية (S-01 → S-04) مُعالجة
- التنفيذ الناقص الحرج (I-02, I-03, I-04, I-07, I-08) مكتمل
- مشاكل الأداء (P-02, P-03, P-04) محلولة
- جودة الكود (Q-01 → Q-08) محسّنة
- كل ملف تحت 350 سطر
- لا `as never[]` أو `|| null` على قيم رقمية

---

## Phase 5 — Production Readiness 🔲 لم يُبدأ

| Task | الوصف | الحالة |
|------|-------|--------|
| 5.1 | PDF Generation (Puppeteer) — الفواتير | 🔲 |
| 5.2 | ZATCA Phase 2 Full Flow (CSR + CSID + production) | 🔲 |
| 5.3 | Performance Testing (load + DB optimization) | 🔲 |
| 5.4 | Security Audit (OWASP + penetration testing) | 🔲 |
| 5.5 | Docker Production Setup (multi-stage + secrets) | 🔲 |
| 5.6 | CI/CD Pipeline (GitHub Actions → Dokploy) | 🔲 |
| 5.7 | Monitoring (Sentry + Grafana + health checks) | 🔲 |
| 5.8 | App Store Submission (iOS + Android) | 🔲 |

---

## Phase 6 — Testing & Delivery 🔲 لم يُبدأ

| Task | الوصف | الحالة |
|------|-------|--------|
| 6.1 | Integration Testing (all user flows E2E) | 🔲 |
| 6.2 | Security Audit | 🔲 |
| 6.3 | Performance Testing | 🔲 |
| 6.4 | RTL + i18n Testing | 🔲 |
| 6.5 | Docker Image (production compose) | 🔲 |
| 6.6 | Documentation (install guide + API docs + user guide AR) | 🔲 |
| 6.7 | App Store Submission | 🔲 |
| 6.8 | Client Training + Handoff | 🔲 |
| 6.9 | Go Live | 🔲 |

---

## الموارد والمكتبات

### Backend (NestJS + Prisma)

| Package | Purpose |
|---------|---------|
| `@nestjs/passport` + `passport-jwt` | JWT Auth |
| `@casl/ability` + `@casl/prisma` | Dynamic RBAC |
| `@nestjs/swagger` | API Documentation |
| `@nestjs/bull` + `bullmq` | Job Queues |
| `@nestjs/schedule` | Cron Jobs |
| `nestjs-i18n` | i18n (AR/EN) |
| `@nestjs/throttler` | Rate Limiting |
| `class-validator` + `class-transformer` | Validation |
| `@nestjs-modules/mailer` | Email |
| `minio` | S3-compatible storage |

### Mobile (Expo SDK 54)

| Package | Purpose |
|---------|---------|
| `expo-router` v6 | Navigation |
| `@reduxjs/toolkit` + `redux-persist` | State Management |
| `react-hook-form` + `zod` | Form Validation |
| `expo-notifications` | Push (FCM) |
| `expo-image-picker` | Receipt upload |
| `i18next` + `react-i18next` | i18n |
| `axios` | API Client |
| `expo-secure-store` | Token storage |

### Dashboard (Next.js 14)

| Package | Purpose |
|---------|---------|
| `shadcn/ui` (32 component) | UI Components |
| `@tanstack/react-table` | Data Tables |
| `recharts` | Charts |
| `react-hook-form` + `zod` | Forms |
| `next-intl` | i18n |
| `nuqs` | URL State |
| `lucide-react` | Icons |

### AI & Chatbot (Phase 4)

| Package | Purpose |
|---------|---------|
| OpenRouter API | Multi-model AI gateway |
| `langchain` or `vercel/ai` | AI SDK |
| `pgvector` | Knowledge base embeddings |

### External Services

| Service | Technology |
|---------|-----------|
| Payment | Moyasar SDK |
| Video | Zoom API |
| Email | Resend / SendGrid |
| Push | Firebase FCM |
| Storage | MinIO (self-hosted) |

---

## ZATCA Sandbox معلومات

```
URL:          https://sandbox.zatca.gov.sa/
API Base:     https://gw-apic-gov.gazt.gov.sa/e-invoicing/developer-portal
API Version:  V2
Auth:         Basic Auth — Base64(CSID:Secret)
```

**Endpoints:**

```
POST /compliance/csids           # Compliance CSID
POST /production/csids           # Production CSID
POST /compliance/invoices        # فحص امتثال
POST /invoices/reporting/single  # فاتورة مبسطة (Phase 2)
POST /invoices/clearance/single  # فاتورة معيارية (Phase 2)
```

---

## نقاط مراجعة إلزامية

- ✋ تطبيق أي migration على قاعدة البيانات
- ✋ إرسال أي طلب لـ ZATCA حتى Sandbox
- ✋ أي تعديل على Payment model
- ✋ الانتقال من Phase 1 لـ Phase 2 في ZATCA
- ✋ نشر أي build لـ App Store / Play Store

---

## Critical Path

1. **ERD (1.1)** → كل شيء يعتمد على الـ schema ✅
2. **Auth + RBAC (2.2, 2.3)** → كل feature تحتاج auth ✅
3. **Booking API (2.7)** → وظيفة المنتج الأساسية ✅
4. **Payment في Mobile** → الدفع ضروري للإطلاق ✅
5. **App Store Submission (6.7)** → مراجعة Apple قد تأخذ 1-2 أسبوع 🔲

---

## سجل الإنجازات

| التاريخ | الإنجاز |
|---------|---------|
| 2026-03 | Phase 1 مكتمل: Backend 18 module + Prisma 28 model/13 enum |
| 2026-03 | Phase 2 مكتمل: ZATCA module (6 services) + Dashboard 16 صفحة + 459 test |
| 2026-03 | Phase 3 مكتمل: Mobile 28 شاشة + Payment (Moyasar + Bank Transfer) + Notifications + Video Call + Settings |
| 2026-03 | Refactor: تقسيم 5 service files كبيرة (auth, practitioners, payments, bookings, users) — 455 test يمرّون |
| 2026-03 | Dashboard API: ربط Services + Practitioners detail بالـ API (16/16 صفحة متصلة) |
| 2026-03 | PRD: إضافة `docs/CareKit-PRD-EN.md` — Phase 1 Design & Planning مكتملة 100% |
| 2026-03 | توحيد ملفات التخطيط في sprint-plan.md |
| 2026-03 | Sprint 3.5: Payment Flow + Notifications + Video Call + Settings (10 ملفات جديدة + 8 تعديلات، 0 TS errors) |
| 2026-03-22 | Phase 4 مكتمل: AI Chatbot — Backend 23 ملف + Mobile chat (GiftedChat + RTL) + Dashboard 3 tabs + KB editor + File processing + 39 unit test + Migration applied |
| 2026-03-23 | Sprint 4.5: إصلاح 9 bugs حرجة (availability validation, date filter, slot booking display, category delete FK, partial refund, notifications, patient name anonymization) |
| 2026-03-23 | Pricing Refactor: نقل الأسعار من Practitioner لـ PractitionerService — 3-tier pricing + availableTypes + bufferBefore/After + customDuration + 4 endpoints جديدة + 3 migrations + 5 ملفات جديدة + 10 معدّلة |

---

*CareKit — WebVue Technology Solutions — آخر تحديث: 2026-03-23*
