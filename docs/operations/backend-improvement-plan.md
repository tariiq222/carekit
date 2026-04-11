# CareKit Backend — خطة التحسين الشاملة

> **تاريخ الإنشاء:** 2026-04-01
> **بناءً على:** تحليل معماري شامل للباك اند (30 موديول، 111 unit test، 63 e2e test)
> **التقييم الحالي:** ⭐⭐⭐⭐½ (4.5/5)
> **الهدف:** ⭐⭐⭐⭐⭐ (5/5) — Production-ready مع 85%+ test coverage

---

## الوضع الحالي — Snapshot

| المقياس | الحالي | الهدف |
|---------|--------|-------|
| Unit Tests | 111 ملف | 200+ ملف |
| E2E Tests | 63 ملف (غير مُفعّل في CI) | 80+ ملف (مُفعّل) |
| Coverage Branches | 40% | 85% |
| Coverage Lines | 50% | 85% |
| Load Testing | موجود (غير مُحدّث) | مُحدّث مع baselines |
| Contract Testing | ❌ غير موجود | ✅ مُفعّل في CI |
| PDF Invoices | ❌ غير منجز | ✅ منجز |
| ZATCA Phase 2 | ⚠️ جزئي | ✅ كامل |
| Zoom Integration | ⚠️ stub fallback | ✅ فعلي |
| ActivityLog Archiving | ❌ غير موجود | ✅ منجز |
| pgvector HNSW Index | ❌ غير موجود | ✅ منجز |

---

## نظرة عامة على المراحل

```
Phase A — Critical Fixes        ████ الأسبوع 1
Phase B — Test Coverage         ████████ الأسابيع 2-3
Phase C — E2E Test Suite        ████████ الأسابيع 3-4
Phase D — Integration Completion ████████████ الأسابيع 4-6
Phase E — Performance & Quality  ████████ الأسابيع 5-6
Phase F — Production Readiness   ████████ الأسابيع 6-7
```

---

## Phase A — إصلاحات حرجة (P0) — الأسبوع 1

> **الهدف:** إغلاق الثغرات الحرجة قبل أي عمل آخر

---

### A-1: إزالة `getPreviousInvoiceHash()` المُعلّم deprecated
- **الأولوية:** P0 🔴
- **الجهد:** S (2-3 ساعات)
- **الخطر:** حرج — race condition يُنتج فواتير بنفس الـ previousHash مما يكسر سلسلة ZATCA
- **الوصف:**
  - الإصلاح الجزئي موجود في `invoice-creator.service.ts` (يقرأ الـ hash داخل Serializable transaction) ✅
  - لكن `zatca.service.ts` لا يزال يحتوي على `getPreviousInvoiceHash()` المُعلّم `@deprecated` كـ fallback
  - **المطلوب:**
    1. حذف `getPreviousInvoiceHash()` بالكامل من `zatca.service.ts`
    2. جعل `previousInvoiceHash` مطلوباً (required) في `GenerateZatcaDataInput`
    3. إضافة runtime check: إذا لم يُمرر `previousInvoiceHash` → رمي خطأ واضح
- **الملفات المتأثرة:**
  - `backend/src/modules/zatca/zatca.service.ts`
  - `backend/src/modules/zatca/dto/zatca-config.dto.ts`
  - `backend/test/unit/zatca/zatca.service.spec.ts`
- **معيار الإتمام:** `getPreviousInvoiceHash()` محذوف، `previousInvoiceHash` required، كل الاختبارات تمر

---

### A-2: MinIO Graceful Degradation
- **الأولوية:** P0 🔴
- **الجهد:** S (2-3 ساعات)
- **الخطر:** عالي — التطبيق يفشل كلياً عند بدء التشغيل إذا لم تكن MinIO credentials موجودة
- **الوصف:**
  - `minio.service.ts` يرمي `throw new Error()` في الـ constructor إذا لم تكن credentials موجودة
  - هذا يمنع التطبيق من البدء حتى في بيئة الاختبار
  - **المطلوب:**
    1. تحويل الـ constructor لـ lazy initialization
    2. إضافة `isAvailable()` method
    3. كل method تتحقق من `isAvailable()` وترمي `ServiceUnavailableException` بدلاً من crash
    4. إضافة health check indicator لحالة MinIO
- **الملفات المتأثرة:**
  - `backend/src/common/services/minio.service.ts`
  - `backend/test/unit/health/minio.health.spec.ts`
