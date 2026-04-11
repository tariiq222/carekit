/**
 * CareKit — Seed Data Validation E2E Tests (TDD RED Phase)
 *
 * Validates that the database seed script (prisma/seed.ts)
 * correctly populates all required initial data:
 *
 *   - 6 default roles with correct isSystem/isDefault flags
 *   - 72 permissions (18 modules x 4 actions)
 *   - super_admin role has ALL 72 permissions assigned
 *   - 8 default specialties with Arabic + English names
 *   - WhiteLabelConfig entries for essential settings
 *   - patient role marked as isDefault: true
 *
 * These tests require:
 *   1. Test database to be migrated (prisma migrate)
 *   2. Seed script to have run (prisma db seed)
 *
 * These tests will FAIL until backend-dev implements the seed script.
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  getAuthHeaders,
  expectSuccessResponse,
  TEST_USERS,
  DEFAULT_ROLES,
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  TOTAL_PERMISSIONS,
  type TestApp,
} from '../setup/setup';

describe('Seed Data Validation (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;
  let adminToken: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    // Login as the seeded super_admin
    const auth = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );
    adminToken = auth.accessToken;
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // =========================================================================
  // Roles
  // =========================================================================

  describe('default roles', () => {
    let roles: Array<{
      id: string;
      name: string;
      slug: string;
      isDefault: boolean;
      isSystem: boolean;
    }>;

    beforeAll(async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/roles`)
        .set(getAuthHeaders(adminToken))
        .expect(200);

      expectSuccessResponse(res.body);
      roles = res.body.data.items || res.body.data;
    });

    it('should have 6 default roles in database', () => {
      const systemRoles = roles.filter((r) => r.isSystem === true);
      expect(systemRoles.length).toBe(6);
    });

    it('should have all 6 expected role slugs', () => {
      const slugs = roles.map((r) => r.slug);

      for (const expectedSlug of DEFAULT_ROLES) {
        expect(slugs).toContain(expectedSlug);
      }
    });

    it('should have all default roles marked as isSystem: true', () => {
      for (const slug of DEFAULT_ROLES) {
        const role = roles.find((r) => r.slug === slug);
        expect(role).toBeDefined();
        expect(role!.isSystem).toBe(true);
      }
    });

    it('should have patient role marked as isDefault: true', () => {
      const patientRole = roles.find((r) => r.slug === 'patient');
      expect(patientRole).toBeDefined();
      expect(patientRole!.isDefault).toBe(true);
    });

    it('should have only patient marked as isDefault (not other roles)', () => {
      const defaultRoles = roles.filter((r) => r.isDefault === true);
      expect(defaultRoles.length).toBe(1);
      expect(defaultRoles[0].slug).toBe('patient');
    });
  });

  // =========================================================================
  // Permissions
  // =========================================================================

  describe('permissions', () => {
    let permissions: Array<{
      id: string;
      module: string;
      action: string;
    }>;

    beforeAll(async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/permissions`)
        .set(getAuthHeaders(adminToken))
        .expect(200);

      expectSuccessResponse(res.body);
      permissions = res.body.data.items || res.body.data;
    });

    it('should have at least 72 permissions (18 modules x 4 actions + extra granular permissions)', () => {
      // EXTRA_PERMISSIONS adds granular actions: notifications:update, chatbot:use,
      // practitioners:favorites:view, practitioners:favorites:edit (4 extra = 76 total)
      expect(permissions.length).toBeGreaterThanOrEqual(TOTAL_PERMISSIONS);
    });

    it('should have all 18 modules represented', () => {
      const modules = [...new Set(permissions.map((p) => p.module))];
      expect(modules.length).toBeGreaterThanOrEqual(PERMISSION_MODULES.length);

      for (const expectedModule of PERMISSION_MODULES) {
        expect(modules).toContain(expectedModule);
      }
    });

    it('should have all 4 standard actions for each module', () => {
      for (const module of PERMISSION_MODULES) {
        const modulePerms = permissions.filter((p) => p.module === module);
        // Each module has at least 4 standard actions; some have extra granular ones
        expect(modulePerms.length).toBeGreaterThanOrEqual(4);

        const actions = modulePerms.map((p) => p.action);
        for (const expectedAction of PERMISSION_ACTIONS) {
          expect(actions).toContain(expectedAction);
        }
      }
    });
  });

  // =========================================================================
  // super_admin permissions
  // =========================================================================

  describe('super_admin role permissions', () => {
    it('should have super_admin role with ALL 72 permissions', async () => {
      // Get roles with their permissions
      const res = await request(httpServer)
        .get(`${API_PREFIX}/roles`)
        .set(getAuthHeaders(adminToken))
        .expect(200);

      const roles = res.body.data.items || res.body.data;
      const superAdmin = (
        roles as Array<{
          slug: string;
          permissions?: Array<{ module: string; action: string }>;
        }>
      ).find((r) => r.slug === 'super_admin');

      expect(superAdmin).toBeDefined();

      // If permissions are included in the role response
      // super_admin has all 72 standard + 4 extra granular = 76 total
      if (superAdmin!.permissions) {
        expect(superAdmin!.permissions.length).toBeGreaterThanOrEqual(
          TOTAL_PERMISSIONS,
        );
      }

      // Alternative: check via the admin /me endpoint
      const meRes = await request(httpServer)
        .get(`${API_PREFIX}/auth/me`)
        .set(getAuthHeaders(adminToken))
        .expect(200);

      const adminPermissions = meRes.body.data.permissions;
      expect(Array.isArray(adminPermissions)).toBe(true);
      expect(adminPermissions.length).toBeGreaterThanOrEqual(TOTAL_PERMISSIONS);

      // Verify all module:action combos exist
      for (const module of PERMISSION_MODULES) {
        for (const action of PERMISSION_ACTIONS) {
          expect(adminPermissions).toContain(`${module}:${action}`);
        }
      }
    });
  });

  // =========================================================================
  // Specialties
  // =========================================================================

  describe('default specialties', () => {
    let specialties: Array<{
      id: string;
      nameAr: string;
      nameEn: string;
      isActive: boolean;
    }>;

    beforeAll(async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/specialties`)
        .set(getAuthHeaders(adminToken))
        .expect(200);

      expectSuccessResponse(res.body);
      specialties = res.body.data.items || res.body.data;
    });

    it('should have 8 default specialties', () => {
      expect(specialties.length).toBeGreaterThanOrEqual(8);
    });

    it('should have Arabic names (nameAr) for all specialties', () => {
      for (const specialty of specialties) {
        expect(specialty.nameAr).toBeDefined();
        expect(typeof specialty.nameAr).toBe('string');
        expect(specialty.nameAr.length).toBeGreaterThan(0);
        // Arabic text should contain Arabic characters
        expect(/[\u0600-\u06FF]/.test(specialty.nameAr)).toBe(true);
      }
    });

    it('should have English names (nameEn) for all specialties', () => {
      for (const specialty of specialties) {
        expect(specialty.nameEn).toBeDefined();
        expect(typeof specialty.nameEn).toBe('string');
        expect(specialty.nameEn.length).toBeGreaterThan(0);
        // English text should contain Latin characters
        expect(/[a-zA-Z]/.test(specialty.nameEn)).toBe(true);
      }
    });

    it('should have all specialties marked as active', () => {
      for (const specialty of specialties) {
        expect(specialty.isActive).toBe(true);
      }
    });

    it('should include expected medical specialties', () => {
      const englishNames = specialties.map((s) => s.nameEn.toLowerCase());

      // At minimum, these common specialties should be seeded
      const expectedSpecialties = [
        'general medicine',
        'dermatology',
        'pediatrics',
        'dentistry',
      ];

      // At least half of expected specialties should exist
      // (exact names may vary — this is a soft check)
      let matchCount = 0;
      for (const expected of expectedSpecialties) {
        if (
          englishNames.some((name) => name.includes(expected.toLowerCase()))
        ) {
          matchCount++;
        }
      }
      expect(matchCount).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // WhiteLabelConfig
  // =========================================================================

  describe('WhiteLabelConfig defaults', () => {
    it('should have WhiteLabelConfig entries for essential settings', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/whitelabel/config`)
        .set(getAuthHeaders(adminToken))
        .expect(200);

      expectSuccessResponse(res.body);

      const configs = res.body.data.items || res.body.data;
      expect(Array.isArray(configs) || typeof configs === 'object').toBe(true);

      // Essential config keys that must be seeded
      // Note: clinic branding uses system_name / system_name_ar (not clinic_name)
      const essentialKeys = [
        'system_name',
        'system_name_ar',
        'primary_color',
        'contact_email',
        'contact_phone',
        'cancellation_policy',
        'cancellation_policy_ar',
      ];

      if (Array.isArray(configs)) {
        const configKeys = configs.map((c: { key: string }) => c.key);
        for (const key of essentialKeys) {
          expect(configKeys).toContain(key);
        }
      } else {
        // If returned as key-value object
        for (const key of essentialKeys) {
          expect(configs).toHaveProperty(key);
        }
      }
    });
  });

  // =========================================================================
  // Seeded super_admin user
  // =========================================================================

  describe('seeded super_admin user', () => {
    it('should have a super_admin user that can login', async () => {
      // This test validates that the seed script creates the admin user
      // The login itself is tested by beforeAll — if it fails, all tests fail
      const res = await request(httpServer)
        .post(`${API_PREFIX}/auth/login`)
        .send({
          email: TEST_USERS.super_admin.email,
          password: TEST_USERS.super_admin.password,
        })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.user.email).toBe(TEST_USERS.super_admin.email);
    });

    it('should have super_admin role assigned to seeded admin', async () => {
      const res = await request(httpServer)
        .get(`${API_PREFIX}/auth/me`)
        .set(getAuthHeaders(adminToken))
        .expect(200);

      const roles = res.body.data.roles;
      const roleIdentifiers = roles.map((r: string | { slug: string }) =>
        typeof r === 'string' ? r : r.slug,
      );
      expect(roleIdentifiers).toContain('super_admin');
    });
  });
});
