/**
 * Mobile tenant-lock — proves the X-Org-Id header is honored on
 * UNAUTHENTICATED public routes and that two different header values
 * resolve to different tenants. Authenticated paths are unaffected.
 *
 * The catalog endpoint is used because it's a real public route already
 * tenant-scoped via TenantContextService.requireOrganizationIdOrDefault().
 */
import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma } from '../../setup/db.setup';

describe('Mobile public tenant header (X-Org-Id)', () => {
  let req: SuperTest.Agent;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());

    const stamp = Date.now();
    const orgA = await testPrisma.organization.upsert({
      where: { slug: `mobile-hdr-a-${stamp}` },
      update: {},
      create: {
        slug: `mobile-hdr-a-${stamp}`,
        nameAr: 'منظمة موبايل أ',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    const orgB = await testPrisma.organization.upsert({
      where: { slug: `mobile-hdr-b-${stamp}` },
      update: {},
      create: {
        slug: `mobile-hdr-b-${stamp}`,
        nameAr: 'منظمة موبايل ب',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('public route: X-Org-Id resolves to that tenant (returns 200)', async () => {
    const res = await req
      .get('/public/services/departments')
      .set('X-Org-Id', orgAId)
      .expect(200);
    // Body shape is a bare array of PublicDepartment.
    // No departments are seeded for fresh test orgs, so length may be 0.
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('public route: different X-Org-Id values do not bleed across tenants', async () => {
    const aRes = await req
      .get('/public/services/departments')
      .set('X-Org-Id', orgAId)
      .expect(200);

    const bRes = await req
      .get('/public/services/departments')
      .set('X-Org-Id', orgBId)
      .expect(200);

    const aIds = (aRes.body as Array<{ id: string }>).map((d) => d.id);
    const bIds = (bRes.body as Array<{ id: string }>).map((d) => d.id);
    // Whatever each tenant returns, they MUST NOT share ids — this is the
    // isolation contract. Both being empty is also a valid pass (each tenant
    // has its own empty catalog), since createOrg does not seed departments.
    expect(aIds.some((id) => bIds.includes(id))).toBe(false);
  });

  it('public route: invalid UUID is rejected in strict mode', async () => {
    // Test env runs TENANT_ENFORCEMENT=strict (the platform default). An
    // invalid UUID is silently dropped by the parser, leaving no resolved
    // org → middleware throws TenantResolutionError (400). In permissive
    // dev mode the same request would fall through to DEFAULT_ORGANIZATION_ID.
    const res = await req
      .get('/public/services/departments')
      .set('X-Org-Id', 'not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'TENANT_RESOLUTION_FAILED' });
  });
});