- **معيار الإتمام:** التطبيق يبدأ بدون MinIO credentials مع warning في الـ logs

---

### A-3: إغلاق Swagger في Staging
- **الأولوية:** P0 🔴
- **الجهد:** S (1 ساعة)
- **الخطر:** عالي — Swagger مفتوح في staging يكشف كل الـ API endpoints
- **الوصف:**
  - `main.ts` يتحقق فقط من `!isProduction` — أي أن staging يعرض Swagger
  - **المطلوب:**
    1. تغيير الشرط إلى `process.env['ENABLE_SWAGGER'] === 'true'`
    2. إضافة Basic Auth على Swagger endpoint في بيئات غير development
    3. تحديث `.env.example`
- **الملفات المتأثرة:**
  - `backend/src/main.ts`
  - `.env.example`
- **معيار الإتمام:** Swagger لا يظهر في staging بدون `ENABLE_SWAGGER=true`

---

### A-4: إزالة `enableImplicitConversion: true`
- **الأولوية:** P0 🔴
- **الجهد:** M (يوم كامل)
- **الخطر:** عالي — يسبب تحويلات غير متوقعة (string "true" → boolean، string "0" → number)
- **الوصف:**
  - موجود في `main.ts:63` — يؤثر على كل الـ DTOs
  - **المطلوب:**
    1. إزالة `enableImplicitConversion: true` من `main.ts`
    2. مراجعة كل DTO وإضافة `@Type(() => Number)` أو `@Type(() => Boolean)` صريحة
    3. الإبقاء على `enableImplicitConversion` في `env.validation.ts` (آمن — ConfigModule فقط)
    4. تشغيل كل الاختبارات للتأكد
- **الملفات المتأثرة:**
  - `backend/src/main.ts`
  - `backend/src/modules/*/dto/*.dto.ts` (مراجعة شاملة)
- **معيار الإتمام:** `enableImplicitConversion` محذوف من `main.ts`، كل الـ DTOs تستخدم `@Type()` صريحة، كل الاختبارات تمر

---

### A-5: توحيد PaginationMeta المكررة
- **الأولوية:** P0 🟡
- **الجهد:** S (2-3 ساعات)
- **الخطر:** منخفض — تنظيف كود
- **الوصف:**
  - `PaginationMeta` معرّفة في مكانين:
    1. `common/helpers/pagination.helper.ts` — interface
    2. `common/dto/api-response.dto.ts` — class
  - **المطلوب:**
    1. حذف `PaginationMeta` class من `api-response.dto.ts`
    2. تحويل `PaginationMeta` في `pagination.helper.ts` إلى class مع `@ApiProperty` decorators
    3. تحديث كل الاستخدامات
- **الملفات المتأثرة:**
  - `backend/src/common/dto/api-response.dto.ts`
  - `backend/src/common/helpers/pagination.helper.ts`
- **معيار الإتمام:** تعريف واحد فقط لـ `PaginationMeta`

---

## Phase B — رفع Test Coverage (P1) — الأسابيع 2-3

> **الهدف:** رفع coverage من 40%/50% إلى 85%+ عبر كل الكودبيس

---

### B-1: تحليل Coverage الحالي
- **الأولوية:** P1 🟠
- **الجهد:** S (3-4 ساعات)
- **الخطر:** منخفض
- **الوصف:**
  - تشغيل `npm run test:cov` وتحليل التقرير
  - تحديد الملفات التي coverage أقل من 85%
  - ترتيب الأولويات: auth → payments → zatca → bookings → باقي الموديولات
- **الملفات المتأثرة:** لا شيء — تحليل فقط
- **معيار الإتمام:** تقرير مفصل بالملفات التي تحتاج اختبارات إضافية

---

### B-2: اختبارات الموديولات الحرجة (auth, payments, zatca)
- **الأولوية:** P1 🟠
- **الجهد:** L (2-3 أيام)
- **الخطر:** منخفض
- **الوصف:**
  - **Auth Module** — إضافة edge cases:
    - OTP expiry و re-send
    - Token rotation race conditions
    - Multi-device logout
    - Walk-in account auto-claim
    - Email verification flow
  - **Payments Module** — إضافة edge cases:
    - Moyasar webhook signature verification (valid/invalid/replay)
    - Refund edge cases (partial, full, already refunded)
    - Concurrent payment attempts
    - Bank transfer AI verification states
  - **ZATCA Module** — إضافة edge cases:
    - XML signing integrity
    - Hash chaining (first invoice → zero hash)
    - Onboarding flow steps
    - Phase 1 vs Phase 2 routing
