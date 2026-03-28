/**
 * CareKit — Services Module E2E Tests (TDD RED Phase)
 *
 * Tests all service and service category endpoints per docs/api-spec.md:
 *
 * Services:
 *   GET    /services              — list (PUBLIC, filterable)
 *   GET    /services/:id          — get by ID (PUBLIC)
 *   POST   /services              — create (PERMISSION:services:create)
 *   PATCH  /services/:id          — update (PERMISSION:services:edit)
 *   DELETE /services/:id          — soft-delete (PERMISSION:services:delete)
 *
 * Categories:
 *   GET    /services/categories          — list (PUBLIC)
 *   POST   /services/categories          — create (PERMISSION:services:create)
 *   PATCH  /services/categories/:id      — update (PERMISSION:services:edit)
 *   DELETE /services/categories/:id      — delete (PERMISSION:services:delete)
 *
 * Permission matrix (services module):
 *   super_admin  → view, create, edit, delete
 *   receptionist → view, create, edit
 *   accountant   → (none)
 *   practitioner → (none)
 *   patient      → view only
 *
 * These tests will FAIL until backend-dev implements the services module.
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
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const SERVICES_URL = `${API_PREFIX}/services`;
const CATEGORIES_URL = `${SERVICES_URL}/categories`;

describe('Services Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let accountant: AuthResult;
  let practitionerAuth: AuthResult;
  let patient: AuthResult;

  // IDs populated during tests
  let categoryId: string;
  let category2Id: string;
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

  // ═══════════════════════════════════════════════════════════════
  //  SERVICE CATEGORIES
  // ═══════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // POST /services/categories — Create Category
  // ─────────────────────────────────────────────────────────────

  describe('POST /services/categories', () => {
    const validCategory = {
      nameEn: 'General Medicine',
      nameAr: 'الطب العام',
      sortOrder: 1,
    };

    it('should create a category as super_admin', async () => {
      const res = await request(httpServer)
        .post(CATEGORIES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(validCategory)
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('nameEn', validCategory.nameEn);
      expect(res.body.data).toHaveProperty('nameAr', validCategory.nameAr);
      expect(res.body.data).toHaveProperty('sortOrder', validCategory.sortOrder);
      expect(res.body.data).toHaveProperty('isActive', true);

      categoryId = res.body.data.id as string;
    });

    it('should create a category as receptionist (has services:create)', async () => {
      const res = await request(httpServer)
        .post(CATEGORIES_URL)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          nameEn: 'Specialized Care',
          nameAr: 'الرعاية المتخصصة',
          sortOrder: 2,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      category2Id = res.body.data.id as string;
    });

    it('should reject creation without authentication (401)', async () => {
      const res = await request(httpServer)
        .post(CATEGORIES_URL)
        .send(validCategory)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject creation by patient (403 — view only)', async () => {
      const res = await request(httpServer)
        .post(CATEGORIES_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send(validCategory)
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject creation by accountant (403 — no services permissions)', async () => {
      const res = await request(httpServer)
        .post(CATEGORIES_URL)
        .set(getAuthHeaders(accountant.accessToken))
        .send(validCategory)
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject creation by practitioner (403 — no services permissions)', async () => {
      const res = await request(httpServer)
        .post(CATEGORIES_URL)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .send(validCategory)
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject creation without required fields', async () => {
      const res = await request(httpServer)
        .post(CATEGORIES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({})
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should default sortOrder to 0 when not provided', async () => {
      const res = await request(httpServer)
        .post(CATEGORIES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Emergency Services',
          nameAr: 'خدمات الطوارئ',
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('sortOrder', 0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /services/categories — List Categories (PUBLIC)
  // ─────────────────────────────────────────────────────────────

  describe('GET /services/categories', () => {
    it('should return categories list without authentication (PUBLIC)', async () => {
      const res = await request(httpServer)
        .get(CATEGORIES_URL)
        .expect(200);

      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should return categories with correct shape', async () => {
      const res = await request(httpServer)
        .get(CATEGORIES_URL)
        .expect(200);

      const categories = res.body.data as Array<Record<string, unknown>>;
      for (const cat of categories) {
        expect(cat).toHaveProperty('id');
        expect(cat).toHaveProperty('nameEn');
        expect(cat).toHaveProperty('nameAr');
        expect(cat).toHaveProperty('sortOrder');
        expect(cat).toHaveProperty('isActive');
      }
    });

    it('should return categories sorted by sortOrder', async () => {
      const res = await request(httpServer)
        .get(CATEGORIES_URL)
        .expect(200);

      const categories = res.body.data as Array<{ sortOrder: number }>;
      for (let i = 1; i < categories.length; i++) {
        expect(categories[i].sortOrder).toBeGreaterThanOrEqual(
          categories[i - 1].sortOrder,
        );
      }
    });

    it('should only return active categories by default', async () => {
      const res = await request(httpServer)
        .get(CATEGORIES_URL)
        .expect(200);

      const categories = res.body.data as Array<{ isActive: boolean }>;
      for (const cat of categories) {
        expect(cat.isActive).toBe(true);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /services/categories/:id — Update Category
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /services/categories/:id', () => {
    it('should update a category as super_admin', async () => {
      const res = await request(httpServer)
        .patch(`${CATEGORIES_URL}/${categoryId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameEn: 'Updated General Medicine', sortOrder: 10 })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('nameEn', 'Updated General Medicine');
      expect(res.body.data).toHaveProperty('sortOrder', 10);
    });

    it('should update a category as receptionist (has services:edit)', async () => {
      const res = await request(httpServer)
        .patch(`${CATEGORIES_URL}/${categoryId}`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ nameAr: 'الطب العام المحدث' })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should reject update by patient (403)', async () => {
      const res = await request(httpServer)
        .patch(`${CATEGORIES_URL}/${categoryId}`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ sortOrder: 99 })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject update without authentication (401)', async () => {
      const res = await request(httpServer)
        .patch(`${CATEGORIES_URL}/${categoryId}`)
        .send({ sortOrder: 99 })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 404 for non-existent category', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .patch(`${CATEGORIES_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ sortOrder: 1 })
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should allow deactivating a category', async () => {
      const res = await request(httpServer)
        .patch(`${CATEGORIES_URL}/${category2Id}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ isActive: false })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('isActive', false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /services/categories/:id — Delete Category
  // ─────────────────────────────────────────────────────────────

  describe('DELETE /services/categories/:id', () => {
    let deletableCategoryId: string;

    beforeAll(async () => {
      const res = await request(httpServer)
        .post(CATEGORIES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Category To Delete',
          nameAr: 'فئة للحذف',
        })
        .expect(201);

      deletableCategoryId = res.body.data.id as string;
    });

    it('should reject deletion by receptionist (403 — no services:delete)', async () => {
      const res = await request(httpServer)
        .delete(`${CATEGORIES_URL}/${deletableCategoryId}`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject deletion by patient (403)', async () => {
      const res = await request(httpServer)
        .delete(`${CATEGORIES_URL}/${deletableCategoryId}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject deletion without authentication (401)', async () => {
      const res = await request(httpServer)
        .delete(`${CATEGORIES_URL}/${deletableCategoryId}`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should delete a category as super_admin (no services assigned)', async () => {
      const res = await request(httpServer)
        .delete(`${CATEGORIES_URL}/${deletableCategoryId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should return 404 after deletion', async () => {
      // Category endpoints don't have a GET /:id in spec, but delete should fail for non-existent
      const res = await request(httpServer)
        .delete(`${CATEGORIES_URL}/${deletableCategoryId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should prevent deletion of category with assigned services (cascade protection)', async () => {
      // First create a service under categoryId, then try to delete categoryId
      await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Temp Service For Cascade Test',
          nameAr: 'خدمة مؤقتة لاختبار الحماية',
          categoryId,
          price: 10000,
          duration: 30,
        })
        .expect(201);

      const res = await request(httpServer)
        .delete(`${CATEGORIES_URL}/${categoryId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(409);

      expectErrorResponse(res.body, 'CONFLICT');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  SERVICES
  // ═══════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────
  // POST /services — Create Service
  // ─────────────────────────────────────────────────────────────

  describe('POST /services', () => {
    const validService = {
      nameEn: 'General Consultation',
      nameAr: 'استشارة عامة',
      descriptionEn: 'General medical consultation with a physician',
      descriptionAr: 'استشارة طبية عامة مع طبيب',
      categoryId: '', // Will be set in beforeAll
      price: 15000, // 150 SAR in halalat
      duration: 30, // minutes
    };

    beforeAll(() => {
      validService.categoryId = categoryId;
    });

    it('should create a service as super_admin', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(validService)
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('nameEn', validService.nameEn);
      expect(res.body.data).toHaveProperty('nameAr', validService.nameAr);
      expect(res.body.data).toHaveProperty('price', validService.price);
      expect(res.body.data).toHaveProperty('duration', validService.duration);
      expect(res.body.data).toHaveProperty('isActive', true);

      serviceId = res.body.data.id as string;
    });

    it('should create a service as receptionist (has services:create)', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({
          nameEn: 'Follow-up Appointment',
          nameAr: 'موعد متابعة',
          categoryId,
          price: 10000,
          duration: 15,
        })
        .expect(201);

      expectSuccessResponse(res.body);
    });

    it('should reject creation without authentication (401)', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .send(validService)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject creation by patient (403 — view only)', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send(validService)
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject creation by accountant (403)', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(accountant.accessToken))
        .send(validService)
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject creation by practitioner (403)', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .send(validService)
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject creation without required fields', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({})
        .expect(400);

      expectValidationError(res.body, ['nameEn', 'nameAr', 'categoryId']);
    });

    it('should reject creation with invalid categoryId', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Invalid Category Service',
          nameAr: 'خدمة فئة غير صالحة',
          categoryId: '00000000-0000-0000-0000-000000000000',
          price: 10000,
          duration: 30,
        })
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should store price as integer (halalat)', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Price Test Service',
          nameAr: 'خدمة اختبار السعر',
          categoryId,
          price: 25050, // 250.50 SAR
          duration: 45,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data.price).toBe(25050);
      expect(typeof res.body.data.price).toBe('number');
    });

    it('should reject negative price', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Negative Price Service',
          nameAr: 'خدمة سعر سلبي',
          categoryId,
          price: -1000,
          duration: 30,
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject negative or zero duration', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Zero Duration Service',
          nameAr: 'خدمة بدون مدة',
          categoryId,
          price: 10000,
          duration: 0,
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should default price to 0 and duration to 30 when not provided', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Default Values Service',
          nameAr: 'خدمة القيم الافتراضية',
          categoryId,
        })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('price', 0);
      expect(res.body.data).toHaveProperty('duration', 30);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /services — List Services (PUBLIC)
  // ─────────────────────────────────────────────────────────────

  describe('GET /services', () => {
    it('should return services list without authentication (PUBLIC)', async () => {
      const res = await request(httpServer)
        .get(SERVICES_URL)
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('meta');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('should return paginated response with meta', async () => {
      const res = await request(httpServer)
        .get(SERVICES_URL)
        .query({ page: 1, perPage: 5 })
        .expect(200);

      const { meta } = res.body.data;
      expect(meta).toHaveProperty('total');
      expect(meta).toHaveProperty('page', 1);
      expect(meta).toHaveProperty('perPage', 5);
      expect(meta).toHaveProperty('totalPages');
      expect(meta).toHaveProperty('hasNextPage');
      expect(meta).toHaveProperty('hasPreviousPage');
    });

    it('should return services with correct shape', async () => {
      const res = await request(httpServer)
        .get(SERVICES_URL)
        .expect(200);

      const items = res.body.data.items as Array<Record<string, unknown>>;
      expect(items.length).toBeGreaterThanOrEqual(1);

      for (const service of items) {
        expect(service).toHaveProperty('id');
        expect(service).toHaveProperty('nameEn');
        expect(service).toHaveProperty('nameAr');
        expect(service).toHaveProperty('price');
        expect(service).toHaveProperty('duration');
        expect(service).toHaveProperty('isActive');
        expect(service).toHaveProperty('category');
      }
    });

    it('should filter by categoryId', async () => {
      const res = await request(httpServer)
        .get(SERVICES_URL)
        .query({ categoryId })
        .expect(200);

      const items = res.body.data.items as Array<{
        category: { id: string };
      }>;
      for (const item of items) {
        expect(item.category.id).toBe(categoryId);
      }
    });

    it('should filter by isActive', async () => {
      const res = await request(httpServer)
        .get(SERVICES_URL)
        .query({ isActive: true })
        .expect(200);

      const items = res.body.data.items as Array<{ isActive: boolean }>;
      for (const item of items) {
        expect(item.isActive).toBe(true);
      }
    });

    it('should search by name (Arabic or English)', async () => {
      const res = await request(httpServer)
        .get(SERVICES_URL)
        .query({ search: 'Consultation' })
        .expect(200);

      const items = res.body.data.items as Array<{ nameEn: string }>;
      expect(items.length).toBeGreaterThanOrEqual(1);
      for (const item of items) {
        expect(
          item.nameEn.toLowerCase().includes('consultation'),
        ).toBe(true);
      }
    });

    it('should search in Arabic', async () => {
      const res = await request(httpServer)
        .get(SERVICES_URL)
        .query({ search: 'استشارة' })
        .expect(200);

      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should exclude soft-deleted services', async () => {
      const res = await request(httpServer)
        .get(SERVICES_URL)
        .expect(200);

      const items = res.body.data.items as Array<{ deletedAt: string | null }>;
      for (const item of items) {
        expect(item.deletedAt).toBeUndefined(); // deletedAt should not be exposed
      }
    });

    it('should exclude isHidden services from public listing', async () => {
      // Create a hidden service
      const hiddenRes = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Hidden From Public Service',
          nameAr: 'خدمة مخفية عن الجمهور',
          categoryId,
          isHidden: true,
        })
        .expect(201);

      const hiddenId = hiddenRes.body.data.id as string;

      // Public (unauthenticated) GET should not return it
      const res = await request(httpServer)
        .get(SERVICES_URL)
        .expect(200);

      const ids = (res.body.data.items as Array<{ id: string }>).map((i) => i.id);
      expect(ids).not.toContain(hiddenId);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /services/:id — Get Service by ID (PUBLIC)
  // ─────────────────────────────────────────────────────────────

  describe('GET /services/:id', () => {
    it('should return a service by ID without authentication', async () => {
      const res = await request(httpServer)
        .get(`${SERVICES_URL}/${serviceId}`)
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id', serviceId);
      expect(res.body.data).toHaveProperty('nameEn');
      expect(res.body.data).toHaveProperty('nameAr');
      expect(res.body.data).toHaveProperty('descriptionEn');
      expect(res.body.data).toHaveProperty('descriptionAr');
      expect(res.body.data).toHaveProperty('price');
      expect(res.body.data).toHaveProperty('duration');
      expect(res.body.data).toHaveProperty('isActive');
      expect(res.body.data).toHaveProperty('category');
    });

    it('should include category details in response', async () => {
      const res = await request(httpServer)
        .get(`${SERVICES_URL}/${serviceId}`)
        .expect(200);

      const category = res.body.data.category as Record<string, unknown>;
      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('nameEn');
      expect(category).toHaveProperty('nameAr');
    });

    it('should return 404 for non-existent service', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .get(`${SERVICES_URL}/${fakeId}`)
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 400 for invalid UUID', async () => {
      const res = await request(httpServer)
        .get(`${SERVICES_URL}/invalid-uuid`)
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /services/:id — Update Service
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /services/:id', () => {
    it('should update a service as super_admin', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          descriptionEn: 'Updated consultation description',
          price: 20000,
          duration: 45,
        })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty(
        'descriptionEn',
        'Updated consultation description',
      );
      expect(res.body.data).toHaveProperty('price', 20000);
      expect(res.body.data).toHaveProperty('duration', 45);
    });

    it('should update a service as receptionist (has services:edit)', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ nameAr: 'استشارة عامة محدثة' })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should reject update by patient (403)', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ price: 99999 })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject update by accountant (403)', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(accountant.accessToken))
        .send({ price: 99999 })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject update by practitioner (403)', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .send({ price: 99999 })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject update without authentication (401)', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .send({ price: 99999 })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 404 for non-existent service', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ price: 10000 })
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should allow deactivating a service', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ isActive: false })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('isActive', false);

      // Re-activate for subsequent tests
      await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ isActive: true })
        .expect(200);
    });

    it('should allow changing category', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ categoryId: category2Id })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.category).toHaveProperty('id', category2Id);

      // Revert category
      await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ categoryId })
        .expect(200);
    });

    it('should reject update with invalid categoryId', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ categoryId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should update advanced fields (depositEnabled, bufferMinutes, allowRecurring)', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          depositEnabled: true,
          depositPercent: 30,
          bufferMinutes: 15,
          allowRecurring: false,
          maxParticipants: 5,
        })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('depositEnabled', true);
      expect(res.body.data).toHaveProperty('depositPercent', 30);
      expect(res.body.data).toHaveProperty('bufferMinutes', 15);
      expect(res.body.data).toHaveProperty('allowRecurring', false);
      expect(res.body.data).toHaveProperty('maxParticipants', 5);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /services/:id — Soft Delete Service
  // ─────────────────────────────────────────────────────────────

  describe('DELETE /services/:id', () => {
    let deletableServiceId: string;

    beforeAll(async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Service To Delete',
          nameAr: 'خدمة للحذف',
          categoryId,
          price: 5000,
          duration: 15,
        })
        .expect(201);

      deletableServiceId = res.body.data.id as string;
    });

    it('should reject deletion without authentication (401)', async () => {
      const res = await request(httpServer)
        .delete(`${SERVICES_URL}/${deletableServiceId}`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should reject deletion by patient (403)', async () => {
      const res = await request(httpServer)
        .delete(`${SERVICES_URL}/${deletableServiceId}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject deletion by receptionist (403 — no services:delete)', async () => {
      const res = await request(httpServer)
        .delete(`${SERVICES_URL}/${deletableServiceId}`)
        .set(getAuthHeaders(receptionist.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject deletion by accountant (403)', async () => {
      const res = await request(httpServer)
        .delete(`${SERVICES_URL}/${deletableServiceId}`)
        .set(getAuthHeaders(accountant.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject deletion by practitioner (403)', async () => {
      const res = await request(httpServer)
        .delete(`${SERVICES_URL}/${deletableServiceId}`)
        .set(getAuthHeaders(practitionerAuth.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should soft-delete a service as super_admin', async () => {
      const res = await request(httpServer)
        .delete(`${SERVICES_URL}/${deletableServiceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should not return soft-deleted service in GET /services', async () => {
      const res = await request(httpServer)
        .get(SERVICES_URL)
        .expect(200);

      const items = res.body.data.items as Array<{ id: string }>;
      const ids = items.map((item) => item.id);
      expect(ids).not.toContain(deletableServiceId);
    });

    it('should return 404 when getting soft-deleted service by ID', async () => {
      const res = await request(httpServer)
        .get(`${SERVICES_URL}/${deletableServiceId}`)
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 404 for deleting non-existent service', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .delete(`${SERVICES_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });
  });

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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.data.price).toBe(100000);
      expect(res.body.data.duration).toBe(60);
      expect(res.body.data.bufferMinutes).toBe(30);
      expect(res.body.data.depositEnabled).toBe(true);
      expect(res.body.data.depositPercent).toBe(25);
      expect(res.body.data.allowRecurring).toBe(true);
      expect(res.body.data.maxRecurrences).toBe(12);
      expect(res.body.data.maxParticipants).toBe(1);
      expect(res.body.data.minLeadMinutes).toBe(1440);
      expect(res.body.data.maxAdvanceDays).toBe(60);
      expect(res.body.data.calendarColor).toBe('#4CAF50');
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
          allowedRecurringPatterns: ['yearly'],
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    // Validation: depositPercent > 100
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

    // Scenario 11: Create service with practitioner linked atomically
    it('should create service with practitionerIds and link practitioners atomically', async () => {
      // Step 1: Get an existing specialty
      const specRes = await request(httpServer).get(`${API_PREFIX}/specialties`).expect(200);
      const specialties = (specRes.body.data?.items ?? specRes.body.data) as Array<{ id: string }>;
      if (!Array.isArray(specialties) || specialties.length === 0) return; // skip if no specialties seeded
      const specialtyId = specialties[0].id;

      // Step 2: Create a practitioner profile for the test practitioner user
      const practUserId = (practitionerAuth.user as { id: string }).id;
      const practRes = await request(httpServer)
        .post(`${API_PREFIX}/practitioners`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          userId: practUserId,
          specialtyId,
          bio: 'Test practitioner for service link',
          bioAr: 'طبيب اختبار لربط الخدمة',
          experience: 3,
        });
      expect([201, 409]).toContain(practRes.status);
      let practitionerId: string;
      if (practRes.status === 201) {
        practitionerId = practRes.body.data.id as string;
      } else {
        const listRes = await request(httpServer).get(`${API_PREFIX}/practitioners`).expect(200);
        const found = (listRes.body.data.items as Array<{ id: string; user: { id: string } }>).find(
          (p) => p.user.id === practUserId,
        );
        expect(found).toBeDefined();
        practitionerId = found!.id;
      }

      // Step 3: Create a category for this test (categoryId outer var may be unset in isolated runs)
      const catRes = await request(httpServer)
        .post(CATEGORIES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ nameEn: 'Practitioner Link Test', nameAr: 'ربط الطبيب', sortOrder: 99 })
        .expect(201);
      const testCategoryId = catRes.body.data.id as string;

      // Step 4: Create service with practitionerIds
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Service With Practitioner',
          nameAr: 'خدمة مع طبيب',
          categoryId: testCategoryId,
          price: 15000,
          duration: 45,
          practitionerIds: [practitionerId],
        })
        .expect(201);

      expectSuccessResponse(res.body);
      const createdServiceId = res.body.data.id as string;

      // Step 5: Verify practitioner is linked via GET /services/:id/practitioners
      const linkRes = await request(httpServer)
        .get(`${SERVICES_URL}/${createdServiceId}/practitioners`)
        .expect(200);

      expectSuccessResponse(linkRes.body);
      const linked = linkRes.body.data as Array<{ practitionerId: string; practitioner: { id: string } }>;
      expect(Array.isArray(linked)).toBe(true);
      expect(linked.some((p) => p.practitioner.id === practitionerId)).toBe(true);
    });

    // Validation: minLeadMinutes > 1440
    it('should reject minLeadMinutes > 1440', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Too Long Lead Service',
          nameAr: 'خدمة وقت انتظار طويل',
          categoryId,
          minLeadMinutes: 1441,
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    // Validation: depositPercent: 0 (below @Min(1))
    it('should reject depositPercent: 0', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Zero Deposit Service',
          nameAr: 'خدمة عربون صفر',
          categoryId,
          depositEnabled: true,
          depositPercent: 0,
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    // Validation: maxRecurrences: 0 (below @Min(1))
    it('should reject maxRecurrences: 0', async () => {
      const res = await request(httpServer)
        .post(SERVICES_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({
          nameEn: 'Zero Recurrences Service',
          nameAr: 'خدمة تكرار صفر',
          categoryId,
          allowRecurring: true,
          maxRecurrences: 0,
        })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });
  });
});
