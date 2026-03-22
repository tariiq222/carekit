# CareKit — Sprint Plan
> آخر تحديث: 2026-03-22
> الهدف: تطوير منصة CareKit كاملة (Backend + Dashboard + Mobile)

---

## قواعد العمل الصارمة

1. **لا يتجاوز أي ملف 350 سطراً** — فوراً يُقسم عند الاقتراب
2. **لا كود بدون مراجعة الـ schema أولاً** — الـ Prisma schema هو مصدر الحقيقة
3. **كل migration تُراجع من الـ Maestro قبل التطبيق**
4. **كل endpoint له Swagger decorator + unit test**
5. **لا hardcoded values** — كل شيء في constants/ أو env
6. **RTL-first في كل مكون داشبورد**
7. **كل رسالة commit بالإنجليزية — Conventional Commits فقط**

---

## الـ Phases

```
Phase 1 — الأساسيات          ✅ مكتمل
Phase 2 — ZATCA + Dashboard   ✅ مكتمل
Phase 3 — Mobile App          🔲 لم يُبدأ
Phase 4 — AI Chatbot          🔲 مستقبلي
```

---

## Phase 1 — الأساسيات ✅ مكتمل بالكامل

### Backend
| الوحدة | الحالة | الملاحظات |
|--------|--------|-----------|
| Auth (JWT + OTP + CASL) | ✅ | email+password + OTP |
| Users | ✅ | |
| Roles + Permissions (Dynamic RBAC) | ✅ | |
| Practitioners + Specialties + Services | ✅ | |
| Bookings + Zoom integration | ✅ | |
| Payments (Moyasar + Bank Transfer + AI Receipt) | ✅ | |
| Invoices (createInvoice + generateHtml) | ✅ | |
| Notifications (Email + FCM) | ✅ | |
| WhiteLabel config | ✅ | |
| Patients module | ✅ | findAll + findOne + stats + search/pagination |
| Ratings module | ✅ | create + findByPractitioner + updateRating |
| Reports module | ✅ | revenue + summary |

### Database Schema
| الوحدة | الحالة |
|--------|--------|
| كل الـ models الأساسية | ✅ |
| ZatcaStatus enum | ✅ |
| Invoice: vatAmount, vatRate, invoiceHash, previousHash, qrCodeData, zatcaStatus, xmlContent | ✅ |
| WhiteLabelConfig: zatca_phase, vat_rate, vat_registration_number, business_registration, seller_address, clinic_city, clinic_name | ✅ |

### Dashboard
| الصفحة | الحالة |
|--------|--------|
| Layout + i18n (AR/EN) + shadcn/ui | ✅ |
| كل الـ 16 صفحة (هيكل) | ✅ |

---

## Phase 2 — ZATCA + Dashboard Integration ✅ مكتمل بالكامل

### Sprint 2.1 — ZATCA Module (Backend) ✅

| Task | الحالة | الملف |
|------|--------|-------|
| ZatcaService (loadConfig + generateForInvoice + getPreviousHash) | ✅ | `backend/src/modules/zatca/zatca.service.ts` |
| InvoiceHashService (SHA-256 + base64 + buildHashInput) | ✅ | `backend/src/modules/zatca/services/invoice-hash.service.ts` |
| QrGeneratorService (TLV encoding — 5 fields) | ✅ | `backend/src/modules/zatca/services/qr-generator.service.ts` |
| XmlBuilderService (UBL 2.1 Simplified Invoice) | ✅ | `backend/src/modules/zatca/services/xml-builder.service.ts` |
| ZatcaApiService (reportInvoice + clearInvoice + checkCompliance) | ✅ | `backend/src/modules/zatca/services/zatca-api.service.ts` |
| ZatcaSandboxService (reportInvoiceToSandbox + getSandboxStats) | ✅ | `backend/src/modules/zatca/services/zatca-sandbox.service.ts` |
| ZatcaController (GET /zatca/config + POST /zatca/sandbox/report/:id + GET /zatca/sandbox/stats) | ✅ | `backend/src/modules/zatca/zatca.controller.ts` |
| InvoiceCreatorService (createInvoice مدمج مع ZATCA) | ✅ | `backend/src/modules/invoices/invoice-creator.service.ts` |

### Sprint 2.2 — Dashboard Integration ✅