- **الملفات المتأثرة:**
  - `backend/test/unit/auth/` — 3-4 ملفات spec جديدة
  - `backend/test/unit/payments/` — 2-3 ملفات spec جديدة
  - `backend/test/unit/zatca/` — 2-3 ملفات spec جديدة
- **معيار الإتمام:** coverage ≥ 90% لكل من auth, payments, zatca

---

### B-3: اختبارات الموديولات المتوسطة (bookings, invoices, chatbot, practitioners)
- **الأولوية:** P1 🟠
- **الجهد:** L (2-3 أيام)
- **الخطر:** منخفض
- **الوصف:**
  - **Bookings** — إضافة edge cases:
    - Recurring bookings (daily/weekly/monthly)
    - Concurrent slot booking (race condition)
    - Cancellation timeout flow
    - Buffer time conflicts
    - Multi-branch booking
  - **Invoices** — إضافة اختبارات:
    - HTML builder output validation
    - Invoice number uniqueness
    - ZATCA data integration
    - Stats calculations
  - **Chatbot** — إضافة اختبارات:
    - Tool execution errors
    - Session limits
    - RAG context building
    - Streaming error handling
  - **Practitioners** — إضافة اختبارات:
    - Availability calculation edge cases
    - Vacation overlap detection
    - Break time conflicts
    - Multi-branch availability
- **الملفات المتأثرة:**
  - `backend/test/unit/bookings/` — 2-3 ملفات spec جديدة
  - `backend/test/unit/invoices/` — 2-3 ملفات spec جديدة
  - `backend/test/unit/chatbot/` — 1-2 ملف spec جديد
  - `backend/test/unit/practitioners/` — 1-2 ملف spec جديد
- **معيار الإتمام:** coverage ≥ 85% لكل هذه الموديولات

---

### B-4: اختبارات الـ Common Layer والموديولات المساندة
- **الأولوية:** P1 🟠
- **الجهد:** M (يوم كامل)
- **الخطر:** منخفض
- **الوصف:**
  - **Common Layer** — إضافة اختبارات لـ:
    - `pagination.helper.ts` — edge cases (page 0, negative limit)
    - `date-filter.helper.ts` — timezone handling
    - `sanitize.helper.ts` — XSS prevention
    - `resilient-fetch.helper.ts` — circuit breaker states
    - `booking-time.helper.ts` — slot calculation edge cases
  - **Notifications** — إضافة اختبارات:
    - FCM token management (invalid tokens cleanup)
    - Notification batching
    - SMS fallback
  - **Tasks Module** — إضافة edge cases:
    - Booking expiry with active payments
    - No-show detection timing
    - Cleanup retention periods
- **الملفات المتأثرة:**
  - `backend/test/unit/common/` — 4-5 ملفات spec جديدة
  - `backend/test/unit/notifications/` — 1 ملف spec جديد
  - `backend/test/unit/tasks/` — تحديث الموجود
- **معيار الإتمام:** coverage ≥ 85% عبر كل الكودبيس

---

### B-5: رفع Coverage Threshold
- **الأولوية:** P1 🟠
- **الجهد:** S (30 دقيقة)
- **الخطر:** منخفض
- **الوصف:**
  - بعد إكمال B-2 إلى B-4، تحديث `package.json`:
    ```json
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 85,
        "lines": 85,
        "statements": 85
      },
      "./src/modules/auth/**": { "branches": 90, "lines": 90 },
      "./src/modules/payments/**": { "branches": 90, "lines": 90 },
      "./src/modules/zatca/**": { "branches": 90, "lines": 90 }
    }
    ```
- **الملفات المتأثرة:**
  - `backend/package.json`
- **معيار الإتمام:** `npm run test:cov` يمر بنجاح مع الـ thresholds الجديدة

---

## Phase C — تفعيل وتكملة E2E Test Suite (P1) — الأسابيع 3-4

> **ملاحظة:** 63 ملف e2e-spec.ts موجودة فعلياً مع بنية تحتية كاملة — المطلوب تفعيلها وتكملتها

---

