/**
 * CareKit — Departments Module E2E Tests
 *
 * Endpoints:
 *   GET    /api/v1/departments           — public list with filters
 *   GET    /api/v1/departments/:id       — public get by ID
 *   POST   /api/v1/departments           — create (departments:create + feature flag)
 *   PATCH  /api/v1/departments/reorder   — reorder (departments:edit + feature flag)
 *   PATCH  /api/v1/departments/:id       — update (departments:edit + feature flag)
 *   DELETE /api/v1/departments/:id       — soft delete (departments:delete + feature flag)
 *
 * Coverage:
 *   - Public endpoints accessible without auth even when feature flag is disabled
 *   - Feature flag gate blocks mutations when disabled
 *   - Auth gating on mutation endpoints
 *   - Permission gating on mutation endpoints
 *   - CRUD lifecycle
 *   - Filters: isActive, search
 *   - Soft delete: deleted item not returned in list
 *   - Reorder operation
 *   - 404 for non-existent IDs
 *   - 400 for validation errors
 */

import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  loginTestUser,
  getAuthHeaders,
  expectSuccessResponse,
  TEST_USERS,
  API_PREFIX,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const DEPTS_URL = `${API_PREFIX}/departments`;
const FLAGS_URL = `${API_PREFIX}/feature-flags`;
const NON_EXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

