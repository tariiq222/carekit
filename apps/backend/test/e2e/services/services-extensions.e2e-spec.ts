/**
 * CareKit — Services Extensions E2E Tests
 *
 * Duration Options: PUT/GET /services/:id/duration-options
 * Booking Types:   PUT/GET /services/:id/booking-types
 *
 * Permission matrix (services module):
 *   super_admin  → view, create, edit, delete
 *   receptionist → view, create, edit (no delete)
 *   patient      → view only
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  createTestUserWithRole,
  registerTestPatient,
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

    patient = await registerTestPatient(httpServer);

    // Create category for tests
    const catRes = await request(httpServer)
      .post(CATEGORIES_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        nameEn: 'Extensions Test Category',
        nameAr: 'فئة اختبار الامتدادات',
      })
      .expect(201);

    categoryId = catRes.body.data.id as string;

    // Create service for tests
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

  // ═══════════════════════════════════════════════════════════════
  //  DURATION OPTIONS
  // ═══════════════════════════════════════════════════════════════

  describe('PUT /services/:id/duration-options', () => {
    const validOptions = {
      options: [
        {
          label: '30 min',
          labelAr: '٣٠ دقيقة',
          durationMinutes: 30,
          price: 15000,
          isDefault: true,
        },
        {
          label: '60 min',
          labelAr: '٦٠ دقيقة',
          durationMinutes: 60,
          price: 25000,
          isDefault: false,
        },
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.data[0].durationMinutes).toBe(30);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.data[0].price).toBe(15000);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.data[0].isDefault).toBe(true);
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
        .put(
          `${SERVICES_URL}/00000000-0000-0000-0000-000000000000/duration-options`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(validOptions)
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should replace options on second call (idempotent replace)', async () => {
      // Set a single option
      await request(httpServer)
        .put(`${SERVICES_URL}/${serviceId}/duration-options`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          options: [
            {
              label: '45 min',
              labelAr: '٤٥ دقيقة',
              durationMinutes: 45,
              price: 18000,
              isDefault: true,
            },
          ],
        })
        .expect(200);

      // Verify only 1 option remains
      const res = await request(httpServer)
        .get(`${SERVICES_URL}/${serviceId}/duration-options`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.data[0].durationMinutes).toBe(45);
    });
  });

  describe('GET /services/:id/duration-options', () => {
    it('should return duration options for a service (authenticated)', async () => {
      const res = await request(httpServer)
        .get(`${SERVICES_URL}/${serviceId}/duration-options`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 404 for non-existent service', async () => {
      const res = await request(httpServer)
        .get(
          `${SERVICES_URL}/00000000-0000-0000-0000-000000000000/duration-options`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  BOOKING TYPES
  // ═══════════════════════════════════════════════════════════════

  describe('PUT /services/:id/booking-types', () => {
    const validBookingTypes = {
      types: [
        {
          bookingType: 'in_person',
          price: 15000,
          duration: 30,
          isActive: true,
        },
        { bookingType: 'online', price: 10000, duration: 30, isActive: true },
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

      const inPerson = (
        res.body.data as Array<{ bookingType: string; price: number }>
      ).find((t) => t.bookingType === 'in_person');
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
          types: [
            {
              bookingType: 'home_visit',
              price: 10000,
              duration: 30,
              isActive: true,
            },
          ],
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 404 for non-existent service', async () => {
      const res = await request(httpServer)
        .put(
          `${SERVICES_URL}/00000000-0000-0000-0000-000000000000/booking-types`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(validBookingTypes)
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should replace booking types on second call (idempotent replace)', async () => {
      // Replace with single in_person type
      await request(httpServer)
        .put(`${SERVICES_URL}/${serviceId}/booking-types`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          types: [
            {
              bookingType: 'in_person',
              price: 20000,
              duration: 45,
              isActive: true,
            },
          ],
        })
        .expect(200);

      // Verify only 1 type remains
      const res = await request(httpServer)
        .get(`${SERVICES_URL}/${serviceId}/booking-types`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.data[0].bookingType).toBe('in_person');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.data[0].price).toBe(20000);
    });
  });

  describe('GET /services/:id/booking-types', () => {
    it('should return booking types for a service (authenticated)', async () => {
      const res = await request(httpServer)
        .get(`${SERVICES_URL}/${serviceId}/booking-types`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 404 for non-existent service', async () => {
      const res = await request(httpServer)
        .get(
          `${SERVICES_URL}/00000000-0000-0000-0000-000000000000/booking-types`,
        )
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });
  });
});
