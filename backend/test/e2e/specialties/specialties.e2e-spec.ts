/**
 * CareKit — Specialties Module E2E Tests (TDD RED Phase)
 *
 * Tests all specialty endpoints per docs/api-spec.md:
 *   GET    /specialties          — list all (PUBLIC)
 *   GET    /specialties/:id      — get by ID (PUBLIC)
 *   POST   /specialties          — create (PERMISSION:practitioners:create)
 *   PATCH  /specialties/:id      — update (PERMISSION:practitioners:edit)
 *   DELETE /specialties/:id      — delete (PERMISSION:practitioners:delete)
 *
 * Specialties use the "practitioners" permission module for authorization.
 * These tests will FAIL until backend-dev implements the specialties module.
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

const SPECIALTIES_URL = `${API_PREFIX}/specialties`;

describe('Specialties Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let practitionerAuth: AuthResult;
  let accountant: AuthResult;
  let patient: AuthResult;

  // IDs populated during tests
  let createdSpecialtyId: string;

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

    patient = await registerTestPatient(httpServer);
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ─────────────────────────────────────────────────────────────
  // GET /specialties — List All (PUBLIC)
  // ─────────────────────────────────────────────────────────────

  describe('GET /specialties', () => {
    it('should return specialties list without authentication (PUBLIC)', async () => {
      const res = await request(httpServer).get(SPECIALTIES_URL).expect(200);

      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return seeded specialties with correct shape', async () => {
      const res = await request(httpServer).get(SPECIALTIES_URL).expect(200);

      expectSuccessResponse(res.body);
      const specialties = res.body.data as Array<Record<string, unknown>>;
      expect(specialties.length).toBeGreaterThanOrEqual(8); // 8 seeded specialties

      // Verify shape of each specialty
      for (const specialty of specialties) {
        expect(specialty).toHaveProperty('id');
        expect(specialty).toHaveProperty('nameAr');
        expect(specialty).toHaveProperty('nameEn');
        expect(specialty).toHaveProperty('sortOrder');
        expect(specialty).toHaveProperty('isActive');
        expect(typeof specialty.nameAr).toBe('string');
        expect(typeof specialty.nameEn).toBe('string');
      }
    });

    it('should return specialties sorted by sortOrder ascending', async () => {
      const res = await request(httpServer).get(SPECIALTIES_URL).expect(200);

      const specialties = res.body.data as Array<{ sortOrder: number }>;
      for (let i = 1; i < specialties.length; i++) {
        expect(specialties[i].sortOrder).toBeGreaterThanOrEqual(
          specialties[i - 1].sortOrder,
        );
      }
    });

    it('should only return active specialties by default', async () => {
      const res = await request(httpServer).get(SPECIALTIES_URL).expect(200);

      const specialties = res.body.data as Array<{ isActive: boolean }>;
      for (const s of specialties) {
        expect(s.isActive).toBe(true);
      }
    });

    it('should include Arabic and English names for all specialties', async () => {
      const res = await request(httpServer).get(SPECIALTIES_URL).expect(200);

      const specialties = res.body.data as Array<{
        nameAr: string;
        nameEn: string;
      }>;
      for (const s of specialties) {
        expect(s.nameAr.length).toBeGreaterThan(0);
        expect(s.nameEn.length).toBeGreaterThan(0);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /specialties/:id — Get by ID (PUBLIC)
  // ─────────────────────────────────────────────────────────────

  describe('GET /specialties/:id', () => {
    it('should return a single specialty by ID without authentication', async () => {
      // First, get the list to obtain a valid ID
      const listRes = await request(httpServer)
        .get(SPECIALTIES_URL)
        .expect(200);

      const firstSpecialty = listRes.body.data[0] as { id: string };
      expect(firstSpecialty).toBeDefined();

      const res = await request(httpServer)
        .get(`${SPECIALTIES_URL}/${firstSpecialty.id}`)
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id', firstSpecialty.id);
      expect(res.body.data).toHaveProperty('nameAr');
      expect(res.body.data).toHaveProperty('nameEn');
      expect(res.body.data).toHaveProperty('descriptionAr');
      expect(res.body.data).toHaveProperty('descriptionEn');
      expect(res.body.data).toHaveProperty('iconUrl');
      expect(res.body.data).toHaveProperty('sortOrder');
      expect(res.body.data).toHaveProperty('isActive');
    });

    it('should return 404 for non-existent specialty ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .get(`${SPECIALTIES_URL}/${fakeId}`)
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(httpServer)
        .get(`${SPECIALTIES_URL}/not-a-uuid`)
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /specialties — Create (PERMISSION:practitioners:create)
  // ─────────────────────────────────────────────────────────────

  describe('POST /specialties', () => {
    const validSpecialty = {
      nameEn: 'Neurology',
      nameAr: 'طب الأعصاب',
      descriptionEn: 'Diagnosis and treatment of nervous system disorders',
      descriptionAr: 'تشخيص وعلاج اضطرابات الجهاز العصبي',
      iconUrl: 'https://cdn.example.com/icons/neurology.svg',
      sortOrder: 9,
    };

    it('should create a specialty as super_admin', async () => {
      const res = await request(httpServer)
        .post(SPECIALTIES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(validSpecialty)
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('nameEn', validSpecialty.nameEn);
      expect(res.body.data).toHaveProperty('nameAr', validSpecialty.nameAr);
      expect(res.body.data).toHaveProperty(
        'descriptionEn',
        validSpecialty.descriptionEn,
      );
      expect(res.body.data).toHaveProperty(
        'descriptionAr',
        validSpecialty.descriptionAr,
      );
      expect(res.body.data).toHaveProperty(
        'sortOrder',
        validSpecialty.sortOrder,
      );
      expect(res.body.data).toHaveProperty('isActive', true);

      // Save ID for later tests
      createdSpecialtyId = res.body.data.id as string;
    });

    it('should create a specialty as receptionist (has practitioners:create)', async () => {
      const res = await request(httpServer)
        .post(SPECIALTIES_URL)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          nameEn: 'Oncology',
          nameAr: 'علم الأورام',
          descriptionEn: 'Cancer diagnosis and treatment',
          descriptionAr: 'تشخيص وعلاج السرطان',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('nameEn', 'Oncology');
    });

    it('should reject creation without authentication (401)', async () => {
      const res = await request(httpServer)
        .post(SPECIALTIES_URL)
        .send(validSpecialty)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject creation by patient (403 — no practitioners:create)', async () => {
      const res = await request(httpServer)
        .post(SPECIALTIES_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          nameEn: 'Urology',
          nameAr: 'جراحة المسالك البولية',
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject creation by accountant (403 — no practitioners:create)', async () => {
      const res = await request(httpServer)
        .post(SPECIALTIES_URL)
        .set(getAuthHeaders(accountant.accessToken))
        .send({
          nameEn: 'Urology',
          nameAr: 'جراحة المسالك البولية',
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject creation by practitioner (403 — practitioners have own, not create)', async () => {
      const res = await request(httpServer)
        .post(SPECIALTIES_URL)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .send({
          nameEn: 'Urology',
          nameAr: 'جراحة المسالك البولية',
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject creation without required fields (nameEn, nameAr)', async () => {
      const res = await request(httpServer)
        .post(SPECIALTIES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({})
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject duplicate nameEn (unique constraint)', async () => {
      const res = await request(httpServer)
        .post(SPECIALTIES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: validSpecialty.nameEn, // Already created above
          nameAr: 'اسم مكرر',
        })
        .expect(409);

      expectErrorResponse(res.body, 'CONFLICT');
    });

    it('should default sortOrder to 0 when not provided', async () => {
      const res = await request(httpServer)
        .post(SPECIALTIES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Rheumatology',
          nameAr: 'أمراض الروماتيزم',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('sortOrder', 0);
    });

    it('should default isActive to true', async () => {
      const res = await request(httpServer)
        .post(SPECIALTIES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Nephrology',
          nameAr: 'أمراض الكلى',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('isActive', true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /specialties/:id — Update (PERMISSION:practitioners:edit)
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /specialties/:id', () => {
    it('should update a specialty as super_admin', async () => {
      const res = await request(httpServer)
        .patch(`${SPECIALTIES_URL}/${createdSpecialtyId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          descriptionEn: 'Updated description for neurology',
          sortOrder: 15,
        })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty(
        'descriptionEn',
        'Updated description for neurology',
      );
      expect(res.body.data).toHaveProperty('sortOrder', 15);
    });

    it('should update a specialty as receptionist (has practitioners:edit)', async () => {
      const res = await request(httpServer)
        .patch(`${SPECIALTIES_URL}/${createdSpecialtyId}`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ descriptionAr: 'وصف محدث' })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('descriptionAr', 'وصف محدث');
    });

    it('should reject update without authentication (401)', async () => {
      const res = await request(httpServer)
        .patch(`${SPECIALTIES_URL}/${createdSpecialtyId}`)
        .send({ sortOrder: 99 })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject update by patient (403)', async () => {
      const res = await request(httpServer)
        .patch(`${SPECIALTIES_URL}/${createdSpecialtyId}`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ sortOrder: 99 })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject update by accountant (403)', async () => {
      const res = await request(httpServer)
        .patch(`${SPECIALTIES_URL}/${createdSpecialtyId}`)
        .set(getAuthHeaders(accountant.accessToken))
        .send({ sortOrder: 99 })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 404 for updating non-existent specialty', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .patch(`${SPECIALTIES_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ sortOrder: 1 })
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should allow deactivating a specialty (isActive: false)', async () => {
      const res = await request(httpServer)
        .patch(`${SPECIALTIES_URL}/${createdSpecialtyId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ isActive: false })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('isActive', false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /specialties/:id — Delete (PERMISSION:practitioners:delete)
  // ─────────────────────────────────────────────────────────────

  describe('DELETE /specialties/:id', () => {
    let deletableSpecialtyId: string;

    beforeAll(async () => {
      // Create a specialty specifically for deletion tests
      const res = await request(httpServer)
        .post(SPECIALTIES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'To Be Deleted Specialty',
          nameAr: 'تخصص للحذف',
        })
        .expect(201);

      deletableSpecialtyId = res.body.data.id as string;
    });

    it('should reject deletion without authentication (401)', async () => {
      const res = await request(httpServer)
        .delete(`${SPECIALTIES_URL}/${deletableSpecialtyId}`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject deletion by patient (403)', async () => {
      const res = await request(httpServer)
        .delete(`${SPECIALTIES_URL}/${deletableSpecialtyId}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject deletion by receptionist (403 — no practitioners:delete)', async () => {
      const res = await request(httpServer)
        .delete(`${SPECIALTIES_URL}/${deletableSpecialtyId}`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject deletion by accountant (403)', async () => {
      const res = await request(httpServer)
        .delete(`${SPECIALTIES_URL}/${deletableSpecialtyId}`)
        .set(getAuthHeaders(accountant.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject deletion by practitioner (403)', async () => {
      const res = await request(httpServer)
        .delete(`${SPECIALTIES_URL}/${deletableSpecialtyId}`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should delete a specialty as super_admin', async () => {
      const res = await request(httpServer)
        .delete(`${SPECIALTIES_URL}/${deletableSpecialtyId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should return 404 after deletion', async () => {
      const res = await request(httpServer)
        .get(`${SPECIALTIES_URL}/${deletableSpecialtyId}`)
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 404 for deleting non-existent specialty', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .delete(`${SPECIALTIES_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should prevent deletion of specialty with assigned practitioners (cascade protection)', async () => {
      // First, get a specialty that has practitioners assigned (from seed or created by practitioner tests)
      const listRes = await request(httpServer)
        .get(SPECIALTIES_URL)
        .expect(200);

      // Use the first seeded specialty (likely has practitioners from seed data)
      const seededSpecialty = listRes.body.data[0] as { id: string };

      // Try to delete it — should fail if practitioners are assigned
      const res = await request(httpServer)
        .delete(`${SPECIALTIES_URL}/${seededSpecialty.id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(409);

      expectErrorResponse(res.body, 'CONFLICT');
    });
  });
});
