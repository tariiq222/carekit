import { INestApplication, NotFoundException } from '@nestjs/common';
import { createVerticalsTestApp, closeVerticalsTestApp } from './verticals-test-app';
import { testPrisma } from '../../../setup/db.setup';
import { SeedOrganizationFromVerticalHandler } from '../../../../src/modules/platform/verticals/seed-organization-from-vertical.handler';
import { PrismaService } from '../../../../src/infrastructure/database';

// Stable seeded slugs from migration 20260422080855
const DENTAL_SLUG = 'dental';
const DENTAL_DEPT_COUNT = 4;  // 4 seed departments for dental
const DENTAL_CAT_COUNT = 4;   // 4 seed service categories for dental

describe('SeedOrganizationFromVerticalHandler (e2e / integration)', () => {
  let app: INestApplication;
  let handler: SeedOrganizationFromVerticalHandler;
  let prisma: PrismaService;

  // IDs of orgs created during this suite — cleaned up in afterAll
  const createdOrgIds: string[] = [];

  async function createTestOrg(suffix: string): Promise<string> {
    const org = await testPrisma.organization.create({
      data: {
        slug: `test-seed-org-${suffix}-${Date.now()}`,
        nameAr: `منظمة تجريبية ${suffix}`,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    createdOrgIds.push(org.id);
    return org.id;
  }

  beforeAll(async () => {
    ({ app } = await createVerticalsTestApp());
    handler = app.get(SeedOrganizationFromVerticalHandler);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Delete child rows first (FK constraint), then the orgs
    if (createdOrgIds.length > 0) {
      await testPrisma.department.deleteMany({
        where: { organizationId: { in: createdOrgIds } },
      });
      await testPrisma.serviceCategory.deleteMany({
        where: { organizationId: { in: createdOrgIds } },
      });
      await testPrisma.organization.deleteMany({
        where: { id: { in: createdOrgIds } },
      });
    }
    await closeVerticalsTestApp();
  });

  it('happy path — seeds departments, categories, and sets verticalId', async () => {
    const orgId = await createTestOrg('happy');

    const result = await handler.execute({ organizationId: orgId, verticalSlug: DENTAL_SLUG });

    expect(result).toMatchObject({
      seededDepartments: DENTAL_DEPT_COUNT,
      seededCategories: DENTAL_CAT_COUNT,
    });
    expect(typeof (result as Record<string, unknown>).verticalId).toBe('string');

    // Verify rows in DB
    const deptCount = await prisma.department.count({ where: { organizationId: orgId } });
    expect(deptCount).toBe(DENTAL_DEPT_COUNT);

    const catCount = await prisma.serviceCategory.count({ where: { organizationId: orgId } });
    expect(catCount).toBe(DENTAL_CAT_COUNT);

    // Organization.verticalId must be set
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    expect(org?.verticalId).not.toBeNull();
    expect(org?.verticalId).toBe((result as Record<string, unknown>).verticalId);
  });

  it('idempotency — second call returns skipped=true, counts unchanged', async () => {
    const orgId = await createTestOrg('idempotent');

    // First call
    await handler.execute({ organizationId: orgId, verticalSlug: DENTAL_SLUG });

    // Second call on the same org
    const second = await handler.execute({ organizationId: orgId, verticalSlug: DENTAL_SLUG });

    expect(second).toMatchObject({ skipped: true, reason: 'already-seeded' });

    // Counts must not have doubled
    const deptCount = await prisma.department.count({ where: { organizationId: orgId } });
    expect(deptCount).toBe(DENTAL_DEPT_COUNT);

    const catCount = await prisma.serviceCategory.count({ where: { organizationId: orgId } });
    expect(catCount).toBe(DENTAL_CAT_COUNT);
  });

  it('throws NotFoundException for a non-existent slug', async () => {
    const orgId = await createTestOrg('notfound');

    await expect(
      handler.execute({ organizationId: orgId, verticalSlug: 'slug-that-does-not-exist-xyz' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('cross-org isolation — departments seeded into orgA never appear in orgB', async () => {
    const orgAId = await createTestOrg('isolation-a');
    const orgBId = await createTestOrg('isolation-b');

    // Seed both orgs from the same vertical
    await handler.execute({ organizationId: orgAId, verticalSlug: DENTAL_SLUG });
    await handler.execute({ organizationId: orgBId, verticalSlug: DENTAL_SLUG });

    // Each org gets its own set of departments
    const orgADepts = await prisma.department.count({ where: { organizationId: orgAId } });
    const orgBDepts = await prisma.department.count({ where: { organizationId: orgBId } });
    expect(orgADepts).toBe(DENTAL_DEPT_COUNT);
    expect(orgBDepts).toBe(DENTAL_DEPT_COUNT);

    // None of orgA's department rows have orgBId (no cross-tenant leakage)
    const orgADeptIds = await prisma.department
      .findMany({ where: { organizationId: orgAId }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));

    const orgALeakIntoBDepts = await prisma.department.count({
      where: { organizationId: orgBId, id: { in: orgADeptIds } },
    });
    expect(orgALeakIntoBDepts).toBe(0);

    // Same check for service categories
    const orgACats = await prisma.serviceCategory.count({ where: { organizationId: orgAId } });
    const orgBCats = await prisma.serviceCategory.count({ where: { organizationId: orgBId } });
    expect(orgACats).toBe(DENTAL_CAT_COUNT);
    expect(orgBCats).toBe(DENTAL_CAT_COUNT);
  });
});