### C-1: تفعيل E2E Tests في CI
- **الأولوية:** P1 🟠
- **الجهد:** M (يوم كامل)
- **الخطر:** متوسط
- **الوصف:**
  - تشغيل `npm run test:e2e` وتحليل النتائج
  - إصلاح الاختبارات الفاشلة
  - التحقق من أن الـ global-setup ينظف البيانات بشكل صحيح
  - إضافة `test:e2e` إلى `.github/workflows/ci.yml`
  - إضافة test database مستقل في CI
- **الملفات المتأثرة:**
  - `backend/test/e2e/**/*.e2e-spec.ts` — إصلاح الفاشل
  - `.github/workflows/ci.yml` — إضافة e2e step
  - `backend/test/e2e/setup/` — تحديث إذا لزم
- **معيار الإتمام:** كل الـ 63 e2e test تمر، مضافة للـ CI

---

### C-2: تكملة E2E Scenarios الناقصة
- **الأولوية:** P1 🟠
- **الجهد:** L (2-3 أيام)
- **الخطر:** منخفض
- **الوصف:**
  - مقارنة الـ e2e tests الموجودة مع الـ scenarios في `e2e/` (23 ملف markdown)
  - **أولوية التكملة:**
    1. **Bookings state machine** — كل الانتقالات: pending → confirmed → checked_in → in_progress → completed → no_show
    2. **Payment webhook edge cases** — duplicate webhooks, out-of-order delivery, invalid signature
    3. **RBAC cross-module** — receptionist لا يستطيع حذف users، accountant لا يستطيع تعديل bookings
    4. **Concurrent operations** — double booking prevention، double payment prevention
    5. **Cancellation flow** — patient request → admin review → approve/reject
    6. **Waitlist flow** — add to waitlist → slot opens → notification → booking
- **الملفات المتأثرة:**
  - `backend/test/e2e/bookings/` — 2-3 ملفات جديدة
  - `backend/test/e2e/payments/` — 1-2 ملف جديد
  - `backend/test/e2e/rbac/` — 1-2 ملف جديد
- **معيار الإتمام:** تغطية ≥ 90% من الـ scenarios في `e2e/`

---

### C-3: E2E Test Data Factories
- **الأولوية:** P1 🟠
- **الجهد:** S (3-4 ساعات)
- **الخطر:** منخفض
- **الوصف:**
  - إنشاء factory functions لتسهيل إنشاء بيانات الاختبار:
    ```typescript
    // test/e2e/factories/
    createTestUser(role: UserRole): Promise<User>
    createTestPractitioner(options?): Promise<Practitioner>
    createTestBooking(status: BookingStatus): Promise<Booking>
    createTestPayment(method: PaymentMethod): Promise<Payment>
    ```
  - إضافة retry logic للاختبارات الـ flaky
  - تحسين test isolation
- **الملفات المتأثرة:**
  - `backend/test/e2e/factories/` — مجلد جديد
  - `backend/test/jest-e2e.json` — تحسين الإعدادات
- **معيار الإتمام:** E2E suite يعمل بثبات في CI بدون flaky tests

---

## Phase D — إكمال Integrations الناقصة (P2) — الأسابيع 4-6

---

### D-1: Zoom Integration — إزالة Stub Fallback
- **الأولوية:** P2 🟡
- **الجهد:** M (يوم كامل)
- **الخطر:** متوسط
- **الوصف:**
  - الكود الفعلي موجود في `zoom.service.ts` — OAuth token management, create/delete meeting
  - المشكلة: عند عدم وجود credentials يُرجع stub links بدلاً من خطأ واضح
  - **المطلوب:**
    1. تحويل الـ stub fallback إلى `ServiceUnavailableException` واضح
    2. إضافة Zoom health check في `/health` endpoint
    3. إضافة webhook endpoint لـ Zoom meeting events (meeting.ended)
    4. ربط Zoom meeting status بـ booking status (meeting.ended → auto-complete booking)
    5. تحديث Zoom link عند reschedule (المؤجل من Sprint 4.6)
- **الملفات المتأثرة:**
  - `backend/src/modules/integrations/zoom/zoom.service.ts`
  - `backend/src/modules/integrations/zoom/zoom.controller.ts` (جديد)
  - `backend/src/modules/bookings/booking-reschedule.service.ts`
  - `backend/test/unit/integrations/zoom.service.spec.ts`
