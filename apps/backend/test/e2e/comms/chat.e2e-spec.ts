import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedClient } from '../../setup/seed.helper';
import { createTestToken, adminUser } from '../../setup/auth.helper';
describe('Staff↔Client Chat API (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
  });

  beforeEach(async () => {
    await cleanTables(['CommsChatMessage', 'ChatConversation', 'Client']);
  });

  afterAll(async () => {
    await cleanTables(['CommsChatMessage', 'ChatConversation', 'Client']);
    await closeTestApp();
  });

  it('[CH-001][Chat/create-conversation][P1-High] إنشاء محادثة جديدة عبر DB وظهورها في list', async () => {
    const client = await seedClient(testPrisma as any);
    await (testPrisma as any).chatConversation.create({
      data: { organizationId: '00000000-0000-0000-0000-000000000001', clientId: client.id, status: 'OPEN' },
    });

    const res = await req
      .get('/dashboard/comms/chat/conversations')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].clientId).toBe(client.id);
    expect(res.body.items[0].status).toBe('OPEN');
  });

  it('[CH-002][Chat/send-staff-message][P1-High] إرسال رسالة من الموظف وعرضها في list-messages', async () => {
    const client = await seedClient(testPrisma as any);
    const conv = await (testPrisma as any).chatConversation.create({
      data: { organizationId: '00000000-0000-0000-0000-000000000001', clientId: client.id, status: 'OPEN' },
    });

    const sendRes = await req
      .post(`/dashboard/comms/chat/conversations/${conv.id}/messages`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ body: 'مرحبا' });

    expect(sendRes.status).toBe(201);

    const listRes = await req
      .get(`/dashboard/comms/chat/conversations/${conv.id}/messages`)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].body).toBe('مرحبا');
  });

  it('[CH-003][Chat/close-conversation][P2-Medium] قفل محادثة يغيّر status إلى CLOSED', async () => {
    const client = await seedClient(testPrisma as any);
    const conv = await (testPrisma as any).chatConversation.create({
      data: { organizationId: '00000000-0000-0000-0000-000000000001', clientId: client.id, status: 'OPEN' },
    });

    const res = await req
      .patch(`/dashboard/comms/chat/conversations/${conv.id}/close`)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    const inDb = await (testPrisma as any).chatConversation.findUnique({ where: { id: conv.id } });
    expect(inDb.status).toBe('CLOSED');
  });

  // NOTE: cross-tenant isolation removed in single-org refactor
});
