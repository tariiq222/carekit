# Backend Integration Tests — 90% Coverage Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** اختبارات تكامل حقيقية للـ NestJS backend تغطي كل الـ API flows الحرجة بنسبة ≥90% مع قاعدة بيانات PostgreSQL حقيقية (test DB معزولة).

**Architecture:** كل test يشغّل NestJS app كامل عبر supertest ويتواصل مع test DB حقيقية. كل test suite يُنظّف جداوله عبر TRUNCATE في beforeAll/afterAll. الـ external services (Email, OpenAI, FCM, Moyasar) تُستبدل بـ mock providers فقط.

**Tech Stack:** Jest + Supertest, NestJS Testing Module, Prisma (test DB: carekit_test), @prisma/adapter-pg, bcryptjs, jsonwebtoken. لا mock للـ DB، لا mock للـ Core services.

---

## المبادئ التي تحكم كل test

```
1. سيناريو واحد فقط لكل test
2. قاعدة بيانات حقيقية — لا mock للـ Prisma أو أي service داخلي
3. كل suite تبدأ نظيفة عبر TRUNCATE في beforeAll
4. اختبر: Status Code + Response Body + DB State
5. كل domain: success path + failure path + edge case
6. mock فقط: Email, OpenAI, Moyasar, FCM, MinIO
7. X-Tenant-ID header مطلوب في كل request
```

---

## File Structure

```
apps/backend/
├── test/
│   ├── jest-e2e.json                       # موجود — يحتاج تحديث
│   ├── setup/
│   │   ├── global-setup.ts                 # يشغّل migrate على carekit_test
│   │   ├── global-teardown.ts              # placeholder
│   │   ├── app.setup.ts                    # ينشئ NestJS app مع mock providers
│   │   ├── db.setup.ts                     # testPrisma + cleanTables util
│   │   ├── auth.helper.ts                  # توليد JWT tokens
│   │   └── seed.helper.ts                  # دوال إنشاء بيانات اختبار في DB
│   └── e2e/
│       ├── identity/
│       │   ├── login.e2e-spec.ts
│       │   ├── refresh-token.e2e-spec.ts
│       │   └── logout.e2e-spec.ts
│       ├── people/
│       │   ├── clients.e2e-spec.ts
│       │   └── employees.e2e-spec.ts
│       ├── bookings/
│       │   ├── create-booking.e2e-spec.ts
│       │   ├── booking-lifecycle.e2e-spec.ts
│       │   └── waitlist.e2e-spec.ts
│       ├── finance/
│       │   ├── invoices.e2e-spec.ts
│       │   └── payments.e2e-spec.ts
│       ├── org-config/
│       │   └── org-config.e2e-spec.ts
│       ├── org-experience/
│       │   └── services.e2e-spec.ts
│       └── ops/
│           └── reports.e2e-spec.ts
```

---

## Task 1: Test Database + Jest E2E Config

**Files:**
- Modify: `apps/backend/test/jest-e2e.json`
- Create: `apps/backend/test/setup/global-setup.ts`
- Create: `apps/backend/test/setup/global-teardown.ts`
- Create: `apps/backend/test/setup/db.setup.ts`

- [ ] **Step 1: تحديث jest-e2e.json**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "globalSetup": "./setup/global-setup.ts",
  "globalTeardown": "./setup/global-teardown.ts",
  "testTimeout": 30000,
  "maxWorkers": 1,
  "moduleNameMapper": {
    "^@carekit/shared$": "<rootDir>/../../packages/shared/src/index.ts"
  }
}
```

- [ ] **Step 2: إنشاء `test/setup/global-setup.ts`**

```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export default async function globalSetup() {
  process.env.TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/carekit_test?schema=public';

  // شغّل migrations على test DB
  await execFileAsync(
    'npx',
    ['prisma', 'migrate', 'deploy'],
    {
      env: {
        ...process.env,
        DATABASE_URL: process.env.TEST_DATABASE_URL,
      },
      cwd: path.resolve(__dirname, '../..'),
    },
  );
}
```

- [ ] **Step 3: إنشاء `test/setup/global-teardown.ts`**

```typescript
export default async function globalTeardown() {
  // لا شيء — الـ pool يُغلق في كل suite
}
```

- [ ] **Step 4: إنشاء `test/setup/db.setup.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/carekit_test?schema=public';

const pool = new Pool({ connectionString: TEST_DB_URL });

export const testPrisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

/** يحذف كل البيانات من الجداول المطلوبة — استخدمه في beforeAll/afterAll */
export async function cleanTables(tables: string[]): Promise<void> {
  // Prisma model names → DB table names (snake_case)
  const tableList = tables.map((t) => `"${t}"`).join(', ');
  await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}

export async function closePrisma(): Promise<void> {
  await testPrisma.$disconnect();
  await pool.end();
}
```

- [ ] **Step 5: إنشاء carekit_test database وتشغيل migrations**

```bash
cd apps/backend
psql -U postgres -c "CREATE DATABASE carekit_test;" 2>/dev/null || echo "already exists"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/carekit_test?schema=public" \
  npx prisma migrate deploy
```

Expected: "All migrations have been successfully applied"

- [ ] **Step 6: Commit**

```bash
git add apps/backend/test/jest-e2e.json apps/backend/test/setup/
git commit -m "test(e2e): setup test DB infra with transaction isolation"
```

---

## Task 2: NestJS App Factory + Auth Helper + Seed Helper

**Files:**
- Create: `apps/backend/test/setup/app.setup.ts`
- Create: `apps/backend/test/setup/auth.helper.ts`
- Create: `apps/backend/test/setup/seed.helper.ts`

- [ ] **Step 1: تحقق من اسم MailService provider**

```bash
grep -n "provide\|useClass\|MailService\|MailAdapter" \
  apps/backend/src/infrastructure/mail/mail.module.ts | head -10
```

دوّن الاسم — ستستخدمه في overrideProvider أدناه.

- [ ] **Step 2: إنشاء `test/setup/app.setup.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as supertest from 'supertest';
import { AppModule } from '../../src/app.module';

let cachedApp: INestApplication | null = null;