- **معيار الإتمام:** Zoom integration تعمل مع credentials حقيقية، خطأ واضح بدونها، webhook يستقبل أحداث

---

### D-2: PDF Invoice Generation
- **الأولوية:** P2 🟡
- **الجهد:** L (2-3 أيام)
- **الخطر:** متوسط
- **الوصف:**
  - HTML template موجود وكامل في `invoice-html.builder.ts` (تصميم احترافي RTL مع QR code)
  - `pdfUrl: null` في الـ schema — الحقل موجود لكن لا يُملأ
  - **المطلوب:**
    1. إضافة `puppeteer-core` مع Chromium headless
    2. إنشاء `invoice-pdf.service.ts` يحوّل HTML → PDF
    3. رفع PDF إلى MinIO وتخزين الـ URL في `pdfUrl`
    4. إضافة endpoint `GET /invoices/:id/pdf` لتحميل PDF
    5. إضافة خيار إرسال PDF عبر البريد الإلكتروني
    6. تحديث Dockerfile لإضافة Chromium
- **الملفات المتأثرة:**
  - `backend/src/modules/invoices/invoice-pdf.service.ts` (جديد)
  - `backend/src/modules/invoices/invoices.controller.ts`
  - `backend/src/modules/invoices/invoice-creator.service.ts`
  - `backend/src/modules/invoices/invoices.module.ts`
  - `backend/package.json`
  - `backend/Dockerfile`
- **معيار الإتمام:** `GET /invoices/:id/pdf` يُرجع PDF صالح مع QR code، PDF مخزن في MinIO

---

### D-3: ZATCA Phase 2 Production Flow
- **الأولوية:** P2 🟡
- **الجهد:** XL (أسبوع+)
- **الخطر:** حرج — يتعلق بالامتثال الضريبي السعودي
- **الوصف:**
  - **ما هو موجود:** Onboarding flow، CSR generation، XML builder، API service، BullMQ processor، hash chaining
  - **ما ينقص:**
    1. **Standard Invoice support** — حالياً simplified فقط، يجب إضافة standard invoices (B2B)
    2. **Credit/Debit notes** — مطلوبة لـ refunds
    3. **Production URL switching** — حالياً sandbox فقط
    4. **Retry strategy تحسين** — dead letter queue للفواتير الفاشلة
    5. **اختبار شامل** مع ZATCA sandbox environment
    6. **Dashboard UI** — عرض حالة ZATCA لكل فاتورة بشكل أوضح
- **الملفات المتأثرة:**
  - `backend/src/modules/zatca/services/xml-builder.service.ts`
  - `backend/src/modules/zatca/services/xml-signing.service.ts`
  - `backend/src/modules/zatca/constants/zatca.constants.ts`
  - `backend/src/modules/zatca/dto/`
  - `backend/src/modules/zatca/zatca.controller.ts`
  - `backend/test/unit/zatca/`
- **معيار الإتمام:** Onboarding يعمل مع ZATCA sandbox، فواتير simplified و standard تُرسل وتُقبل، credit notes تعمل

---

## Phase E — الأداء والجودة (P2) — الأسابيع 5-6

---

### E-1: ActivityLog Archiving Strategy
- **الأولوية:** P2 🟡
- **الجهد:** M (يوم كامل)
- **الخطر:** متوسط — unbounded growth يؤثر على أداء الاستعلامات
- **الوصف:**
  - `activity-log` table ينمو بلا حد مع 30 موديول يسجّل أحداث
  - **المطلوب:**
    1. إنشاء migration لـ `activity_log_archive` table
    2. إضافة Cron job في `tasks/cleanup.service.ts` لنقل السجلات الأقدم من 90 يوم
    3. إضافة `ACTIVITY_LOG_RETENTION_DAYS` env variable (default: 90)
    4. إضافة index على `createdAt` للـ archiving query
    5. إضافة endpoint `GET /activity-log/archive` للأدمن
- **الملفات المتأثرة:**
  - `backend/prisma/schema/config.prisma`
  - `backend/src/modules/tasks/cleanup.service.ts`
  - `backend/src/modules/activity-log/activity-log.service.ts`
  - `backend/test/unit/tasks/cleanup.service.spec.ts`
- **معيار الإتمام:** Cron job يعمل يومياً، السجلات القديمة تُنقل للأرشيف، الأداء مستقر

---