| Task | الحالة | الملف |
|------|--------|-------|
| ZATCA Settings tab في صفحة الإعدادات | ✅ | `dashboard/.../settings/zatca-tab.tsx` |
| صفحة الفواتير: عمود ZATCA Status + QR viewer + فلتر | ✅ | `dashboard/.../invoices/page.tsx` |
| ZatcaBadge (badge ملوّن + QR Code Popover) | ✅ | `dashboard/.../invoices/zatca-badge.tsx` |
| InvoiceStatsCards (4 بطاقات إحصائية) | ✅ | `dashboard/.../invoices/invoice-stats.tsx` |
| صفحة المرضى: server-side search + pagination | ✅ | `dashboard/.../patients/page.tsx` |
| PatientsTable: controlled (لا client-side filtering) | ✅ | `dashboard/.../patients/patients-table.tsx` |
| Patient Detail Page: تقسيم 734 سطر → 4 ملفات | ✅ | `dashboard/.../patients/[id]/` |
| hooks: usePatients + usePatient + usePatientStats | ✅ | `dashboard/src/hooks/use-patients.ts` |
| API lib: PatientBooking + PatientDetail types | ✅ | `dashboard/src/lib/api/patients.ts` |

### Sprint 2.3 — Bug Fixes ✅

| Bug | الحالة |
|-----|--------|
| patients.service: search كان يستخدم `name` (non-existent) → `firstName`/`lastName` | ✅ |
| dashboard patients: apiToLocalPatient كانت تستخدم حقول خاطئة | ✅ |
| E2E: GET /reports/revenue → 400 (ناقص dateFrom/dateTo) | ✅ |
| E2E: PUT /whitelabel/config جسم خاطئ | ✅ |
| Base UI Popover: إزالة asChild غير المدعوم | ✅ |

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
| **المجموع** | **459 في 21 suite** | ✅ |

---

## Phase 3 — Mobile App ✅ مكتمل

### Sprint 3.1 — Auth + Navigation (أولوية: 🔴 حرج)

**المجلد:** `mobile/`
**Stack:** React Native (Expo SDK 54) + Expo Router v6 + Redux Toolkit

| Task | الملف | الوصف |
|------|-------|-------|
| 3.1.1 — إعداد Redux + persist | `mobile/src/store/` | auth slice + redux-persist |
| 3.1.2 — Login Screen | `mobile/src/app/(auth)/login.tsx` | email+password + validation |
| 3.1.3 — OTP Screen | `mobile/src/app/(auth)/otp.tsx` | 6-digit OTP input |
| 3.1.4 — Auth Guard | `mobile/src/app/_layout.tsx` | redirect بحسب role |
| 3.1.5 — API Client (axios + interceptors) | `mobile/src/lib/api-client.ts` | token injection + refresh |
| 3.1.6 — Secure token storage | `mobile/src/lib/auth-storage.ts` | expo-secure-store |

**شرط الانتهاء:** المريض والطبيب يستطيعان تسجيل الدخول + الانتقال لشاشاتهم المختلفة

---

### Sprint 3.2 — Patient Screens (أولوية: 🔴 حرج)

| Task | الملف | الوصف |
|------|-------|-------|
| 3.2.1 — Patient Home Screen | `mobile/src/app/(patient)/index.tsx` | نظرة عامة + الحجز القادم |
| 3.2.2 — Appointments Screen | `mobile/src/app/(patient)/appointments.tsx` | قائمة بالحجوزات |
| 3.2.3 — Book Appointment Flow | `mobile/src/app/(patient)/book/` | اختيار طبيب → خدمة → وقت → دفع |
| 3.2.4 — Payment Screen (Moyasar) | `mobile/src/app/(patient)/payment.tsx` | Moyasar SDK |
| 3.2.5 — Bank Transfer Screen | `mobile/src/app/(patient)/bank-transfer.tsx` | رفع صورة الإيصال |
| 3.2.6 — Patient Profile Screen | `mobile/src/app/(patient)/profile.tsx` | بيانات المريض |

---

### Sprint 3.3 — Practitioner Screens (أولوية: 🔴 حرج)

| Task | الملف | الوصف |
|------|-------|-------|
| 3.3.1 — Today's Schedule | `mobile/src/app/(doctor)/index.tsx` | حجوزات اليوم |
| 3.3.2 — Calendar View | `mobile/src/app/(doctor)/calendar.tsx` | عرض أسبوعي/شهري |
| 3.3.3 — Patient Detail (Doctor view) | `mobile/src/app/(doctor)/patients/[id].tsx` | ملف المريض |
| 3.3.4 — Doctor Profile | `mobile/src/app/(doctor)/profile.tsx` | إدارة الجدول + الإجازات |

---

### Sprint 3.4 — Shared Screens (أولوية: 🟡 عالي)

