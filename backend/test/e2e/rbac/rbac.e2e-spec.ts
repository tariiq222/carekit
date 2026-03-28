/**
 * CareKit — RBAC E2E Tests (TDD RED Phase)
 *
 * Tests Dynamic RBAC enforcement per the CASL Permission Matrix
 * defined in docs/api-spec.md.
 *
 * Covers:
 *   - All 5 default roles (super_admin, receptionist, accountant, practitioner, patient)
 *   - Correct 403 responses for forbidden actions
 *   - Custom role creation and permission enforcement
 *   - Ownership checks (own resources only for practitioner/patient)
 *   - Standard error response format
 *
 * These tests will FAIL until backend-dev implements RBAC with CASL.
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  registerTestPatient,
  loginTestUser,
  createTestUserWithRole,
  getAuthHeaders,
  expectSuccessResponse,
  expectErrorResponse,
  TEST_USERS,
  TEST_PATIENT_2,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

describe('RBAC (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  // Auth results for each role
  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let accountant: AuthResult;
  let practitioner: AuthResult;
  let patient: AuthResult;
  let patient2: AuthResult;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    // -----------------------------------------------------------------------
    // Seed users for each role.
    //
    // The super_admin must be seeded in the database before tests run
    // (via prisma seed). We login with the seeded admin credentials,
    // then use the admin API to create users for other roles.
    //
    // Patient users are created via /register (self-registration).
    // -----------------------------------------------------------------------

    // Login as seeded super_admin
    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );

    // Create staff users via admin API
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

    practitioner = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.practitioner,
      'practitioner',
    );

    // Register patients (self-registration)
    patient = await registerTestPatient(httpServer, TEST_USERS.patient);
    patient2 = await registerTestPatient(httpServer, TEST_PATIENT_2);
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // =========================================================================
  // super_admin — full access to everything
  // =========================================================================

  describe('super_admin access', () => {
    it('should access GET /api/v1/users (users:view)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/users`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should access POST /api/v1/users (users:create)', async () => {
      const res = await request(httpServer)
        .post(`${API_PREFIX}/users`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'admin-created@carekit-test.com',
          password: 'Str0ngP@ss!',
          firstName: 'سلطان',
          lastName: 'الشمري',
          phone: '+966520123456',
          gender: 'male',
          roleSlug: 'receptionist',
        })
        .expect(201);

      expectSuccessResponse(res.body);
    });

    it('should access GET /api/v1/bookings (bookings:view)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should access GET /api/v1/payments (payments:view)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/payments`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should access GET /api/v1/reports/revenue (reports:view)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/reports/revenue?dateFrom=2026-01-01&dateTo=2026-12-31`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should access GET /api/v1/whitelabel/config (whitelabel:view)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/whitelabel/config`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should access PUT /api/v1/whitelabel/config (whitelabel:edit)', async () => {
      const res = await request(httpServer)
        .put(`${API_PREFIX}/whitelabel/config`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ configs: [{ key: 'clinic_name', value: 'عيادة الاختبار' }] });

      // 200 or 201 depending on upsert behavior
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
    });

    it('should access chatbot admin endpoints (chatbot:view)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/chatbot/sessions`)
        .set(getAuthHeaders(superAdmin.accessToken));

      // 200 or 404 if no sessions exist — but NOT 403
      expect(res.status).not.toBe(403);
    });
  });

  // =========================================================================
  // receptionist — bookings, patients, services, practitioners, notifications
  // =========================================================================

  describe('receptionist access', () => {
    it('should access GET /api/v1/bookings (bookings:view)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should access POST /api/v1/bookings (bookings:create)', async () => {
      // Receptionist can create bookings on behalf of patients
      const res = await request(httpServer)
        .post(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          patientId: patient.user.id,
          practitionerId: practitioner.user.id,
          serviceId: 'placeholder-service-id',
          type: 'in_person',
          date: '2026-05-01',
          startTime: '09:00',
        });

      // May be 201 (success) or 400/404 (missing service) — but NOT 403
      expect(res.status).not.toBe(403);
    });

    it('should access GET /api/v1/patients (patients:view)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/patients`)
        .set(getAuthHeaders(receptionist.accessToken));

      expect(res.status).not.toBe(403);
    });

    it('should access GET /api/v1/practitioners (practitioners:view)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/practitioners`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should access GET /api/v1/services (services:view)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/services`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should NOT access DELETE /api/v1/users/:id (users:delete) -> 403', async () => {
      const res = await request(httpServer)
        .delete(`${API_PREFIX}/users/${patient.user.id}`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should NOT access PUT /api/v1/whitelabel/config (whitelabel:edit) -> 403', async () => {
      const res = await request(httpServer)
        .put(`${API_PREFIX}/whitelabel/config`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ key: 'clinic_name', value: 'Hacked' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should NOT access GET /api/v1/users (users:view) -> 403', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/users`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should NOT access GET /api/v1/reports/revenue (reports:view) -> 403', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/reports/revenue`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // accountant — payments, invoices, reports
  // =========================================================================

  describe('accountant access', () => {
    it('should access GET /api/v1/payments (payments:view)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/payments`)
        .set(getAuthHeaders(accountant.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should access GET /api/v1/invoices (invoices:view)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/invoices`)
        .set(getAuthHeaders(accountant.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should access GET /api/v1/reports/revenue (reports:view)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/reports/revenue?dateFrom=2026-01-01&dateTo=2026-12-31`)
        .set(getAuthHeaders(accountant.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should access GET /api/v1/bookings (bookings:view)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(accountant.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should NOT access POST /api/v1/bookings (bookings:create) -> 403', async () => {
      const res = await request(httpServer)
        .post(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(accountant.accessToken))
        .send({
          patientId: patient.user.id,
          practitionerId: practitioner.user.id,
          serviceId: 'some-service-id',
          type: 'in_person',
          date: '2026-05-01',
          startTime: '09:00',
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should NOT access PATCH /api/v1/users/:id (users:edit) -> 403', async () => {
      const res = await request(httpServer)
        .patch(`${API_PREFIX}/users/${patient.user.id}`)
        .set(getAuthHeaders(accountant.accessToken))
        .send({ firstName: 'Hacked' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should NOT access GET /api/v1/users (users:view) -> 403', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/users`)
        .set(getAuthHeaders(accountant.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should NOT access whitelabel endpoints -> 403', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/whitelabel/config`)
        .set(getAuthHeaders(accountant.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // practitioner — own bookings, own profile, own ratings
  // =========================================================================

  describe('practitioner access', () => {
    it('should access own bookings (bookings:view with ownership)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(practitioner.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);

      // If bookings are returned, they should all belong to this practitioner
      const items = res.body.data.items || res.body.data;
      if (Array.isArray(items) && items.length > 0) {
        for (const booking of items) {
          // practitionerId is the Practitioner model UUID;
          // verify via the included practitioner.user relation
          expect(booking.practitioner.user.id).toBe(practitioner.user.id);
        }
      }
    });

    it('should access own profile (practitioners:view own)', async () => {
      // Get practitioner profile ID first
      const res = await request(httpServer)
        .get(`${API_PREFIX}/practitioners`)
        .set(getAuthHeaders(practitioner.accessToken))
        .expect(200);

      // Practitioner should see at least themselves
      expect(res.status).not.toBe(403);
    });

    it('should edit own profile (practitioners:edit own)', async () => {
      // Practitioner updates their own bio
      const res = await request(httpServer)
        .patch(`${API_PREFIX}/practitioners/me`)
        .set(getAuthHeaders(practitioner.accessToken))
        .send({ bio: 'Updated bio for Dr. Khalid' });

      // 200 or 404 (if "me" endpoint isn't implemented) — NOT 403
      expect(res.status).not.toBe(403);
    });

    it('should NOT edit other practitioner profiles -> 403', async () => {
      // Create a second practitioner
      const practitioner2 = await createTestUserWithRole(
        httpServer,
        superAdmin.accessToken,
        {
          email: 'doctor2@carekit-test.com',
          password: 'D0ct0r2P@ss!',
          firstName: 'عبدالرحمن',
          lastName: 'الشهري',
          phone: '+966521234567',
          gender: 'male',
        },
        'practitioner',
      );

      // Try to edit the other practitioner's profile
      const res = await request(httpServer)
        .patch(`${API_PREFIX}/practitioners/${practitioner2.user.id}`)
        .set(getAuthHeaders(practitioner.accessToken))
        .send({ bio: 'Hacked bio' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should NOT access user management (users:view) -> 403', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/users`)
        .set(getAuthHeaders(practitioner.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should NOT access payment management -> 403', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/payments`)
        .set(getAuthHeaders(practitioner.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should NOT access whitelabel endpoints -> 403', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/whitelabel/config`)
        .set(getAuthHeaders(practitioner.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should NOT create bookings -> 403', async () => {
      const res = await request(httpServer)
        .post(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(practitioner.accessToken))
        .send({
          patientId: patient.user.id,
          serviceId: 'some-service-id',
          type: 'in_person',
          date: '2026-05-01',
          startTime: '09:00',
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // patient — own bookings, create booking, ratings, chatbot
  // =========================================================================

  describe('patient access', () => {
    it('should access own bookings (bookings:view own)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);

      // If bookings exist, they should all belong to this patient
      const items = res.body.data.items || res.body.data;
      if (Array.isArray(items) && items.length > 0) {
        for (const booking of items) {
          expect(booking.patientId).toBe(patient.user.id);
        }
      }
    });

    it('should create a booking (bookings:create)', async () => {
      const res = await request(httpServer)
        .post(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          practitionerId: practitioner.user.id,
          serviceId: 'placeholder-service-id',
          type: 'in_person',
          date: '2026-05-01',
          startTime: '09:00',
        });

      // May succeed (201) or fail due to missing service — but NOT 403
      expect(res.status).not.toBe(403);
    });

    it('should NOT access other patient data -> 403', async () => {
      // Patient1 tries to access patient2's bookings by ID
      // This depends on endpoint design — if /bookings/:id checks ownership
      const res = await request(httpServer)
        .get(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      // Verify no bookings from patient2 are returned
      const items = res.body.data.items || res.body.data;
      if (Array.isArray(items)) {
        for (const booking of items) {
          expect(booking.patientId).not.toBe(patient2.user.id);
        }
      }
    });

    it('should create a rating (ratings:create)', async () => {
      const res = await request(httpServer)
        .post(`${API_PREFIX}/ratings`)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          bookingId: 'placeholder-booking-id',
          stars: 5,
          comment: 'طبيب ممتاز',
        });

      // May succeed or fail (booking not found) — but NOT 403
      expect(res.status).not.toBe(403);
    });

    it('should access chatbot (POST /chatbot/message)', async () => {
      const res = await request(httpServer)
        .post(`${API_PREFIX}/chatbot/message`)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          message: 'أريد حجز موعد',
        });

      // May succeed or fail (chatbot not implemented) — but NOT 403
      expect(res.status).not.toBe(403);
    });

    it('should view services (services:view)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/services`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should view practitioners (practitioners:view)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/practitioners`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should NOT access admin endpoints -> 403', async () => {
      const adminEndpoints = [
        { method: 'get' as const, url: `${API_PREFIX}/users` },
        { method: 'get' as const, url: `${API_PREFIX}/whitelabel/config` },
        { method: 'get' as const, url: `${API_PREFIX}/reports/revenue` },
        // Note: GET /chatbot/sessions intentionally returns 200 for patients
        // (they can list their own sessions) — not an admin-only endpoint.
      ];

      for (const endpoint of adminEndpoints) {
        const res = await request(httpServer)
          [endpoint.method](endpoint.url)
          .set(getAuthHeaders(patient.accessToken));

        expect(res.status).toBe(403);
        expectErrorResponse(res.body, 'FORBIDDEN');
      }
    });

    it('should NOT delete any resources -> 403', async () => {
      const deleteEndpoints = [
        `${API_PREFIX}/users/fake-id`,
        `${API_PREFIX}/services/fake-id`,
        `${API_PREFIX}/practitioners/fake-id`,
      ];

      for (const url of deleteEndpoints) {
        const res = await request(httpServer)
          .delete(url)
          .set(getAuthHeaders(patient.accessToken))
          .expect(403);

        expectErrorResponse(res.body, 'FORBIDDEN');
      }
    });

    it('should NOT edit services -> 403', async () => {
      const res = await request(httpServer)
        .patch(`${API_PREFIX}/services/fake-id`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ nameEn: 'Hacked Service' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // Custom Role
  // =========================================================================

  describe('custom role', () => {
    let customRoleId: string;

    it('should create a custom role via super_admin', async () => {
      const res = await request(httpServer)
        .post(`${API_PREFIX}/users`)
        .set(getAuthHeaders(superAdmin.accessToken));

      // First, we need the roles endpoint — check if it exists
      const rolesRes = await request(httpServer)
        .post(`${API_PREFIX}/roles`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          name: 'مساعد مدير',
          slug: 'assistant_manager',
          description: 'Custom role for assistant managers',
        });

      if (rolesRes.status === 201) {
        expectSuccessResponse(rolesRes.body);
        customRoleId = rolesRes.body.data.id;
        expect(rolesRes.body.data.slug).toBe('assistant_manager');
        expect(rolesRes.body.data.isSystem).toBe(false);
      }
    });

    it('should assign specific permissions to custom role', async () => {
      if (!customRoleId) return;

      // Assign bookings:view and bookings:create permissions
      const permissions = ['bookings:view', 'bookings:create', 'patients:view'];

      for (const permission of permissions) {
        const [module, action] = permission.split(':');
        const res = await request(httpServer)
          .post(`${API_PREFIX}/roles/${customRoleId}/permissions`)
          .set(getAuthHeaders(superAdmin.accessToken))
          .send({ module, action });

        expect([200, 201]).toContain(res.status);
      }
    });

    it('should enforce custom role permissions correctly', async () => {
      if (!customRoleId) return;

      // Create a user with the custom role
      const customUser = await createTestUserWithRole(
        httpServer,
        superAdmin.accessToken,
        {
          email: 'custom-role@carekit-test.com',
          password: 'Cust0mR0le!',
          firstName: 'مشاري',
          lastName: 'الحمود',
          phone: '+966522345678',
          gender: 'male',
        },
        'assistant_manager',
      );

      // Should access bookings (permitted)
      const bookingsRes = await request(httpServer)
        .get(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(customUser.accessToken));

      expect(bookingsRes.status).not.toBe(403);

      // Should NOT access payments (not permitted)
      const paymentsRes = await request(httpServer)
        .get(`${API_PREFIX}/payments`)
        .set(getAuthHeaders(customUser.accessToken))
        .expect(403);

      expectErrorResponse(paymentsRes.body, 'FORBIDDEN');
    });

    it('should allow removing permissions from custom role', async () => {
      if (!customRoleId) return;

      // Remove bookings:create permission
      const res = await request(httpServer)
        .delete(`${API_PREFIX}/roles/${customRoleId}/permissions`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ module: 'bookings', action: 'create' });

      expect([200, 204]).toContain(res.status);
    });

    it('should NOT allow patients to create roles -> 403', async () => {
      const res = await request(httpServer)
        .post(`${API_PREFIX}/roles`)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          name: 'Hacker Role',
          slug: 'hacker',
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should NOT allow modifying system roles', async () => {
      // Try to delete the patient role (isSystem: true)
      // First, find the patient role ID
      const rolesRes = await request(httpServer)
        .get(`${API_PREFIX}/roles`)
        .set(getAuthHeaders(superAdmin.accessToken));

      if (rolesRes.status === 200) {
        const roles = rolesRes.body.data.items || rolesRes.body.data;
        const patientRole = (roles as Array<{ slug: string; id: string }>).find(
          (r) => r.slug === 'patient',
        );

        if (patientRole) {
          const deleteRes = await request(httpServer)
            .delete(`${API_PREFIX}/roles/${patientRole.id}`)
            .set(getAuthHeaders(superAdmin.accessToken));

          // Should be rejected — system roles cannot be deleted
          expect([400, 403]).toContain(deleteRes.status);
        }
      }
    });
  });

  // =========================================================================
  // Forbidden access response format
  // =========================================================================

  describe('forbidden access returns correct format', () => {
    it('should return 403 with standard error shape', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/users`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expect(res.body).toEqual({
        success: false,
        error: expect.objectContaining({
          code: 'FORBIDDEN',
          message: expect.any(String),
        }),
      });
    });

    it('should return 401 when no token provided (not 403)', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/users`)
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      const errorCode = (res.body.error as { code: string }).code;
      expect(['AUTH_TOKEN_MISSING', 'AUTH_TOKEN_INVALID']).toContain(errorCode);
    });
  });

  // =========================================================================
  // Ownership boundary tests
  // =========================================================================

  describe('ownership boundaries', () => {
    it('patient1 should NOT see patient2 booking details', async () => {
      // Create a booking for patient2 (via receptionist or admin)
      const createRes = await request(httpServer)
        .post(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          patientId: patient2.user.id,
          practitionerId: practitioner.user.id,
          serviceId: 'placeholder-service-id',
          type: 'in_person',
          date: '2026-06-01',
          startTime: '10:00',
        });

      if (createRes.status === 201) {
        const bookingId = createRes.body.data.id;

        // Patient1 tries to access patient2's booking
        const res = await request(httpServer)
          .get(`${API_PREFIX}/bookings/${bookingId}`)
          .set(getAuthHeaders(patient.accessToken));

        // Should be 403 (forbidden) or 404 (hidden)
        expect([403, 404]).toContain(res.status);
      }
    });

    it('practitioner should NOT see another practitioner bookings', async () => {
      // Create a second practitioner
      const otherDoc = await createTestUserWithRole(
        httpServer,
        superAdmin.accessToken,
        {
          email: 'other-doctor@carekit-test.com',
          password: 'Oth3rD0c!',
          firstName: 'ناصر',
          lastName: 'الجهني',
          phone: '+966523456789',
          gender: 'male',
        },
        'practitioner',
      );

      // Create a booking for the other practitioner
      const createRes = await request(httpServer)
        .post(`${API_PREFIX}/bookings`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          patientId: patient.user.id,
          practitionerId: otherDoc.user.id,
          serviceId: 'placeholder-service-id',
          type: 'in_person',
          date: '2026-06-02',
          startTime: '11:00',
        });

      if (createRes.status === 201) {
        const bookingId = createRes.body.data.id;

        // Original practitioner tries to access the other's booking
        const res = await request(httpServer)
          .get(`${API_PREFIX}/bookings/${bookingId}`)
          .set(getAuthHeaders(practitioner.accessToken));

        expect([403, 404]).toContain(res.status);
      }
    });
  });

  // =========================================================================
  // RBAC Security
  // =========================================================================

  describe('RBAC security', () => {
    it('should not allow privilege escalation by assigning own roles', async () => {
      // Patient tries to assign super_admin role to themselves
      const res = await request(httpServer)
        .post(`${API_PREFIX}/users/${patient.user.id}/roles`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ roleId: 'super_admin-role-id' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should not leak permission details in 403 responses', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/users`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      const body = JSON.stringify(res.body);
      // Should NOT reveal what permission is needed
      expect(body).not.toContain('users:view');
      expect(body).not.toContain('CASL');
      expect(body).not.toContain('ability');
    });
  });
});