### E-2: pgvector HNSW Index
- **الأولوية:** P2 🟡
- **الجهد:** S (2-3 ساعات)
- **الخطر:** متوسط — بدون index، similarity search يعمل بـ sequential scan
- **الوصف:**
  - `KnowledgeBase.embedding` هو `vector(1536)` — Prisma لا يدعم HNSW syntax
  - **المطلوب:**
    1. إنشاء raw SQL migration:
       ```sql
       CREATE INDEX CONCURRENTLY idx_knowledge_base_embedding_hnsw
       ON knowledge_base
       USING hnsw (embedding vector_cosine_ops)
       WITH (m = 16, ef_construction = 64);
       ```
    2. إضافة `SET hnsw.ef_search = 40` في الـ session settings عند البحث
    3. اختبار الأداء قبل وبعد
- **الملفات المتأثرة:**
  - `backend/prisma/migrations/[timestamp]_add_hnsw_index/migration.sql` (جديد)
  - `backend/src/modules/chatbot/chatbot-rag.service.ts`
- **معيار الإتمام:** HNSW index موجود، similarity search يستخدم index scan

---

### E-3: Load Testing — تحديث وتفعيل
- **الأولوية:** P2 🟡
- **الجهد:** M (يوم كامل)
- **الخطر:** منخفض
- **الوصف:**
  - مجلد `performance/k6/` موجود بالفعل مع scenarios
  - **المطلوب:**
    1. تحديث الـ k6 scenarios الموجودة
    2. إضافة scenarios جديدة:
       - Concurrent booking creation (الأكثر أهمية)
       - Payment webhook burst
       - Chatbot concurrent sessions
       - Auth token refresh under load
    3. تحديد baselines:
       - p95 response time < 200ms لـ CRUD
       - p95 response time < 500ms لـ complex queries
       - 0 errors under 100 concurrent users
    4. إضافة k6 run إلى CI (on-demand)
- **الملفات المتأثرة:**
  - `performance/k6/scenarios/` — تحديث وإضافة
  - `performance/k6/config.js`
  - `performance/k6/run-all.sh`
- **معيار الإتمام:** k6 scenarios تعمل، baselines محددة، تقرير أداء أولي

---

### E-4: Code Quality — تنظيف الكود
- **الأولوية:** P2 🟡
- **الجهد:** S (3-4 ساعات)
- **الخطر:** منخفض
- **الوصف:**
  - حذف الملفات المكررة في e2e (ملفات بمسافة في الاسم)
  - مراجعة dead imports و unused exports
  - التأكد من أن كل module يتبع الـ convention المحدد في CLAUDE.md
  - `npm run lint` يجب أن يمر بدون warnings
- **الملفات المتأثرة:** ملفات متفرقة
- **معيار الإتمام:** `npm run lint` يمر بدون warnings، لا ملفات مكررة

---

## Phase F — Production Readiness (P3) — الأسابيع 6-7

---

### F-1: Contract Testing
- **الأولوية:** P3 🟢
- **الجهد:** L (2-3 أيام)
- **الخطر:** منخفض
- **الوصف:**
  - لا يوجد contract testing بين Backend ↔ Dashboard ↔ Mobile
  - **المطلوب:**
    1. استخراج OpenAPI spec من Swagger (`/api/docs-json`)
    2. إنشاء contract tests تتحقق من أن الـ API responses تطابق الـ spec
    3. إضافة breaking change detection في CI
    4. استخدام `openapi-typescript` لتوليد types من الـ spec
- **الملفات المتأثرة:**
  - `backend/test/contract/` (مجلد جديد)
  - `.github/workflows/ci.yml`
- **معيار الإتمام:** Contract tests تكشف أي breaking change في API قبل الـ merge

---

### F-2: WAF Rules و Rate Limiting المتقدم
- **الأولوية:** P3 🟢
- **الجهد:** M (يوم كامل)
- **الخطر:** متوسط
- **الوصف:**
  - Nginx موجود مع security headers ✅
  - **المطلوب:**
    1. إضافة Nginx rate limiting rules:
       - `/api/v1/auth/*` — 10 req/min per IP
       - `/api/v1/payments/moyasar/webhook` — 100 req/min
       - General API — 60 req/min per IP
    2. إضافة IP blacklist/whitelist support
    3. إضافة Fail2Ban integration لـ brute force detection
