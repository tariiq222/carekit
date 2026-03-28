# Services Module — Full Coverage Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** اختبار وإغلاق وحدة الخدمات 100% — unit tests + E2E شاملة لكل السيناريوهات + اختبار بصري للداشبورد.

**Architecture:** الـ E2E الأساسية موجودة بالفعل (1018 سطر). ناقص: سيناريوهات booking settings المتقدمة (deposit, recurring, buffer, capacity) + duration options + booking types. الاختبار البصري عبر Playwright يغطي الفورم في الداشبورد.

**Tech Stack:** NestJS 11, Jest + Supertest (E2E), Prisma (PostgreSQL), Next.js 15 (Dashboard), Playwright (visual)

---

## Task 1: تشغيل Unit Tests الموجودة والتأكد من نجاحها

**Files:**
- Test: `backend/test/unit/services/services.service.spec.ts`

- [ ] **Step 1: تشغيل unit tests**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="services" --verbose
```

Expected: جميع الـ tests تنجح. إذا فشل أي test، سجّل الخطأ وأصلحه قبل المتابعة.

- [ ] **Step 2: تحقق من التغطية**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test:cov -- --testPathPattern="services"
```

Expected: branches ≥ 40%, functions/lines ≥ 50%

---

## Task 2: تشغيل E2E Tests الموجودة

**Files:**
- Test: `backend/test/e2e/services/services.e2e-spec.ts`

**المتطلبات:** Docker يجب أن يكون شغّالاً (postgres + redis)

- [ ] **Step 1: تأكد من تشغيل Docker**

```bash
cd /Users/tariq/Documents/my_programs/CareKit
npm run docker:up
sleep 5
```

Expected: حاويات `carekit-postgres` و `carekit-redis` تعمل.

- [ ] **Step 2: تطبيق الـ migrations**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run prisma:migrate
```

Expected: `All migrations have been successfully applied.` أو رسالة تشير لعدم وجود migrations معلّقة.

- [ ] **Step 3: تشغيل E2E لوحدة الخدمات فقط**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test:e2e -- --testPathPattern="services" --verbose
```

Expected: جميع الـ tests تنجح. إذا فشل أي test، سجّل الخطأ بدقة.

---

## Task 3: إضافة E2E لسيناريو Booking Settings المتقدمة

**Files:**
- Modify: `backend/test/e2e/services/services.e2e-spec.ts`

الملف الحالي يصل 1018 سطر — يجب الإضافة بعناية بحيث لا يتجاوز 1200 سطر. إذا تجاوز، انقله إلى `services-advanced.e2e-spec.ts`.

- [ ] **Step 1: أضف describe block لـ Advanced Service Creation Scenarios**

أضف هذا الكود قبل السطر الأخير من الملف (قبل `});` الأخير):

