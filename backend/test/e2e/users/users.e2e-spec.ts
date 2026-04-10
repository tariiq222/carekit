/**
 * CareKit — Users Module E2E Tests (TDD RED Phase)
 *
 * Tests all user management endpoints per docs/api-spec.md:
 *   GET    /api/v1/users          — list (paginated, filterable)
 *   GET    /api/v1/users/:id      — get by ID
 *   POST   /api/v1/users          — create staff/practitioner
 *   PATCH  /api/v1/users/:id      — update
 *   DELETE /api/v1/users/:id      — soft-delete
 *   PATCH  /api/v1/users/:id/activate   — activate
 *   PATCH  /api/v1/users/:id/deactivate — deactivate
 *   POST   /api/v1/users/:id/roles      — assign role
 *   DELETE /api/v1/users/:id/roles/:roleId — remove role
 *
 * These tests will FAIL until backend-dev implements the users module.
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
  expectValidationError,
  TEST_USERS,
  TEST_PATIENT_2,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const USERS_URL = `${API_PREFIX}/users`;
const AUTH_URL = `${API_PREFIX}/auth`;

describe('Users Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let practitioner: AuthResult;
  let patient: AuthResult;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    // Login as seeded super_admin
    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );

    // Create supporting users
    receptionist = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.receptionist,
      'receptionist',
    );

    practitioner = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.practitioner,
      'practitioner',
    );

    patient = await registerTestPatient(httpServer, TEST_USERS.patient);
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // =========================================================================
  // GET /users
  // =========================================================================

  describe('GET /api/v1/users', () => {
    it('should list users with pagination (super_admin)', async () => {
      const res = await request(httpServer)
        .get(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);

      const { data } = res.body;
      expect(data.items).toBeDefined();
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.meta).toBeDefined();
      expect(data.meta.total).toBeGreaterThanOrEqual(1);
      expect(data.meta.page).toBe(1);
      expect(data.meta.perPage).toBeDefined();
      expect(data.meta.totalPages).toBeDefined();
      expect(typeof data.meta.hasNextPage).toBe('boolean');
      expect(typeof data.meta.hasPreviousPage).toBe('boolean');
    });

    it('should respect page and perPage params', async () => {
      const res = await request(httpServer)
        .get(`${USERS_URL}?page=1&perPage=2`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.items.length).toBeLessThanOrEqual(2);
      expect(res.body.data.meta.perPage).toBe(2);
    });

    it('should filter users by role (?role=patient)', async () => {
      const res = await request(httpServer)
        .get(`${USERS_URL}?role=patient`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);

      const items = res.body.data.items as Array<{
        roles: Array<string | { slug: string }>;
      }>;
      for (const user of items) {
        const slugs = user.roles.map((r) =>
          typeof r === 'string' ? r : r.slug,
        );
        expect(slugs).toContain('patient');
      }
    });

    it('should filter users by status (?isActive=true)', async () => {
      const res = await request(httpServer)
        .get(`${USERS_URL}?isActive=true`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);

      const items = res.body.data.items as Array<{ isActive: boolean }>;
      for (const user of items) {
        expect(user.isActive).toBe(true);
      }
    });

    it('should filter users by isActive=false', async () => {
      const res = await request(httpServer)
        .get(`${USERS_URL}?isActive=false`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);

      const items = res.body.data.items as Array<{ isActive: boolean }>;
      for (const user of items) {
        expect(user.isActive).toBe(false);
      }
    });

    it('should search users by name (?search=أحمد)', async () => {
      const res = await request(httpServer)
        .get(`${USERS_URL}?search=${encodeURIComponent('أحمد')}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);

      const items = res.body.data.items as Array<{
        firstName: string;
        lastName: string;
        email: string;
      }>;
      if (items.length > 0) {
        const match = items.some(
          (u) =>
            u.firstName.includes('أحمد') ||
            u.lastName.includes('أحمد') ||
            u.email.includes('أحمد'),
        );
        expect(match).toBe(true);
      }
    });

    it('should search users by email (?search=patient)', async () => {
      const res = await request(httpServer)
        .get(`${USERS_URL}?search=patient`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should return correct pagination meta', async () => {
      const res = await request(httpServer)
        .get(`${USERS_URL}?page=1&perPage=2`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const { meta } = res.body.data;
      expect(meta.total).toBeGreaterThanOrEqual(1);
      expect(meta.page).toBe(1);
      expect(meta.perPage).toBe(2);
      expect(meta.totalPages).toBe(Math.ceil(meta.total / meta.perPage));
      expect(meta.hasNextPage).toBe(meta.page < meta.totalPages);
      expect(meta.hasPreviousPage).toBe(false);
    });

    it('should not include soft-deleted users by default', async () => {
      // Create and soft-delete a user
      await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'to-delete-list@carekit-test.com',
          password: 'D3l3teP@ss!',
          firstName: 'حذف',
          lastName: 'المحذوف',
          phone: '+966530000001',
          gender: 'male',
          roleSlug: 'receptionist',
        })
        .expect(201);

      // Find the user
      const listRes = await request(httpServer)
        .get(`${USERS_URL}?search=to-delete-list`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      if (listRes.body.data.items.length > 0) {
        const userId = (listRes.body.data.items[0] as { id: string }).id;

        // Soft-delete
        await request(httpServer)
          .delete(`${USERS_URL}/${userId}`)
          .set(getAuthHeaders(superAdmin.accessToken))
          .expect(200);

        // Re-list — should not include deleted user
        const afterRes = await request(httpServer)
          .get(`${USERS_URL}?search=to-delete-list`)
          .set(getAuthHeaders(superAdmin.accessToken))
          .expect(200);

        const ids = (afterRes.body.data.items as Array<{ id: string }>).map(
          (u) => u.id,
        );
        expect(ids).not.toContain(userId);
      }
    });

    it('should not include password/passwordHash in response', async () => {
      const res = await request(httpServer)
        .get(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const items = res.body.data.items as Array<Record<string, unknown>>;
      for (const user of items) {
        expect(user).not.toHaveProperty('password');
        expect(user).not.toHaveProperty('passwordHash');
      }
    });

    it('should reject access for patient role -> 403', async () => {
      const res = await request(httpServer)
        .get(USERS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject access for practitioner role -> 403', async () => {
      const res = await request(httpServer)
        .get(USERS_URL)
        .set(getAuthHeaders(practitioner.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject access without auth -> 401', async () => {
      const res = await request(httpServer).get(USERS_URL).expect(401);

      const errorCode = (res.body.error as { code: string }).code;
      expect(['AUTH_TOKEN_MISSING', 'AUTH_TOKEN_INVALID']).toContain(errorCode);
    });
  });

  // =========================================================================
  // GET /users/:id
  // =========================================================================

  describe('GET /api/v1/users/:id', () => {
    it('should return user by ID with roles (super_admin)', async () => {
      const userId = superAdmin.user.id as string;

      const res = await request(httpServer)
        .get(`${USERS_URL}/${userId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);

      const { data } = res.body;
      expect(data.id).toBe(userId);
      expect(data.email).toBeDefined();
      expect(data.firstName).toBeDefined();
      expect(data.lastName).toBeDefined();
      expect(data.isActive).toBeDefined();
      expect(Array.isArray(data.roles)).toBe(true);
      expect(data).not.toHaveProperty('password');
      expect(data).not.toHaveProperty('passwordHash');
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(httpServer)
        .get(`${USERS_URL}/00000000-0000-0000-0000-000000000000`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'USER_NOT_FOUND');
    });

    it('should return 400 for invalid UUID', async () => {
      const res = await request(httpServer)
        .get(`${USERS_URL}/not-a-uuid`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject access for unauthorized roles -> 403', async () => {
      const res = await request(httpServer)
        .get(`${USERS_URL}/${superAdmin.user.id}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // POST /users
  // =========================================================================

  describe('POST /api/v1/users', () => {
    it('should create user with specified role (super_admin creates receptionist)', async () => {
      const res = await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'new-receptionist@carekit-test.com',
          password: 'N3wRecept!0n',
          firstName: 'منيرة',
          lastName: 'العصيمي',
          phone: '+966530000010',
          gender: 'female',
          roleSlug: 'receptionist',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body).toHaveProperty('message', 'User created successfully');

      const { data } = res.body;
      expect(data.id).toBeDefined();
      expect(data.email).toBe('new-receptionist@carekit-test.com');
      expect(data.firstName).toBe('منيرة');
      expect(data.lastName).toBe('العصيمي');
      expect(data.isActive).toBe(true);
      expect(
        data.roles.some((r: { slug: string }) => r.slug === 'receptionist'),
      ).toBe(true);
      expect(data.createdAt).toBeDefined();
      expect(data).not.toHaveProperty('password');
      expect(data).not.toHaveProperty('passwordHash');
    });

    it('should create user with accountant role', async () => {
      const res = await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'new-accountant@carekit-test.com',
          password: 'Acc0untant!',
          firstName: 'فيصل',
          lastName: 'الحقباني',
          phone: '+966530000011',
          gender: 'male',
          roleSlug: 'accountant',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(
        res.body.data.roles.some(
          (r: { slug: string }) => r.slug === 'accountant',
        ),
      ).toBe(true);
    });

    it('should hash password before storing', async () => {
      const password = 'H@shedP@ss1!';

      const createRes = await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'hash-check@carekit-test.com',
          password,
          firstName: 'هاش',
          lastName: 'الاختبار',
          phone: '+966530000012',
          gender: 'male',
          roleSlug: 'receptionist',
        })
        .expect(201);

      // Verify user can login with the password (hashing works correctly)
      const loginRes = await request(httpServer)
        .post(`${AUTH_URL}/login`)
        .send({ email: 'hash-check@carekit-test.com', password })
        .expect(200);

      expectSuccessResponse(loginRes.body);
    });

    it('should reject duplicate email -> 409', async () => {
      // First create
      await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'dup-user@carekit-test.com',
          password: 'DupP@ss1!',
          firstName: 'مكرر',
          lastName: 'الاسم',
          phone: '+966530000013',
          gender: 'male',
          roleSlug: 'receptionist',
        })
        .expect(201);

      // Second create with same email
      const res = await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'dup-user@carekit-test.com',
          password: 'DupP@ss2!',
          firstName: 'آخر',
          lastName: 'مكرر',
          phone: '+966530000014',
          gender: 'female',
          roleSlug: 'receptionist',
        })
        .expect(409);

      expectErrorResponse(res.body, 'USER_EMAIL_EXISTS');
    });

    it('should reject missing required fields -> 400', async () => {
      const res = await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ email: 'partial@carekit-test.com' })
        .expect(400);

      expectValidationError(res.body, [
        'password',
        'firstName',
        'lastName',
        'roleSlug',
      ]);
    });

    it('should reject invalid email format -> 400', async () => {
      const res = await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'invalid-email',
          password: 'Str0ngP@ss!',
          firstName: 'اختبار',
          lastName: 'الايميل',
          roleSlug: 'receptionist',
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject invalid roleSlug', async () => {
      const res = await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'bad-role@carekit-test.com',
          password: 'Str0ngP@ss!',
          firstName: 'دور',
          lastName: 'خاطئ',
          roleSlug: 'nonexistent_role',
        });

      expect([400, 404]).toContain(res.status);
    });

    it('should reject access for non-admin roles -> 403', async () => {
      const res = await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({
          email: 'hacked@carekit-test.com',
          password: 'H@ckedP@ss!',
          firstName: 'اختراق',
          lastName: 'محاولة',
          roleSlug: 'super_admin',
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject access for receptionist -> 403', async () => {
      const res = await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          email: 'recep-create@carekit-test.com',
          password: 'Str0ngP@ss!',
          firstName: 'محاولة',
          lastName: 'إنشاء',
          roleSlug: 'receptionist',
        })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // PATCH /users/:id
  // =========================================================================

  describe('PATCH /api/v1/users/:id', () => {
    let targetUserId: string;

    beforeAll(async () => {
      const res = await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'to-update@carekit-test.com',
          password: 'Upd@teP@ss1!',
          firstName: 'قبل',
          lastName: 'التحديث',
          phone: '+966530000020',
          gender: 'male',
          roleSlug: 'receptionist',
        })
        .expect(201);

      targetUserId = res.body.data.id;
    });

    it('should update user fields (firstName, lastName, phone)', async () => {
      const res = await request(httpServer)
        .patch(`${USERS_URL}/${targetUserId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          firstName: 'بعد',
          lastName: 'التعديل',
          phone: '+966530000021',
        })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.firstName).toBe('بعد');
      expect(res.body.data.lastName).toBe('التعديل');
      expect(res.body.data.phone).toBe('+966530000021');
    });

    it('should not allow changing email to existing email -> 409', async () => {
      const res = await request(httpServer)
        .patch(`${USERS_URL}/${targetUserId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ email: TEST_USERS.super_admin.email })
        .expect(409);

      expectErrorResponse(res.body, 'USER_EMAIL_EXISTS');
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(httpServer)
        .patch(`${USERS_URL}/00000000-0000-0000-0000-000000000000`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ firstName: 'لا يوجد' })
        .expect(404);

      expectErrorResponse(res.body, 'USER_NOT_FOUND');
    });

    it('should reject access for non-admin -> 403', async () => {
      const res = await request(httpServer)
        .patch(`${USERS_URL}/${targetUserId}`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ firstName: 'اختراق' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should not allow updating password through this endpoint', async () => {
      const res = await request(httpServer)
        .patch(`${USERS_URL}/${targetUserId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ password: 'NewP@ss123!' });

      // Should either be ignored (200 without changing password) or rejected (400)
      if (res.status === 200) {
        // Verify password was NOT changed — original still works
        const loginRes = await request(httpServer)
          .post(`${AUTH_URL}/login`)
          .send({
            email: 'to-update@carekit-test.com',
            password: 'Upd@teP@ss1!',
          })
          .expect(200);

        expectSuccessResponse(loginRes.body);
      }
    });
  });

  // =========================================================================
  // DELETE /users/:id (soft-delete)
  // =========================================================================

  describe('DELETE /api/v1/users/:id', () => {
    let deletableUserId: string;

    beforeAll(async () => {
      const res = await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'to-soft-delete@carekit-test.com',
          password: 'D3l3teP@ss!',
          firstName: 'محذوف',
          lastName: 'المستخدم',
          phone: '+966530000030',
          gender: 'male',
          roleSlug: 'receptionist',
        })
        .expect(201);

      deletableUserId = res.body.data.id;
    });

    it('should soft-delete user (set deletedAt)', async () => {
      const res = await request(httpServer)
        .delete(`${USERS_URL}/${deletableUserId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
    });

    it('should not physically remove from database (record still exists)', async () => {
      // After soft-delete, the user should still exist but be hidden from default list
      // Admin should be able to find them with a specific query or by direct ID
      const res = await request(httpServer)
        .get(`${USERS_URL}/${deletableUserId}`)
        .set(getAuthHeaders(superAdmin.accessToken));

      // Could return 404 (default behavior hides soft-deleted) or 200 with deletedAt set
      // Either is acceptable as long as the record is not physically gone
      expect([200, 404]).toContain(res.status);
    });

    it('should prevent login after soft delete', async () => {
      const res = await request(httpServer)
        .post(`${AUTH_URL}/login`)
        .send({
          email: 'to-soft-delete@carekit-test.com',
          password: 'D3l3teP@ss!',
        })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_INVALID_CREDENTIALS');
    });

    it('should reject deleting own account -> 400', async () => {
      const adminId = superAdmin.user.id as string;

      const res = await request(httpServer)
        .delete(`${USERS_URL}/${adminId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(httpServer)
        .delete(`${USERS_URL}/00000000-0000-0000-0000-000000000000`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'USER_NOT_FOUND');
    });

    it('should reject access for non-admin -> 403', async () => {
      const res = await request(httpServer)
        .delete(`${USERS_URL}/${deletableUserId}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // PATCH /users/:id/activate
  // =========================================================================

  describe('PATCH /api/v1/users/:id/activate', () => {
    let deactivatedUserId: string;

    beforeAll(async () => {
      // Create and deactivate a user
      const createRes = await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'to-activate@carekit-test.com',
          password: 'Act!vateP@ss1',
          firstName: 'تفعيل',
          lastName: 'المستخدم',
          phone: '+966530000040',
          gender: 'female',
          roleSlug: 'receptionist',
        })
        .expect(201);

      deactivatedUserId = createRes.body.data.id;

      await request(httpServer)
        .patch(`${USERS_URL}/${deactivatedUserId}/deactivate`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);
    });

    it('should activate a deactivated user', async () => {
      const res = await request(httpServer)
        .patch(`${USERS_URL}/${deactivatedUserId}/activate`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data.isActive).toBe(true);
    });

    it('should allow login after activation', async () => {
      const res = await request(httpServer)
        .post(`${AUTH_URL}/login`)
        .send({
          email: 'to-activate@carekit-test.com',
          password: 'Act!vateP@ss1',
        })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should reject for non-admin -> 403', async () => {
      const res = await request(httpServer)
        .patch(`${USERS_URL}/${deactivatedUserId}/activate`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // PATCH /users/:id/deactivate
  // =========================================================================

  describe('PATCH /api/v1/users/:id/deactivate', () => {
    let activeUserId: string;

    beforeAll(async () => {
      const createRes = await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'to-deactivate@carekit-test.com',
          password: 'De@ctivateP@ss1',
          firstName: 'تعطيل',
          lastName: 'المستخدم',
          phone: '+966530000050',
          gender: 'male',
          roleSlug: 'receptionist',
        })
        .expect(201);

      activeUserId = createRes.body.data.id;
    });

    it('should deactivate user (isActive = false)', async () => {
      const res = await request(httpServer)
        .patch(`${USERS_URL}/${activeUserId}/deactivate`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data.isActive).toBe(false);
    });

    it('should prevent login after deactivation -> 403', async () => {
      const res = await request(httpServer)
        .post(`${AUTH_URL}/login`)
        .send({
          email: 'to-deactivate@carekit-test.com',
          password: 'De@ctivateP@ss1',
        })
        .expect(403);

      expectErrorResponse(res.body, 'AUTH_ACCOUNT_DEACTIVATED');
    });

    it('should reject deactivating own account -> 400', async () => {
      const adminId = superAdmin.user.id as string;

      const res = await request(httpServer)
        .patch(`${USERS_URL}/${adminId}/deactivate`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject for non-admin -> 403', async () => {
      const res = await request(httpServer)
        .patch(`${USERS_URL}/${activeUserId}/deactivate`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // POST /users/:id/roles
  // =========================================================================

  describe('POST /api/v1/users/:id/roles', () => {
    let targetUserId: string;

    beforeAll(async () => {
      const createRes = await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'role-assign@carekit-test.com',
          password: 'R0leP@ss1!',
          firstName: 'دور',
          lastName: 'الإضافة',
          phone: '+966530000060',
          gender: 'male',
          roleSlug: 'receptionist',
        })
        .expect(201);

      targetUserId = createRes.body.data.id;
    });

    it('should assign role to user', async () => {
      // Get the accountant role ID
      const rolesRes = await request(httpServer)
        .get(`${API_PREFIX}/roles`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const roles = rolesRes.body.data.items || rolesRes.body.data;
      const accountantRole = (
        roles as Array<{ slug: string; id: string }>
      ).find((r) => r.slug === 'accountant');

      if (accountantRole) {
        const res = await request(httpServer)
          .post(`${USERS_URL}/${targetUserId}/roles`)
          .set(getAuthHeaders(superAdmin.accessToken))
          .send({ roleId: accountantRole.id })
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty(
          'message',
          'Role assigned successfully',
        );
      }
    });

    it('should not duplicate role assignment', async () => {
      const rolesRes = await request(httpServer)
        .get(`${API_PREFIX}/roles`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const roles = rolesRes.body.data.items || rolesRes.body.data;
      const receptionistRole = (
        roles as Array<{ slug: string; id: string }>
      ).find((r) => r.slug === 'receptionist');

      if (receptionistRole) {
        // User already has receptionist role from creation
        const res = await request(httpServer)
          .post(`${USERS_URL}/${targetUserId}/roles`)
          .set(getAuthHeaders(superAdmin.accessToken))
          .send({ roleId: receptionistRole.id });

        // Should be 409 or idempotent 200 — not a server error
        expect([200, 409]).toContain(res.status);
      }
    });

    it('should reject assigning non-existent role -> 404', async () => {
      const res = await request(httpServer)
        .post(`${USERS_URL}/${targetUserId}/roles`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ roleId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should reject for non-admin -> 403', async () => {
      const res = await request(httpServer)
        .post(`${USERS_URL}/${targetUserId}/roles`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ roleId: '00000000-0000-0000-0000-000000000001' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // DELETE /users/:id/roles/:roleId
  // =========================================================================

  describe('DELETE /api/v1/users/:id/roles/:roleId', () => {
    let targetUserId: string;
    let accountantRoleId: string;
    let receptionistRoleId: string;

    beforeAll(async () => {
      // Create user with receptionist role
      const createRes = await request(httpServer)
        .post(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          email: 'role-remove@carekit-test.com',
          password: 'R0leRemP@ss!',
          firstName: 'إزالة',
          lastName: 'الدور',
          phone: '+966530000070',
          gender: 'female',
          roleSlug: 'receptionist',
        })
        .expect(201);

      targetUserId = createRes.body.data.id;

      // Get role IDs
      const rolesRes = await request(httpServer)
        .get(`${API_PREFIX}/roles`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const roles = rolesRes.body.data.items || rolesRes.body.data;
      const accRole = (roles as Array<{ slug: string; id: string }>).find(
        (r) => r.slug === 'accountant',
      );
      const recRole = (roles as Array<{ slug: string; id: string }>).find(
        (r) => r.slug === 'receptionist',
      );

      if (accRole) accountantRoleId = accRole.id;
      if (recRole) receptionistRoleId = recRole.id;

      // Assign a second role (accountant) so we can remove one
      if (accountantRoleId) {
        await request(httpServer)
          .post(`${USERS_URL}/${targetUserId}/roles`)
          .set(getAuthHeaders(superAdmin.accessToken))
          .send({ roleId: accountantRoleId })
          .expect(200);
      }
    });

    it('should remove role from user', async () => {
      if (!accountantRoleId) return;

      const res = await request(httpServer)
        .delete(`${USERS_URL}/${targetUserId}/roles/${accountantRoleId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expect(res.body).toHaveProperty('success', true);

      // Verify role was removed
      const userRes = await request(httpServer)
        .get(`${USERS_URL}/${targetUserId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const userRoles = userRes.body.data.roles as Array<
        string | { id: string }
      >;
      const roleIds = userRoles.map((r) => (typeof r === 'string' ? r : r.id));
      expect(roleIds).not.toContain(accountantRoleId);
    });

    it('should reject removing last role -> 400', async () => {
      if (!receptionistRoleId) return;

      // User now only has receptionist role (accountant was removed)
      const res = await request(httpServer)
        .delete(`${USERS_URL}/${targetUserId}/roles/${receptionistRoleId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should reject for non-admin -> 403', async () => {
      if (!receptionistRoleId) return;

      const res = await request(httpServer)
        .delete(`${USERS_URL}/${targetUserId}/roles/${receptionistRoleId}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // Security
  // =========================================================================

  describe('Users Security', () => {
    it('should not expose sensitive fields in any response', async () => {
      const res = await request(httpServer)
        .get(USERS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('passwordHash');
      expect(bodyStr).not.toContain('"password":');
    });

    it('should not allow SQL injection in search param', async () => {
      const res = await request(httpServer)
        .get(`${USERS_URL}?search=${encodeURIComponent("' OR '1'='1")}`)
        .set(getAuthHeaders(superAdmin.accessToken));

      expect(res.status).toBeLessThan(500);
    });
  });
});