- **الملفات المتأثرة:**
  - `docker/nginx/nginx.conf`
  - `docker/nginx/waf-rules.conf` (جديد)
- **معيار الإتمام:** Rate limiting يعمل على Nginx level، brute force يُحظر تلقائياً

---

### F-3: PgBouncer Connection Pooling
- **الأولوية:** P3 🟢
- **الجهد:** M (يوم كامل)
- **الخطر:** متوسط — يتطلب تغيير في connection string
- **الوصف:**
  - حالياً Prisma يتصل مباشرة بـ PostgreSQL
  - مع زيادة الحمل، عدد الاتصالات سيتجاوز `max_connections`
  - **المطلوب:**
    1. إضافة PgBouncer إلى `docker-compose.prod.yml`
    2. تكوين PgBouncer بـ transaction pooling mode
    3. تحديث `DATABASE_URL` للإشارة إلى PgBouncer
    4. إضافة PgBouncer health check
- **الملفات المتأثرة:**
  - `docker/docker-compose.prod.yml`
  - `docker/pgbouncer/` (مجلد جديد)
  - `.env.example`
- **معيار الإتمام:** PgBouncer يعمل في Docker، connection pooling فعّال

---

### F-4: Final Security Audit
- **الأولوية:** P3 🟢
- **الجهد:** M (يوم كامل)
- **الخطر:** عالي
- **الوصف:**
  - مراجعة أمنية شاملة نهائية:
    1. `npm audit` + Snyk scan
    2. Secret scanning — التأكد من عدم وجود secrets في الكود
    3. OWASP Top 10 checklist نهائي
    4. Headers audit
    5. CORS audit
    6. Rate limiting audit
    7. File upload validation audit
  - إضافة `npm audit` إلى CI pipeline
- **الملفات المتأثرة:** مراجعة فقط — إصلاح ما يُكتشف
- **معيار الإتمام:** تقرير أمني نهائي بدون P0/P1 findings

---

## الجدول الزمني الكامل

```
الأسبوع 1 — Phase A: Critical Fixes
├── A-1: ZATCA race condition cleanup          [S] ██
├── A-2: MinIO graceful degradation            [S] ██
├── A-3: Swagger staging lockdown              [S] █
├── A-4: Remove enableImplicitConversion       [M] ████
└── A-5: Unify PaginationMeta                  [S] ██

الأسبوع 2 — Phase B: Test Coverage (بداية)
├── B-1: Coverage analysis                     [S] ██
└── B-2: Critical modules tests (auth/pay/zatca) [L] ████████

الأسبوع 3 — Phase B + C: Tests
├── B-3: Medium modules tests                  [L] ████████
├── B-4: Supporting modules tests              [M] ████
├── B-5: Raise thresholds                      [S] █
└── C-1: Activate existing E2E                 [M] ████

الأسبوع 4 — Phase C: E2E Completion
├── C-2: Complete E2E scenarios                [L] ████████
└── C-3: E2E test data factories               [S] ██

الأسبوع 5 — Phase D: Integrations (بداية)
├── D-1: Zoom integration cleanup              [M] ████
├── D-2: PDF Invoice generation                [L] ████████
└── D-3: ZATCA Phase 2 (بداية)               [XL] ████████████

الأسبوع 6 — Phase D + E: Integrations + Performance
├── D-3: ZATCA Phase 2 (تكملة)               [XL] ████████████
├── E-1: ActivityLog archiving                 [M] ████
└── E-2: pgvector HNSW index                   [S] ██

الأسبوع 7 — Phase E + F: Quality + Production
├── E-3: Load testing                          [M] ████
├── E-4: Code cleanup                          [S] ██
├── F-1: Contract testing                      [L] ████████
├── F-2: WAF rules                             [M] ████
├── F-3: PgBouncer                             [M] ████
└── F-4: Security audit                        [M] ████
```

---

## مصفوفة الأولويات