```typescript
  // ═══════════════════════════════════════════════════════════════
  //  ADVANCED SERVICE CREATION SCENARIOS
  // ═══════════════════════════════════════════════════════════════

  describe('POST /services — Advanced Scenarios', () => {
    // Scenario 3: Service with deposit
    it('should create service with deposit required (50%)', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Premium Therapy',
          nameAr: 'العلاج المميز',
          categoryId,
          price: 50000,
          duration: 60,
          depositEnabled: true,
          depositPercent: 50,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('depositEnabled', true);
      expect(res.body.data).toHaveProperty('depositPercent', 50);
    });

    // Scenario 4: Service with restricted recurring patterns
    it('should create service with restricted recurring patterns', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Weekly Wellness',
          nameAr: 'العافية الأسبوعية',
          categoryId,
          price: 20000,
          duration: 45,
          allowRecurring: true,
          allowedRecurringPatterns: ['weekly', 'biweekly'],
          maxRecurrences: 24,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('allowRecurring', true);
      expect(res.body.data).toHaveProperty('maxRecurrences', 24);
      expect(res.body.data.allowedRecurringPatterns).toEqual(
        expect.arrayContaining(['weekly', 'biweekly']),
      );
    });

    // Scenario 5: Hidden service (admin-only)
    it('should create hidden service (isHidden: true)', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Internal Assessment',
          nameAr: 'التقييم الداخلي',
          categoryId,
          isHidden: true,
          hidePriceOnBooking: true,
          hideDurationOnBooking: true,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('isHidden', true);
      expect(res.body.data).toHaveProperty('hidePriceOnBooking', true);
      expect(res.body.data).toHaveProperty('hideDurationOnBooking', true);
    });

    // Scenario 6: Group service with max participants
    it('should create group service with maxParticipants: 10', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Group Workshop',
          nameAr: 'ورشة عمل جماعية',
          categoryId,
          price: 30000,
          duration: 90,
          maxParticipants: 10,
          minLeadMinutes: 1440,
          maxAdvanceDays: 30,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('maxParticipants', 10);
      expect(res.body.data).toHaveProperty('minLeadMinutes', 1440);
      expect(res.body.data).toHaveProperty('maxAdvanceDays', 30);
    });

    // Scenario 7: Service with custom buffer
    it('should create service with custom buffer (60 minutes)', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Extended Consultation',
          nameAr: 'استشارة مطولة',
          categoryId,
          price: 80000,
          duration: 120,
          bufferMinutes: 60,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('bufferMinutes', 60);
    });

    // Scenario 8: Inactive service
    it('should create inactive service (isActive: false)', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Seasonal Service',
          nameAr: 'الخدمة الموسمية',
          categoryId,
          isActive: false,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('isActive', false);
    });

    // Scenario 9: Service with calendar color
    it('should create service with calendar color', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Priority Treatment',
          nameAr: 'العلاج الأولوي',
          categoryId,
          price: 100000,
          calendarColor: '#FF1744',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('calendarColor', '#FF1744');
    });

    // Scenario 10: Full complex service
    it('should create fully configured service (all fields)', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Premium Surgical Consultation',
          nameAr: 'استشارة جراحية متقدمة',
          descriptionEn: 'Comprehensive surgical assessment',
          descriptionAr: 'تقييم جراحي شامل',
          categoryId,
          price: 100000,
          duration: 60,
          isActive: true,
          isHidden: false,
          bufferMinutes: 30,
          depositEnabled: true,
          depositPercent: 25,
          allowRecurring: true,
          allowedRecurringPatterns: ['weekly', 'monthly'],
          maxRecurrences: 12,
          maxParticipants: 1,
          minLeadMinutes: 1440,
          maxAdvanceDays: 60,
          calendarColor: '#4CAF50',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      const d = res.body.data;
      expect(d.price).toBe(100000);
      expect(d.duration).toBe(60);
      expect(d.bufferMinutes).toBe(30);
      expect(d.depositEnabled).toBe(true);
      expect(d.depositPercent).toBe(25);
      expect(d.allowRecurring).toBe(true);
      expect(d.maxRecurrences).toBe(12);
      expect(d.maxParticipants).toBe(1);
      expect(d.minLeadMinutes).toBe(1440);
      expect(d.maxAdvanceDays).toBe(60);
      expect(d.calendarColor).toBe('#4CAF50');
    });

    // Validation: invalid recurring pattern
    it('should reject invalid recurring pattern value', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Invalid Pattern Service',
          nameAr: 'خدمة نمط غير صالح',
          categoryId,
          allowedRecurringPatterns: ['yearly'], // invalid
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    // Validation: deposit percent without depositEnabled
    it('should reject depositPercent > 100', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Over Deposit Service',
          nameAr: 'خدمة عربون زائد',
          categoryId,
          depositEnabled: true,
          depositPercent: 101,
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    // Validation: bufferMinutes > 120
    it('should reject bufferMinutes > 120', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Big Buffer Service',
          nameAr: 'خدمة وقت تنظيف طويل',
          categoryId,
          bufferMinutes: 121,
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    // Validation: invalid calendar color format
    it('should reject invalid calendarColor format', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Bad Color Service',
          nameAr: 'خدمة لون خاطئ',
          categoryId,
          calendarColor: 'notacolor',
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    // Validation: maxParticipants > 100
    it('should reject maxParticipants > 100', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Too Many Participants',
          nameAr: 'خدمة مشاركون كثيرون',
          categoryId,
          maxParticipants: 101,
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    // Free service (price: 0)
    it('should create free service (price: 0)', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Free Consultation',
          nameAr: 'استشارة مجانية',
          categoryId,
          price: 0,
          duration: 20,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('price', 0);
    });
  });
```