export async function createTestApp(): Promise<{
  app: INestApplication;
  request: supertest.SuperTest<supertest.Test>;
}> {
  if (cachedApp) {
    return { app: cachedApp, request: supertest(cachedApp.getHttpServer()) };
  }

  // override env vars ليشير الـ app للـ test DB
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/carekit_test?schema=public';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.MOYASAR_API_KEY = 'test-key';
  process.env.FCM_PROJECT_ID = 'test-project';
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_PORT = '1025';
  process.env.LICENSE_SERVER_URL = 'http://localhost:9999';

  // اقرأ الـ provider name من mail.module.ts ثم استبدله هنا
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    // استبدل external services — غيّر 'MailService' للاسم الفعلي
    .overrideProvider('MailService')
    .useValue({ send: jest.fn().mockResolvedValue(undefined), sendTemplate: jest.fn().mockResolvedValue(undefined) })
    .overrideProvider('EmbeddingAdapter')
    .useValue({ embed: jest.fn().mockResolvedValue(new Array(1536).fill(0)) })
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  cachedApp = app;

  return { app, request: supertest(app.getHttpServer()) };
}

export async function closeTestApp(): Promise<void> {
  if (cachedApp) {
    await cachedApp.close();
    cachedApp = null;
  }
}
```

- [ ] **Step 3: إنشاء `test/setup/auth.helper.ts`**

```typescript
import * as jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me';

export interface TestUser {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  customRoleId: string | null;
  permissions: Array<{ action: string; subject: string }>;
}

export function createTestToken(user: TestUser): string {
  return jwt.sign(
    {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      customRoleId: user.customRoleId,
      permissions: user.permissions,
      features: [],
    },
    ACCESS_SECRET,
    { expiresIn: '1h' },
  );
}

// tenant ID ثابت يُستخدم في كل الـ specs
export const TEST_TENANT_ID = 'test-tenant-e2e-fixed';

export const adminUser: TestUser = {
  id: 'user-admin-e2e',
  tenantId: TEST_TENANT_ID,
  email: 'admin@e2e.test',
  role: 'ADMIN',
  customRoleId: null,
  permissions: [],
};

