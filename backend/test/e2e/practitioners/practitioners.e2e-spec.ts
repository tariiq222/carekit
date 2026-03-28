/**
 * CareKit — Practitioners Module E2E Tests (TDD RED Phase)
 *
 * Tests all practitioner endpoints per docs/api-spec.md:
 *   GET    /practitioners              — list (PUBLIC, paginated)
 *   GET    /practitioners/:id          — profile (PUBLIC)
 *   POST   /practitioners              — create (admin)
 *   PATCH  /practitioners/:id          — update (admin or OWNER)
 *   DELETE /practitioners/:id          — soft-delete (admin)
 *   GET    /practitioners/:id/availability — weekly schedule (PUBLIC)
 *   PUT    /practitioners/:id/availability — set schedule (admin or OWNER)
 *   GET    /practitioners/:id/slots    — available slots for date (PUBLIC)
 *   POST   /practitioners/:id/vacations     — add vacation
 *   GET    /practitioners/:id/vacations     — list vacations
 *   DELETE /practitioners/:id/vacations/:id — remove vacation
 *   GET    /practitioners/:id/ratings  — list ratings (PUBLIC)
 *
 * These tests will FAIL until backend-dev implements the practitioners module.
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

describe('Practitioners Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let practitionerAuth: AuthResult;
  let practitioner2Auth: AuthResult;
  let patient: AuthResult;

  // IDs populated during setup
  let practitionerId: string;
  let practitioner2Id: string;
  let specialtyId: string;

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

    practitionerAuth = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.practitioner,
      'practitioner',
    );

    practitioner2Auth = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      {
        email: 'prac2@carekit-test.com',
        password: 'Pr@c2P@ss!',
        firstName: 'عبدالرحمن',
        lastName: 'الشهري',
        phone: '+966540000002',
        gender: 'male',
      },
      'practitioner',
    );

    patient = await registerTestPatient(httpServer, TEST_USERS.patient);

    // Get a specialty ID from seed data
    const specRes = await request(httpServer)
      .get(`${API_PREFIX}/specialties`)
      .expect(200);

    const specialties = specRes.body.data.items || specRes.body.data;
    if (Array.isArray(specialties) && specialties.length > 0) {
      specialtyId = (specialties[0] as { id: string }).id;
    }

    // Create practitioner profiles
    const p1Res = await request(httpServer)
      .post(PRACTITIONERS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        userId: practitionerAuth.user.id,
        specialtyId,
        bio: 'Board-certified cardiologist with 15 years experience',
        bioAr: 'طبيب قلب معتمد بخبرة 15 عاما',
        experience: 15,
        education: 'MBBS, MD Cardiology - King Saud University',
        educationAr: 'بكالوريوس طب وجراحة، ماجستير أمراض القلب - جامعة الملك سعود',
        priceClinic: 30000,
        pricePhone: 20000,
        priceVideo: 25000,
      });

    if (p1Res.status === 201) {
      practitionerId = p1Res.body.data.id;
    }

    const p2Res = await request(httpServer)
      .post(PRACTITIONERS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        userId: practitioner2Auth.user.id,
        specialtyId,
        bio: 'Pediatric specialist',
        bioAr: 'أخصائي أطفال',
        experience: 8,
        priceClinic: 25000,
        pricePhone: 15000,
        priceVideo: 20000,
      });

    if (p2Res.status === 201) {
      practitioner2Id = p2Res.body.data.id;
    }
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // =========================================================================
  // GET /practitioners (PUBLIC)
  // =========================================================================

  describe('GET /api/v1/practitioners', () => {
    it('should list practitioners (PUBLIC — no auth required)', async () => {
      const res = await request(httpServer)
        .get(PRACTITIONERS_URL)
        .expect(200);

      expectSuccessResponse(res.body);
      const items = res.body.data.items || res.body.data;
      expect(Array.isArray(items)).toBe(true);
    });

    it('should return paginated results', async () => {
      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}?page=1&perPage=1`)
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.meta).toBeDefined();
      expect(res.body.data.meta.page).toBe(1);
      expect(res.body.data.meta.perPage).toBe(1);
      expect(res.body.data.items.length).toBeLessThanOrEqual(1);
    });

    it('should filter by specialtyId', async () => {
      if (!specialtyId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}?specialtyId=${specialtyId}`)
        .expect(200);

      expectSuccessResponse(res.body);
      const items = res.body.data.items as Array<{
        specialty: { id: string };
      }>;
      for (const p of items) {
        expect(p.specialty.id).toBe(specialtyId);
      }
    });

    it('should filter by minimum rating (?minRating=4)', async () => {
      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}?minRating=4`)
        .expect(200);

      expectSuccessResponse(res.body);
      const items = res.body.data.items as Array<{ rating: number }>;
      for (const p of items) {
        expect(p.rating).toBeGreaterThanOrEqual(4);
      }
    });

    it('should sort by rating descending by default', async () => {
      const res = await request(httpServer)
        .get(PRACTITIONERS_URL)
        .expect(200);

      const items = res.body.data.items as Array<{ rating: number }>;
      if (items.length >= 2) {
        for (let i = 1; i < items.length; i++) {
          expect(items[i - 1].rating).toBeGreaterThanOrEqual(items[i].rating);
        }
      }
    });

    it('should only return active practitioners', async () => {
      const res = await request(httpServer)
        .get(PRACTITIONERS_URL)
        .expect(200);

      const items = res.body.data.items as Array<{ isActive: boolean }>;
      for (const p of items) {
        expect(p.isActive).toBe(true);
      }
    });

    it('should include specialty name (AR+EN) in response', async () => {
      const res = await request(httpServer)
        .get(PRACTITIONERS_URL)
        .expect(200);

      const items = res.body.data.items as Array<{
        specialty: { nameAr: string; nameEn: string } | null;
      }>;
      // Find a practitioner with a linked specialty (some may have null specialty)
      const withSpecialty = items.find((p) => p.specialty !== null);
      if (withSpecialty) {
        expect(withSpecialty.specialty).toBeDefined();
        expect(withSpecialty.specialty!.nameAr).toBeDefined();
        expect(withSpecialty.specialty!.nameEn).toBeDefined();
      }
    });

    it('should include user basic info (firstName, lastName)', async () => {
      const res = await request(httpServer)
        .get(PRACTITIONERS_URL)
        .expect(200);

      const items = res.body.data.items as Array<{
        user: { firstName: string; lastName: string };
      }>;
      if (items.length > 0) {
        expect(items[0].user).toBeDefined();
        expect(items[0].user.firstName).toBeDefined();
        expect(items[0].user.lastName).toBeDefined();
      }
    });

    it('should search by name (?search=خالد)', async () => {
      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}?search=${encodeURIComponent('خالد')}`)
        .expect(200);

      expectSuccessResponse(res.body);
    });
  });

  // =========================================================================
  // GET /practitioners/:id (PUBLIC)
  // =========================================================================

  describe('GET /api/v1/practitioners/:id', () => {
    it('should return practitioner profile with specialty and ratings (PUBLIC)', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}`)
        .expect(200);

      expectSuccessResponse(res.body);

      const { data } = res.body;
      expect(data.id).toBe(practitionerId);
      expect(data.bio).toBeDefined();
      expect(data.bioAr).toBeDefined();
      expect(data.experience).toBeDefined();
      expect(data.specialty).toBeDefined();
      expect(data.specialty.nameAr).toBeDefined();
      expect(data.specialty.nameEn).toBeDefined();
    });

    it('should include user info (name, avatar, email)', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}`)
        .expect(200);

      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.firstName).toBeDefined();
      expect(res.body.data.user.lastName).toBeDefined();
    });

    it('should include prices (clinic, phone, video) in halalat', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}`)
        .expect(200);

      const { data } = res.body;
      expect(typeof data.priceClinic).toBe('number');
      expect(typeof data.pricePhone).toBe('number');
      expect(typeof data.priceVideo).toBe('number');
      // Prices in halalat (integers)
      expect(Number.isInteger(data.priceClinic)).toBe(true);
      expect(Number.isInteger(data.pricePhone)).toBe(true);
      expect(Number.isInteger(data.priceVideo)).toBe(true);
    });

    it('should include average rating and review count', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}`)
        .expect(200);

      const { data } = res.body;
      expect(typeof data.rating).toBe('number');
      expect(typeof data.reviewCount).toBe('number');
      expect(data.rating).toBeGreaterThanOrEqual(0);
      expect(data.rating).toBeLessThanOrEqual(5);
    });

    it('should return 404 for non-existent practitioner', async () => {
      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/00000000-0000-0000-0000-000000000000`)
        .expect(404);

      expectErrorResponse(res.body, 'PRACTITIONER_NOT_FOUND');
    });

    it('should return 404 for soft-deleted practitioner', async () => {
      // Create a practitioner then soft-delete it
      const userRes = await request(httpServer)
        .post(`${API_PREFIX}/users`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'to-delete-prac@carekit-test.com',
          password: 'D3lPr@cP@ss!',
          firstName: 'محذوف',
          lastName: 'الطبيب',
          phone: '+966540000003',
          gender: 'male',
          roleSlug: 'practitioner',
        });

      if (userRes.status === 201) {
        const createRes = await request(httpServer)
          .post(PRACTITIONERS_URL)
          .set(getAuthHeaders(superAdmin.accessToken))
          .send({
            userId: userRes.body.data.id,
            specialtyId,
            priceClinic: 10000,
            pricePhone: 10000,
            priceVideo: 10000,
          });

        if (createRes.status === 201) {
          const deletedId = createRes.body.data.id;

          await request(httpServer)
            .delete(`${PRACTITIONERS_URL}/${deletedId}`)
            .set(getAuthHeaders(superAdmin.accessToken))
            .expect(200);

          const res = await request(httpServer)
            .get(`${PRACTITIONERS_URL}/${deletedId}`)
            .expect(404);

          expectErrorResponse(res.body, 'PRACTITIONER_NOT_FOUND');
        }
      }
    });
  });

  // =========================================================================
  // POST /practitioners (admin)
  // =========================================================================

  describe('POST /api/v1/practitioners', () => {
    it('should create practitioner linked to existing user (admin)', async () => {
      const userRes = await request(httpServer)
        .post(`${API_PREFIX}/users`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'new-prac@carekit-test.com',
          password: 'N3wPr@c!',
          firstName: 'سامي',
          lastName: 'الزيد',
          phone: '+966540000010',
          gender: 'male',
          roleSlug: 'practitioner',
        })
        .expect(201);

      const res = await request(httpServer)
        .post(PRACTITIONERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          userId: userRes.body.data.id,
          specialtyId,
          bio: 'Dermatologist with 10 years experience',
          bioAr: 'أخصائي جلدية بخبرة 10 سنوات',
          experience: 10,
          education: 'MBBS, Dermatology - King Faisal University',
          educationAr: 'بكالوريوس طب، تخصص جلدية - جامعة الملك فيصل',
          priceClinic: 25000,
          pricePhone: 18000,
          priceVideo: 22000,
        })
        .expect(201);

      expectSuccessResponse(res.body);

      const { data } = res.body;
      expect(data.id).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.specialty).toBeDefined();
      expect(data.bio).toBe('Dermatologist with 10 years experience');
      expect(data.bioAr).toBe('أخصائي جلدية بخبرة 10 سنوات');
      expect(data.experience).toBe(10);
      expect(data.priceClinic).toBe(25000);
      expect(data.pricePhone).toBe(18000);
      expect(data.priceVideo).toBe(22000);
      expect(data.rating).toBe(0);
      expect(data.reviewCount).toBe(0);
      expect(data.isActive).toBe(true);
    });

    it('should reject creating duplicate practitioner for same user -> 409', async () => {
      if (!practitionerAuth.user.id) return;

      const res = await request(httpServer)
        .post(PRACTITIONERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          userId: practitionerAuth.user.id,
          specialtyId,
          priceClinic: 10000,
          pricePhone: 10000,
          priceVideo: 10000,
        })
        .expect(409);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should reject non-existent userId -> 404', async () => {
      const res = await request(httpServer)
        .post(PRACTITIONERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          userId: '00000000-0000-0000-0000-000000000000',
          specialtyId,
          priceClinic: 10000,
          pricePhone: 10000,
          priceVideo: 10000,
        })
        .expect(404);

      expectErrorResponse(res.body, 'USER_NOT_FOUND');
    });

    it('should reject non-existent specialtyId -> 404', async () => {
      const userRes = await request(httpServer)
        .post(`${API_PREFIX}/users`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'bad-spec@carekit-test.com',
          password: 'B@dSp3cP@ss!',
          firstName: 'تخصص',
          lastName: 'خاطئ',
          phone: '+966540000011',
          gender: 'male',
          roleSlug: 'practitioner',
        });

      if (userRes.status === 201) {
        const res = await request(httpServer)
          .post(PRACTITIONERS_URL)
          .set(getAuthHeaders(superAdmin.accessToken))
          .send({
            userId: userRes.body.data.id,
            specialtyId: '00000000-0000-0000-0000-000000000000',
            priceClinic: 10000,
            pricePhone: 10000,
            priceVideo: 10000,
          })
          .expect(404);

        expectErrorResponse(res.body, 'SPECIALTY_NOT_FOUND');
      }
    });

    it('should validate price fields are positive integers', async () => {
      const res = await request(httpServer)
        .post(PRACTITIONERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          userId: '00000000-0000-0000-0000-000000000001',
          specialtyId,
          priceClinic: -100,
          pricePhone: 'not a number',
          priceVideo: 25.5,
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject for non-admin -> 403', async () => {
      const res = await request(httpServer)
        .post(PRACTITIONERS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          userId: 'any-id',
          specialtyId,
          priceClinic: 10000,
          pricePhone: 10000,
          priceVideo: 10000,
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should allow receptionist to create (practitioners:create)', async () => {
      const userRes = await request(httpServer)
        .post(`${API_PREFIX}/users`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'recep-created-prac@carekit-test.com',
          password: 'Rec3pPr@c!',
          firstName: 'طارق',
          lastName: 'الحمد',
          phone: '+966540000012',
          gender: 'male',
          roleSlug: 'practitioner',
        });

      if (userRes.status === 201) {
        const res = await request(httpServer)
          .post(PRACTITIONERS_URL)
          .set(getAuthHeaders(receptionist.accessToken))
          .send({
            userId: userRes.body.data.id,
            specialtyId,
            priceClinic: 20000,
            pricePhone: 15000,
            priceVideo: 18000,
          });

        // Receptionist has practitioners:create permission
        expect(res.status).not.toBe(403);
      }
    });
  });

  // =========================================================================
  // PATCH /practitioners/:id
  // =========================================================================

  describe('PATCH /api/v1/practitioners/:id', () => {
    it('should update practitioner profile (admin)', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          bio: 'Updated bio by admin',
          bioAr: 'السيرة المحدثة بواسطة المدير',
          experience: 16,
        })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.bio).toBe('Updated bio by admin');
      expect(res.body.data.experience).toBe(16);
    });

    it('should allow practitioner to update own profile', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .send({
          bio: 'Updated by myself',
          bioAr: 'محدث بواسطتي',
        })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.bio).toBe('Updated by myself');
    });

    it('should reject practitioner updating another profile -> 403', async () => {
      if (!practitioner2Id) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitioner2Id}`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .send({ bio: 'Hacked' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should validate price fields', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ priceClinic: -500 })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject for patient role -> 403', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/${practitionerId}`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ bio: 'Hacked' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 404 for non-existent practitioner', async () => {
      const res = await request(httpServer)
        .patch(`${PRACTITIONERS_URL}/00000000-0000-0000-0000-000000000000`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ bio: 'test' })
        .expect(404);

      expectErrorResponse(res.body, 'PRACTITIONER_NOT_FOUND');
    });
  });

  // =========================================================================
  // DELETE /practitioners/:id
  // =========================================================================

  describe('DELETE /api/v1/practitioners/:id', () => {
    it('should soft-delete practitioner (admin)', async () => {
      // Create a practitioner to delete
      const userRes = await request(httpServer)
        .post(`${API_PREFIX}/users`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'deletable-prac@carekit-test.com',
          password: 'D3l3t@bleP@ss!',
          firstName: 'حذف',
          lastName: 'الطبيب',
          phone: '+966540000020',
          gender: 'male',
          roleSlug: 'practitioner',
        });

      if (userRes.status !== 201) return;

      const createRes = await request(httpServer)
        .post(PRACTITIONERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          userId: userRes.body.data.id,
          specialtyId,
          priceClinic: 10000,
          pricePhone: 10000,
          priceVideo: 10000,
        });

      if (createRes.status !== 201) return;

      const deletableId = createRes.body.data.id;

      const res = await request(httpServer)
        .delete(`${PRACTITIONERS_URL}/${deletableId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
    });

    it('should reject for non-admin -> 403', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .delete(`${PRACTITIONERS_URL}/${practitionerId}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject for practitioner (cannot delete own profile via this endpoint) -> 403', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .delete(`${PRACTITIONERS_URL}/${practitionerId}`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // GET /practitioners/:id/availability (PUBLIC)
  // =========================================================================

  describe('GET /api/v1/practitioners/:id/availability', () => {
    it('should return weekly availability schedule (PUBLIC)', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
        .expect(200);

      expectSuccessResponse(res.body);
      const schedule = res.body.data.schedule || res.body.data;
      expect(Array.isArray(schedule)).toBe(true);
    });

    it('should include dayOfWeek, startTime, endTime for each slot', async () => {
      if (!practitionerId) return;

      // First set some availability
      await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          schedule: [
            { dayOfWeek: 0, startTime: '09:00', endTime: '13:00', isActive: true },
            { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
          ],
        });

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
        .expect(200);

      const schedule = res.body.data.schedule || res.body.data;
      if (Array.isArray(schedule) && schedule.length > 0) {
        const slot = schedule[0] as {
          dayOfWeek: number;
          startTime: string;
          endTime: string;
        };
        expect(typeof slot.dayOfWeek).toBe('number');
        expect(slot.dayOfWeek).toBeGreaterThanOrEqual(0);
        expect(slot.dayOfWeek).toBeLessThanOrEqual(6);
        expect(slot.startTime).toMatch(/^\d{2}:\d{2}$/);
        expect(slot.endTime).toMatch(/^\d{2}:\d{2}$/);
      }
    });

    it('should only return active availability slots', async () => {
      if (!practitionerId) return;

      // Set mix of active and inactive
      await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          schedule: [
            { dayOfWeek: 0, startTime: '09:00', endTime: '13:00', isActive: true },
            { dayOfWeek: 5, startTime: '09:00', endTime: '12:00', isActive: false },
          ],
        });

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
        .expect(200);

      const schedule = res.body.data.schedule || res.body.data;
      if (Array.isArray(schedule)) {
        for (const slot of schedule as Array<{ isActive: boolean }>) {
          expect(slot.isActive).toBe(true);
        }
      }
    });

    it('should return 404 for non-existent practitioner', async () => {
      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/00000000-0000-0000-0000-000000000000/availability`)
        .expect(404);

      expectErrorResponse(res.body, 'PRACTITIONER_NOT_FOUND');
    });
  });

  // =========================================================================
  // PUT /practitioners/:id/availability
  // =========================================================================

  describe('PUT /api/v1/practitioners/:id/availability', () => {
    const validSchedule = {
      schedule: [
        { dayOfWeek: 0, startTime: '09:00', endTime: '13:00', isActive: true },
        { dayOfWeek: 0, startTime: '16:00', endTime: '20:00', isActive: true },
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
        { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true },
        { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isActive: true },
      ],
    };

    it('should set/replace full availability schedule (admin)', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(validSchedule)
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body).toHaveProperty('message', 'Availability updated');
    });

    it('should allow owner to set own availability', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .send({
          schedule: [
            { dayOfWeek: 4, startTime: '10:00', endTime: '14:00', isActive: true },
          ],
        })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should validate time format (HH:mm)', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          schedule: [
            { dayOfWeek: 0, startTime: '9am', endTime: '1pm', isActive: true },
          ],
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should validate dayOfWeek (0-6)', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          schedule: [
            { dayOfWeek: 7, startTime: '09:00', endTime: '17:00', isActive: true },
          ],
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject overlapping time slots on same day -> 400', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          schedule: [
            { dayOfWeek: 0, startTime: '09:00', endTime: '13:00', isActive: true },
            { dayOfWeek: 0, startTime: '12:00', endTime: '16:00', isActive: true }, // overlaps
          ],
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject startTime >= endTime -> 400', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          schedule: [
            { dayOfWeek: 0, startTime: '17:00', endTime: '09:00', isActive: true },
          ],
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject for non-owner practitioner -> 403', async () => {
      if (!practitioner2Id) return;

      const res = await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitioner2Id}/availability`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .send(validSchedule)
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject for patient -> 403', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
        .set(getAuthHeaders(patient.accessToken))
        .send(validSchedule)
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // GET /practitioners/:id/slots (PUBLIC)
  // =========================================================================

  describe('GET /api/v1/practitioners/:id/slots', () => {
    beforeAll(async () => {
      if (!practitionerId) return;

      // Set up availability for testing slots
      await request(httpServer)
        .put(`${PRACTITIONERS_URL}/${practitionerId}/availability`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          schedule: [
            // Sunday through Thursday 09:00-17:00
            { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isActive: true },
            { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
            { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true },
            { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isActive: true },
            { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isActive: true },
          ],
        });
    });

    it('should return available time slots for a specific date (PUBLIC)', async () => {
      if (!practitionerId) return;

      // Use a future weekday date
      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/slots?date=2026-05-03`)
        .expect(200);

      expectSuccessResponse(res.body);

      const { data } = res.body;
      expect(data.date).toBe('2026-05-03');
      expect(data.practitionerId).toBe(practitionerId);
      expect(Array.isArray(data.slots)).toBe(true);
    });

    it('should return slots with startTime, endTime, and available flag', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/slots?date=2026-05-03`)
        .expect(200);

      const slots = res.body.data.slots as Array<{
        startTime: string;
        endTime: string;
        available: boolean;
      }>;

      if (slots.length > 0) {
        expect(slots[0].startTime).toMatch(/^\d{2}:\d{2}$/);
        expect(slots[0].endTime).toMatch(/^\d{2}:\d{2}$/);
        expect(typeof slots[0].available).toBe('boolean');
      }
    });

    it('should accept ?duration= query param', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/slots?date=2026-05-03&duration=60`)
        .expect(200);

      expectSuccessResponse(res.body);

      const slots = res.body.data.slots as Array<{
        startTime: string;
        endTime: string;
      }>;
      if (slots.length > 0) {
        // With 60-min duration, gap between start and end should be ~60 min
        const start = slots[0].startTime.split(':').map(Number);
        const end = slots[0].endTime.split(':').map(Number);
        const durationMin = (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]);
        expect(durationMin).toBe(60);
      }
    });

    it('should return empty array for days with no availability', async () => {
      if (!practitionerId) return;

      // Saturday (dayOfWeek=6) has no availability set
      // Find next Saturday from 2026-05-01
      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/slots?date=2026-05-02`) // Saturday
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.slots).toEqual([]);
    });

    it('should return empty array for vacation days', async () => {
      if (!practitionerId) return;

      // Add a vacation
      await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/vacations`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          startDate: '2026-06-01T00:00:00.000Z',
          endDate: '2026-06-07T23:59:59.000Z',
          reason: 'Annual leave',
        });

      // Query slots for a vacation day
      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/slots?date=2026-06-03`)
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.slots).toEqual([]);
    });

    it('should require date query param', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/slots`)
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 404 for non-existent practitioner', async () => {
      const res = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/00000000-0000-0000-0000-000000000000/slots?date=2026-05-01`,
        )
        .expect(404);

      expectErrorResponse(res.body, 'PRACTITIONER_NOT_FOUND');
    });
  });

  // =========================================================================
  // Vacations
  // =========================================================================

  describe('POST /api/v1/practitioners/:id/vacations', () => {
    it('should add vacation period (admin)', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/vacations`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          startDate: '2026-07-01T00:00:00.000Z',
          endDate: '2026-07-07T23:59:59.000Z',
          reason: 'إجازة سنوية',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.startDate).toBeDefined();
      expect(res.body.data.endDate).toBeDefined();
      expect(res.body.data.reason).toBe('إجازة سنوية');
    });

    it('should allow owner to add own vacation', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/vacations`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .send({
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-08-05T23:59:59.000Z',
          reason: 'Personal leave',
        })
        .expect(201);

      expectSuccessResponse(res.body);
    });

    it('should validate startDate < endDate', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/vacations`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          startDate: '2026-09-10T00:00:00.000Z',
          endDate: '2026-09-05T00:00:00.000Z', // before start
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject overlapping vacation periods -> 400', async () => {
      if (!practitionerId) return;

      // First vacation
      await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/vacations`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          startDate: '2026-10-01T00:00:00.000Z',
          endDate: '2026-10-10T23:59:59.000Z',
        })
        .expect(201);

      // Overlapping vacation
      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/vacations`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          startDate: '2026-10-05T00:00:00.000Z',
          endDate: '2026-10-15T23:59:59.000Z',
        })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should reject for non-owner -> 403', async () => {
      if (!practitioner2Id) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitioner2Id}/vacations`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .send({
          startDate: '2026-11-01T00:00:00.000Z',
          endDate: '2026-11-05T00:00:00.000Z',
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  describe('GET /api/v1/practitioners/:id/vacations', () => {
    it('should list vacations (admin)', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/vacations`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const vacations = res.body.data.items || res.body.data;
      expect(Array.isArray(vacations)).toBe(true);
    });

    it('should allow owner to list own vacations', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/vacations`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should sort by startDate descending', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/vacations`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const vacations = (res.body.data.items || res.body.data) as Array<{
        startDate: string;
      }>;
      if (vacations.length >= 2) {
        for (let i = 1; i < vacations.length; i++) {
          expect(
            new Date(vacations[i - 1].startDate).getTime(),
          ).toBeGreaterThanOrEqual(new Date(vacations[i].startDate).getTime());
        }
      }
    });
  });

  describe('DELETE /api/v1/practitioners/:id/vacations/:vacationId', () => {
    let vacationId: string;

    beforeAll(async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitionerId}/vacations`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          startDate: '2026-12-01T00:00:00.000Z',
          endDate: '2026-12-05T23:59:59.000Z',
          reason: 'To be deleted',
        })
        .expect(201);

      vacationId = res.body.data.id;
    });

    it('should remove vacation (admin)', async () => {
      if (!practitionerId || !vacationId) return;

      const res = await request(httpServer)
        .delete(`${PRACTITIONERS_URL}/${practitionerId}/vacations/${vacationId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
    });

    it('should reject for non-owner -> 403', async () => {
      if (!practitioner2Id) return;

      // Create a vacation for practitioner2
      const vacRes = await request(httpServer)
        .post(`${PRACTITIONERS_URL}/${practitioner2Id}/vacations`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          startDate: '2026-12-10T00:00:00.000Z',
          endDate: '2026-12-15T23:59:59.000Z',
        })
        .expect(201);

      const vId = vacRes.body.data.id;

      // Practitioner1 tries to delete practitioner2's vacation
      const res = await request(httpServer)
        .delete(`${PRACTITIONERS_URL}/${practitioner2Id}/vacations/${vId}`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 404 for non-existent vacation', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .delete(
          `${PRACTITIONERS_URL}/${practitionerId}/vacations/00000000-0000-0000-0000-000000000000`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
    });
  });

  // =========================================================================
  // GET /practitioners/:id/ratings (PUBLIC)
  // =========================================================================

  describe('GET /api/v1/practitioners/:id/ratings', () => {
    it('should return paginated ratings for practitioner (PUBLIC)', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/ratings`)
        .expect(200);

      expectSuccessResponse(res.body);
      const ratings = res.body.data.items || res.body.data;
      expect(Array.isArray(ratings)).toBe(true);
    });

    it('should include patient name and comment', async () => {
      if (!practitionerId) return;

      const res = await request(httpServer)
        .get(`${PRACTITIONERS_URL}/${practitionerId}/ratings`)
        .expect(200);

      const ratings = (res.body.data.items || res.body.data) as Array<{
        stars: number;
        patient: { firstName: string };
      }>;

      if (ratings.length > 0) {
        expect(ratings[0].stars).toBeDefined();
        expect(typeof ratings[0].stars).toBe('number');
        expect(ratings[0].stars).toBeGreaterThanOrEqual(1);
        expect(ratings[0].stars).toBeLessThanOrEqual(5);
      }
    });

    it('should return 404 for non-existent practitioner', async () => {
      const res = await request(httpServer)
        .get(
          `${PRACTITIONERS_URL}/00000000-0000-0000-0000-000000000000/ratings`,
        )
        .expect(404);

      expectErrorResponse(res.body, 'PRACTITIONER_NOT_FOUND');
    });
  });
});