| Task | الملف | الوصف |
|------|-------|-------|
| 3.4.1 — Notifications Screen | `mobile/src/app/notifications.tsx` | FCM push notifications |
| 3.4.2 — Rating Screen | `mobile/src/app/rate/[bookingId].tsx` | تقييم بعد الحجز |
| 3.4.3 — Video Call Launch | `mobile/src/app/video-call.tsx` | فتح Zoom link |
| 3.4.4 — Settings Screen | `mobile/src/app/settings.tsx` | اللغة + الإشعارات |

---

## Phase 4 — AI Chatbot 🔲 مستقبلي

### Sprint 4.1 — Chatbot Backend

| Task | الوصف |
|------|-------|
| 4.1.1 — pgvector setup | تثبيت extension + embedding model |
| 4.1.2 — Knowledge Base ingestion | FAQ + services + practitioners → embeddings |
| 4.1.3 — ChatbotService | OpenRouter API + RAG pipeline |
| 4.1.4 — Intent detection | book / modify / cancel / query |
| 4.1.5 — Booking actions via chat | استدعاء BookingsService من الـ chatbot |
| 4.1.6 — Handoff to Live Chat | fallback عند عدم الفهم |

### Sprint 4.2 — Chatbot Mobile UI

| Task | الوصف |
|------|-------|
| 4.2.1 — Chat Screen | `mobile/src/app/(patient)/chat.tsx` |
| 4.2.2 — Bubble UI | رسائل AR/EN + RTL support |
| 4.2.3 — Quick Actions | أزرار سريعة (احجز، ألغي، مواعيدي) |
| 4.2.4 — Typing indicator | WebSocket real-time |

---

## Phase 5 — Production Readiness 🔲 مستقبلي

| Task | الوصف |
|------|-------|
| 5.1 — PDF Generation (Puppeteer) | فواتير PDF حقيقية بدلاً من HTML |
| 5.2 — ZATCA Phase 2 Full Flow | CSR automation + CSID registration + production reporting |
| 5.3 — Performance Testing | load testing + DB query optimization |
| 5.4 — Security Audit | OWASP checklist + penetration testing |
| 5.5 — Docker Production Setup | multi-stage builds + secrets management |
| 5.6 — CI/CD Pipeline | GitHub Actions → Dokploy |
| 5.7 — Monitoring | Sentry + Grafana + health checks |
| 5.8 — App Store Submission | iOS + Android review |

---

## الوضع الحالي — ملخص سريع

```
✅ Phase 1 — Backend + Schema               100% مكتمل
✅ Phase 2 — ZATCA + Dashboard              100% مكتمل
   ├── 459 unit test يمرّون في 21 suite
   ├── 0 TypeScript errors (backend + dashboard)
   └── E2E tests مُصلحة

✅ Phase 3 — Mobile App                     100% مكتمل
   ├── Sprint 3.1: Auth (Login + OTP + Register) ✅
   ├── Sprint 3.2: Patient (Home + Appointments + Profile + Practitioner Detail) ✅
   ├── Sprint 3.3: Doctor (Today + Calendar + Patients + Profile) ✅
   ├── Sprint 3.4: Shared (Booking Flow + Rating + Appointment Detail) ✅
   ├── 0 TypeScript errors
   ├── Design System متوافق 100% مع CareKit DS
   └── 45+ ملف جديد/محدّث

🔲 Phase 4 — AI Chatbot                     0% مستقبلي
🔲 Phase 5 — Production Readiness           0% مستقبلي
```

---

## نقاط مراجعة إلزامية (Maestro Sign-off)

الفريق يوقف العمل وينتظر موافقة قبل:

- ✋ **تطبيق أي migration** على قاعدة البيانات
- ✋ **إرسال أي طلب لـ ZATCA** حتى Sandbox
- ✋ **أي تعديل على `Payment` model** في الـ schema
- ✋ **الانتقال من Phase 1 لـ Phase 2** في إعدادات ZATCA
- ✋ **نشر أي build لـ App Store / Play Store**

---

## معلومات ZATCA Sandbox

```
URL:          https://sandbox.zatca.gov.sa/
API Base:     https://gw-apic-gov.gazt.gov.sa/e-invoicing/developer-portal
API Version:  V2 (إلزامي في كل request)
Auth:         Basic Auth — Base64(CSID:Secret)
Content-Type: application/json
Accept-Language: ar | en
```

**Endpoints:**
```
POST /compliance/csids           # Compliance CSID
POST /production/csids           # Production CSID
POST /compliance/invoices        # فحص امتثال فاتورة
POST /invoices/reporting/single  # إرسال فاتورة مبسطة (Phase 2)
POST /invoices/clearance/single  # مقاصة فاتورة معيارية (Phase 2)
```
