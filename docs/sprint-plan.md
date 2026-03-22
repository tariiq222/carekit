# CareKit — Sprint Plan & Progress Tracker

> **آخر تحديث:** 2026-03-22
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
| Practitioners | practitioners.service, practitioner-availability.service, practitioner-vacation.service | ✅ |
| Specialties | specialties.service, specialties.controller | ✅ |
| Services | services.service, services.controller | ✅ |
| Bookings | bookings.service, booking-cancellation.service, zoom.service | ✅ |
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
| Models | 28 (User, Practitioner, Booking, Payment, Invoice, Rating, etc.) | ✅ |
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

---

*CareKit — WebVue Technology Solutions — آخر تحديث: 2026-03-22*