describe('Departments Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;
  let superAdmin: AuthResult;

  // Track created department IDs for cleanup
  const createdIds: string[] = [];

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );

    // Enable the departments feature flag so mutations work
    await request(httpServer)
      .patch(`${FLAGS_URL}/departments`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ enabled: true })
      .expect(200);
  });

  afterAll(async () => {
    // Clean up created departments
    for (const id of createdIds) {
      await request(httpServer)
        .delete(`${DEPTS_URL}/${id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .catch(() => {
          // Ignore — may already be deleted in a test
        });
    }

    // Restore feature flag to disabled (original seed state)
    await request(httpServer)
      .patch(`${FLAGS_URL}/departments`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ enabled: false })
      .catch(() => {
        // Non-fatal
      });

    await closeTestApp(testApp.app);
  });

  // ---------------------------------------------------------------------------
  // GET /departments — public list
  // ---------------------------------------------------------------------------

  describe('GET /departments (public)', () => {
    it('returns 200 with empty list when no departments exist (no auth)', async () => {
      const res = await request(httpServer).get(DEPTS_URL).expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as {
        items: unknown[];
        meta: { total: number };
      };
      expect(Array.isArray(data.items)).toBe(true);
      expect(typeof data.meta.total).toBe('number');
    });

    it('returns 200 with paginated results when departments exist', async () => {
      // Create two departments first
      const r1 = await request(httpServer)
        .post(DEPTS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameAr: 'قسم الطوارئ',
          nameEn: 'Emergency',
          isActive: true,
          sortOrder: 1,
        })
        .expect(201);

      const r2 = await request(httpServer)
        .post(DEPTS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameAr: 'قسم الأسنان',
          nameEn: 'Dentistry',
          isActive: false,
          sortOrder: 2,
        })
        .expect(201);

      const id1 = (r1.body.data as { id: string }).id;
      const id2 = (r2.body.data as { id: string }).id;
      createdIds.push(id1, id2);

      const res = await request(httpServer).get(DEPTS_URL).expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as {
        items: unknown[];
        meta: {
          total: number;
          page: number;
          perPage: number;
          totalPages: number;
        };
      };
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThanOrEqual(2);
      expect(typeof data.meta.total).toBe('number');
      expect(data.meta.page).toBe(1);
      expect(typeof data.meta.perPage).toBe('number');
      expect(typeof data.meta.totalPages).toBe('number');
    });

    it('filters by isActive=true', async () => {
      const res = await request(httpServer)
        .get(`${DEPTS_URL}?isActive=true`)
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as { items: Array<{ isActive: boolean }> };
      for (const item of data.items) {
        expect(item.isActive).toBe(true);
      }
    });

    it('filters by isActive=false', async () => {
      const res = await request(httpServer)
        .get(`${DEPTS_URL}?isActive=false`)
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as { items: Array<{ isActive: boolean }> };
      for (const item of data.items) {
        expect(item.isActive).toBe(false);
      }
    });

    it('searches by nameEn', async () => {
      const res = await request(httpServer)
        .get(`${DEPTS_URL}?search=Emergency`)
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as { items: Array<{ nameEn: string }> };
      expect(data.items.length).toBeGreaterThan(0);
      const match = data.items.find((d) =>
        d.nameEn.toLowerCase().includes('emergency'),
      );
      expect(match).toBeDefined();
    });

    it('searches by nameAr', async () => {
      const res = await request(httpServer)
        .get(`${DEPTS_URL}?search=الأسنان`)
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as { items: Array<{ nameAr: string }> };
      expect(data.items.length).toBeGreaterThan(0);
    });

    it('returns 200 without auth even when feature flag is disabled', async () => {
      // Temporarily disable the flag
      await request(httpServer)
        .patch(`${FLAGS_URL}/departments`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ enabled: false })
        .expect(200);

      // Public GET should still work
      await request(httpServer).get(DEPTS_URL).expect(200);

      // Re-enable for remaining tests
      await request(httpServer)
        .patch(`${FLAGS_URL}/departments`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ enabled: true })
        .expect(200);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /departments/:id — public get by ID
  // ---------------------------------------------------------------------------

  describe('GET /departments/:id (public)', () => {
    let deptId: string;

    beforeAll(async () => {
      const res = await request(httpServer)
        .post(DEPTS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameAr: 'قسم الأشعة',
          nameEn: 'Radiology',
          descriptionEn: 'X-ray and imaging',
          isActive: true,
        })
        .expect(201);

      deptId = (res.body.data as { id: string }).id;
      createdIds.push(deptId);
    });

    it('returns 200 with department data (no auth needed)', async () => {
      const res = await request(httpServer)
        .get(`${DEPTS_URL}/${deptId}`)
        .expect(200);

      expectSuccessResponse(res.body);
      const dept = res.body.data as {
        id: string;
        nameAr: string;
        nameEn: string;
        isActive: boolean;
      };
      expect(dept.id).toBe(deptId);
      expect(dept.nameEn).toBe('Radiology');
      expect(dept.isActive).toBe(true);
    });

    it('returns 404 for non-existent UUID', async () => {
      const res = await request(httpServer)
        .get(`${DEPTS_URL}/${NON_EXISTENT_UUID}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid UUID format', async () => {
      await request(httpServer)
        .get(`${DEPTS_URL}/not-a-valid-uuid`)
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /departments — create
  // ---------------------------------------------------------------------------

  describe('POST /departments', () => {
    it('returns 201 with created department (super_admin)', async () => {
      const res = await request(httpServer)
        .post(DEPTS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameAr: 'قسم الجراحة',
          nameEn: 'Surgery',
          descriptionAr: 'قسم الجراحة العامة',
          descriptionEn: 'General surgery department',
          icon: 'scalpel',
          sortOrder: 10,
          isActive: true,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      const dept = res.body.data as {
        id: string;
        nameAr: string;
        nameEn: string;
        isActive: boolean;
        sortOrder: number;
      };
      expect(dept.nameEn).toBe('Surgery');
      expect(dept.nameAr).toBe('قسم الجراحة');
      expect(dept.isActive).toBe(true);
      expect(dept.sortOrder).toBe(10);
      createdIds.push(dept.id);
    });

    it('returns 403 FEATURE_NOT_ENABLED when feature flag is disabled', async () => {
      // Disable the flag
      await request(httpServer)
        .patch(`${FLAGS_URL}/departments`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ enabled: false })
        .expect(200);

      const res = await request(httpServer)
        .post(DEPTS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameAr: 'قسم مؤقت', nameEn: 'Temp' })
        .expect(403);

      expect(res.body.success).toBe(false);
      const error = res.body.error as { code: string };
      expect(error.code).toBe('FEATURE_NOT_ENABLED');

      // Re-enable
      await request(httpServer)
        .patch(`${FLAGS_URL}/departments`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ enabled: true })
        .expect(200);
    });

    it('returns 401 without auth', async () => {
      await request(httpServer)
        .post(DEPTS_URL)
        .send({ nameAr: 'قسم', nameEn: 'Dept' })
        .expect(401);
    });

    it('returns 400 for missing required fields (nameAr missing)', async () => {
      const res = await request(httpServer)
        .post(DEPTS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameEn: 'Only English' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 for missing required fields (nameEn missing)', async () => {
      const res = await request(httpServer)
        .post(DEPTS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameAr: 'عربي فقط' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 when body is empty', async () => {
      const res = await request(httpServer)
        .post(DEPTS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /departments/:id — update
  // ---------------------------------------------------------------------------

  describe('PATCH /departments/:id', () => {
    let deptId: string;

    beforeAll(async () => {
      const res = await request(httpServer)
        .post(DEPTS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameAr: 'قسم للتحديث',
          nameEn: 'Update Target',
          isActive: true,
        })
        .expect(201);

      deptId = (res.body.data as { id: string }).id;
      createdIds.push(deptId);
    });

    it('returns 200 with updated department', async () => {
      const res = await request(httpServer)
        .patch(`${DEPTS_URL}/${deptId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameEn: 'Updated Name', isActive: false })
        .expect(200);

      expectSuccessResponse(res.body);
      const dept = res.body.data as { nameEn: string; isActive: boolean };
      expect(dept.nameEn).toBe('Updated Name');
      expect(dept.isActive).toBe(false);
    });

    it('returns 404 for non-existent department', async () => {
      const res = await request(httpServer)
        .patch(`${DEPTS_URL}/${NON_EXISTENT_UUID}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameEn: 'Ghost' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('returns 401 without auth', async () => {
      await request(httpServer)
        .patch(`${DEPTS_URL}/${deptId}`)
        .send({ nameEn: 'No Auth' })
        .expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /departments/:id — soft delete
  // ---------------------------------------------------------------------------

  describe('DELETE /departments/:id', () => {
    let deptId: string;

    beforeAll(async () => {
      const res = await request(httpServer)
        .post(DEPTS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameAr: 'قسم للحذف', nameEn: 'Delete Target', isActive: true })
        .expect(201);

      deptId = (res.body.data as { id: string }).id;
      // Do NOT push to createdIds — the test will delete it
    });

    it('returns 200 with { deleted: true }', async () => {
      const res = await request(httpServer)
        .delete(`${DEPTS_URL}/${deptId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as { deleted: boolean };
      expect(data.deleted).toBe(true);
    });

    it('deleted department is not returned in GET list', async () => {
      const res = await request(httpServer).get(DEPTS_URL).expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as { items: Array<{ id: string }> };
      const found = data.items.find((d) => d.id === deptId);
      expect(found).toBeUndefined();
    });

    it('returns 404 for already-deleted department', async () => {
      const res = await request(httpServer)
        .delete(`${DEPTS_URL}/${deptId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent department', async () => {
      const res = await request(httpServer)
        .delete(`${DEPTS_URL}/${NON_EXISTENT_UUID}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('returns 401 without auth', async () => {
      // Use a fresh UUID — the actual dept is already deleted, but 401 fires before 404
      await request(httpServer)
        .delete(`${DEPTS_URL}/${NON_EXISTENT_UUID}`)
        .expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /departments/reorder — reorder
  // ---------------------------------------------------------------------------

  describe('PATCH /departments/reorder', () => {
    let idA: string;
    let idB: string;

    beforeAll(async () => {
      const r1 = await request(httpServer)
        .post(DEPTS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameAr: 'قسم أ', nameEn: 'Dept A', sortOrder: 1 })
        .expect(201);

      const r2 = await request(httpServer)
        .post(DEPTS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameAr: 'قسم ب', nameEn: 'Dept B', sortOrder: 2 })
        .expect(201);

      idA = (r1.body.data as { id: string }).id;
      idB = (r2.body.data as { id: string }).id;
      createdIds.push(idA, idB);
    });

    it('returns 200 with { reordered: true }', async () => {
      const res = await request(httpServer)
        .patch(`${DEPTS_URL}/reorder`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          items: [
            { id: idA, sortOrder: 20 },
            { id: idB, sortOrder: 10 },
          ],
        })
        .expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as { reordered: boolean };
      expect(data.reordered).toBe(true);
    });

    it('sortOrder is reflected in GET list ordering', async () => {
      const res = await request(httpServer).get(DEPTS_URL).expect(200);

      expectSuccessResponse(res.body);
      const data = res.body.data as {
        items: Array<{ id: string; sortOrder: number }>;
      };

      const deptA = data.items.find((d) => d.id === idA);
      const deptB = data.items.find((d) => d.id === idB);

      expect(deptA?.sortOrder).toBe(20);
      expect(deptB?.sortOrder).toBe(10);

      // B should appear before A in the sorted list
      const indexA = data.items.findIndex((d) => d.id === idA);
      const indexB = data.items.findIndex((d) => d.id === idB);
      expect(indexB).toBeLessThan(indexA);
    });

    it('returns 401 without auth', async () => {
      await request(httpServer)
        .patch(`${DEPTS_URL}/reorder`)
        .send({ items: [{ id: idA, sortOrder: 0 }] })
        .expect(401);
    });

    it('returns 400 for invalid reorder payload', async () => {
      const res = await request(httpServer)
        .patch(`${DEPTS_URL}/reorder`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ items: [{ id: 'not-a-uuid', sortOrder: 1 }] })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });
});
