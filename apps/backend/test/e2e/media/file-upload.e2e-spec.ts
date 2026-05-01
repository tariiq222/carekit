import path from 'node:path';
import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedEmployee } from '../../setup/seed.helper';
import { createTestToken, adminUser } from '../../setup/auth.helper';
const FIXTURES = path.resolve(__dirname, '../fixtures');
const LOGO_PNG = path.join(FIXTURES, 'sample-logo.png');
const SAMPLE_PDF = path.join(FIXTURES, 'sample-document.pdf');

const MOCKED_URL = 'http://localhost:9000/deqah/mocked-key';

describe('File Upload API (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
  });

  beforeEach(async () => {
    await cleanTables(['File', 'BrandingConfig', 'Employee']);
  });

  afterAll(async () => {
    await cleanTables(['File', 'BrandingConfig', 'Employee']);
    await closeTestApp();
  });

  it('[MD-001][Media/upload-logo][P1-High] رفع logo للـ branding ناجح', async () => {
    const res = await req
      .post('/dashboard/organization/branding/logo')
      .set('Authorization', `Bearer ${TOKEN}`)
      .attach('file', LOGO_PNG);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('fileId');
    expect(res.body).toHaveProperty('url');

    const fileRow = await (testPrisma as any).file.findFirst({
      where: { ownerType: 'branding' },
    });
    expect(fileRow).not.toBeNull();
    expect(fileRow.ownerType).toBe('branding');

    const brandingRow = await (testPrisma as any).brandingConfig.findFirst({
      where: { organizationId: '00000000-0000-0000-0000-000000000001' },
    });
    expect(brandingRow).not.toBeNull();
    expect(brandingRow.logoUrl).toBe(res.body.url);
  });

  it('[MD-002][Media/upload-logo][P2-Medium] رفض logo > 2MB', async () => {
    const bigBuffer = Buffer.alloc(2 * 1024 * 1024 + 1, 0x00);

    const res = await req
      .post('/dashboard/organization/branding/logo')
      .set('Authorization', `Bearer ${TOKEN}`)
      .attach('file', bigBuffer, { filename: 'big.png', contentType: 'image/png' });

    expect(res.status).toBe(400);

    const count = await (testPrisma as any).file.count({ where: { } });
    expect(count).toBe(0);
  });

  it('[MD-003][Media/upload-logo][P2-Medium] رفض logo بنوع PDF', async () => {
    const res = await req
      .post('/dashboard/organization/branding/logo')
      .set('Authorization', `Bearer ${TOKEN}`)
      .attach('file', SAMPLE_PDF);

    expect(res.status).toBe(400);

    const count = await (testPrisma as any).file.count({ where: { } });
    expect(count).toBe(0);
  });

  it('[MD-004][Media/upload-avatar][P1-High] رفع avatar للموظف ناجح', async () => {
    const employee = await seedEmployee(testPrisma as any, { name: 'د. خالد' });

    const res = await req
      .post(`/dashboard/people/employees/${employee.id}/avatar`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .attach('file', LOGO_PNG);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('url');

    const updatedEmployee = await (testPrisma as any).employee.findUnique({
      where: { id: employee.id },
    });
    expect(updatedEmployee.avatarUrl).toBe(res.body.url);

    const fileRow = await (testPrisma as any).file.findFirst({
      where: { ownerType: 'employee', ownerId: employee.id },
    });
    expect(fileRow).not.toBeNull();
    expect(fileRow.ownerType).toBe('employee');
    expect(fileRow.ownerId).toBe(employee.id);
  });

  it('[MD-005][Media/upload-avatar][P2-Medium] رفض avatar > 1MB', async () => {
    const employee = await seedEmployee(testPrisma as any, { name: 'د. سارة' });
    const bigBuffer = Buffer.alloc(1 * 1024 * 1024 + 1, 0x00);

    const res = await req
      .post(`/dashboard/people/employees/${employee.id}/avatar`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .attach('file', bigBuffer, { filename: 'big.png', contentType: 'image/png' });

    expect(res.status).toBe(400);

    const count = await (testPrisma as any).file.count({ where: { } });
    expect(count).toBe(0);
  });

  it('[MD-006][Media/upload-generic][P1-High] الـ endpoint العام لا يزال يقبل رفع ملف', async () => {
    const res = await req
      .post('/dashboard/media/upload')
      .set('Authorization', `Bearer ${TOKEN}`)
      .attach('file', LOGO_PNG);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
});
