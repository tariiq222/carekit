import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma } from '../../setup/db.setup';

const SINGLETON_ID = 'default';

describe('Public Branding centralization (e2e)', () => {
  let req: SuperTest.Agent;
  let originalRow: Awaited<ReturnType<typeof testPrisma.brandingConfig.findUnique>> | null = null;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    originalRow = await testPrisma.brandingConfig.findUnique({ where: { id: SINGLETON_ID } });
  });

  afterAll(async () => {
    if (originalRow) {
      await testPrisma.brandingConfig.update({
        where: { id: SINGLETON_ID },
        data: {
          organizationNameAr: originalRow.organizationNameAr,
          colorPrimary: originalRow.colorPrimary,
          websiteDomain: originalRow.websiteDomain,
          activeWebsiteTheme: originalRow.activeWebsiteTheme,
        },
      });
    }
    await closeTestApp();
  });

  it('GET /public/branding returns the full PublicBranding shape without internal fields', async () => {
    await testPrisma.brandingConfig.upsert({
      where: { id: SINGLETON_ID },
      update: { colorPrimary: '#DE0B5C' },
      create: { id: SINGLETON_ID, organizationNameAr: 'عيادتي', colorPrimary: '#DE0B5C' },
    });

    const res = await req.get('/public/branding').expect(200);

    expect(res.body).toMatchObject({
      organizationNameAr: expect.any(String),
      colorPrimary: '#DE0B5C',
      activeWebsiteTheme: expect.stringMatching(/^(SAWAA|PREMIUM)$/),
    });

    expect(res.body).not.toHaveProperty('id');
    expect(res.body).not.toHaveProperty('customCss');
    expect(res.body).not.toHaveProperty('createdAt');
    expect(res.body).not.toHaveProperty('updatedAt');
  });

  it('reflects a color change in DB on the next request (centralization contract)', async () => {
    const primary1 = '#AA0000';
    const primary2 = '#00AA00';

    await testPrisma.brandingConfig.update({
      where: { id: SINGLETON_ID },
      data: { colorPrimary: primary1 },
    });
    const r1 = await req.get('/public/branding').expect(200);
    expect(r1.body.colorPrimary).toBe(primary1);

    await testPrisma.brandingConfig.update({
      where: { id: SINGLETON_ID },
      data: { colorPrimary: primary2 },
    });
    const r2 = await req.get('/public/branding').expect(200);
    expect(r2.body.colorPrimary).toBe(primary2);
  });

  it('includes websiteDomain and activeWebsiteTheme (Phase 1 additions)', async () => {
    await testPrisma.brandingConfig.update({
      where: { id: SINGLETON_ID },
      data: { websiteDomain: 'clinic-test.example', activeWebsiteTheme: 'PREMIUM' },
    });

    const res = await req.get('/public/branding').expect(200);

    expect(res.body.websiteDomain).toBe('clinic-test.example');
    expect(res.body.activeWebsiteTheme).toBe('PREMIUM');
  });
});