| # | المهمة | الأولوية | الجهد | الخطر | الأسبوع |
|---|--------|----------|-------|-------|---------|
| A-1 | ZATCA race condition | P0 🔴 | S | حرج | 1 |
| A-2 | MinIO graceful degradation | P0 🔴 | S | عالي | 1 |
| A-3 | Swagger staging lockdown | P0 🔴 | S | عالي | 1 |
| A-4 | Remove enableImplicitConversion | P0 🔴 | M | عالي | 1 |
| A-5 | Unify PaginationMeta | P0 🟡 | S | منخفض | 1 |
| B-1 | Coverage analysis | P1 🟠 | S | منخفض | 2 |
| B-2 | Critical modules tests | P1 🟠 | L | منخفض | 2 |
| B-3 | Medium modules tests | P1 🟠 | L | منخفض | 3 |
| B-4 | Supporting modules tests | P1 🟠 | M | منخفض | 3 |
| B-5 | Raise thresholds | P1 🟠 | S | منخفض | 3 |
| C-1 | Activate E2E in CI | P1 🟠 | M | متوسط | 3 |
| C-2 | Complete E2E scenarios | P1 🟠 | L | منخفض | 4 |
| C-3 | E2E test factories | P1 🟠 | S | منخفض | 4 |
| D-1 | Zoom integration | P2 🟡 | M | متوسط | 5 |
| D-2 | PDF Invoice generation | P2 🟡 | L | متوسط | 5 |
| D-3 | ZATCA Phase 2 | P2 🟡 | XL | حرج | 5-6 |
| E-1 | ActivityLog archiving | P2 🟡 | M | متوسط | 6 |
| E-2 | pgvector HNSW index | P2 🟡 | S | متوسط | 6 |
| E-3 | Load testing | P2 🟡 | M | منخفض | 7 |
| E-4 | Code cleanup | P2 🟡 | S | منخفض | 7 |
| F-1 | Contract testing | P3 🟢 | L | منخفض | 7 |
| F-2 | WAF rules | P3 🟢 | M | متوسط | 7 |
| F-3 | PgBouncer | P3 🟢 | M | متوسط | 7 |
| F-4 | Security audit | P3 🟢 | M | عالي | 7 |

---

## استراتيجية الاختبار الكاملة

| المستوى | الأداة | الهدف | الحالي | المطلوب |
|---------|--------|-------|--------|---------|
| Unit | Jest + ts-jest | 85% coverage | 111 test, ~50% | 200+ test, 85%+ |
| E2E | Jest + Supertest | كل الـ API endpoints | 63 test (غير مُفعّل) | 80+ test, مُفعّل في CI |
| Load | k6 | Performance baselines | موجود (غير مُحدّث) | مُحدّث مع thresholds |
| Contract | OpenAPI-based | API compatibility | غير موجود | مُفعّل في CI |
| Security | npm audit + manual | Zero P0/P1 | Sprint 4.7 ✅ | تحديث نهائي |

---

## القيود — ما يجب عدم تغييره

> ⚠️ هذه العناصر تعمل بشكل ممتاز — لا تُعدّل إلا إذا كان هناك سبب قوي

1. **Prisma migrations الموجودة** — immutable، لا تُعدّل أبداً
2. **Auth flow** — JWT + refresh token rotation يعمل بشكل ممتاز
3. **CASL RBAC** — النظام مُحكم ومُختبر
4. **Circuit breakers** — موجودة على كل external APIs
5. **Redis caching** — auth + permissions caching يعمل
6. **Prometheus + Sentry** — monitoring stack كامل
7. **Docker production setup** — مُحسّن ومُختبر
8. **الـ 111 unit test الموجودة** — لا تُحذف، فقط تُضاف عليها
9. **الـ 63 e2e test الموجودة** — لا تُحذف، فقط تُفعّل وتُكمّل

---

## معايير الإتمام النهائية

عند إكمال كل المراحل، يجب أن يكون:

- [ ] `npm run test` يمر بـ 200+ test و 85%+ coverage
- [ ] `npm run test:e2e` يمر بـ 80+ test في CI
- [ ] `npm run lint` يمر بدون warnings
- [ ] `npm run build` يمر بدون errors
- [ ] k6 load test يمر بـ p95 < 200ms تحت 100 concurrent users
- [ ] Contract tests تكشف breaking changes
- [ ] ZATCA Phase 2 يعمل مع sandbox
- [ ] PDF invoices تُولّد وتُرسل
- [ ] Zoom integration تعمل مع credentials حقيقية
- [ ] ActivityLog archiving يعمل يومياً
- [ ] pgvector HNSW index موجود
- [ ] Swagger مُغلق في staging
- [ ] MinIO graceful degradation يعمل
- [ ] Security audit نهائي بدون P0/P1 findings

---

*CareKit Backend Improvement Plan — WebVue Technology Solutions — 2026-04-01*
