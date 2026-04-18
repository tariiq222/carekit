import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedBranch } from '../../setup/seed.helper';
import { createPublicTestApp, closePublicTestApp } from './public-test-app';
import type SuperTest from 'supertest';

describe('GET /public/branches (e2e)', () => {
  let req: SuperTest.Agent;

  beforeAll(async () => {
    ({ request: req } = await createPublicTestApp());
    await cleanTables(['Branch']);
  });

  afterAll(async () => {
    await closePublicTestApp();
  });

  afterEach(async () => {
    await cleanTables(['Branch']);
  });

  it('returns 200 with an empty array when no branches exist', async () => {
    const res = await req.get('/public/branches').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('returns 200 with active branches', async () => {
    await seedBranch(testPrisma as never, { nameAr: 'الفرع الرئيسي', nameEn: 'Main Branch' });

    const res = await req.get('/public/branches').expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);

    const branch = res.body[0] as Record<string, unknown>;
    expect(branch).toHaveProperty('id');
    expect(branch.nameAr).toBe('الفرع الرئيسي');
    expect(branch.nameEn).toBe('Main Branch');
  });

  it('excludes inactive branches', async () => {
    await seedBranch(testPrisma as never, { nameAr: 'فرع نشط' });
    await testPrisma.branch.create({
      data: { nameAr: 'فرع مغلق', isActive: false },
    });

    const res = await req.get('/public/branches').expect(200);

    expect(res.body).toHaveLength(1);
    const branch = res.body[0] as Record<string, unknown>;
    expect(branch.nameAr).toBe('فرع نشط');
  });

  it('response items contain only public-safe fields', async () => {
    await seedBranch(testPrisma as never);

    const res = await req.get('/public/branches').expect(200);

    const item = res.body[0] as Record<string, unknown>;
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('nameAr');
    expect(item).toHaveProperty('nameEn');
    expect(item).toHaveProperty('city');
    expect(item).toHaveProperty('addressAr');
    // Internal-only fields must NOT be present
    expect(item).not.toHaveProperty('phone');
    expect(item).not.toHaveProperty('isActive');
    expect(item).not.toHaveProperty('createdAt');
    expect(item).not.toHaveProperty('updatedAt');
  });

  it('returns multiple active branches', async () => {
    await seedBranch(testPrisma as never, { nameAr: 'الفرع الأول' });
    await seedBranch(testPrisma as never, { nameAr: 'الفرع الثاني' });

    const res = await req.get('/public/branches').expect(200);

    expect(res.body).toHaveLength(2);
  });
});
