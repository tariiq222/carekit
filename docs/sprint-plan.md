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
Phase 3 — Mobile App                                        ⚠️  ~85% (ناقص: Payment, Settings, FCM)
Phase 4 — AI Chatbot                                        🔲 5%  (هيكل فاضي فقط)
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

### Sprint 2.5 — Dashboard API Integration ✅

| الصفحة | قبل | بعد |
| -------- | ------ | ------ |
| Dashboard Home | ✅ API | ✅ |
| Appointments | ✅ API | ✅ |
| Practitioners List | ✅ API | ✅ |
| Practitioner Detail | ❌ placeholder | ✅ API — `use-practitioner.ts` + تقسيم لـ profile-tab + ratings-tab |
| Patients + Detail | ✅ API | ✅ |
| Services | ❌ placeholder | ✅ API — `lib/api/services.ts` + `use-services.ts` + `use-categories.ts` |
| Invoices + ZATCA | ✅ API | ✅ |
| Payments | ✅ API | ✅ |
| Reports | ✅ API | ✅ |
| Users + Roles | ✅ API | ✅ |
| Settings | ✅ API | ✅ |

**النتيجة:** 16/16 صفحة متصلة بالـ API ✅

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

## Phase 3 — Mobile App ⚠️ ~85%

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

### ⚠️ ما زال ناقص في Mobile

| Task | الأولوية | الحالة |
|------|---------|--------|
| Payment Screen (Moyasar SDK) | 🔴 | 🔲 لم يُبدأ |
| Bank Transfer Screen (upload receipt) | 🔴 | 🔲 لم يُبدأ |
| Video Call (Zoom link) | 🟡 | 🔲 لم يُبدأ |
| Settings Screen (language + notifications) | 🟡 | 🔲 لم يُبدأ |
| Push Notifications (FCM setup) | 🟡 | 🔲 لم يُبدأ |
| Chat Screen (ينتظر Phase 4) | 🔵 | ⚠️ هيكل فقط |

---

## Phase 4 — AI Chatbot ⚠️ 5% (هيكل فقط)

**الموجود فعلياً:**
- `backend/src/modules/chatbot/chatbot.module.ts` — هيكل فاضي
- `backend/src/modules/chatbot/chatbot.controller.ts` — هيكل فاضي
- `mobile/app/(patient)/(tabs)/chat.tsx` — placeholder شاشة
- `dashboard/src/app/[locale]/(dashboard)/chatbot/page.tsx` — صفحة هيكل
- Schema: ChatSession, ChatMessage, KnowledgeBase models موجودين في Prisma

### Sprint 4.1 — Chatbot Backend

| Task | الوصف | الحالة |
|------|-------|--------|
| 4.1.1 | pgvector setup + embedding model | 🔲 |
| 4.1.2 | Knowledge Base ingestion (FAQ + services + practitioners) | 🔲 |
| 4.1.3 | ChatbotService (OpenRouter API + RAG) | 🔲 |
| 4.1.4 | Intent detection (book / modify / cancel / query) | 🔲 |
| 4.1.5 | Booking actions via chat | 🔲 |
| 4.1.6 | Handoff to Live Chat | 🔲 |

### Sprint 4.2 — Chatbot UI (Mobile + Dashboard)

| Task | الوصف | الحالة |
|------|-------|--------|
| 4.2.1 | Chat Screen (تفعيل الـ placeholder) | 🔲 |
| 4.2.2 | Bubble UI (AR/EN + RTL) | 🔲 |
| 4.2.3 | Quick Actions (أزرار سريعة) | 🔲 |
| 4.2.4 | Typing indicator (WebSocket) | 🔲 |
| 4.2.5 | Dashboard: conversation log + analytics | 🔲 |
| 4.2.6 | Dashboard: knowledge base editor | 🔲 |

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
4. **Payment في Mobile** → الدفع ضروري للإطلاق 🔲
5. **App Store Submission (6.7)** → مراجعة Apple قد تأخذ 1-2 أسبوع 🔲

---

## سجل الإنجازات

| التاريخ | الإنجاز |
|---------|---------|
| 2026-03 | Phase 1 مكتمل: Backend 18 module + Prisma 28 model/13 enum |
| 2026-03 | Phase 2 مكتمل: ZATCA module (6 services) + Dashboard 16 صفحة + 459 test |
| 2026-03 | Phase 3 ~85%: Mobile 28 شاشة (auth + patient + practitioner) + theme + i18n |
| 2026-03 | Refactor: تقسيم 5 service files كبيرة (auth, practitioners, payments, bookings, users) — 455 test يمرّون |
| 2026-03 | Dashboard API: ربط Services + Practitioners detail بالـ API (16/16 صفحة متصلة) |
| 2026-03 | PRD: إضافة `docs/CareKit-PRD-EN.md` — Phase 1 Design & Planning مكتملة 100% |
| 2026-03 | توحيد ملفات التخطيط في sprint-plan.md |

---

*CareKit — WebVue Technology Solutions — آخر تحديث: 2026-03-22*
