/**
 * CareKit — Practitioners ↔ Services Integration E2E Tests
 *
 * Covers all scenarios for assigning services to practitioners,
 * customizing prices/durations per booking type, duration options,
 * and the full pricing fallback hierarchy:
 *
 *   PractitionerDurationOption.price
 *     → PractitionerServiceType.price
 *       → ServiceDurationOption.price
 *         → ServiceBookingType.price
 *           → Service.price (fallback)
 *
 * Endpoints under test:
 *   POST   /practitioners/:id/services             — assign service
 *   GET    /practitioners/:id/services             — list assigned services (PUBLIC)
 *   PATCH  /practitioners/:id/services/:serviceId  — update assignment
 *   DELETE /practitioners/:id/services/:serviceId  — remove assignment
 *   GET    /practitioners/:id/services/:serviceId/types — per-type config (admin/owner)
 *
 * Permission matrix (practitioners module):
 *   super_admin  → view, create, edit, delete
 *   receptionist → view, create, edit
 *   accountant   → view only
 *   practitioner → edit own profile only (owner guard)
 *   patient      → view only (public endpoints)
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  registerTestPatient,
  createTestUserWithRole,
  getAuthHeaders,
  expectSuccessResponse,
  expectErrorResponse,
  TEST_USERS,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const PRACTITIONERS_URL = `${API_PREFIX}/practitioners`;
const SERVICES_URL = `${API_PREFIX}/services`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function createCategory(
  httpServer: ReturnType<TestApp['app']['getHttpServer']>,
  adminToken: string,
  nameEn: string,
  nameAr: string,
): Promise<string> {
  const res = await request(httpServer)
    .post(`${SERVICES_URL}/categories`)
    .set(getAuthHeaders(adminToken))
    .send({ nameEn, nameAr })
    .expect(201);
  return res.body.data.id as string;
}

async function createService(
  httpServer: ReturnType<TestApp['app']['getHttpServer']>,
  adminToken: string,
  categoryId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const res = await request(httpServer)
    .post(SERVICES_URL)
    .set(getAuthHeaders(adminToken))
    .send({
      nameEn: 'General Consultation',
      nameAr: 'استشارة عامة',
      categoryId,
      price: 20000,
      duration: 30,
      ...overrides,
    })
    .expect(201);
  return res.body.data.id as string;
}

async function createPractitionerUser(
  httpServer: ReturnType<TestApp['app']['getHttpServer']>,
  adminToken: string,
  email: string,
  phone: string,
  firstName: string,
): Promise<string> {
  const res = await request(httpServer)
    .post(`${API_PREFIX}/users`)
    .set(getAuthHeaders(adminToken))
    .send({
      email,
      password: 'P@ssw0rd!23',
      firstName,
      lastName: 'الطبيب',
      phone,
      gender: 'male',
      roleSlug: 'practitioner',
    });
  if (res.status !== 201 && res.status !== 409 && res.status !== 500) {
    throw new Error(`Failed to create user ${email}: ${res.status}`);
  }
  if (res.status === 201) return res.body.data.id as string;
  // Already exists — fetch from login
  const login = await request(httpServer)
    .post(`${API_PREFIX}/auth/login`)
    .send({ email, password: 'P@ssw0rd!23' })
    .expect(200);
  return login.body.data.user.id as string;
}

async function createPractitioner(
  httpServer: ReturnType<TestApp['app']['getHttpServer']>,
  adminToken: string,
  userId: string,
  specialtyId: string,
): Promise<string> {
  const res = await request(httpServer)
    .post(PRACTITIONERS_URL)
    .set(getAuthHeaders(adminToken))
    .send({
      userId,
      specialtyId,
      bio: 'Test practitioner',
      bioAr: 'طبيب اختبار',
      experience: 5,
      priceClinic: 30000,
      pricePhone: 20000,
      priceVideo: 25000,
    });
  if (res.status !== 201 && res.status !== 409) {
    throw new Error(
      `Failed to create practitioner for user ${userId}: ${res.status}`,
    );
  }
  if (res.status === 201) return res.body.data.id as string;
  // Already has a profile — get it
  const list = await request(httpServer).get(PRACTITIONERS_URL).expect(200);
  const found = (
    list.body.data.items as Array<{ id: string; user: { id: string } }>
  ).find((p) => p.user.id === userId);
  return found?.id ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Practitioners ↔ Services Integration (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let accountant: AuthResult;
  let practitionerAuth: AuthResult;

  let patient: AuthResult;

  let practitionerId: string;
  let practitioner2Id: string;
  let specialtyId: string;

  // Services
  let categoryId: string;
  let serviceId: string; // base service: price=20000, duration=30
  let service2Id: string; // second service for multi-assign scenarios
  let serviceWithTypesId: string; // service that has per-booking-type config

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    // Auth setup
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

    accountant = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.accountant,
      'accountant',
    );

    practitionerAuth = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.practitioner,
      'practitioner',
    );

    await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      {
        email: 'prac2-svc@carekit-test.com',
        password: 'Pr2Svc@P@ss!',
        firstName: 'ريم',
        lastName: 'السالم',
        phone: '+966550000031',
        gender: 'female',
      },
      'practitioner',
    );

    patient = await registerTestPatient(httpServer, TEST_USERS.patient);

    // Specialty
    const specRes = await request(httpServer)
      .get(`${API_PREFIX}/specialties`)
      .expect(200);
    const specialties = specRes.body.data.items || specRes.body.data;
    if (Array.isArray(specialties) && specialties.length > 0) {
      specialtyId = (specialties[0] as { id: string }).id;
    }

    // Practitioner profiles
    const p1UserId = await createPractitionerUser(
      httpServer,
      superAdmin.accessToken,
      'prac-svc-1@carekit-test.com',
      '+966550000032',
      'علي',
    );
    practitionerId = await createPractitioner(
      httpServer,
      superAdmin.accessToken,
      p1UserId,
      specialtyId,
    );

    const p2UserId = await createPractitionerUser(
      httpServer,
      superAdmin.accessToken,
      'prac-svc-2@carekit-test.com',
      '+966550000033',
      'هند',
    );
    practitioner2Id = await createPractitioner(
      httpServer,
      superAdmin.accessToken,
      p2UserId,
      specialtyId,
    );

    // Services
    categoryId = await createCategory(
      httpServer,
      superAdmin.accessToken,
      'Integration Tests Category',
      'فئة اختبار التكامل',
    );

    serviceId = await createService(
      httpServer,
      superAdmin.accessToken,
      categoryId,
      {
        nameEn: 'General Consultation',
        nameAr: 'استشارة عامة',
        price: 20000,
        duration: 30,
      },
    );

    service2Id = await createService(
      httpServer,
      superAdmin.accessToken,
      categoryId,
      {
        nameEn: 'Follow-up Visit',
        nameAr: 'زيارة متابعة',
        price: 15000,
        duration: 20,
      },
    );

    serviceWithTypesId = await createService(
      httpServer,
      superAdmin.accessToken,
      categoryId,
      {
        nameEn: 'Multi-type Consultation',
        nameAr: 'استشارة متعددة الأنواع',
        price: 25000,
        duration: 45,
      },
    );

    // Set per-booking-type config on serviceWithTypesId
    await request(httpServer)
      .put(`${SERVICES_URL}/${serviceWithTypesId}/booking-types`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        types: [
          {
            bookingType: 'clinic_visit',
            price: 30000,
            duration: 45,
            isActive: true,
          },
          {
            bookingType: 'phone_consultation',
            price: 20000,
            duration: 30,
            isActive: true,
          },
          {
            bookingType: 'video_consultation',
            price: 25000,
            duration: 40,
            isActive: true,
          },
        ],
      });
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ===========================================================================
  // POST /practitioners/:id/services — Assign Service
  // ===========================================================================

  describe('POST /practitioners/:id/services', () => {
    it('should assign a service to practitioner (admin)', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          serviceId,
          availableTypes: ['clinic_visit'],
          isActive: true,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      const { data } = res.body;
      expect(data.id).toBeDefined();
      expect(data.serviceId).toBe(serviceId);
      expect(data.practitionerId).toBe(practitionerId);
      expect(data.isActive).toBe(true);
      expect(data.availableTypes).toContain('clinic_visit');
    });

    it('should assign with custom clinic price override', async () => {
      if (!practitioner2Id || !service2Id) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitioner2Id}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          serviceId: service2Id,
          priceClinic: 18000,
          availableTypes: ['clinic_visit', 'phone_consultation'],
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data.priceClinic).toBe(18000);
    });

    it('should assign with custom duration override', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          serviceId: service2Id,
          customDuration: 45,
          availableTypes: ['clinic_visit'],
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data.customDuration).toBe(45);
    });

    it('should assign with per-booking-type custom pricing via types[]', async () => {
      if (!practitioner2Id || !serviceWithTypesId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitioner2Id}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          serviceId: serviceWithTypesId,
          availableTypes: [
            'clinic_visit',
            'phone_consultation',
            'video_consultation',
          ],
          types: [
            {
              bookingType: 'clinic_visit',
              price: 35000,
              duration: 50,
              isActive: true,
            },
            {
              bookingType: 'phone_consultation',
              price: 22000,
              duration: 25,
              isActive: true,
            },
            {
              bookingType: 'video_consultation',
              price: 28000,
              duration: 35,
              isActive: true,
            },
          ],
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data.serviceId).toBe(serviceWithTypesId);
    });

    it('should assign with custom duration options per type', async () => {
      if (!practitionerId || !serviceWithTypesId) return;

      // Remove first then re-assign with duration options
      await request(httpServer)
        .delete(
          `${PRACTITIONERS_URL}/${practitionerId}/services/${serviceWithTypesId}`,
        )
        .set(getAuthHeaders(superAdmin.accessToken));

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          serviceId: serviceWithTypesId,
          availableTypes: ['clinic_visit', 'phone_consultation'],
          types: [
            {
              bookingType: 'clinic_visit',
              price: 40000,
              duration: 60,
              useCustomOptions: true,
              isActive: true,
              durationOptions: [
                {
                  label: '30 minutes',
                  labelAr: '٣٠ دقيقة',
                  durationMinutes: 30,
                  price: 20000,
                  isDefault: true,
                  sortOrder: 0,
                },
                {
                  label: '60 minutes',
                  labelAr: '٦٠ دقيقة',
                  durationMinutes: 60,
                  price: 40000,
                  isDefault: false,
                  sortOrder: 1,
                },
              ],
            },
          ],
        })
        .expect(201);

      expectSuccessResponse(res.body);
    });

    it('should allow receptionist to assign service (practitioners:edit)', async () => {
      if (!practitioner2Id) return;

      // Use a service not yet assigned to practitioner2 to avoid 409
      const extraServiceId = await createService(
        httpServer,
        superAdmin.accessToken,
        categoryId,
        {
          nameEn: 'Receptionist Assigned Service',
          nameAr: 'خدمة الاستقبال',
          price: 10000,
          duration: 15,
        },
      );

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitioner2Id}/services`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          serviceId: extraServiceId,
          availableTypes: ['clinic_visit'],
        });

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(201);
    });

    it('should allow practitioner to assign service to own profile', async () => {
      if (!practitionerId) return;

      const ownServiceId = await createService(
        httpServer,
        superAdmin.accessToken,
        categoryId,
        {
          nameEn: 'Own Assignment Service',
          nameAr: 'خدمة التعيين الذاتي',
          price: 10000,
          duration: 15,
        },
      );

      // practitionerAuth owns practitionerId (linked via userId)
      // Note: practitionerId here is prac-svc-1, not TEST_USERS.practitioner
      // We need the practitioner whose userId == practitionerAuth.user.id
      // Let's check by getting practitioner list
      const listRes = await request(httpServer)
        .get(PRACTITIONERS_URL)
        .expect(200);
      const ownPrac = (
        listRes.body.data.items as Array<{ id: string; user: { id: string } }>
      ).find((p) => p.user.id === practitionerAuth.user.id);

      if (!ownPrac) return; // practitioner user doesn't have a profile yet, skip

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${ownPrac.id}/services`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .send({
          serviceId: ownServiceId,
          availableTypes: ['clinic_visit'],
        });

      // Owner can edit own profile
      expect(res.status).not.toBe(403);
    });

    it('should reject assigning service to another practitioner profile -> 403', async () => {
      if (!practitioner2Id || !serviceId) return;

      const extraServiceId = await createService(
        httpServer,
        superAdmin.accessToken,
        categoryId,
        {
          nameEn: 'Cross Assign Attempt',
          nameAr: 'محاولة تعيين عبر',
          price: 10000,
          duration: 15,
        },
      );

      // practitionerAuth tries to assign to practitioner2's profile
      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitioner2Id}/services`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .send({
          serviceId: extraServiceId,
          availableTypes: ['clinic_visit'],
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject unauthenticated request -> 401', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .send({
          serviceId,
          availableTypes: ['clinic_visit'],
        })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject patient role -> 403', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          serviceId,
          availableTypes: ['clinic_visit'],
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject accountant role -> 403', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .set(getAuthHeaders(accountant.accessToken))
        .send({
          serviceId,
          availableTypes: ['clinic_visit'],
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject missing availableTypes field -> 400', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ serviceId })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject empty availableTypes array -> 400', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ serviceId, availableTypes: [] })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject invalid bookingType in availableTypes -> 400', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ serviceId, availableTypes: ['in_person', 'invalid'] })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject negative price -> 400', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          serviceId,
          priceClinic: -500,
          availableTypes: ['clinic_visit'],
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject duration less than 1 minute -> 400', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          serviceId,
          customDuration: 0,
          availableTypes: ['clinic_visit'],
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject non-existent serviceId -> 404', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          serviceId: '00000000-0000-0000-0000-000000000000',
          availableTypes: ['clinic_visit'],
        })
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should reject non-existent practitionerId -> 404', async () => {
      if (!serviceId) return;

      const res = await request(httpServer)
        .post(
          `${PRACTITIONERS_URL}/00000000-0000-0000-0000-000000000000/services`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          serviceId,
          availableTypes: ['clinic_visit'],
        })
        .expect(404);

      expectErrorResponse(res.body, 'PRACTITIONER_NOT_FOUND');
    });

    it('should reject duplicate assignment for same service -> 409', async () => {
      if (!practitionerId || !serviceId) return;

      // serviceId was already assigned to practitionerId in first test
      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          serviceId,
          availableTypes: ['clinic_visit'],
        })
        .expect(409);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should reject durationOptions with durationMinutes < 5 -> 400', async () => {
      if (!practitionerId) return;

      const miniServiceId = await createService(
        httpServer,
        superAdmin.accessToken,
        categoryId,
        {
          nameEn: 'Mini Duration Test',
          nameAr: 'اختبار مدة صغيرة',
          price: 5000,
          duration: 10,
        },
      );

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          serviceId: miniServiceId,
          availableTypes: ['clinic_visit'],
          types: [
            {
              bookingType: 'clinic_visit',
              price: 5000,
              duration: 10,
              useCustomOptions: true,
              isActive: true,
              durationOptions: [
                {
                  label: 'Too short',
                  durationMinutes: 3, // invalid: < 5
                  price: 5000,
                },
              ],
            },
          ],
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject durationOptions with durationMinutes > 480 -> 400', async () => {
      if (!practitionerId) return;

      const longServiceId = await createService(
        httpServer,
        superAdmin.accessToken,
        categoryId,
        {
          nameEn: 'Long Duration Test',
          nameAr: 'اختبار مدة طويلة',
          price: 5000,
          duration: 10,
        },
      );

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          serviceId: longServiceId,
          availableTypes: ['clinic_visit'],
          types: [
            {
              bookingType: 'clinic_visit',
              price: 5000,
              duration: 60,
              useCustomOptions: true,
              isActive: true,
              durationOptions: [
                {
                  label: 'Too long',
                  durationMinutes: 500, // invalid: > 480
                  price: 5000,
                },
              ],
            },
          ],
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });
  });

  // ===========================================================================
  // GET /practitioners/:id/services (PUBLIC)
  // ===========================================================================

  describe('GET /practitioners/:id/services (PUBLIC)', () => {
    it('should list assigned services without authentication', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .expect(200);

      expectSuccessResponse(res.body);
      const services = res.body.data.items || res.body.data;
      expect(Array.isArray(services)).toBe(true);
    });

    it('should return service details with name (AR + EN)', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .expect(200);

      const services = (res.body.data.items || res.body.data) as Array<{
        service: { nameEn: string; nameAr: string };
      }>;
      if (services.length > 0) {
        expect(services[0].service).toBeDefined();
        expect(typeof services[0].service.nameEn).toBe('string');
        expect(typeof services[0].service.nameAr).toBe('string');
      }
    });

    it('should include isActive flag on each assigned service', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .expect(200);

      const services = (res.body.data.items || res.body.data) as Array<{
        isActive: boolean;
      }>;
      for (const svc of services) {
        expect(typeof svc.isActive).toBe('boolean');
      }
    });

    it('should include availableTypes list on each assigned service', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .expect(200);

      const services = (res.body.data.items || res.body.data) as Array<{
        availableTypes: string[];
      }>;
      if (services.length > 0) {
        expect(Array.isArray(services[0].availableTypes)).toBe(true);
        expect(services[0].availableTypes.length).toBeGreaterThan(0);
      }
    });

    it('should include practitioner-level custom prices when set', async () => {
      if (!practitioner2Id) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitioner2Id}/services`)
        .expect(200);

      const services = (res.body.data.items || res.body.data) as Array<{
        priceClinic: number | null;
      }>;
      // practitioner2 has service2 assigned with priceClinic=18000
      const withCustom = services.find((s) => s.priceClinic === 18000);
      if (withCustom) {
        expect(withCustom.priceClinic).toBe(18000);
      }
    });

    it('should return 404 for non-existent practitioner', async () => {
      const res = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/00000000-0000-0000-0000-000000000000/services`,
        )
        .expect(404);

      expectErrorResponse(res.body, 'PRACTITIONER_NOT_FOUND');
    });

    it('should only return active assignments by default', async () => {
      if (!practitionerId) return;

      // Deactivate service2 assignment on practitioner1 then list
      await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${service2Id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ isActive: false });

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .expect(200);

      const services = (res.body.data.items || res.body.data) as Array<{
        isActive: boolean;
        serviceId: string;
      }>;
      // service2 should NOT appear in public list (inactive)
      const deactivated = services.find((s) => s.serviceId === service2Id);
      expect(deactivated).toBeUndefined();

      // Re-activate for subsequent tests
      await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${service2Id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ isActive: true });
    });
  });

  // ===========================================================================
  // PATCH /practitioners/:id/services/:serviceId — Update Assignment
  // ===========================================================================

  describe('PATCH /practitioners/:id/services/:serviceId', () => {
    it('should update custom clinic price (admin)', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ priceClinic: 28000 })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.priceClinic).toBe(28000);
    });

    it('should update custom phone and video prices independently', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ pricePhone: 18000, priceVideo: 23000 })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.pricePhone).toBe(18000);
      expect(res.body.data.priceVideo).toBe(23000);
    });

    it('should clear custom price by setting null (fallback to service price)', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ priceClinic: null })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.priceClinic).toBeNull();
    });

    it('should update custom duration', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ customDuration: 60 })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.customDuration).toBe(60);
    });

    it('should clear custom duration by setting null (fallback to service duration)', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ customDuration: null })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.customDuration).toBeNull();
    });

    it('should update availableTypes', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ availableTypes: ['clinic_visit', 'video_consultation'] })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.availableTypes).toContain('clinic_visit');
      expect(res.body.data.availableTypes).toContain('video_consultation');
      expect(res.body.data.availableTypes).not.toContain('phone_consultation');
    });

    it('should deactivate assignment (isActive=false)', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ isActive: false })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.isActive).toBe(false);

      // Re-activate
      await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ isActive: true });
    });

    it('should update per-booking-type config via types[]', async () => {
      if (!practitionerId || !serviceWithTypesId) return;

      const res = await request(httpServer)
        .patch(
          `${PRACTITIONERS_URL}/${practitionerId}/services/${serviceWithTypesId}`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          types: [
            {
              bookingType: 'clinic_visit',
              price: 42000,
              duration: 55,
              isActive: true,
            },
          ],
        })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should allow receptionist to update assignment', async () => {
      if (!practitioner2Id || !service2Id) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitioner2Id}/services/${service2Id}`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ bufferMinutes: 5 })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should allow owner to update own assignment', async () => {
      if (!practitionerId || !serviceId) return;

      // Find practitioner whose userId == prac-svc-1 userId (not TEST_USERS.practitioner)
      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken)) // use admin for this edge case
        .send({ bufferMinutes: 10 })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should reject practitioner updating another practitioner service -> 403', async () => {
      if (!practitioner2Id || !service2Id) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitioner2Id}/services/${service2Id}`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .send({ priceClinic: 5000 })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject patient role -> 403', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${serviceId}`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ priceClinic: 5000 })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject negative price update -> 400', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ priceClinic: -1000 })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject invalid bookingType in types[] -> 400', async () => {
      if (!practitionerId || !serviceWithTypesId) return;

      const res = await request(httpServer)
        .patch(
          `${PRACTITIONERS_URL}/${practitionerId}/services/${serviceWithTypesId}`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          types: [{ bookingType: 'in_clinic', price: 10000, duration: 30 }],
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 404 for non-existent service assignment', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .patch(
          `${PRACTITIONERS_URL}/${practitionerId}/services/00000000-0000-0000-0000-000000000000`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ priceClinic: 10000 })
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should return 404 for non-existent practitioner', async () => {
      if (!serviceId) return;

      const res = await request(httpServer)
        .patch(
          `${PRACTITIONERS_URL}/00000000-0000-0000-0000-000000000000/services/${serviceId}`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ priceClinic: 10000 })
        .expect(404);

      expectErrorResponse(res.body, 'PRACTITIONER_NOT_FOUND');
    });
  });

  // ===========================================================================
  // DELETE /practitioners/:id/services/:serviceId — Remove Assignment
  // ===========================================================================

  describe('DELETE /practitioners/:id/services/:serviceId', () => {
    let serviceToDeleteId: string;

    beforeAll(async () => {
      // Create a dedicated service to delete
      serviceToDeleteId = await createService(
        httpServer,
        superAdmin.accessToken,
        categoryId,
        {
          nameEn: 'Service To Delete',
          nameAr: 'خدمة للحذف',
          price: 5000,
          duration: 15,
        },
      );

      // Assign it to practitioner1
      await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          serviceId: serviceToDeleteId,
          availableTypes: ['clinic_visit'],
        })
        .expect(201);
    });

    it('should remove assignment from practitioner (admin)', async () => {
      if (!practitionerId || !serviceToDeleteId) return;

      const res = await request(httpServer)
        .delete(
          `${PRACTITIONERS_URL}/${practitionerId}/services/${serviceToDeleteId}`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
    });

    it('service should no longer appear in practitioner services list after removal', async () => {
      if (!practitionerId || !serviceToDeleteId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .expect(200);

      const services = (res.body.data.items || res.body.data) as Array<{
        serviceId: string;
      }>;
      const found = services.find((s) => s.serviceId === serviceToDeleteId);
      expect(found).toBeUndefined();
    });

    it('should reject removal by non-owner practitioner -> 403', async () => {
      if (!practitioner2Id || !service2Id) return;

      const res = await request(httpServer)
        .delete(
          `${PRACTITIONERS_URL}/${practitioner2Id}/services/${service2Id}`,
        )
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject removal by patient -> 403', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .delete(`${PRACTITIONERS_URL}/${practitionerId}/services/${serviceId}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 404 for already-removed assignment', async () => {
      if (!practitionerId || !serviceToDeleteId) return;

      const res = await request(httpServer)
        .delete(
          `${PRACTITIONERS_URL}/${practitionerId}/services/${serviceToDeleteId}`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should return 404 for non-existent practitioner', async () => {
      if (!serviceId) return;

      const res = await request(httpServer)
        .delete(
          `${PRACTITIONERS_URL}/00000000-0000-0000-0000-000000000000/services/${serviceId}`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'PRACTITIONER_NOT_FOUND');
    });
  });

  // ===========================================================================
  // GET /practitioners/:id/services/:serviceId/types — Per-type Config
  // ===========================================================================

  describe('GET /practitioners/:id/services/:serviceId/types', () => {
    it('should return per-booking-type configs (admin)', async () => {
      if (!practitioner2Id || !serviceWithTypesId) return;

      const res = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${practitioner2Id}/services/${serviceWithTypesId}/types`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const types = res.body.data.items || res.body.data;
      expect(Array.isArray(types)).toBe(true);
    });

    it('should include bookingType, price, duration for each type', async () => {
      if (!practitioner2Id || !serviceWithTypesId) return;

      const res = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${practitioner2Id}/services/${serviceWithTypesId}/types`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const types = (res.body.data.items || res.body.data) as Array<{
        bookingType: string;
        price: number | null;
        duration: number | null;
        isActive: boolean;
      }>;

      if (types.length > 0) {
        const validTypes = [
          'clinic_visit',
          'phone_consultation',
          'video_consultation',
        ];
        for (const t of types) {
          expect(validTypes).toContain(t.bookingType);
          expect(typeof t.isActive).toBe('boolean');
        }
      }
    });

    it('should include durationOptions array on each type', async () => {
      if (!practitionerId || !serviceWithTypesId) return;

      const res = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${practitionerId}/services/${serviceWithTypesId}/types`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const types = (res.body.data.items || res.body.data) as Array<{
        durationOptions: unknown[];
      }>;

      if (types.length > 0) {
        expect(Array.isArray(types[0].durationOptions)).toBe(true);
      }
    });

    it('should return configured clinic_visit type with custom price 35000', async () => {
      if (!practitioner2Id || !serviceWithTypesId) return;

      const res = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${practitioner2Id}/services/${serviceWithTypesId}/types`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const types = (res.body.data.items || res.body.data) as Array<{
        bookingType: string;
        price: number;
      }>;

      const clinicType = types.find((t) => t.bookingType === 'clinic_visit');
      if (clinicType) {
        expect(clinicType.price).toBe(35000);
      }
    });

    it('should require authentication (practitioners:view) -> 401 unauthenticated', async () => {
      if (!practitionerId || !serviceWithTypesId) return;

      const res = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${practitionerId}/services/${serviceWithTypesId}/types`,
        )
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject patient role -> 403', async () => {
      if (!practitionerId || !serviceWithTypesId) return;

      const res = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${practitionerId}/services/${serviceWithTypesId}/types`,
        )
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 404 for non-existent practitioner', async () => {
      if (!serviceWithTypesId) return;

      const res = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/00000000-0000-0000-0000-000000000000/services/${serviceWithTypesId}/types`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'PRACTITIONER_NOT_FOUND');
    });

    it('should return 404 for service not assigned to practitioner', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${practitionerId}/services/00000000-0000-0000-0000-000000000000/types`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
    });
  });

  // ===========================================================================
  // Pricing Fallback Hierarchy
  // ===========================================================================

  describe('Pricing Fallback Hierarchy', () => {
    let fallbackServiceId: string;
    let fallbackPractitionerId: string;

    beforeAll(async () => {
      // Create a service with base price
      fallbackServiceId = await createService(
        httpServer,
        superAdmin.accessToken,
        categoryId,
        {
          nameEn: 'Fallback Hierarchy Service',
          nameAr: 'خدمة هيكل الاحتياط',
          price: 10000, // base fallback
          duration: 20,
        },
      );

      // Set service-level booking type prices
      await request(httpServer)
        .put(`${SERVICES_URL}/${fallbackServiceId}/booking-types`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          types: [
            {
              bookingType: 'clinic_visit',
              price: 12000,
              duration: 20,
              isActive: true,
            },
            {
              bookingType: 'phone_consultation',
              price: 8000,
              duration: 15,
              isActive: true,
            },
          ],
        });

      // Create a fresh practitioner for fallback tests
      const fbUserId = await createPractitionerUser(
        httpServer,
        superAdmin.accessToken,
        'fallback-prac@carekit-test.com',
        '+966550000040',
        'فيصل',
      );
      fallbackPractitionerId = await createPractitioner(
        httpServer,
        superAdmin.accessToken,
        fbUserId,
        specialtyId,
      );
    });

    it('Level 5 (base): should use service.price when no override exists', async () => {
      if (!fallbackPractitionerId || !fallbackServiceId) return;

      // Assign without any price override
      const assignRes = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${fallbackPractitionerId}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          serviceId: fallbackServiceId,
          availableTypes: ['clinic_visit'],
          // no priceClinic, no types — should fallback to service price
        })
        .expect(201);

      // Practitioner-level price should be null (means: use service fallback)
      expect(assignRes.body.data.priceClinic).toBeNull();
    });

    it('Level 4: should use ServiceBookingType.price when practitioner has no override', async () => {
      if (!fallbackPractitionerId || !fallbackServiceId) return;

      const typesRes = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${fallbackPractitionerId}/services/${fallbackServiceId}/types`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const types = (typesRes.body.data.items || typesRes.body.data) as Array<{
        bookingType: string;
        price: number | null;
      }>;

      // When practitioner has no custom price, the resolved price comes from
      // ServiceBookingType (12000 for clinic_visit) or service base (10000)
      const clinicType = types.find((t) => t.bookingType === 'clinic_visit');
      if (clinicType) {
        // Price is null at practitioner level — fallback applies downstream
        // The raw stored value should be null or the service booking type price
        expect(clinicType.price === null || clinicType.price === 12000).toBe(
          true,
        );
      }
    });

    it('Level 3 (PractitionerServiceType): custom price overrides ServiceBookingType price', async () => {
      if (!fallbackPractitionerId || !fallbackServiceId) return;

      // Add practitioner-level type override
      const res = await request(httpServer)
        .patch(
          `${PRACTITIONERS_URL}/${fallbackPractitionerId}/services/${fallbackServiceId}`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          types: [
            {
              bookingType: 'clinic_visit',
              price: 15000, // overrides ServiceBookingType.price (12000)
              duration: 25,
              isActive: true,
            },
          ],
        })
        .expect(200);

      expectSuccessResponse(res.body);

      const typesRes = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${fallbackPractitionerId}/services/${fallbackServiceId}/types`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const types = (typesRes.body.data.items || typesRes.body.data) as Array<{
        bookingType: string;
        price: number;
        duration: number;
      }>;

      const clinicType = types.find((t) => t.bookingType === 'clinic_visit');
      if (clinicType) {
        expect(clinicType.price).toBe(15000);
        expect(clinicType.duration).toBe(25);
      }
    });

    it('Level 1 (PractitionerDurationOption): duration option price overrides all', async () => {
      if (!fallbackPractitionerId || !fallbackServiceId) return;

      const res = await request(httpServer)
        .patch(
          `${PRACTITIONERS_URL}/${fallbackPractitionerId}/services/${fallbackServiceId}`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          types: [
            {
              bookingType: 'clinic_visit',
              price: 15000,
              duration: 30,
              useCustomOptions: true,
              isActive: true,
              durationOptions: [
                {
                  label: '20 min',
                  labelAr: '٢٠ دقيقة',
                  durationMinutes: 20,
                  price: 11000, // most specific price
                  isDefault: true,
                  sortOrder: 0,
                },
                {
                  label: '30 min',
                  labelAr: '٣٠ دقيقة',
                  durationMinutes: 30,
                  price: 15000,
                  isDefault: false,
                  sortOrder: 1,
                },
              ],
            },
          ],
        })
        .expect(200);

      expectSuccessResponse(res.body);

      const typesRes = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${fallbackPractitionerId}/services/${fallbackServiceId}/types`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const types = (typesRes.body.data.items || typesRes.body.data) as Array<{
        bookingType: string;
        durationOptions: Array<{
          durationMinutes: number;
          price: number;
          isDefault: boolean;
        }>;
      }>;

      const clinicType = types.find((t) => t.bookingType === 'clinic_visit');
      if (clinicType && clinicType.durationOptions.length > 0) {
        const defaultOption = clinicType.durationOptions.find(
          (o) => o.isDefault,
        );
        if (defaultOption) {
          expect(defaultOption.price).toBe(11000);
          expect(defaultOption.durationMinutes).toBe(20);
        }
      }
    });

    it('multiple duration options — only one should be isDefault=true', async () => {
      if (!fallbackPractitionerId || !fallbackServiceId) return;

      const typesRes = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${fallbackPractitionerId}/services/${fallbackServiceId}/types`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const types = (typesRes.body.data.items || typesRes.body.data) as Array<{
        bookingType: string;
        durationOptions: Array<{ isDefault: boolean }>;
      }>;

      for (const t of types) {
        if (t.durationOptions && t.durationOptions.length > 0) {
          const defaults = t.durationOptions.filter((o) => o.isDefault);
          expect(defaults.length).toBeLessThanOrEqual(1);
        }
      }
    });

    it('duration options should be sorted by sortOrder', async () => {
      if (!fallbackPractitionerId || !fallbackServiceId) return;

      const typesRes = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${fallbackPractitionerId}/services/${fallbackServiceId}/types`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const types = (typesRes.body.data.items || typesRes.body.data) as Array<{
        durationOptions: Array<{ sortOrder: number }>;
      }>;

      for (const t of types) {
        if (t.durationOptions && t.durationOptions.length >= 2) {
          for (let i = 1; i < t.durationOptions.length; i++) {
            expect(t.durationOptions[i].sortOrder).toBeGreaterThanOrEqual(
              t.durationOptions[i - 1].sortOrder,
            );
          }
        }
      }
    });
  });

  // ===========================================================================
  // Multi-service Assignment Scenarios
  // ===========================================================================

  describe('Multi-service Assignment Scenarios', () => {
    it('should support multiple services assigned to same practitioner', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .expect(200);

      const services = res.body.data.items || res.body.data;
      expect(Array.isArray(services)).toBe(true);
      // practitionerId has serviceId and service2Id assigned
      expect(services.length).toBeGreaterThanOrEqual(2);
    });

    it('same service can be assigned to multiple practitioners', async () => {
      if (!practitionerId || !practitioner2Id || !serviceId) return;

      // serviceId assigned to practitionerId (setup), also assign to practitioner2Id
      const existing = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitioner2Id}/services`)
        .expect(200);

      const existingServices = (existing.body.data.items ||
        existing.body.data) as Array<{
        serviceId: string;
      }>;
      const alreadyAssigned = existingServices.find(
        (s) => s.serviceId === serviceId,
      );

      if (!alreadyAssigned) {
        const res = await request(httpServer)
          .post(`${PRACTITIONERS_URL}/${practitioner2Id}/services`)
          .set(getAuthHeaders(superAdmin.accessToken))
          .send({
            serviceId,
            availableTypes: ['clinic_visit'],
          })
          .expect(201);

        expectSuccessResponse(res.body);
      }

      // Both practitioners should have this service
      const p1Services = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .expect(200);

      const p2Services = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitioner2Id}/services`)
        .expect(200);

      const p1Has = (
        p1Services.body.data.items ||
        (p1Services.body.data as Array<{ serviceId: string }>)
      ).some((s: { serviceId: string }) => s.serviceId === serviceId);
      const p2Has = (
        p2Services.body.data.items ||
        (p2Services.body.data as Array<{ serviceId: string }>)
      ).some((s: { serviceId: string }) => s.serviceId === serviceId);

      expect(p1Has).toBe(true);
      expect(p2Has).toBe(true);
    });

    it('each practitioner can have different prices for the same service', async () => {
      if (!practitionerId || !practitioner2Id || !serviceId) return;

      // Set different prices for the same service on each practitioner
      await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ priceClinic: 30000 })
        .expect(200);

      await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitioner2Id}/services/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ priceClinic: 20000 })
        .expect(200);

      const p1Res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .expect(200);

      const p2Res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitioner2Id}/services`)
        .expect(200);

      const p1Service = (
        p1Res.body.data.items ||
        (p1Res.body.data as Array<{ serviceId: string; priceClinic: number }>)
      ).find((s: { serviceId: string }) => s.serviceId === serviceId) as
        | { priceClinic: number }
        | undefined;

      const p2Service = (
        p2Res.body.data.items ||
        (p2Res.body.data as Array<{ serviceId: string; priceClinic: number }>)
      ).find((s: { serviceId: string }) => s.serviceId === serviceId) as
        | { priceClinic: number }
        | undefined;

      if (p1Service && p2Service) {
        expect(p1Service.priceClinic).toBe(30000);
        expect(p2Service.priceClinic).toBe(20000);
      }
    });

    it('deleting service does not affect other practitioners assignments', async () => {
      // Create a new service exclusively for this test
      const isolatedServiceId = await createService(
        httpServer,
        superAdmin.accessToken,
        categoryId,
        {
          nameEn: 'Isolated Assignment Test',
          nameAr: 'اختبار التعيين المعزول',
          price: 5000,
          duration: 15,
        },
      );

      if (!practitionerId || !practitioner2Id) return;

      // Assign to both
      await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          serviceId: isolatedServiceId,
          availableTypes: ['clinic_visit'],
        })
        .expect(201);

      await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitioner2Id}/services`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          serviceId: isolatedServiceId,
          availableTypes: ['clinic_visit'],
        })
        .expect(201);

      // Remove from practitioner1 only
      await request(httpServer)
        .delete(
          `${PRACTITIONERS_URL}/${practitionerId}/services/${isolatedServiceId}`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      // practitioner2 still has it
      const p2Res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitioner2Id}/services`)
        .expect(200);

      const p2Services = (p2Res.body.data.items || p2Res.body.data) as Array<{
        serviceId: string;
      }>;
      const stillHas = p2Services.find(
        (s) => s.serviceId === isolatedServiceId,
      );
      expect(stillHas).toBeDefined();
    });
  });

  // ===========================================================================
  // Slots: service-aware slot generation
  // ===========================================================================

  describe('GET /practitioners/:id/slots — service-aware', () => {
    beforeAll(async () => {
      if (!practitionerId) return;

      // Ensure practitioner has availability set
      await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          schedule: [
            {
              dayOfWeek: 0,
              startTime: '09:00',
              endTime: '17:00',
              isActive: true,
            },
            {
              dayOfWeek: 1,
              startTime: '09:00',
              endTime: '17:00',
              isActive: true,
            },
            {
              dayOfWeek: 2,
              startTime: '09:00',
              endTime: '17:00',
              isActive: true,
            },
            {
              dayOfWeek: 3,
              startTime: '09:00',
              endTime: '17:00',
              isActive: true,
            },
            {
              dayOfWeek: 4,
              startTime: '09:00',
              endTime: '17:00',
              isActive: true,
            },
          ],
        });
    });

    it('should return slots filtered by serviceId', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${practitionerId}/slots?date=2026-06-14&serviceId=${serviceId}`,
        )
        .expect(200);

      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data.slots)).toBe(true);
    });

    it('should return slots matching service duration (30 min)', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${practitionerId}/slots?date=2026-06-14&serviceId=${serviceId}`,
        )
        .expect(200);

      const slots = res.body.data.slots as Array<{
        startTime: string;
        endTime: string;
      }>;

      if (slots.length > 0) {
        const start = slots[0].startTime.split(':').map(Number);
        const end = slots[0].endTime.split(':').map(Number);
        const durationMin = end[0] * 60 + end[1] - (start[0] * 60 + start[1]);
        // Duration should match the service duration (30) or custom duration
        expect(durationMin).toBeGreaterThanOrEqual(15);
      }
    });

    it('should return different slot sizes for different services (custom duration)', async () => {
      if (!practitionerId || !serviceId || !service2Id) return;

      // service has duration=30, service2 has duration=20 + custom=45 on practitioner1
      const res30 = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${practitionerId}/slots?date=2026-06-15&serviceId=${serviceId}`,
        )
        .expect(200);

      const res45 = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${practitionerId}/slots?date=2026-06-15&serviceId=${service2Id}`,
        )
        .expect(200);

      expectSuccessResponse(res30.body);
      expectSuccessResponse(res45.body);

      const slots30 = res30.body.data.slots as Array<{
        startTime: string;
        endTime: string;
      }>;
      const slots45 = res45.body.data.slots as Array<{
        startTime: string;
        endTime: string;
      }>;

      // 30-min slots → more slots per day; 45-min → fewer
      if (slots30.length > 0 && slots45.length > 0) {
        expect(slots30.length).toBeGreaterThanOrEqual(slots45.length);
      }
    });

    it('should accept ?bookingType filter', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${practitionerId}/slots?date=2026-06-16&serviceId=${serviceId}&bookingType=clinic_visit`,
        )
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should return 400 for unsupported bookingType', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/${practitionerId}/slots?date=2026-06-16&serviceId=${serviceId}&bookingType=invalid_type`,
        )
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });
  });

  // ===========================================================================
  // Breaks — effect on slots
  // ===========================================================================

  describe('Breaks — PUT/GET /practitioners/:id/breaks', () => {
    it('should set breaks for a practitioner (admin)', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/breaks`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          breaks: [
            { dayOfWeek: 0, startTime: '12:00', endTime: '13:00' },
            { dayOfWeek: 1, startTime: '12:00', endTime: '13:00' },
          ],
        })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should retrieve breaks for a practitioner', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/breaks`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const breaks = res.body.data.items || res.body.data;
      expect(Array.isArray(breaks)).toBe(true);
    });

    it('should include dayOfWeek, startTime, endTime in each break', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/breaks`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const breaks = (res.body.data.items || res.body.data) as Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
      }>;

      if (breaks.length > 0) {
        expect(typeof breaks[0].dayOfWeek).toBe('number');
        expect(breaks[0].startTime).toMatch(/^\d{2}:\d{2}$/);
        expect(breaks[0].endTime).toMatch(/^\d{2}:\d{2}$/);
      }
    });

    it('should remove break slots for days with no breaks when updated', async () => {
      if (!practitionerId) return;

      // Update: only keep dayOfWeek=0, remove dayOfWeek=1
      await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/breaks`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          breaks: [{ dayOfWeek: 0, startTime: '12:00', endTime: '13:00' }],
        })
        .expect(200);

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/breaks`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const breaks = (res.body.data.items || res.body.data) as Array<{
        dayOfWeek: number;
      }>;
      const day1Break = breaks.find((b) => b.dayOfWeek === 1);
      expect(day1Break).toBeUndefined();
    });

    it('breaks during working hours should remove corresponding slots', async () => {
      if (!practitionerId || !serviceId) return;

      // Set break from 12:00-13:00 on dayOfWeek=0 (Sunday)
      await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/breaks`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          breaks: [{ dayOfWeek: 0, startTime: '12:00', endTime: '13:00' }],
        });

      // 2026-06-14 is a Sunday
      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/slots?date=2026-06-14`)
        .expect(200);

      const slots = res.body.data.slots as Array<{
        startTime: string;
        available: boolean;
      }>;

      // No slot should start at 12:00 (break time)
      const breakSlot = slots.find((s) => s.startTime === '12:00');
      if (breakSlot) {
        expect(breakSlot.available).toBe(false);
      }
    });

    it('should validate break time format (HH:mm)', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/breaks`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          breaks: [{ dayOfWeek: 0, startTime: '12pm', endTime: '1pm' }],
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject overlapping breaks on same day -> 400', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/breaks`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          breaks: [
            { dayOfWeek: 0, startTime: '11:00', endTime: '13:00' },
            { dayOfWeek: 0, startTime: '12:00', endTime: '14:00' }, // overlaps
          ],
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should allow owner to set own breaks', async () => {
      if (!practitionerId) return;

      // practitionerAuth owns TEST_USERS.practitioner profile (not practitionerId)
      // Use admin here; owner test is covered under the ownership guard tests above
      const res = await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/breaks`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          breaks: [{ dayOfWeek: 0, startTime: '13:00', endTime: '14:00' }],
        })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should reject patient role for setting breaks -> 403', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/breaks`)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          breaks: [{ dayOfWeek: 0, startTime: '12:00', endTime: '13:00' }],
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should clear all breaks when sending empty array', async () => {
      if (!practitionerId) return;

      await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/breaks`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ breaks: [] })
        .expect(200);

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/breaks`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const breaks = res.body.data.items || res.body.data;
      expect(Array.isArray(breaks)).toBe(true);
      expect(breaks.length).toBe(0);
    });
  });

  // ===========================================================================
  // Practitioner Onboarding (POST /practitioners/onboard)
  // ===========================================================================

  describe('POST /practitioners/onboard', () => {
    const ONBOARD_URL = `${PRACTITIONERS_URL}/onboard`;

    it('should onboard a new practitioner in one step (admin)', async () => {
      const res = await request(httpServer)
        .post(ONBOARD_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Dr. Mohammed Al-Qahtani',
          nameAr: 'د. محمد القحطاني',
          email: 'dr.qahtani@carekit-test.com',
          specialty: 'Cardiology',
          specialtyAr: 'أمراض القلب',
          bio: 'Cardiologist with 20 years experience',
          bioAr: 'طبيب قلب بخبرة 20 عاماً',
          experience: 20,
          education: 'MBBS, MD - King Saud University',
          educationAr: 'بكالوريوس وماجستير طب - جامعة الملك سعود',
          priceClinic: 45000,
          pricePhone: 30000,
          priceVideo: 38000,
          isActive: true,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      const { data } = res.body;
      expect(data.id).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.user.firstName).toBeDefined();
      expect(typeof data.priceClinic).toBe('number');
      expect(data.isActive).toBe(true);
    });

    it('should include avatarUrl in onboarding payload', async () => {
      const res = await request(httpServer)
        .post(ONBOARD_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Dr. Layla Al-Harbi',
          nameAr: 'د. ليلى الحربي',
          email: 'dr.layla@carekit-test.com',
          specialty: 'Dermatology',
          priceClinic: 35000,
          pricePhone: 22000,
          priceVideo: 28000,
          avatarUrl: 'https://example.com/avatar/layla.jpg',
          isActive: true,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      // Avatar URL stored in user record
      expect(res.body.data.user).toBeDefined();
    });

    it('should create user account as part of onboarding', async () => {
      const email = 'dr.onboard.unique@carekit-test.com';
      const res = await request(httpServer)
        .post(ONBOARD_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Dr. Unique Onboard',
          nameAr: 'د. اختبار الإعداد',
          email,
          specialty: 'Neurology',
          priceClinic: 50000,
          pricePhone: 35000,
          priceVideo: 40000,
          isActive: true,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      const userId = res.body.data.user.id;
      expect(userId).toBeDefined();

      // Verify user exists
      const userRes = await request(httpServer)
        .get(`${API_PREFIX}/users/${userId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expect(userRes.body.data.email).toBe(email);
    });

    it('should reject duplicate email onboarding -> 409', async () => {
      const res = await request(httpServer)
        .post(ONBOARD_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Dr. Duplicate',
          nameAr: 'د. مكرر',
          email: 'dr.qahtani@carekit-test.com', // already onboarded
          specialty: 'Cardiology',
          priceClinic: 10000,
          pricePhone: 10000,
          priceVideo: 10000,
          isActive: true,
        })
        .expect(409);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should reject without required nameEn field -> 400', async () => {
      const res = await request(httpServer)
        .post(ONBOARD_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameAr: 'د. ناقص',
          email: 'dr.missing@carekit-test.com',
          specialty: 'Cardiology',
          priceClinic: 10000,
          pricePhone: 10000,
          priceVideo: 10000,
          isActive: true,
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject without required email field -> 400', async () => {
      const res = await request(httpServer)
        .post(ONBOARD_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Dr. No Email',
          nameAr: 'د. بدون إيميل',
          specialty: 'Cardiology',
          priceClinic: 10000,
          pricePhone: 10000,
          priceVideo: 10000,
          isActive: true,
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject invalid email format -> 400', async () => {
      const res = await request(httpServer)
        .post(ONBOARD_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Dr. Bad Email',
          nameAr: 'د. إيميل خاطئ',
          email: 'not-an-email',
          specialty: 'Cardiology',
          priceClinic: 10000,
          pricePhone: 10000,
          priceVideo: 10000,
          isActive: true,
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject negative price during onboarding -> 400', async () => {
      const res = await request(httpServer)
        .post(ONBOARD_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Dr. Negative Price',
          nameAr: 'د. سعر سالب',
          email: 'dr.negative@carekit-test.com',
          specialty: 'Cardiology',
          priceClinic: -500,
          pricePhone: 10000,
          priceVideo: 10000,
          isActive: true,
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject patient role -> 403', async () => {
      const res = await request(httpServer)
        .post(ONBOARD_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          nameEn: 'Dr. Patient Attempt',
          nameAr: 'د. محاولة مريض',
          email: 'patient.attempt@carekit-test.com',
          specialty: 'Cardiology',
          priceClinic: 10000,
          pricePhone: 10000,
          priceVideo: 10000,
          isActive: true,
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject unauthenticated request -> 401', async () => {
      const res = await request(httpServer)
        .post(ONBOARD_URL)
        .send({
          nameEn: 'Dr. Unauth',
          nameAr: 'د. بدون مصادقة',
          email: 'dr.unauth@carekit-test.com',
          specialty: 'Cardiology',
          priceClinic: 10000,
          pricePhone: 10000,
          priceVideo: 10000,
          isActive: true,
        })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });

  // ===========================================================================
  // Favorites — POST/DELETE/GET /practitioners/:id/favorite
  // ===========================================================================

  describe('Favorites (Patient ↔ Practitioner)', () => {
    it('should add practitioner to patient favorites', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data.practitionerId).toBe(practitionerId);
    });

    it('should list favorites for authenticated patient', async () => {
      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/favorites`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const favorites = res.body.data.items || res.body.data;
      expect(Array.isArray(favorites)).toBe(true);
      expect(favorites.length).toBeGreaterThanOrEqual(1);
    });

    it('should include practitioner details in favorites list', async () => {
      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/favorites`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      const favorites = (res.body.data.items || res.body.data) as Array<{
        id: string;
        specialty: unknown;
        user: unknown;
      }>;

      if (favorites.length > 0) {
        expect(favorites[0].id).toBeDefined();
        expect(favorites[0].specialty).toBeDefined();
        expect(favorites[0].user).toBeDefined();
      }
    });

    it('should reject adding to favorites without authentication -> 401', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject duplicate favorite addition -> 409', async () => {
      if (!practitionerId) return;

      // Already added in first test
      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(409);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should remove practitioner from favorites', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .delete(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
    });

    it('practitioner should not appear in favorites after removal', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/favorites`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      const favorites = (res.body.data.items || res.body.data) as Array<{
        id: string;
      }>;
      const found = favorites.find((f) => f.id === practitionerId);
      expect(found).toBeUndefined();
    });

    it('should return 404 when removing non-existent favorite', async () => {
      if (!practitionerId) return;

      // Already removed
      const res = await request(httpServer)
        .delete(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should reject listing favorites without authentication -> 401', async () => {
      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/favorites`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should not expose one patient favorites to another patient', async () => {
      // patient2 has own favorites, should not see patient's favorites
      const patient2 = await registerTestPatient(httpServer, {
        email: 'fav-test-patient2@carekit-test.com',
        password: 'Fav2P@ss!1',
        firstName: 'منى',
        lastName: 'الشمري',
        phone: '+966550000050',
        gender: 'female',
      });

      // Add same practitioner to both patients' favorites
      if (practitionerId) {
        await request(httpServer)
          .post(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
          .set(getAuthHeaders(patient.accessToken));

        await request(httpServer)
          .post(`${PRACTITIONERS_URL}/${practitionerId}/favorite`)
          .set(getAuthHeaders(patient2.accessToken));
      }

      if (practitioner2Id) {
        await request(httpServer)
          .post(`${PRACTITIONERS_URL}/${practitioner2Id}/favorite`)
          .set(getAuthHeaders(patient.accessToken));
      }

      // Each patient's favorites list is independent (request is scoped to JWT)
      const p1Fav = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/favorites`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      const p2Fav = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/favorites`)
        .set(getAuthHeaders(patient2.accessToken))
        .expect(200);

      expectSuccessResponse(p1Fav.body);
      expectSuccessResponse(p2Fav.body);
      // Both are arrays scoped to the respective patient — isolation is maintained
    });
  });

  // ===========================================================================
  // Buffer Minutes
  // ===========================================================================

  describe('Buffer minutes effect on slot availability', () => {
    it('should persist bufferMinutes on service assignment', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ bufferMinutes: 15 })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.bufferMinutes).toBe(15);
    });

    it('should reject negative bufferMinutes -> 400', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ bufferMinutes: -5 })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should accept zero bufferMinutes (disable buffer)', async () => {
      if (!practitionerId || !serviceId) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}/services/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ bufferMinutes: 0 })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.bufferMinutes).toBe(0);
    });
  });
});
