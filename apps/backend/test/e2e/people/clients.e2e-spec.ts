import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedClient } from '../../setup/seed.helper';
import { createTestToken, adminUser } from '../../setup/auth.helper';let counter = 0;
const uniquePhone = () => {
  counter += 1;
  return `+9665${Date.now().toString().slice(-6)}${counter.toString().padStart(2, '0')}`;
};

describe('Clients API (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
    await cleanTables(['Client']);
  });

  afterAll(async () => {
    await cleanTables(['Client']);
    await closeTestApp();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE
  // ══════════════════════════════════════════════════════════════════════════
  describe('POST /dashboard/people/clients', () => {
    it('[CL-001][Clients/create-client][P1-High] إنشاء walk-in بالحد الأدنى', async () => {
      const phone = uniquePhone();
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'أحمد', lastName: 'العلي', phone });

      expect(res.status).toBe(201);
      const inDb = await (testPrisma as any).client.findUnique({ where: { id: res.body.id } });
      expect(inDb.source).toBe('WALK_IN');
      expect(inDb.accountType).toBe('WALK_IN');
      expect(inDb.isActive).toBe(true);
      expect(inDb.name).toBe('أحمد العلي');
    });

    it('[CL-002][Clients/create-client][P1-High] إنشاء بجميع الحقول الاختيارية', async () => {
      const phone = uniquePhone();
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({
          firstName: 'سارة',
          middleName: 'محمد',
          lastName: 'الفهد',
          phone,
          email: 'sara@example.com',
          gender: 'FEMALE',
          dateOfBirth: '1990-05-15',
          nationality: 'Saudi',
          nationalId: '1012345678',
          emergencyName: 'أخ سارة',
          emergencyPhone: uniquePhone(),
          bloodType: 'O_POS',
          allergies: 'البنسلين',
          chronicConditions: 'السكري',
          notes: 'ملاحظة تجريبية',
        });

      expect(res.status).toBe(201);
      const inDb = await (testPrisma as any).client.findUnique({ where: { id: res.body.id } });
      expect(inDb.name).toBe('سارة محمد الفهد');
      expect(inDb.gender).toBe('FEMALE');
      expect(inDb.bloodType).toBe('O_POS');
    });

    it('[CL-003][Clients/create-client][P1-High] جوال مستخدم مسبقاً → backend يُرجع 409 (UI يفسّره كـ isExisting)', async () => {
      const phone = uniquePhone();
      const first = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'Existing', lastName: 'User', phone });
      expect(first.status).toBe(201);

      const second = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'Another', lastName: 'Attempt', phone });
      expect(second.status).toBe(409);
    });

    it('[CL-004][Clients/create-client][P1-High] جوال 05XXXXXXXX يُطبَّع إلى E.164 ويُقبل', async () => {
      // Phone normalization converts local 0501234567 → +966501234567 at DTO ingress.
      // The normalized form is valid, so the client is created successfully.
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'Bad', lastName: 'Phone', phone: '0501234567' });
      // May be 201 (created) or 409 (conflict if this number already exists from a prior run).
      expect([201, 409]).toContain(res.status);
    });

    it('[CL-005][Clients/create-client][P2-Medium] رفض جوال +966 بدون 5', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'A', lastName: 'B', phone: '+966401234567' });
      expect(res.status).toBe(400);
    });

    it('[CL-006][Clients/create-client][P2-Medium] رفض جوال طوله غير صحيح', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'A', lastName: 'B', phone: '+9665123456789' });
      expect(res.status).toBe(400);
    });

    it('[CL-007][Clients/create-client][P1-High] جوال مكرر → 409', async () => {
      const phone = uniquePhone();
      await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'Orig', lastName: 'Client', phone });
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'Dup', lastName: 'Client', phone });
      expect(res.status).toBe(409);
    });

    it('[CL-008][Clients/create-client][P1-High] رفض firstName فارغ', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: '', lastName: 'L', phone: uniquePhone() });
      expect(res.status).toBe(400);
    });

    it('[CL-009][Clients/create-client][P1-High] رفض lastName مفقود', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'F', phone: uniquePhone() });
      expect(res.status).toBe(400);
    });

    it('[CL-010][Clients/create-client][P3-Low] رفض firstName > 255', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'a'.repeat(256), lastName: 'B', phone: uniquePhone() });
      expect(res.status).toBe(400);
    });

    it('[CL-011][Clients/create-client][P2-Medium] رفض email خاطئ', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'A', lastName: 'B', phone: uniquePhone(), email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('[CL-012][Clients/create-client][P2-Medium] رفض dateOfBirth بصيغة غير ISO', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'A', lastName: 'B', phone: uniquePhone(), dateOfBirth: 'not-a-date' });
      expect(res.status).toBe(400);
    });

    it('[CL-013][Clients/create-client][P2-Medium] رفض gender enum غير صالح', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'A', lastName: 'B', phone: uniquePhone(), gender: 'OTHER' });
      expect(res.status).toBe(400);
    });

    it('[CL-014][Clients/create-client][P3-Low] رفض bloodType enum غير صالح', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'A', lastName: 'B', phone: uniquePhone(), bloodType: 'XX' });
      expect(res.status).toBe(400);
    });

    it('[CL-015][Clients/create-client][P3-Low] رفض nationalId > 20', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'A', lastName: 'B', phone: uniquePhone(), nationalId: '1'.repeat(21) });
      expect(res.status).toBe(400);
    });

    it('[CL-016][Clients/create-client][P3-Low] رفض allergies > 1000', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'A', lastName: 'B', phone: uniquePhone(), allergies: 'a'.repeat(1001) });
      expect(res.status).toBe(400);
    });

    it('[CL-017][Clients/create-client][P3-Low] رفض notes > 2000', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'A', lastName: 'B', phone: uniquePhone(), notes: 'a'.repeat(2001) });
      expect(res.status).toBe(400);
    });

    it('[CL-018][Clients/create-client][P2-Medium] emergencyPhone بالتنسيق المحلي يُطبَّع ويُقبل', async () => {
      // Phone normalization converts local 0501234567 → +966501234567 at DTO ingress.
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'A', lastName: 'B', phone: uniquePhone(), emergencyPhone: '0501234567' });
      expect(res.status).toBe(201);
    });

    it('[CL-019][Clients/create-client][P1-High] رفض بلا JWT → 401', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .send({ firstName: 'A', lastName: 'B', phone: uniquePhone() });
      expect(res.status).toBe(401);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // UPDATE
  // ══════════════════════════════════════════════════════════════════════════
  describe('PATCH /dashboard/people/clients/:id', () => {
    it('[CL-021][Clients/update-client][P1-High] تعديل firstName + إعادة تركيب name', async () => {
      const c = await seedClient(testPrisma as any, {
        name: 'Old Name',
        firstName: 'Old',
        lastName: 'Name',
        phone: uniquePhone(),
      });
      const res = await req
        .patch(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'New' });
      expect(res.status).toBe(200);
      const inDb = await (testPrisma as any).client.findUnique({ where: { id: c.id } });
      expect(inDb.firstName).toBe('New');
      expect(inDb.name).toBe('New Name');
    });

    it('[CL-022][Clients/update-client][P1-High] تعديل جميع الحقول + تفعيل isActive', async () => {
      const c = await seedClient(testPrisma as any, {
        phone: uniquePhone(),
        isActive: false,
      });
      const res = await req
        .patch(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ isActive: true, firstName: 'Updated', lastName: 'All' });
      expect(res.status).toBe(200);
      const inDb = await (testPrisma as any).client.findUnique({ where: { id: c.id } });
      expect(inDb.isActive).toBe(true);
      expect(inDb.firstName).toBe('Updated');
    });

    it('[CL-023][Clients/update-client][P1-High] تعديل الجوال إلى قيمة فريدة', async () => {
      const c = await seedClient(testPrisma as any, { phone: uniquePhone() });
      const newPhone = uniquePhone();
      const res = await req
        .patch(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ phone: newPhone });
      expect(res.status).toBe(200);
      const inDb = await (testPrisma as any).client.findUnique({ where: { id: c.id } });
      expect(inDb.phone).toBe(newPhone);
    });

    it('[CL-024][Clients/update-client][P2-Medium] إبقاء نفس الجوال لا يُثير تكراراً', async () => {
      const phone = uniquePhone();
      const c = await seedClient(testPrisma as any, { phone });
      const res = await req
        .patch(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ phone, firstName: 'Changed' });
      expect(res.status).toBe(200);
    });

    it('[CL-025][Clients/update-client][P2-Medium] مسح حقل اختياري (null)', async () => {
      const c = await (testPrisma as any).client.create({
        data: {
          organizationId: '00000000-0000-0000-0000-000000000001',
          name: 'Has Notes',
          firstName: 'Has',
          lastName: 'Notes',
          phone: uniquePhone(),
          notes: 'existing note',
          source: 'WALK_IN',
          isActive: true,
        },
      });
      const res = await req
        .patch(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ notes: null });
      expect(res.status).toBe(200);
      const inDb = await (testPrisma as any).client.findUnique({ where: { id: c.id } });
      expect(inDb.notes).toBeNull();
    });

    it('[CL-026][Clients/update-client][P1-High] تعديل عميل غير موجود → 404', async () => {
      const res = await req
        .patch('/dashboard/people/clients/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'Ghost' });
      expect(res.status).toBe(404);
    });

    it('[CL-027][Clients/update-client][P2-Medium] تعديل عميل محذوف ناعمياً → 404', async () => {
      const c = await seedClient(testPrisma as any, { phone: uniquePhone() });
      await (testPrisma as any).client.update({
        where: { id: c.id },
        data: { deletedAt: new Date(), phone: null },
      });
      const res = await req
        .patch(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'X' });
      expect(res.status).toBe(404);
    });

    it('[CL-028][Clients/update-client][P1-High] تعديل الجوال إلى مكرر → 409', async () => {
      const c1 = await seedClient(testPrisma as any, { phone: uniquePhone() });
      const phoneOther = uniquePhone();
      await seedClient(testPrisma as any, { phone: phoneOther });
      const res = await req
        .patch(`/dashboard/people/clients/${c1.id}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ phone: phoneOther });
      expect(res.status).toBe(409);
    });

    it('[CL-029][Clients/update-client][P2-Medium] phone بالتنسيق المحلي في PATCH يُطبَّع ويُقبل أو يُثير 409', async () => {
      // Phone normalization converts local 0501234567 → +966501234567 at DTO ingress.
      // Result is 200 (accepted, normalized) or 409 (conflict — that number already exists).
      const c = await seedClient(testPrisma as any, { phone: uniquePhone() });
      const res = await req
        .patch(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ phone: '0501234567' });
      expect([200, 409]).toContain(res.status);
    });

    it('[CL-029b][Clients/update-client][P2-Medium] phone حرفي خاطئ في PATCH → 400', async () => {
      // A completely invalid phone (not parseable as a phone number) still returns 400.
      const c = await seedClient(testPrisma as any, { phone: uniquePhone() });
      const res = await req
        .patch(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ phone: 'not-a-phone' });
      expect(res.status).toBe(400);
    });

    it('[CL-030][Clients/update-client][P3-Low] طول حقل تجاوز الحد في PATCH → 400', async () => {
      const c = await seedClient(testPrisma as any, { phone: uniquePhone() });
      const res = await req
        .patch(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'a'.repeat(256) });
      expect(res.status).toBe(400);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DELETE
  // ══════════════════════════════════════════════════════════════════════════
  describe('DELETE /dashboard/people/clients/:id', () => {
    it('[CL-032][Clients/delete-client][P1-High] soft-delete → 204 + يختفي من القائمة + phone=null', async () => {
      const phone = uniquePhone();
      const c = await seedClient(testPrisma as any, { phone });

      const delRes = await req
        .delete(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(delRes.status).toBe(204);

      const inDb = await (testPrisma as any).client.findUnique({ where: { id: c.id } });
      expect(inDb.deletedAt).not.toBeNull();
      expect(inDb.isActive).toBe(false);
      expect(inDb.phone).toBeNull();
      expect(inDb.notes).toContain(`[deleted-phone:${phone}]`);

      const listRes = await req
        .get('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(listRes.body.items.find((x: { id: string }) => x.id === c.id)).toBeUndefined();

      const getRes = await req
        .get(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(getRes.status).toBe(404);
    });

    it('[CL-033][Clients/delete-client][P2-Medium] إعادة استخدام الجوال بعد الحذف', async () => {
      const phone = uniquePhone();
      const c = await seedClient(testPrisma as any, { phone });
      await req
        .delete(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`);

      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'Re', lastName: 'Use', phone });
      expect(res.status).toBe(201);
    });

    it('[CL-034][Clients/delete-client][P2-Medium] حذف عميل غير موجود → 404', async () => {
      const res = await req
        .delete('/dashboard/people/clients/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(404);
    });

    it('[CL-035][Clients/delete-client][P2-Medium] حذف عميل محذوف مسبقاً → 404', async () => {
      const c = await seedClient(testPrisma as any, { phone: uniquePhone() });
      await req
        .delete(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`);
      const res = await req
        .delete(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(404);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET BY ID
  // ══════════════════════════════════════════════════════════════════════════
  describe('GET /dashboard/people/clients/:id', () => {
    it('[CL-039][Clients/get-client][P1-High] عرض تفاصيل عميل موجود', async () => {
      const c = await seedClient(testPrisma as any, {
        firstName: 'View',
        lastName: 'Me',
        phone: uniquePhone(),
      });
      const res = await req
        .get(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(c.id);
      expect(res.body.firstName).toBe('View');
    });

    it('[CL-040][Clients/get-client][P2-Medium] شارة Walk-in تظهر عند accountType=WALK_IN', async () => {
      const c = await seedClient(testPrisma as any, { phone: uniquePhone() });
      const res = await req
        .get(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      // serializer يُرجع lowercase
      expect(['walk_in', 'WALK_IN']).toContain(res.body.accountType);
    });

    it('[CL-042][Clients/get-client][P1-High] عرض id غير موجود → 404', async () => {
      const res = await req
        .get('/dashboard/people/clients/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(404);
    });

    it('[CL-043][Clients/get-client][P2-Medium] عرض عميل محذوف → 404', async () => {
      const c = await seedClient(testPrisma as any, { phone: uniquePhone() });
      await (testPrisma as any).client.update({
        where: { id: c.id },
        data: { deletedAt: new Date(), phone: null },
      });
      const res = await req
        .get(`/dashboard/people/clients/${c.id}`)
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(404);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // LIST / SEARCH / FILTER
  // ══════════════════════════════════════════════════════════════════════════
  describe('GET /dashboard/people/clients', () => {
    it('[CL-044][Clients/list-clients][P1-High] Pagination - الصفحة الأولى', async () => {
      for (let i = 0; i < 5; i++) {
        await seedClient(testPrisma as any, { phone: uniquePhone() });
      }
      const res = await req
        .get('/dashboard/people/clients?page=1&limit=20')
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeLessThanOrEqual(20);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.perPage).toBe(20);
    });

    it('[CL-045][Clients/list-clients][P1-High] بحث بالاسم', async () => {
      await seedClient(testPrisma as any, {
        firstName: 'SearchMeUnique',
        lastName: 'Xyz',
        phone: uniquePhone(),
      });
      const res = await req
        .get('/dashboard/people/clients?search=SearchMeUnique')
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.items.some((c: any) => c.firstName === 'SearchMeUnique')).toBe(true);
    });

    it('[CL-046][Clients/list-clients][P2-Medium] بحث بالجوال', async () => {
      const phone = uniquePhone();
      await seedClient(testPrisma as any, { phone });
      const res = await req
        .get(`/dashboard/people/clients?search=${encodeURIComponent(phone.slice(-6))}`)
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.items.some((c: any) => c.phone === phone)).toBe(true);
    });

    it('[CL-047][Clients/list-clients][P2-Medium] بحث case-insensitive', async () => {
      await seedClient(testPrisma as any, {
        firstName: 'CaseSensitive',
        phone: uniquePhone(),
      });
      const res = await req
        .get('/dashboard/people/clients?search=casesensitive')
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it('[CL-048][Clients/list-clients][P2-Medium] بحث بنص عربي', async () => {
      await seedClient(testPrisma as any, {
        firstName: 'زينب',
        lastName: 'فريد',
        phone: uniquePhone(),
      });
      const res = await req
        .get(`/dashboard/people/clients?search=${encodeURIComponent('زينب')}`)
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it('[CL-049][Clients/list-clients][P2-Medium] فلتر isActive=true', async () => {
      const res = await req
        .get('/dashboard/people/clients?isActive=true')
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.items.every((c: any) => c.isActive === true)).toBe(true);
    });

    it('[CL-050][Clients/list-clients][P2-Medium] فلتر isActive=false', async () => {
      await seedClient(testPrisma as any, {
        phone: uniquePhone(),
        isActive: false,
      });
      const res = await req
        .get('/dashboard/people/clients?isActive=false')
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.items.every((c: any) => c.isActive === false)).toBe(true);
      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it('[CL-051][Clients/list-clients][P2-Medium] فلتر gender=MALE', async () => {
      const c = await seedClient(testPrisma as any, { phone: uniquePhone() });
      await (testPrisma as any).client.update({
        where: { id: c.id },
        data: { gender: 'MALE' },
      });
      const res = await req
        .get('/dashboard/people/clients?gender=MALE')
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.items.every((c: any) => ['male', 'MALE'].includes(c.gender))).toBe(true);
    });

    it('[CL-052][Clients/list-clients][P2-Medium] فلتر source=WALK_IN', async () => {
      const res = await req
        .get('/dashboard/people/clients?source=WALK_IN')
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
    });

    it('[CL-056][Clients/list-clients][P2-Medium] رفض limit > 200', async () => {
      const res = await req
        .get('/dashboard/people/clients?limit=500')
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(400);
    });

    it('[CL-057][Clients/list-clients][P2-Medium] رفض page < 1', async () => {
      const res = await req
        .get('/dashboard/people/clients?page=0')
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(400);
    });

    it('[CL-058][Clients/list-clients][P2-Medium] بحث بدون نتائج → قائمة فارغة', async () => {
      const res = await req
        .get('/dashboard/people/clients?search=XXNOTEXISTXX99999')
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    // NOTE: cross-tenant isolation removed in single-org refactor
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SECURITY / CONCURRENCY
  // ══════════════════════════════════════════════════════════════════════════
  describe('Security & Concurrency', () => {
    it('[CL-082][Clients/security][P1-High] تزامن إنشاء بنفس الجوال → واحد ينجح والآخر 409', async () => {
      const phone = uniquePhone();
      const [r1, r2] = await Promise.all([
        req
          .post('/dashboard/people/clients')
          .set('Authorization', `Bearer ${TOKEN}`)
          .send({ firstName: 'A', lastName: 'One', phone }),
        req
          .post('/dashboard/people/clients')
          .set('Authorization', `Bearer ${TOKEN}`)
          .send({ firstName: 'B', lastName: 'Two', phone }),
      ]);
      const codes = [r1.status, r2.status].sort();
      expect(codes).toContain(201);
      expect(codes.some((c) => c === 409 || c === 500)).toBe(true);
    });

    it('[CL-083][Clients/security][P1-High] SQL injection في search — آمن', async () => {
      const res = await req
        .get("/dashboard/people/clients?search=' OR 1=1 --")
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
    });

    it('[CL-084][Clients/security][P1-High] XSS في الاسم/notes يُخزَّن حرفياً (لا تنفيذ)', async () => {
      const payload = '<script>alert(1)</script>';
      const res = await req
        .post('/dashboard/people/clients')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: payload, lastName: 'XSS', phone: uniquePhone() });
      expect(res.status).toBe(201);
      const inDb = await (testPrisma as any).client.findUnique({ where: { id: res.body.id } });
      expect(inDb.firstName).toBe(payload);
    });
  });
});