export const receptionistUser: TestUser = {
  id: 'user-receptionist-e2e',
  tenantId: TEST_TENANT_ID,
  email: 'receptionist@e2e.test',
  role: 'RECEPTIONIST',
  customRoleId: null,
  permissions: [],
};
```

- [ ] **Step 4: إنشاء `test/setup/seed.helper.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export async function seedUser(
  prisma: PrismaClient,
  tenantId: string,
  overrides: Partial<{
    email: string;
    password: string;
    role: string;
    name: string;
    isActive: boolean;
  }> = {},
) {
  const email = overrides.email ?? `user-${Date.now()}@test.com`;
  const password = overrides.password ?? 'Test@1234';
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      tenantId,
      email,
      passwordHash,
      name: overrides.name ?? 'Test User',
      role: (overrides.role as never) ?? 'RECEPTIONIST',
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function seedClient(
  prisma: PrismaClient,
  tenantId: string,
  overrides: Partial<{ name: string; phone: string; isActive: boolean }> = {},
) {
  return prisma.client.create({
    data: {
      tenantId,
      name: overrides.name ?? 'Test Client',
      phone: overrides.phone ?? `+9665${Date.now().toString().slice(-8)}`,
      isActive: overrides.isActive ?? true,
      source: 'WALK_IN',
    },
  });
}

export async function seedEmployee(
  prisma: PrismaClient,
  tenantId: string,
  overrides: Partial<{ name: string; isActive: boolean }> = {},
) {
  return prisma.employee.create({
    data: {
      tenantId,
      name: overrides.name ?? 'Test Employee',
      isActive: overrides.isActive ?? true,
      employmentType: 'FULL_TIME',
    },
  });
}

export async function seedService(
  prisma: PrismaClient,
  tenantId: string,
  overrides: Partial<{ name: string; durationMins: number; price: number }> = {},
) {
  return prisma.service.create({
    data: {
      tenantId,
      name: overrides.name ?? 'Test Service',
      durationMins: overrides.durationMins ?? 60,
      price: overrides.price ?? 200,
      currency: 'SAR',
      isActive: true,
    },
  });
}

export async function seedBranch(
  prisma: PrismaClient,
  tenantId: string,
  overrides: Partial<{ name: string }> = {},
) {
  return prisma.branch.create({
    data: {
      tenantId,
      name: overrides.name ?? 'Main Branch',
      isActive: true,
    },
  });
}

export async function seedBooking(
  prisma: PrismaClient,
  tenantId: string,
  opts: {
    clientId: string;
    employeeId: string;
    serviceId: string;
    branchId: string;
    scheduledAt?: Date;
    status?: string;
  },
) {
  const scheduledAt = opts.scheduledAt ?? new Date(Date.now() + 86_400_000);
  const endsAt = new Date(scheduledAt.getTime() + 3_600_000);

  return prisma.booking.create({
    data: {
      tenantId,
      clientId: opts.clientId,
      employeeId: opts.employeeId,
      serviceId: opts.serviceId,
      branchId: opts.branchId,
      scheduledAt,
      endsAt,
      durationMins: 60,
      price: 200,
      currency: 'SAR',
      status: (opts.status as never) ?? 'PENDING',
      bookingType: 'INDIVIDUAL',
    },
  });
}
```

- [ ] **Step 5: تشغيل typecheck**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | grep "test/setup"
```

Expected: لا errors. إذا ظهر خطأ في overrideProvider، صحّح اسم الـ provider.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/test/setup/
git commit -m "test(e2e): add NestJS test app factory + auth/seed helpers"
```

---

## Task 3: Identity — Login + Refresh + Logout

**Files:**
- Create: `apps/backend/test/e2e/identity/login.e2e-spec.ts`
- Create: `apps/backend/test/e2e/identity/refresh-token.e2e-spec.ts`
- Create: `apps/backend/test/e2e/identity/logout.e2e-spec.ts`

- [ ] **Step 1: تحقق من الـ routes الفعلية**

```bash
grep -n "@Get\|@Post\|@Controller" apps/backend/src/api/dashboard/*.controller.ts | grep -i "auth\|login\|refresh\|logout"
```

دوّن الـ prefix الصحيح (مثل `/auth` أو `/dashboard/auth`).

- [ ] **Step 2: إنشاء `test/e2e/identity/login.e2e-spec.ts`**

```typescript
import * as supertest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedUser } from '../../setup/seed.helper';

const TENANT = 'tenant-login-test';

describe('POST /auth/login (e2e)', () => {
  let req: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await cleanTables(['RefreshToken', 'User']);
    await seedUser(testPrisma as unknown as any, TENANT, {
      email: 'admin@clinic.com',
      password: 'Pass@1234',
      role: 'ADMIN',
    });
  });

  afterAll(async () => {
    await cleanTables(['RefreshToken', 'User']);
  });

  it('✅ بيانات صحيحة → 200 + accessToken + refreshToken', async () => {
    const res = await req
      .post('/auth/login')
      .set('x-tenant-id', TENANT)
      .send({ email: 'admin@clinic.com', password: 'Pass@1234' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(typeof res.body.accessToken).toBe('string');

    const tokens = await testPrisma.refreshToken.count({ where: { tenantId: TENANT } });
    expect(tokens).toBeGreaterThan(0);
  });

  it('❌ كلمة مرور خاطئة → 401', async () => {
    const res = await req
      .post('/auth/login')
      .set('x-tenant-id', TENANT)
      .send({ email: 'admin@clinic.com', password: 'WrongPass' });

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('accessToken');
  });

  it('❌ مستخدم غير موجود → 401', async () => {
    const res = await req
      .post('/auth/login')
      .set('x-tenant-id', TENANT)
      .send({ email: 'ghost@clinic.com', password: 'Pass@1234' });

    expect(res.status).toBe(401);
  });

  it('❌ حساب غير مفعّل → 401', async () => {
    await seedUser(testPrisma as unknown as any, TENANT, {
      email: 'inactive@clinic.com',
      password: 'Pass@1234',
      isActive: false,
    });

    const res = await req
      .post('/auth/login')
      .set('x-tenant-id', TENANT)
      .send({ email: 'inactive@clinic.com', password: 'Pass@1234' });

    expect(res.status).toBe(401);
  });

  it('❌ بدون X-Tenant-ID → 400', async () => {
    const res = await req
      .post('/auth/login')
      .send({ email: 'admin@clinic.com', password: 'Pass@1234' });

    expect(res.status).toBe(400);
  });

  it('⚠️ body فارغ → 400 validation error', async () => {
    const res = await req.post('/auth/login').set('x-tenant-id', TENANT).send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });
});
```

- [ ] **Step 3: إنشاء `test/e2e/identity/refresh-token.e2e-spec.ts`**

```typescript
import * as supertest from 'supertest';
import { createTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedUser } from '../../setup/seed.helper';

const TENANT = 'tenant-refresh-test';

describe('POST /auth/refresh (e2e)', () => {
  let req: supertest.SuperTest<supertest.Test>;
  let firstRefreshToken: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await cleanTables(['RefreshToken', 'User']);
    await seedUser(testPrisma as unknown as any, TENANT, {
      email: 'user@clinic.com',
      password: 'Pass@1234',
    });

    const res = await req
      .post('/auth/login')
      .set('x-tenant-id', TENANT)
      .send({ email: 'user@clinic.com', password: 'Pass@1234' });
    firstRefreshToken = res.body.refreshToken;
  });

  afterAll(async () => {
    await cleanTables(['RefreshToken', 'User']);
  });

  it('✅ refresh token صالح → 200 + pair جديد', async () => {
    const res = await req
      .post('/auth/refresh')
      .set('x-tenant-id', TENANT)
      .send({ refreshToken: firstRefreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.refreshToken).not.toBe(firstRefreshToken);
  });

  it('❌ token مزور → 401', async () => {
    const res = await req
      .post('/auth/refresh')
      .set('x-tenant-id', TENANT)
      .send({ refreshToken: 'invalid.fake.token' });

    expect(res.status).toBe(401);
  });

  it('❌ استخدام نفس الـ token مرتين → 401 (rotation)', async () => {
    // أنشئ session جديدة
    await cleanTables(['RefreshToken']);
    await seedUser(testPrisma as unknown as any, TENANT, {
      email: 'rotation@clinic.com',
      password: 'Pass@1234',
    });
    const loginRes = await req
      .post('/auth/login')
      .set('x-tenant-id', TENANT)
      .send({ email: 'rotation@clinic.com', password: 'Pass@1234' });
    const token = loginRes.body.refreshToken;

    await req.post('/auth/refresh').set('x-tenant-id', TENANT).send({ refreshToken: token });

    const res2 = await req
      .post('/auth/refresh')
      .set('x-tenant-id', TENANT)
      .send({ refreshToken: token });

    expect(res2.status).toBe(401);
  });
});
```

- [ ] **Step 4: إنشاء `test/e2e/identity/logout.e2e-spec.ts`**

```typescript
import * as supertest from 'supertest';
import { createTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedUser } from '../../setup/seed.helper';

const TENANT = 'tenant-logout-test';

describe('POST /auth/logout (e2e)', () => {
  let req: supertest.SuperTest<supertest.Test>;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await cleanTables(['RefreshToken', 'User']);
    await seedUser(testPrisma as unknown as any, TENANT, {
      email: 'logout@clinic.com',
      password: 'Pass@1234',
      role: 'ADMIN',
    });

    const res = await req
      .post('/auth/login')
      .set('x-tenant-id', TENANT)
      .send({ email: 'logout@clinic.com', password: 'Pass@1234' });
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  afterAll(async () => {
    await cleanTables(['RefreshToken', 'User']);
  });

  it('✅ logout يحذف الـ refresh token من DB', async () => {
    const before = await testPrisma.refreshToken.count({ where: { tenantId: TENANT } });
    expect(before).toBeGreaterThan(0);

    const res = await req
      .post('/auth/logout')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(200);

    const after = await testPrisma.refreshToken.count({ where: { tenantId: TENANT } });
    expect(after).toBe(0);
  });

  it('❌ بدون JWT → 401', async () => {
    const res = await req
      .post('/auth/logout')
      .set('x-tenant-id', TENANT)
      .send({ refreshToken: 'any' });

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 5: تشغيل**

```bash
cd apps/backend && npx jest --config test/jest-e2e.json test/e2e/identity --verbose
```

Expected: جميع tests تمر. إذا فشل بسبب route خاطئ، راجع الـ controller وصحّح الـ URL.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/test/e2e/identity/
git commit -m "test(e2e): identity — login, refresh, logout flows"
```

---

## Task 4: People — Clients + Employees

**Files:**
- Create: `apps/backend/test/e2e/people/clients.e2e-spec.ts`
- Create: `apps/backend/test/e2e/people/employees.e2e-spec.ts`

- [ ] **Step 1: تحقق من routes**

```bash
grep -n "@Get\|@Post\|@Patch\|@Controller" apps/backend/src/api/dashboard/people.controller.ts | head -20
```

- [ ] **Step 2: إنشاء `test/e2e/people/clients.e2e-spec.ts`**

```typescript
import * as supertest from 'supertest';
import { createTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedClient } from '../../setup/seed.helper';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;
const TOKEN = createTestToken(adminUser);

describe('Clients API (e2e)', () => {
  let req: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await cleanTables(['Client']);
  });

  afterAll(async () => {
    await cleanTables(['Client']);
  });

  describe('GET /dashboard/clients', () => {
    it('✅ قائمة فارغة → 200 + data: []', async () => {
      const res = await req
        .get('/dashboard/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('✅ بعد إضافة client → يظهر في القائمة', async () => {
      await seedClient(testPrisma as unknown as any, TENANT, { name: 'أحمد محمد' });

      const res = await req
        .get('/dashboard/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.status).toBe(200);
      const found = res.body.data.find((c: { name: string }) => c.name === 'أحمد محمد');
      expect(found).toBeDefined();
    });

    it('⚠️ فلترة بـ isActive=false → العملاء غير المفعلين فقط', async () => {
      await seedClient(testPrisma as unknown as any, TENANT, { name: 'Inactive', isActive: false });

      const res = await req
        .get('/dashboard/clients?isActive=false')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.status).toBe(200);
      const allInactive = res.body.data.every((c: { isActive: boolean }) => c.isActive === false);
      expect(allInactive).toBe(true);
    });
  });

  describe('POST /dashboard/clients', () => {
    it('✅ إنشاء client → 201 + يُحفظ في DB', async () => {
      const phone = `+9665${Date.now().toString().slice(-8)}`;

      const res = await req
        .post('/dashboard/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ name: 'سارة العلي', phone, gender: 'FEMALE' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('سارة العلي');

      const inDb = await testPrisma.client.findUnique({ where: { id: res.body.id } });
      expect(inDb).not.toBeNull();
      expect(inDb!.name).toBe('سارة العلي');
    });

    it('❌ رقم هاتف مكرر → 409', async () => {
      const phone = `+9665${Date.now().toString().slice(-8)}`;
      await seedClient(testPrisma as unknown as any, TENANT, { phone });

      const res = await req
        .post('/dashboard/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ name: 'مكرر', phone });

      expect(res.status).toBe(409);
    });

    it('❌ اسم مفقود → 400', async () => {
      const res = await req
        .post('/dashboard/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ phone: '+966501234567' });

      expect(res.status).toBe(400);
    });

    it('❌ بدون JWT → 401', async () => {
      const res = await req
        .post('/dashboard/clients')
        .set('x-tenant-id', TENANT)
        .send({ name: 'Unauthorized' });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /dashboard/clients/:id', () => {
    it('✅ تحديث اسم → DB تتغير', async () => {
      const client = await seedClient(testPrisma as unknown as any, TENANT, { name: 'Old Name' });

      const res = await req
        .patch(`/dashboard/clients/${client.id}`)
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);

      const inDb = await testPrisma.client.findUnique({ where: { id: client.id } });
      expect(inDb!.name).toBe('New Name');
    });

    it('❌ ID غير موجود → 404', async () => {
      const res = await req
        .patch('/dashboard/clients/00000000-0000-0000-0000-000000000000')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });
});
```

- [ ] **Step 3: إنشاء `test/e2e/people/employees.e2e-spec.ts`**

```typescript
import * as supertest from 'supertest';
import { createTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedEmployee } from '../../setup/seed.helper';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;
const TOKEN = createTestToken(adminUser);

describe('Employees API (e2e)', () => {
  let req: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await cleanTables(['Employee']);
  });

  afterAll(async () => {
    await cleanTables(['Employee']);
  });

  it('✅ قائمة الموظفين → 200', async () => {
    await seedEmployee(testPrisma as unknown as any, TENANT, { name: 'Dr. خالد' });

    const res = await req
      .get('/dashboard/employees')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    const found = res.body.data.find((e: { name: string }) => e.name === 'Dr. خالد');
    expect(found).toBeDefined();
  });

  it('✅ إنشاء موظف → 201 + يُحفظ في DB', async () => {
    const res = await req
      .post('/dashboard/employees')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ name: 'Dr. نورة', employmentType: 'FULL_TIME', gender: 'FEMALE' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');

    const inDb = await testPrisma.employee.findUnique({ where: { id: res.body.id } });
    expect(inDb).not.toBeNull();
  });

  it('❌ بيانات ناقصة → 400', async () => {
    const res = await req
      .post('/dashboard/employees')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('❌ بدون JWT → 401', async () => {
    const res = await req
      .post('/dashboard/employees')
      .set('x-tenant-id', TENANT)
      .send({ name: 'Unauthorized', employmentType: 'FULL_TIME' });

    expect(res.status).toBe(401);
  });

  it('✅ GET موظف بـ ID → 200 + بيانات كاملة', async () => {
    const emp = await seedEmployee(testPrisma as unknown as any, TENANT, { name: 'Dr. فيصل' });

    const res = await req
      .get(`/dashboard/employees/${emp.id}`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(emp.id);
    expect(res.body.name).toBe('Dr. فيصل');
  });

  it('❌ GET موظف بـ ID غير موجود → 404', async () => {
    const res = await req
      .get('/dashboard/employees/00000000-0000-0000-0000-000000000000')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 4: تشغيل**

```bash
cd apps/backend && npx jest --config test/jest-e2e.json test/e2e/people --verbose
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/test/e2e/people/
git commit -m "test(e2e): people BC — clients and employees API flows"
```

---

## Task 5: Bookings — Create + Lifecycle + Waitlist

**Files:**
- Create: `apps/backend/test/e2e/bookings/create-booking.e2e-spec.ts`
- Create: `apps/backend/test/e2e/bookings/booking-lifecycle.e2e-spec.ts`
- Create: `apps/backend/test/e2e/bookings/waitlist.e2e-spec.ts`

- [ ] **Step 1: تحقق من routes الـ bookings**

```bash
grep -n "@Get\|@Post\|@Patch\|@Controller" apps/backend/src/api/dashboard/bookings.controller.ts | head -25
```

- [ ] **Step 2: إنشاء `test/e2e/bookings/create-booking.e2e-spec.ts`**

```typescript
import * as supertest from 'supertest';
import { createTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedClient, seedEmployee, seedService, seedBranch } from '../../setup/seed.helper';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;
const TOKEN = createTestToken(adminUser);

describe('POST /dashboard/bookings (e2e)', () => {
  let req: supertest.SuperTest<supertest.Test>;
  let clientId: string;
  let employeeId: string;
  let serviceId: string;
  let branchId: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await cleanTables(['Booking', 'WaitlistEntry', 'Client', 'Employee', 'Service', 'Branch']);

    const [client, employee, service, branch] = await Promise.all([
      seedClient(testPrisma as unknown as any, TENANT),
      seedEmployee(testPrisma as unknown as any, TENANT),
      seedService(testPrisma as unknown as any, TENANT, { durationMins: 60, price: 200 }),
      seedBranch(testPrisma as unknown as any, TENANT),
    ]);
    clientId = client.id;
    employeeId = employee.id;
    serviceId = service.id;
    branchId = branch.id;
  });

  afterAll(async () => {
    await cleanTables(['Booking', 'WaitlistEntry', 'Client', 'Employee', 'Service', 'Branch']);
  });

  const future = () => new Date(Date.now() + 86_400_000).toISOString();

  it('✅ حجز صحيح → 201 + PENDING في DB', async () => {
    const res = await req
      .post('/dashboard/bookings')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ clientId, employeeId, serviceId, branchId, scheduledAt: future(), bookingType: 'INDIVIDUAL' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('PENDING');

    const inDb = await testPrisma.booking.findUnique({ where: { id: res.body.id } });
    expect(inDb).not.toBeNull();
    expect(inDb!.status).toBe('PENDING');
    expect(inDb!.tenantId).toBe(TENANT);
  });

  it('❌ تاريخ في الماضي → 400', async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();

    const res = await req
      .post('/dashboard/bookings')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ clientId, employeeId, serviceId, branchId, scheduledAt: past, bookingType: 'INDIVIDUAL' });

    expect(res.status).toBe(400);
  });

  it('❌ employeeId مفقود → 400', async () => {
    const res = await req
      .post('/dashboard/bookings')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ clientId, serviceId, branchId, scheduledAt: future(), bookingType: 'INDIVIDUAL' });

    expect(res.status).toBe(400);
  });

  it('❌ بدون JWT → 401', async () => {
    const res = await req
      .post('/dashboard/bookings')
      .set('x-tenant-id', TENANT)
      .send({ clientId, employeeId, serviceId, branchId, scheduledAt: future(), bookingType: 'INDIVIDUAL' });

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: إنشاء `test/e2e/bookings/booking-lifecycle.e2e-spec.ts`**

```typescript
import * as supertest from 'supertest';
import { createTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedClient, seedEmployee, seedService, seedBranch, seedBooking } from '../../setup/seed.helper';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;
const TOKEN = createTestToken(adminUser);

describe('Booking Lifecycle (e2e)', () => {
  let req: supertest.SuperTest<supertest.Test>;
  let clientId: string;
  let employeeId: string;
  let serviceId: string;
  let branchId: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await cleanTables(['BookingStatusLog', 'Booking', 'Client', 'Employee', 'Service', 'Branch']);

    const [client, employee, service, branch] = await Promise.all([
      seedClient(testPrisma as unknown as any, TENANT),
      seedEmployee(testPrisma as unknown as any, TENANT),
      seedService(testPrisma as unknown as any, TENANT),
      seedBranch(testPrisma as unknown as any, TENANT),
    ]);
    clientId = client.id;
    employeeId = employee.id;
    serviceId = service.id;
    branchId = branch.id;
  });

  afterAll(async () => {
    await cleanTables(['BookingStatusLog', 'Booking', 'Client', 'Employee', 'Service', 'Branch']);
  });

  it('✅ PENDING → CONFIRMED', async () => {
    const booking = await seedBooking(testPrisma as unknown as any, TENANT, {
      clientId, employeeId, serviceId, branchId, status: 'PENDING',
    });

    const res = await req
      .patch(`/dashboard/bookings/${booking.id}/confirm`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');

    const inDb = await testPrisma.booking.findUnique({ where: { id: booking.id } });
    expect(inDb!.status).toBe('CONFIRMED');
  });

  it('✅ CONFIRMED → COMPLETED', async () => {
    const booking = await seedBooking(testPrisma as unknown as any, TENANT, {
      clientId, employeeId, serviceId, branchId, status: 'CONFIRMED',
    });

    const res = await req
      .patch(`/dashboard/bookings/${booking.id}/complete`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ notes: 'Done' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');

    const inDb = await testPrisma.booking.findUnique({ where: { id: booking.id } });
    expect(inDb!.status).toBe('COMPLETED');
  });

  it('✅ PENDING → CANCELLED', async () => {
    const booking = await seedBooking(testPrisma as unknown as any, TENANT, {
      clientId, employeeId, serviceId, branchId, status: 'PENDING',
    });

    const res = await req
      .patch(`/dashboard/bookings/${booking.id}/cancel`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ reason: 'CLIENT_REQUESTED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('✅ CONFIRMED → NO_SHOW', async () => {
    const booking = await seedBooking(testPrisma as unknown as any, TENANT, {
      clientId, employeeId, serviceId, branchId, status: 'CONFIRMED',
    });

    const res = await req
      .patch(`/dashboard/bookings/${booking.id}/no-show`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('NO_SHOW');
  });

  it('❌ confirm على حجز CANCELLED → 400 أو 409', async () => {
    const booking = await seedBooking(testPrisma as unknown as any, TENANT, {
      clientId, employeeId, serviceId, branchId, status: 'CANCELLED',
    });

    const res = await req
      .patch(`/dashboard/bookings/${booking.id}/confirm`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect([400, 409]).toContain(res.status);
  });

  it('❌ ID غير موجود → 404', async () => {
    const res = await req
      .patch('/dashboard/bookings/00000000-0000-0000-0000-000000000000/confirm')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 4: إنشاء `test/e2e/bookings/waitlist.e2e-spec.ts`**

```typescript
import * as supertest from 'supertest';
import { createTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedClient, seedEmployee, seedService, seedBranch } from '../../setup/seed.helper';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;
const TOKEN = createTestToken(adminUser);

describe('Waitlist API (e2e)', () => {
  let req: supertest.SuperTest<supertest.Test>;
  let clientId: string;
  let employeeId: string;
  let serviceId: string;
  let branchId: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await cleanTables(['WaitlistEntry', 'Client', 'Employee', 'Service', 'Branch']);

    const [client, employee, service, branch] = await Promise.all([
      seedClient(testPrisma as unknown as any, TENANT),
      seedEmployee(testPrisma as unknown as any, TENANT),
      seedService(testPrisma as unknown as any, TENANT),
      seedBranch(testPrisma as unknown as any, TENANT),
    ]);
    clientId = client.id;
    employeeId = employee.id;
    serviceId = service.id;
    branchId = branch.id;
  });

  afterAll(async () => {
    await cleanTables(['WaitlistEntry', 'Client', 'Employee', 'Service', 'Branch']);
  });

  it('✅ إضافة إلى الـ waitlist → 201 + WAITING في DB', async () => {
    const res = await req
      .post('/dashboard/bookings/waitlist')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ clientId, employeeId, serviceId, branchId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('WAITING');

    const inDb = await testPrisma.waitlistEntry.findUnique({ where: { id: res.body.id } });
    expect(inDb).not.toBeNull();
    expect(inDb!.status).toBe('WAITING');
  });

  it('❌ نفس العميل مرتين → 409', async () => {
    // أضف مرة أولى
    await req
      .post('/dashboard/bookings/waitlist')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ clientId, employeeId, serviceId, branchId });

    // أضف مرة ثانية بنفس البيانات
    const res = await req
      .post('/dashboard/bookings/waitlist')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ clientId, employeeId, serviceId, branchId });

    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 5: تشغيل**

```bash
cd apps/backend && npx jest --config test/jest-e2e.json test/e2e/bookings --verbose
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/test/e2e/bookings/
git commit -m "test(e2e): bookings BC — create, lifecycle transitions, waitlist"
```

---

## Task 6: Finance — Invoices + Payments

**Files:**
- Create: `apps/backend/test/e2e/finance/invoices.e2e-spec.ts`
- Create: `apps/backend/test/e2e/finance/payments.e2e-spec.ts`

- [ ] **Step 1: تحقق من routes**

```bash
grep -n "@Get\|@Post\|@Controller" apps/backend/src/api/dashboard/finance.controller.ts | head -20
```

- [ ] **Step 2: إنشاء `test/e2e/finance/invoices.e2e-spec.ts`**

```typescript
import * as supertest from 'supertest';
import { createTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedClient, seedEmployee, seedService, seedBranch, seedBooking } from '../../setup/seed.helper';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;
const TOKEN = createTestToken(adminUser);

describe('Invoices API (e2e)', () => {
  let req: supertest.SuperTest<supertest.Test>;
  let completedBookingId: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await cleanTables(['Invoice', 'Booking', 'Client', 'Employee', 'Service', 'Branch']);

    const [client, employee, service, branch] = await Promise.all([
      seedClient(testPrisma as unknown as any, TENANT),
      seedEmployee(testPrisma as unknown as any, TENANT),
      seedService(testPrisma as unknown as any, TENANT, { price: 300 }),
      seedBranch(testPrisma as unknown as any, TENANT),
    ]);

    const booking = await seedBooking(testPrisma as unknown as any, TENANT, {
      clientId: client.id,
      employeeId: employee.id,
      serviceId: service.id,
      branchId: branch.id,
      status: 'COMPLETED',
    });
    completedBookingId = booking.id;
  });

  afterAll(async () => {
    await cleanTables(['Invoice', 'Booking', 'Client', 'Employee', 'Service', 'Branch']);
  });

  it('✅ إنشاء فاتورة من حجز مكتمل → 201 + يُحفظ في DB', async () => {
    const res = await req
      .post('/dashboard/finance/invoices')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ bookingId: completedBookingId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(Number(res.body.total)).toBeGreaterThan(0);

    const inDb = await testPrisma.invoice.findUnique({ where: { id: res.body.id } });
    expect(inDb).not.toBeNull();
    expect(inDb!.bookingId).toBe(completedBookingId);
  });

  it('❌ فاتورة مكررة لنفس الحجز → 409', async () => {
    // إنشاء booking جديد لتجنب التداخل
    const [client, employee, service, branch] = await Promise.all([
      seedClient(testPrisma as unknown as any, TENANT),
      seedEmployee(testPrisma as unknown as any, TENANT),
      seedService(testPrisma as unknown as any, TENANT),
      seedBranch(testPrisma as unknown as any, TENANT),
    ]);
    const booking = await seedBooking(testPrisma as unknown as any, TENANT, {
      clientId: client.id, employeeId: employee.id,
      serviceId: service.id, branchId: branch.id, status: 'COMPLETED',
    });

    await req
      .post('/dashboard/finance/invoices')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ bookingId: booking.id });

    const res = await req
      .post('/dashboard/finance/invoices')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ bookingId: booking.id });

    expect(res.status).toBe(409);
  });

  it('✅ قائمة الفواتير → 200 + data array', async () => {
    const res = await req
      .get('/dashboard/finance/invoices')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('❌ بدون JWT → 401', async () => {
    const res = await req
      .get('/dashboard/finance/invoices')
      .set('x-tenant-id', TENANT);

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: إنشاء `test/e2e/finance/payments.e2e-spec.ts`**

```typescript
import * as supertest from 'supertest';
import { createTestApp } from '../../setup/app.setup';
import { cleanTables } from '../../setup/db.setup';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;
const TOKEN = createTestToken(adminUser);

describe('Payments API (e2e)', () => {
  let req: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await cleanTables(['Payment']);
  });

  afterAll(async () => {
    await cleanTables(['Payment']);
  });

  it('✅ قائمة المدفوعات → 200 + data array', async () => {
    const res = await req
      .get('/dashboard/finance/payments')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  it('⚠️ تصفية بـ status=COMPLETED → فقط المكتملة', async () => {
    const res = await req
      .get('/dashboard/finance/payments?status=COMPLETED')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    const allCompleted = res.body.data.every(
      (p: { status: string }) => p.status === 'COMPLETED',
    );
    expect(allCompleted).toBe(true);
  });

  it('❌ بدون JWT → 401', async () => {
    const res = await req
      .get('/dashboard/finance/payments')
      .set('x-tenant-id', TENANT);

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 4: تشغيل**

```bash
cd apps/backend && npx jest --config test/jest-e2e.json test/e2e/finance --verbose
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/test/e2e/finance/
git commit -m "test(e2e): finance BC — invoices and payments flows"
```

---

## Task 7: Org-Config — Branches + Categories + Business Hours

**Files:**
- Create: `apps/backend/test/e2e/org-config/org-config.e2e-spec.ts`

- [ ] **Step 1: تحقق من routes وأسماء الجداول**

```bash
grep -n "@Get\|@Post\|@Patch\|@Put\|@Controller" \
  apps/backend/src/api/dashboard/organization-branches.controller.ts \
  apps/backend/src/api/dashboard/organization-categories.controller.ts \
  apps/backend/src/api/dashboard/organization-hours.controller.ts
```

ثم:

```bash
grep "model " apps/backend/prisma/schema/organization.prisma
```

دوّن أسماء الـ models الفعلية (PascalCase).

- [ ] **Step 2: إنشاء `test/e2e/org-config/org-config.e2e-spec.ts`**

```typescript
import * as supertest from 'supertest';
import { createTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedBranch } from '../../setup/seed.helper';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;
const TOKEN = createTestToken(adminUser);

describe('Org-Config API (e2e)', () => {
  let req: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    // استبدل بأسماء الجداول الفعلية من prisma schema
    await cleanTables(['BusinessHour', 'Branch', 'Category', 'Department']);
  });

  afterAll(async () => {
    await cleanTables(['BusinessHour', 'Branch', 'Category', 'Department']);
  });

  // ─── Branches ───────────────────────────────────────────────────────────
  describe('Branches', () => {
    it('✅ إنشاء فرع → 201 + يُحفظ في DB', async () => {
      const res = await req
        .post('/dashboard/organization/branches')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ name: 'فرع الرياض', isActive: true });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');

      const inDb = await testPrisma.branch.findUnique({ where: { id: res.body.id } });
      expect(inDb).not.toBeNull();
      expect(inDb!.name).toBe('فرع الرياض');
    });

    it('✅ قائمة الفروع → 200', async () => {
      const res = await req
        .get('/dashboard/organization/branches')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.status).toBe(200);
    });

    it('✅ تحديث فرع → DB تتغير', async () => {
      const branch = await seedBranch(testPrisma as unknown as any, TENANT, { name: 'Old' });

      const res = await req
        .patch(`/dashboard/organization/branches/${branch.id}`)
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);

      const inDb = await testPrisma.branch.findUnique({ where: { id: branch.id } });
      expect(inDb!.name).toBe('Updated');
    });

    it('❌ اسم مفقود → 400', async () => {
      const res = await req
        .post('/dashboard/organization/branches')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('❌ ID غير موجود → 404', async () => {
      const res = await req
        .patch('/dashboard/organization/branches/00000000-0000-0000-0000-000000000000')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  // ─── Categories ──────────────────────────────────────────────────────────
  describe('Categories', () => {
    it('✅ إنشاء تصنيف → 201', async () => {
      const res = await req
        .post('/dashboard/organization/categories')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ name: 'جلدية' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('❌ تصنيف مكرر → 409', async () => {
      await req
        .post('/dashboard/organization/categories')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ name: 'مكرر-' + Date.now() });

      // أرسل نفس الاسم مرة ثانية
      const name = 'duplicate-cat-' + Date.now();
      await req
        .post('/dashboard/organization/categories')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ name });

      const res = await req
        .post('/dashboard/organization/categories')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ name });

      expect(res.status).toBe(409);
    });
  });

  // ─── Business Hours ───────────────────────────────────────────────────────
  describe('Business Hours', () => {
    it('✅ تعيين ساعات العمل → 200 + يُحفظ في DB', async () => {
      const branch = await seedBranch(testPrisma as unknown as any, TENANT);

      const res = await req
        .put(`/dashboard/organization/hours/${branch.id}`)
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send([
          { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isOpen: true },
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isOpen: true },
        ]);

      expect(res.status).toBe(200);

      const hours = await testPrisma.businessHour.findMany({
        where: { branchId: branch.id },
      });
      expect(hours.length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 3: تشغيل**

```bash
cd apps/backend && npx jest --config test/jest-e2e.json test/e2e/org-config --verbose
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/test/e2e/org-config/
git commit -m "test(e2e): org-config BC — branches, categories, business hours"
```

---

## Task 8: Org-Experience — Services

**Files:**
- Create: `apps/backend/test/e2e/org-experience/services.e2e-spec.ts`

- [ ] **Step 1: تحقق من routes**

```bash
grep -n "@Get\|@Post\|@Patch\|@Controller" apps/backend/src/api/dashboard/people.controller.ts | grep -i service
# أو ابحث في ملف منفصل
grep -rn "@Controller" apps/backend/src/api/dashboard/ | grep -i service
```

- [ ] **Step 2: إنشاء `test/e2e/org-experience/services.e2e-spec.ts`**

```typescript
import * as supertest from 'supertest';
import { createTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedService } from '../../setup/seed.helper';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;
const TOKEN = createTestToken(adminUser);

describe('Services API (e2e)', () => {
  let req: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await cleanTables(['Service']);
  });

  afterAll(async () => {
    await cleanTables(['Service']);
  });

  it('✅ إنشاء خدمة → 201 + يُحفظ في DB', async () => {
    const res = await req
      .post('/dashboard/services')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ name: 'تنظيف أسنان', durationMins: 45, price: 250, currency: 'SAR' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('تنظيف أسنان');

    const inDb = await testPrisma.service.findUnique({ where: { id: res.body.id } });
    expect(inDb).not.toBeNull();
    expect(Number(inDb!.price)).toBe(250);
  });

  it('✅ قائمة الخدمات → 200 + الخدمة تظهر فيها', async () => {
    await seedService(testPrisma as unknown as any, TENANT, { name: 'فحص شامل' });

    const res = await req
      .get('/dashboard/services')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    const list = res.body.data ?? res.body;
    const found = list.find((s: { name: string }) => s.name === 'فحص شامل');
    expect(found).toBeDefined();
  });

  it('✅ تحديث سعر الخدمة → DB تتغير', async () => {
    const service = await seedService(testPrisma as unknown as any, TENANT, { price: 100 });

    const res = await req
      .patch(`/dashboard/services/${service.id}`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ price: 150 });

    expect(res.status).toBe(200);

    const inDb = await testPrisma.service.findUnique({ where: { id: service.id } });
    expect(Number(inDb!.price)).toBe(150);
  });

  it('✅ تعطيل خدمة → isActive = false', async () => {
    const service = await seedService(testPrisma as unknown as any, TENANT);

    await req
      .patch(`/dashboard/services/${service.id}`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ isActive: false });

    const inDb = await testPrisma.service.findUnique({ where: { id: service.id } });
    expect(inDb!.isActive).toBe(false);
  });

  it('❌ حقول مطلوبة مفقودة → 400', async () => {
    const res = await req
      .post('/dashboard/services')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ price: 100 });

    expect(res.status).toBe(400);
  });

  it('❌ ID غير موجود → 404', async () => {
    const res = await req
      .patch('/dashboard/services/00000000-0000-0000-0000-000000000000')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ price: 999 });

    expect(res.status).toBe(404);
  });

  it('❌ بدون JWT → 401', async () => {
    const res = await req
      .get('/dashboard/services')
      .set('x-tenant-id', TENANT);

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: تشغيل**

```bash
cd apps/backend && npx jest --config test/jest-e2e.json test/e2e/org-experience --verbose
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/test/e2e/org-experience/
git commit -m "test(e2e): org-experience BC — services CRUD flows"
```

---

## Task 9: Ops — Reports

**Files:**
- Create: `apps/backend/test/e2e/ops/reports.e2e-spec.ts`

- [ ] **Step 1: تحقق من routes**

```bash
grep -n "@Get\|@Post\|@Controller" apps/backend/src/api/dashboard/ops.controller.ts | head -20
```

- [ ] **Step 2: إنشاء `test/e2e/ops/reports.e2e-spec.ts`**

```typescript
import * as supertest from 'supertest';
import { createTestApp } from '../../setup/app.setup';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;
const TOKEN = createTestToken(adminUser);
const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
const to = new Date().toISOString();

describe('Ops / Reports API (e2e)', () => {
  let req: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
  });

  it('✅ revenue report → 200 + total field', async () => {
    const res = await req
      .get(`/dashboard/ops/reports/revenue?from=${from}&to=${to}`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
  });

  it('✅ activity report → 200', async () => {
    const res = await req
      .get(`/dashboard/ops/reports/activity?from=${from}&to=${to}`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('❌ from بدون to → 400', async () => {
    const res = await req
      .get('/dashboard/ops/reports/revenue?from=2026-01-01')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(400);
  });

  it('❌ بدون JWT → 401', async () => {
    const res = await req
      .get(`/dashboard/ops/reports/revenue?from=${from}&to=${to}`)
      .set('x-tenant-id', TENANT);

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: تشغيل**

```bash
cd apps/backend && npx jest --config test/jest-e2e.json test/e2e/ops --verbose
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/test/e2e/ops/
git commit -m "test(e2e): ops BC — revenue and activity reports"
```

---

## Task 10: Full Suite Run + Coverage Validation

- [ ] **Step 1: تشغيل كل الـ e2e tests**

```bash
cd apps/backend && npx jest --config test/jest-e2e.json --verbose 2>&1 | tee /tmp/e2e-results.txt
```

Expected: جميع tests pass. لا تتجاوز إلى Step 2 قبل أن تمر كل الـ tests.

- [ ] **Step 2: تحقق من عدد الـ tests**

```bash
grep -E "Tests:|Test Suites:" /tmp/e2e-results.txt
```

Expected: ≥ 50 tests across 12 suites.

- [ ] **Step 3: تحقق من typecheck**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | grep "test/"
```

Expected: لا errors.

- [ ] **Step 4: Commit ختامي**

```bash
git add apps/backend/test/
git commit -m "test(e2e): complete integration test suite — 90% critical flow coverage"
```

---

## ملاحظات للمنفذ

### قبل كتابة أي spec — تحقق من الـ Route
```bash
grep -n "@Get\|@Post\|@Patch\|@Delete\|@Put\|@Controller" \
  apps/backend/src/api/dashboard/<name>.controller.ts
```
الـ URL في الخطة مبني على الأنماط الموجودة لكن قد يختلف الـ prefix الدقيق.

### إذا فشل overrideProvider في app.setup.ts
```bash
grep -n "provide\|useClass" apps/backend/src/infrastructure/mail/mail.module.ts
grep -n "provide\|useClass" apps/backend/src/infrastructure/ai/ai.module.ts
```
استبدل 'MailService' و 'EmbeddingAdapter' بالأسماء الفعلية.

### cleanTables — أسماء الجداول
`cleanTables` تستخدم أسماء Prisma models (PascalCase). إذا ظهر `relation does not exist`:
```bash
grep "^model " apps/backend/prisma/schema/*.prisma
```

### TEST_TENANT_ID
ثابت في auth.helper.ts. إذا أردت عزلاً أقوى بين suites:
```typescript
const TENANT = `tenant-${Math.random().toString(36).slice(2, 10)}`;
```
لكن تأكد من تنظيف البيانات في afterAll.