- [ ] **Step 2: تشغيل الـ tests الجديدة**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test:e2e -- --testPathPattern="services" --verbose
```

Expected: جميع الـ tests تنجح بما فيها السيناريوهات الجديدة.

- [ ] **Step 3: Commit**

```bash
cd /Users/tariq/Documents/my_programs/CareKit
git add backend/test/e2e/services/services.e2e-spec.ts
git commit -m "test(services): add e2e coverage for all 10 advanced creation scenarios"
```

---

## Task 4: إضافة E2E لـ Duration Options و Booking Types

**Files:**
- Create: `backend/test/e2e/services/services-extensions.e2e-spec.ts`

- [ ] **Step 1: أنشئ الملف**

```typescript
/**
 * CareKit — Services Extensions E2E Tests
 * Duration Options (PUT/GET /services/:id/duration-options)
 * Booking Types (PUT/GET /services/:id/booking-types)
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  createTestUserWithRole,
  getAuthHeaders,
  expectSuccessResponse,
  expectErrorResponse,
  TEST_USERS,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const SERVICES_URL = `${API_PREFIX}/services`;
const CATEGORIES_URL = `${SERVICES_URL}/categories`;

describe('Services Extensions (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let patient: AuthResult;

  let categoryId: string;
  let serviceId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );

    receptionist = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.receptionist,
      'receptionist',
    );

    // Register patient
    const patientRes = await request(httpServer)
      .post(`${API_PREFIX}/auth/register`)
      .send({
        firstName: 'أحمد',
        lastName: 'الراشد',
        phone: '+966501000005',
        email: 'patient@carekit-test.com',
        password: 'P@tientP@ss1',
        gender: 'male',
      });

    const token =
      patientRes.status === 201
        ? patientRes.body.data.accessToken
        : (
            await request(httpServer)
              .post(`${API_PREFIX}/auth/login`)
              .send({ email: 'patient@carekit-test.com', password: 'P@tientP@ss1' })
          ).body.data.accessToken;

    patient = { accessToken: token } as AuthResult;

    // Create category
    const catRes = await request(httpServer)
      .post(CATEGORIES_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ nameEn: 'Extensions Test Category', nameAr: 'فئة اختبار الامتدادات' })
      .expect(201);

    categoryId = catRes.body.data.id as string;

    // Create service
    const svcRes = await request(httpServer)
      .post(SERVICES_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        nameEn: 'Extensions Test Service',
        nameAr: 'خدمة اختبار الامتدادات',
        categoryId,
        price: 20000,
        duration: 30,
      })
      .expect(201);

    serviceId = svcRes.body.data.id as string;
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ─────────────────────────────────────────────────────────────
  // Duration Options
  // ─────────────────────────────────────────────────────────────

  describe('PUT /services/:id/duration-options', () => {
    const validOptions = {
      options: [
        { label: '30 min', labelAr: '٣٠ دقيقة', durationMinutes: 30, price: 15000, isDefault: true },
        { label: '60 min', labelAr: '٦٠ دقيقة', durationMinutes: 60, price: 25000, isDefault: false },
      ],
    };

    it('should set duration options as super_admin', async () => {
      const res = await request(httpServer)
        .put(`${SERVICES_URL}/${serviceId}/duration-options`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(validOptions)
        .expect(200);

      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('durationMinutes', 30);
      expect(res.body.data[0]).toHaveProperty('price', 15000);
      expect(res.body.data[0]).toHaveProperty('isDefault', true);
    });

    it('should set duration options as receptionist (has services:edit)', async () => {
      const res = await request(httpServer)
        .put(`${SERVICES_URL}/${serviceId}/duration-options`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send(validOptions)
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should reject setting duration options by patient (403)', async () => {
      const res = await request(httpServer)
        .put(`${SERVICES_URL}/${serviceId}/duration-options`)
        .set(getAuthHeaders(patient.accessToken))
        .send(validOptions)
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject without authentication (401)', async () => {
      const res = await request(httpServer)
        .put(`${SERVICES_URL}/${serviceId}/duration-options`)
        .send(validOptions)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 404 for non-existent service', async () => {
      const res = await request(httpServer)
        .put(`${SERVICES_URL}/00000000-0000-0000-0000-000000000000/duration-options`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(validOptions)
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should replace options on second call (idempotent replace)', async () => {
      await request(httpServer)
        .put(`${SERVICES_URL}/${serviceId}/duration-options`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ options: [{ label: '45 min', labelAr: '٤٥ دقيقة', durationMinutes: 45, price: 18000, isDefault: true }] })
        .expect(200);

      const res = await request(httpServer)
        .get(`${SERVICES_URL}/${serviceId}/duration-options`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty('durationMinutes', 45);
    });
  });

  describe('GET /services/:id/duration-options', () => {
    it('should return duration options for a service', async () => {
      const res = await request(httpServer)
        .get(`${SERVICES_URL}/${serviceId}/duration-options`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 404 for non-existent service', async () => {
      const res = await request(httpServer)
        .get(`${SERVICES_URL}/00000000-0000-0000-0000-000000000000/duration-options`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Booking Types
  // ─────────────────────────────────────────────────────────────

  describe('PUT /services/:id/booking-types', () => {
    const validBookingTypes = {
      types: [
        {
          bookingType: 'in_person',
          price: 15000,
          duration: 30,
          isActive: true,
        },
        {
          bookingType: 'online',
          price: 10000,
          duration: 30,
          isActive: true,
        },
      ],
    };

    it('should set booking types as super_admin', async () => {
      const res = await request(httpServer)
        .put(`${SERVICES_URL}/${serviceId}/booking-types`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(validBookingTypes)
        .expect(200);

      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(2);

      const inPerson = (res.body.data as Array<{ bookingType: string; price: number }>).find(
        (t) => t.bookingType === 'in_person',
      );
      expect(inPerson).toBeDefined();
      expect(inPerson!.price).toBe(15000);
    });

    it('should set booking types as receptionist (has services:edit)', async () => {
      const res = await request(httpServer)
        .put(`${SERVICES_URL}/${serviceId}/booking-types`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send(validBookingTypes)
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should reject by patient (403)', async () => {
      const res = await request(httpServer)
        .put(`${SERVICES_URL}/${serviceId}/booking-types`)
        .set(getAuthHeaders(patient.accessToken))
        .send(validBookingTypes)
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject without authentication (401)', async () => {
      const res = await request(httpServer)
        .put(`${SERVICES_URL}/${serviceId}/booking-types`)
        .send(validBookingTypes)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject invalid bookingType enum value', async () => {
      const res = await request(httpServer)
        .put(`${SERVICES_URL}/${serviceId}/booking-types`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          types: [{ bookingType: 'home_visit', price: 10000, duration: 30, isActive: true }],
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 404 for non-existent service', async () => {
      const res = await request(httpServer)
        .put(`${SERVICES_URL}/00000000-0000-0000-0000-000000000000/booking-types`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(validBookingTypes)
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should replace booking types on second call (idempotent replace)', async () => {
      await request(httpServer)
        .put(`${SERVICES_URL}/${serviceId}/booking-types`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ types: [{ bookingType: 'in_person', price: 20000, duration: 45, isActive: true }] })
        .expect(200);

      const res = await request(httpServer)
        .get(`${SERVICES_URL}/${serviceId}/booking-types`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty('bookingType', 'in_person');
      expect(res.body.data[0]).toHaveProperty('price', 20000);
    });
  });

  describe('GET /services/:id/booking-types', () => {
    it('should return booking types for a service', async () => {
      const res = await request(httpServer)
        .get(`${SERVICES_URL}/${serviceId}/booking-types`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 404 for non-existent service', async () => {
      const res = await request(httpServer)
        .get(`${SERVICES_URL}/00000000-0000-0000-0000-000000000000/booking-types`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });
  });
});
```

- [ ] **Step 2: تشغيل الـ tests الجديدة**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test:e2e -- --testPathPattern="services-extensions" --verbose
```

Expected: جميع الـ tests تنجح.

- [ ] **Step 3: Commit**

```bash
cd /Users/tariq/Documents/my_programs/CareKit
git add backend/test/e2e/services/services-extensions.e2e-spec.ts
git commit -m "test(services): add e2e for duration options and booking types endpoints"
```

---

## Task 5: تشغيل كل E2E الخدمات معاً (Full Suite)

- [ ] **Step 1: تشغيل كامل لملفَّي E2E**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test:e2e -- --testPathPattern="services" --verbose
```

Expected: جميع الـ tests في `services.e2e-spec.ts` و `services-extensions.e2e-spec.ts` تنجح.

- [ ] **Step 2: إذا نجح كل شيء — تشغيل E2E الكاملة للتحقق من عدم التعارض**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test:e2e
```

Expected: جميع الـ test suites تنجح.

---

## Task 6: الاختبار البصري للداشبورد

**Files:**
- Test: `dashboard/e2e/services/service-creation.spec.ts` (جديد)

**المتطلبات:** الباك شغّال على `:5000` والداشبورد على `:5001`

- [ ] **Step 1: تأكد من تشغيل الـ servers**

```bash
# Terminal 1
cd /Users/tariq/Documents/my_programs/CareKit
npm run dev:backend

# Terminal 2
cd /Users/tariq/Documents/my_programs/CareKit
npm run dev:dashboard
```

- [ ] **Step 2: افتح الداشبورد في المتصفح وسجّل دخول**

```
URL: http://localhost:5001
Email: admin@carekit-test.com
Password: Adm!nP@ss123
```

- [ ] **Step 3: اختبار يدوي — السيناريو الأساسي**

انتقل إلى: `http://localhost:5001/services/create`

تحقق من:
- [ ] تُحمَّل الصفحة بدون أخطاء
- [ ] تظهر التبويبات الأربعة: Basic / Pricing / Booking / Intake
- [ ] يمكن اختيار فئة من القائمة المنسدلة
- [ ] يمكن إدخال الاسم بالعربية والإنجليزية
- [ ] زر الحفظ يعمل ويُعيد توجيه إلى `/services`

- [ ] **Step 4: اختبار سيناريو الإيداع**

على تبويب Booking:
- [ ] فعّل خيار "العربون"
- [ ] تظهر نسبة العربون
- [ ] غيّر النسبة لـ 50%
- [ ] احفظ وتحقق من النجاح

- [ ] **Step 5: اختبار سيناريو الخدمة المخفية**

على تبويب Basic:
- [ ] فعّل خيار "إخفاء الخدمة عن المرضى" (isHidden)
- [ ] تحقق من أن تفعيل hidePriceOnBooking و hideDurationOnBooking يعمل
- [ ] احفظ وتحقق من النجاح

- [ ] **Step 6: اختبار سيناريو التكرار**

على تبويب Booking:
- [ ] فعّل الحجز المتكرر
- [ ] اختر "أسبوعي" و "كل أسبوعين"
- [ ] حدد 24 كحد أقصى للتكرار
- [ ] احفظ وتحقق من النجاح

- [ ] **Step 7: اختبار validation في الداشبورد**

أرسل الفورم بدون اسم:
- [ ] تظهر رسالة خطأ للحقول المطلوبة

- [ ] **Step 8: Commit إذا أُضيف كود**

```bash
cd /Users/tariq/Documents/my_programs/CareKit
git add dashboard/
git commit -m "test(dashboard): verify service creation form visual scenarios"
```

---

## ملاحظة: معيار الإغلاق الكامل

الخدمات تُعتبر مغلقة 100% عند:
- [ ] جميع unit tests تنجح (`npm run test -- --testPathPattern="services"`)
- [ ] جميع E2E الأساسية تنجح (1018 سطر موجودة)
- [ ] جميع E2E السيناريوهات المتقدمة تنجح (Task 3)
- [ ] E2E لـ duration options و booking types تنجح (Task 4)
- [ ] الاختبار البصري للداشبورد نجح لكل السيناريوهات (Task 6)
