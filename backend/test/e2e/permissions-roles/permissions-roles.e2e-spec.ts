/**
 * CareKit — Permissions & Roles Module E2E Tests
 *
 * Permissions:
 *   GET    /permissions              — list all (PERMISSION:roles:view)
 *
 * Roles:
 *   GET    /roles                    — list with permissions (PERMISSION:roles:view)
 *   POST   /roles                    — create custom role (PERMISSION:roles:create)
 *   DELETE /roles/:id                — delete role (PERMISSION:roles:delete)
 *   POST   /roles/:id/permissions    — assign permission (PERMISSION:roles:edit)
 *   DELETE /roles/:id/permissions    — remove permission (PERMISSION:roles:edit)
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  registerTestPatient,
  getAuthHeaders,
  expectSuccessResponse,
  expectErrorResponse,
  TEST_USERS,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const PERMISSIONS_URL = `${API_PREFIX}/permissions`;
const ROLES_URL = `${API_PREFIX}/roles`;

const NEW_ROLE_PAYLOAD = {
  name: 'E2E Test Role',
  description: 'Created by E2E test',
};

const PERMISSION_PAYLOAD = {
  module: 'services',
  action: 'view',
};

describe('Permissions & Roles Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let patient: AuthResult;

  let createdRoleId: string;
  let superAdminRoleId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );

    patient = await registerTestPatient(httpServer);
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ═══════════════════════════════════════════════════════════════
  //  PERMISSIONS
  // ═══════════════════════════════════════════════════════════════

  describe('GET /permissions', () => {
    it('should return array of permission objects for super_admin', async () => {
      const res = await request(httpServer)
        .get(PERMISSIONS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const permissions = res.body.data as Array<Record<string, unknown>>;
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);

      for (const perm of permissions) {
        expect(perm).toHaveProperty('module');
        expect(perm).toHaveProperty('action');
        expect(typeof perm.module).toBe('string');
        expect(typeof perm.action).toBe('string');
      }
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await request(httpServer)
        .get(PERMISSIONS_URL)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no roles:view)', async () => {
      const res = await request(httpServer)
        .get(PERMISSIONS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  ROLES
  // ═══════════════════════════════════════════════════════════════

  describe('GET /roles', () => {
    it('should return roles with permissions for super_admin', async () => {
      const res = await request(httpServer)
        .get(ROLES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const roles = res.body.data as Array<Record<string, unknown>>;
      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBeGreaterThan(0);

      for (const role of roles) {
        expect(role).toHaveProperty('id');
        expect(role).toHaveProperty('name');
        expect(role).toHaveProperty('slug');
        expect(role).toHaveProperty('permissions');
        expect(Array.isArray(role.permissions)).toBe(true);
      }
    });

    it('should include super_admin system role', async () => {
      const res = await request(httpServer)
        .get(ROLES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const roles = res.body.data as Array<{ slug: string; id: string }>;
      const superAdminRole = roles.find((r) => r.slug === 'super_admin');
      expect(superAdminRole).toBeDefined();

      superAdminRoleId = superAdminRole!.id;
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await request(httpServer)
        .get(ROLES_URL)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no roles:view)', async () => {
      const res = await request(httpServer)
        .get(ROLES_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  describe('POST /roles', () => {
    it('should create custom role with auto-slug (201)', async () => {
      const res = await request(httpServer)
        .post(ROLES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(NEW_ROLE_PAYLOAD)
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('name', NEW_ROLE_PAYLOAD.name);
      expect(res.body.data).toHaveProperty('slug');
      expect(typeof res.body.data.slug).toBe('string');
      expect(res.body.data.slug.length).toBeGreaterThan(0);

      createdRoleId = res.body.data.id as string;
    });

    it('should return 409 for duplicate role name', async () => {
      const res = await request(httpServer)
        .post(ROLES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(NEW_ROLE_PAYLOAD)
        .expect(409);

      expectErrorResponse(res.body, 'CONFLICT');
    });

    it('should return 400 for missing required name field', async () => {
      const res = await request(httpServer)
        .post(ROLES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ description: 'No name provided' })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .post(ROLES_URL)
        .send(NEW_ROLE_PAYLOAD)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should include newly created role in GET /roles', async () => {
      const res = await request(httpServer)
        .get(ROLES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const roles = res.body.data as Array<{ id: string }>;
      const ids = roles.map((r) => r.id);
      expect(ids).toContain(createdRoleId);
    });
  });

  describe('POST /roles/:id/permissions', () => {
    it('should assign permission to role (201)', async () => {
      const res = await request(httpServer)
        .post(`${ROLES_URL}/${createdRoleId}/permissions`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(PERMISSION_PAYLOAD)
        .expect(201);

      expectSuccessResponse(res.body);
    });

    it('should reflect new permission in GET /roles', async () => {
      const res = await request(httpServer)
        .get(ROLES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const roles = res.body.data as Array<{
        id: string;
        permissions: Array<{ module: string; action: string }>;
      }>;

      const role = roles.find((r) => r.id === createdRoleId);
      expect(role).toBeDefined();

      const hasPermission = role!.permissions.some(
        (p) => p.module === PERMISSION_PAYLOAD.module && p.action === PERMISSION_PAYLOAD.action,
      );
      expect(hasPermission).toBe(true);
    });

    it('should return 404 for non-existent role', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .post(`${ROLES_URL}/${fakeId}/permissions`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(PERMISSION_PAYLOAD)
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .post(`${ROLES_URL}/${createdRoleId}/permissions`)
        .send(PERMISSION_PAYLOAD)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });

  describe('DELETE /roles/:id/permissions', () => {
    it('should remove permission from role (200)', async () => {
      const res = await request(httpServer)
        .delete(`${ROLES_URL}/${createdRoleId}/permissions`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(PERMISSION_PAYLOAD)
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .delete(`${ROLES_URL}/${createdRoleId}/permissions`)
        .send(PERMISSION_PAYLOAD)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });

  describe('DELETE /roles/:id', () => {
    it('should delete custom role as super_admin (200)', async () => {
      const res = await request(httpServer)
        .delete(`${ROLES_URL}/${createdRoleId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should return 400 when attempting to delete system role (super_admin)', async () => {
      const res = await request(httpServer)
        .delete(`${ROLES_URL}/${superAdminRoleId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);

      expectErrorResponse(res.body, 'SYSTEM_ROLE');
    });

    it('should return 404 for non-existent role', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .delete(`${ROLES_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .delete(`${ROLES_URL}/${createdRoleId}`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no roles:delete)', async () => {
      const res = await request(httpServer)
        .delete(`${ROLES_URL}/${superAdminRoleId}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });
});
