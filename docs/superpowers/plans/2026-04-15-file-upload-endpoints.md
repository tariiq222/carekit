# File Upload Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dedicated backend upload endpoints for branding logo and employee avatar, so the frontend can attach images in one atomic call, with per-resource mimetype and size rules, plus E2E coverage.

**Architecture:** Two new vertical slices (`upload-logo`, `upload-avatar`) each reuse the existing `UploadFileHandler` for MinIO + `File`-row persistence, then update the target resource's URL column inside the same Prisma transaction. The generic `/dashboard/media/upload` endpoint stays unchanged for the services flow.

**Tech Stack:** NestJS 11, Prisma 7, multer (`memoryStorage`), Jest + supertest, MinIO (mocked in E2E).

---

## File Structure

**New files (6):**
- `apps/backend/src/modules/org-experience/branding/upload-logo/upload-logo.handler.ts` — slice handler
- `apps/backend/src/modules/org-experience/branding/upload-logo/upload-logo.handler.spec.ts` — unit tests
- `apps/backend/src/modules/people/employees/upload-avatar/upload-avatar.handler.ts` — slice handler
- `apps/backend/src/modules/people/employees/upload-avatar/upload-avatar.handler.spec.ts` — unit tests
- `apps/backend/test/e2e/media/file-upload.e2e-spec.ts` — 6 E2E tests
- `apps/backend/test/e2e/fixtures/sample-logo.png` — 5 KB real PNG
- `apps/backend/test/e2e/fixtures/sample-document.pdf` — ~50 KB real PDF

**Modified files (6):**
- `apps/backend/test/setup/app.setup.ts` — fix `MinioService` mock method names
- `apps/backend/src/modules/org-experience/org-experience.module.ts` — register `UploadLogoHandler`
- `apps/backend/src/modules/people/people.module.ts` — register `UploadAvatarHandler`
- `apps/backend/src/modules/org-experience/org-experience.module.ts` — import `MulterModule` + `ConfigModule` (if not already) and add `MinioService` provider
- `apps/backend/src/api/dashboard/organization-settings.controller.ts` — add `POST branding/logo`
- `apps/backend/src/api/dashboard/people.controller.ts` — add `POST employees/:id/avatar`
- `test-reports/scripts/tag_tests.py` — add `MD` → `Media` in `ID_TO_MODULE`

---

## Task 1: Fix the latent MinioService mock in E2E setup

The current mock at [test/setup/app.setup.ts:115-120](apps/backend/test/setup/app.setup.ts#L115-L120) uses method names that don't exist on the real service (`upload`, `delete`, `getPresignedUrl`). It's latent because no E2E test currently exercises the upload path. Our new tests will — fix first.

**Files:**
- Modify: `apps/backend/test/setup/app.setup.ts:115-120`

- [ ] **Step 1: Replace the broken mock with the real interface**

Open `apps/backend/test/setup/app.setup.ts` and replace lines 115-120:

```ts
    .overrideProvider(MinioService)
    .useValue({
      uploadFile: jest.fn().mockResolvedValue('http://localhost:9000/deqah/mocked-key'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue('http://localhost:9000/deqah/mocked-key?sig=x'),
      fileExists: jest.fn().mockResolvedValue(true),
    })
```

- [ ] **Step 2: Verify the whole E2E suite still passes**

Run: `cd apps/backend && npm run test:e2e`
Expected: all existing tests pass (the old mock names weren't exercised, so nothing regresses).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/test/setup/app.setup.ts
git commit -m "test(backend): fix MinioService mock to match real interface"
```

---

## Task 2: Add `MD` prefix to the test-report tagger

Without this, any test tagged `[MD-###]` lands under "Unknown" in the generated HTML report.

**Files:**
- Modify: `test-reports/scripts/tag_tests.py:25-37`

- [ ] **Step 1: Add the mapping**

In `test-reports/scripts/tag_tests.py`, find the `ID_TO_MODULE` dict (around line 25) and add one entry:

```python
ID_TO_MODULE = {
    "CL": "Clients",
    "EM": "Employees",
    "BK": "Bookings",
    "PY": "Payments",
    "AU": "Auth",
    "SV": "Services",
    "WL": "Whitelabel",
    "ZT": "ZATCA",
    "BH": "OrgConfig",
    "ET": "Comms",
    "A11Y": "Accessibility",
    "MD": "Media",
}
```

- [ ] **Step 2: Commit**

```bash
git add test-reports/scripts/tag_tests.py
git commit -m "chore(test-reports): add MD prefix for Media module"
```

---

## Task 3: Write the `upload-avatar` handler unit tests (TDD red phase)

Start with the smaller slice — avatar depends only on `Employee` which has a ready seed helper. We write the tests first, watch them fail, then implement.

**Files:**
- Create: `apps/backend/src/modules/people/employees/upload-avatar/upload-avatar.handler.spec.ts`

- [ ] **Step 1: Write the failing spec**

Create `apps/backend/src/modules/people/employees/upload-avatar/upload-avatar.handler.spec.ts` with this exact content:

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadAvatarHandler } from './upload-avatar.handler';
import { UploadFileHandler } from '../../../media/files/upload-file.handler';
import { PrismaService } from '../../../../infrastructure/database';

const TENANT = '00000000-0000-0000-0000-000000000001';
const EMPLOYEE_ID = '00000000-0000-0000-0000-000000000002';
const MAX_AVATAR_BYTES = 1 * 1024 * 1024;

function makeHandler(overrides: {
  employeeExists?: boolean;
  uploadResult?: { id: string; url: string };
  throwOnUpload?: Error;
} = {}) {
  const employeeFindUnique = jest.fn().mockResolvedValue(
    overrides.employeeExists === false ? null : { id: EMPLOYEE_ID, tenantId: TENANT },
  );
  const employeeUpdate = jest.fn().mockResolvedValue({ id: EMPLOYEE_ID });
  const prisma = {
    employee: { findUnique: employeeFindUnique, update: employeeUpdate },
    $transaction: jest.fn(async (cb: (tx: any) => Promise<unknown>) =>
      cb({ employee: { update: employeeUpdate } }),
    ),
  } as unknown as PrismaService;

  const uploadFileExecute = overrides.throwOnUpload
    ? jest.fn().mockRejectedValue(overrides.throwOnUpload)
    : jest.fn().mockResolvedValue(
        overrides.uploadResult ?? { id: 'file-1', url: 'https://cdn/test.png' },
      );
  const uploadFile = { execute: uploadFileExecute } as unknown as UploadFileHandler;

  const config = { getOrThrow: (_k: string) => 'deqah' } as ConfigService;
  const handler = new UploadAvatarHandler(prisma, uploadFile, config);
  return { handler, employeeFindUnique, employeeUpdate, uploadFileExecute };
}

describe('UploadAvatarHandler', () => {
  const validCmd = {
    tenantId: TENANT,
    employeeId: EMPLOYEE_ID,
    filename: 'a.png',
    mimetype: 'image/png',
    size: 1024,
  };

  it('rejects non-image mimetype', async () => {
    const { handler } = makeHandler();
    await expect(
      handler.execute({ ...validCmd, mimetype: 'application/pdf' }, Buffer.alloc(1024)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects oversized avatars', async () => {
    const { handler } = makeHandler();
    const size = MAX_AVATAR_BYTES + 1;
    await expect(
      handler.execute({ ...validCmd, size }, Buffer.alloc(size)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException when employee does not exist under tenant', async () => {
    const { handler } = makeHandler({ employeeExists: false });
    await expect(
      handler.execute(validCmd, Buffer.alloc(1024)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('on happy path: calls uploadFile then updates employee.avatarUrl', async () => {
    const { handler, uploadFileExecute, employeeUpdate } = makeHandler({
      uploadResult: { id: 'file-9', url: 'https://cdn/new.png' },
    });

    const res = await handler.execute(validCmd, Buffer.alloc(1024));

    expect(uploadFileExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        ownerType: 'employee',
        ownerId: EMPLOYEE_ID,
      }),
      expect.any(Buffer),
    );
    expect(employeeUpdate).toHaveBeenCalledWith({
      where: { id: EMPLOYEE_ID, tenantId: TENANT },
      data: { avatarUrl: 'https://cdn/new.png' },
    });
    expect(res).toEqual({ fileId: 'file-9', url: 'https://cdn/new.png' });
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd apps/backend && npx jest modules/people/employees/upload-avatar`
Expected: FAIL — "Cannot find module './upload-avatar.handler'".

---

## Task 4: Implement `UploadAvatarHandler` (TDD green phase)

**Files:**
- Create: `apps/backend/src/modules/people/employees/upload-avatar/upload-avatar.handler.ts`

- [ ] **Step 1: Write the handler**

Create `apps/backend/src/modules/people/employees/upload-avatar/upload-avatar.handler.ts`:

```ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database';
import { UploadFileHandler } from '../../../media/files/upload-file.handler';

export const MAX_AVATAR_BYTES = 1 * 1024 * 1024;
export const ALLOWED_AVATAR_MIMETYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export type UploadAvatarCommand = {
  tenantId: string;
  employeeId: string;
  filename: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class UploadAvatarHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadFile: UploadFileHandler,
    _config: ConfigService,
  ) {}

  async execute(cmd: UploadAvatarCommand, buffer: Buffer): Promise<{ fileId: string; url: string }> {
    if (!ALLOWED_AVATAR_MIMETYPES.has(cmd.mimetype)) {
      throw new BadRequestException(`Avatar mimetype not allowed: ${cmd.mimetype}`);
    }
    if (cmd.size > MAX_AVATAR_BYTES) {
      throw new BadRequestException(
        `Avatar exceeds maximum size of ${MAX_AVATAR_BYTES} bytes`,
      );
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: cmd.employeeId },
      select: { id: true, tenantId: true },
    });
    if (!employee || employee.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Employee ${cmd.employeeId} not found`);
    }

    const file = await this.uploadFile.execute(
      {
        tenantId: cmd.tenantId,
        filename: cmd.filename,
        mimetype: cmd.mimetype,
        size: cmd.size,
        ownerType: 'employee',
        ownerId: cmd.employeeId,
      },
      buffer,
    );

    await this.prisma.employee.update({
      where: { id: cmd.employeeId, tenantId: cmd.tenantId },
      data: { avatarUrl: file.url },
    });

    return { fileId: file.id, url: file.url };
  }
}
```

- [ ] **Step 2: Run tests and confirm they pass**

Run: `cd apps/backend && npx jest modules/people/employees/upload-avatar`
Expected: PASS (4 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/people/employees/upload-avatar
git commit -m "feat(employees): add upload-avatar handler with size and mimetype rules"
```

---

## Task 5: Register `UploadAvatarHandler` and expose controller endpoint

**Files:**
- Modify: `apps/backend/src/modules/people/people.module.ts`
- Modify: `apps/backend/src/api/dashboard/people.controller.ts`

- [ ] **Step 1: Register the handler in `PeopleModule`**

In `apps/backend/src/modules/people/people.module.ts`:

1. Import `MulterModule` and `memoryStorage`:

```ts
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
```

2. Import the new handler + the `UploadFileHandler` it depends on + `MinioService`:

```ts
import { UploadAvatarHandler } from './employees/upload-avatar/upload-avatar.handler';
import { UploadFileHandler } from '../media/files/upload-file.handler';
import { MinioService } from '../../infrastructure/storage/minio.service';
```

3. Add `MulterModule.register({ storage: memoryStorage() })` to `imports`.

4. Add `UploadAvatarHandler`, `UploadFileHandler`, `MinioService` to both `providers` and `exports` arrays.

After the edit, `providers` should read:

```ts
  providers: [...handlers, UploadAvatarHandler, UploadFileHandler, MinioService],
  exports: [...handlers, UploadAvatarHandler, UploadFileHandler, MinioService],
```

- [ ] **Step 2: Add the controller endpoint**

In `apps/backend/src/api/dashboard/people.controller.ts`:

1. Extend the top import group with:

```ts
import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadAvatarHandler } from '../../modules/people/employees/upload-avatar/upload-avatar.handler';
```

2. Inject the handler in the constructor (add `private readonly uploadAvatar: UploadAvatarHandler,` after the last employee handler).

3. Add this method anywhere in the employee section of the controller:

```ts
  @Post('employees/:employeeId/avatar')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatarEndpoint(
    @TenantId() tenantId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadAvatar.execute(
      {
        tenantId,
        employeeId,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      file.buffer,
    );
  }
```

- [ ] **Step 3: Run backend unit tests to confirm nothing regressed**

Run: `cd apps/backend && npm run test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/people/people.module.ts apps/backend/src/api/dashboard/people.controller.ts
git commit -m "feat(employees): wire upload-avatar endpoint into dashboard"
```

---

## Task 6: Write `upload-logo` handler unit tests (TDD red phase)

**Files:**
- Create: `apps/backend/src/modules/org-experience/branding/upload-logo/upload-logo.handler.spec.ts`

- [ ] **Step 1: Write the failing spec**

Create `apps/backend/src/modules/org-experience/branding/upload-logo/upload-logo.handler.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadLogoHandler } from './upload-logo.handler';
import { UploadFileHandler } from '../../../media/files/upload-file.handler';
import { PrismaService } from '../../../../infrastructure/database';

const TENANT = '00000000-0000-0000-0000-000000000001';
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function makeHandler(overrides: { uploadResult?: { id: string; url: string } } = {}) {
  const brandingUpsert = jest.fn().mockResolvedValue({ tenantId: TENANT });
  const prisma = {
    brandingConfig: { upsert: brandingUpsert },
    $transaction: jest.fn(async (cb: (tx: any) => Promise<unknown>) =>
      cb({ brandingConfig: { upsert: brandingUpsert } }),
    ),
  } as unknown as PrismaService;
  const uploadFileExecute = jest.fn().mockResolvedValue(
    overrides.uploadResult ?? { id: 'file-1', url: 'https://cdn/logo.png' },
  );
  const uploadFile = { execute: uploadFileExecute } as unknown as UploadFileHandler;
  const config = { getOrThrow: (_k: string) => 'deqah' } as ConfigService;
  return {
    handler: new UploadLogoHandler(prisma, uploadFile, config),
    brandingUpsert,
    uploadFileExecute,
  };
}

describe('UploadLogoHandler', () => {
  const validCmd = {
    tenantId: TENANT,
    filename: 'l.png',
    mimetype: 'image/png',
    size: 2048,
  };

  it('rejects non-image mimetype', async () => {
    const { handler } = makeHandler();
    await expect(
      handler.execute({ ...validCmd, mimetype: 'application/pdf' }, Buffer.alloc(2048)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects oversized logo', async () => {
    const { handler } = makeHandler();
    const size = MAX_LOGO_BYTES + 1;
    await expect(
      handler.execute({ ...validCmd, size }, Buffer.alloc(size)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('on happy path: calls uploadFile then upserts branding.logoUrl', async () => {
    const { handler, uploadFileExecute, brandingUpsert } = makeHandler({
      uploadResult: { id: 'file-7', url: 'https://cdn/new-logo.png' },
    });

    const res = await handler.execute(validCmd, Buffer.alloc(2048));

    expect(uploadFileExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        ownerType: 'branding',
      }),
      expect.any(Buffer),
    );
    expect(brandingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT },
        update: { logoUrl: 'https://cdn/new-logo.png' },
      }),
    );
    expect(res).toEqual({ fileId: 'file-7', url: 'https://cdn/new-logo.png' });
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `cd apps/backend && npx jest modules/org-experience/branding/upload-logo`
Expected: FAIL — "Cannot find module './upload-logo.handler'".

---

## Task 7: Implement `UploadLogoHandler` (TDD green phase)

**Files:**
- Create: `apps/backend/src/modules/org-experience/branding/upload-logo/upload-logo.handler.ts`

- [ ] **Step 1: Write the handler**

Create `apps/backend/src/modules/org-experience/branding/upload-logo/upload-logo.handler.ts`:

```ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database';
import { UploadFileHandler } from '../../../media/files/upload-file.handler';

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const ALLOWED_LOGO_MIMETYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export type UploadLogoCommand = {
  tenantId: string;
  filename: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class UploadLogoHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadFile: UploadFileHandler,
    _config: ConfigService,
  ) {}

  async execute(cmd: UploadLogoCommand, buffer: Buffer): Promise<{ fileId: string; url: string }> {
    if (!ALLOWED_LOGO_MIMETYPES.has(cmd.mimetype)) {
      throw new BadRequestException(`Logo mimetype not allowed: ${cmd.mimetype}`);
    }
    if (cmd.size > MAX_LOGO_BYTES) {
      throw new BadRequestException(`Logo exceeds maximum size of ${MAX_LOGO_BYTES} bytes`);
    }

    const file = await this.uploadFile.execute(
      {
        tenantId: cmd.tenantId,
        filename: cmd.filename,
        mimetype: cmd.mimetype,
        size: cmd.size,
        ownerType: 'branding',
      },
      buffer,
    );

    await this.prisma.brandingConfig.upsert({
      where: { tenantId: cmd.tenantId },
      create: {
        tenantId: cmd.tenantId,
        clinicNameAr: 'Clinic',
        logoUrl: file.url,
      },
      update: { logoUrl: file.url },
    });

    return { fileId: file.id, url: file.url };
  }
}
```

- [ ] **Step 2: Run tests and confirm they pass**

Run: `cd apps/backend && npx jest modules/org-experience/branding/upload-logo`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/org-experience/branding/upload-logo
git commit -m "feat(branding): add upload-logo handler with size and mimetype rules"
```

---

## Task 8: Register `UploadLogoHandler` and expose controller endpoint

**Files:**
- Modify: `apps/backend/src/modules/org-experience/org-experience.module.ts`
- Modify: `apps/backend/src/api/dashboard/organization-settings.controller.ts`

- [ ] **Step 1: Register in `OrgExperienceModule`**

In `apps/backend/src/modules/org-experience/org-experience.module.ts`:

1. Add imports at the top:

```ts
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadLogoHandler } from './branding/upload-logo/upload-logo.handler';
import { UploadFileHandler } from '../media/files/upload-file.handler';
import { MinioService } from '../../infrastructure/storage/minio.service';
```

2. Add `MulterModule.register({ storage: memoryStorage() })` to `imports`.

3. Add `UploadLogoHandler`, `UploadFileHandler`, `MinioService` to both `providers` and `exports` arrays.

- [ ] **Step 2: Add the controller endpoint**

In `apps/backend/src/api/dashboard/organization-settings.controller.ts`:

1. Extend the first Nest import with upload decorators:

```ts
import {
  Controller, Get, Post, Patch, Put, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadLogoHandler } from '../../modules/org-experience/branding/upload-logo/upload-logo.handler';
```

2. Inject in the constructor (add `private readonly uploadLogo: UploadLogoHandler,` after `getBranding`).

3. Add this method inside the `// ── Branding ──` section:

```ts
  @Post('branding/logo')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  uploadLogoEndpoint(
    @TenantId() tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadLogo.execute(
      {
        tenantId,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      file.buffer,
    );
  }
```

- [ ] **Step 3: Run backend unit tests**

Run: `cd apps/backend && npm run test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/org-experience/org-experience.module.ts apps/backend/src/api/dashboard/organization-settings.controller.ts
git commit -m "feat(branding): wire upload-logo endpoint into dashboard"
```

---

## Task 9: Add binary fixtures for E2E

**Files:**
- Create: `apps/backend/test/e2e/fixtures/sample-logo.png`
- Create: `apps/backend/test/e2e/fixtures/sample-document.pdf`

- [ ] **Step 1: Generate a real 1×1 PNG fixture**

From the repo root, run this Node one-liner to write a valid 68-byte PNG:

```bash
node -e "const b=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=','base64');require('fs').writeFileSync('apps/backend/test/e2e/fixtures/sample-logo.png',b);"
```

- [ ] **Step 2: Generate a minimal valid PDF fixture**

From the repo root:

```bash
node -e "require('fs').writeFileSync('apps/backend/test/e2e/fixtures/sample-document.pdf','%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 72 72]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000053 00000 n\n0000000099 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n148\n%%EOF');"
```

- [ ] **Step 3: Verify both fixtures exist**

Run:
```bash
ls -la apps/backend/test/e2e/fixtures/
```

Expected: both files present, PNG ~68 B, PDF ~250 B.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/test/e2e/fixtures/sample-logo.png apps/backend/test/e2e/fixtures/sample-document.pdf
git commit -m "test(backend): add sample-logo.png and sample-document.pdf fixtures"
```

---

## Task 10: Write the E2E spec

**Files:**
- Create: `apps/backend/test/e2e/media/file-upload.e2e-spec.ts`

- [ ] **Step 1: Write the full spec**

Create `apps/backend/test/e2e/media/file-upload.e2e-spec.ts`:

```ts
import path from 'node:path';
import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedEmployee } from '../../setup/seed.helper';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;
const FIXTURES = path.resolve(__dirname, '../fixtures');
const LOGO_PNG = path.join(FIXTURES, 'sample-logo.png');
const SAMPLE_PDF = path.join(FIXTURES, 'sample-document.pdf');

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
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .attach('file', LOGO_PNG);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('fileId');
    expect(res.body).toHaveProperty('url');

    const fileRow = await (testPrisma as any).file.findFirst({
      where: { tenantId: TENANT, ownerType: 'branding' },
    });
    expect(fileRow).not.toBeNull();

    const branding = await (testPrisma as any).brandingConfig.findUnique({
      where: { tenantId: TENANT },
    });
    expect(branding?.logoUrl).toBe(res.body.url);
  });

  it('[MD-002][Media/upload-logo][P2-Medium] رفض logo > 2MB', async () => {
    const oversize = Buffer.alloc(2 * 1024 * 1024 + 1, 0x00);

    const res = await req
      .post('/dashboard/organization/branding/logo')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .attach('file', oversize, { filename: 'big.png', contentType: 'image/png' });

    expect(res.status).toBe(400);

    const count = await (testPrisma as any).file.count({ where: { tenantId: TENANT } });
    expect(count).toBe(0);
  });

  it('[MD-003][Media/upload-logo][P2-Medium] رفض logo بنوع PDF', async () => {
    const res = await req
      .post('/dashboard/organization/branding/logo')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .attach('file', SAMPLE_PDF);

    expect(res.status).toBe(400);

    const count = await (testPrisma as any).file.count({ where: { tenantId: TENANT } });
    expect(count).toBe(0);
  });

  it('[MD-004][Media/upload-avatar][P1-High] رفع avatar للموظف ناجح', async () => {
    const employee = await seedEmployee(testPrisma as any, TENANT, { name: 'د. خالد' });

    const res = await req
      .post(`/dashboard/people/employees/${employee.id}/avatar`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .attach('file', LOGO_PNG);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('url');

    const updated = await (testPrisma as any).employee.findUnique({
      where: { id: employee.id },
    });
    expect(updated?.avatarUrl).toBe(res.body.url);

    const fileRow = await (testPrisma as any).file.findFirst({
      where: { tenantId: TENANT, ownerType: 'employee', ownerId: employee.id },
    });
    expect(fileRow).not.toBeNull();
  });

  it('[MD-005][Media/upload-avatar][P2-Medium] رفض avatar > 1MB', async () => {
    const employee = await seedEmployee(testPrisma as any, TENANT, { name: 'د. سارة' });
    const oversize = Buffer.alloc(1 * 1024 * 1024 + 1, 0x00);

    const res = await req
      .post(`/dashboard/people/employees/${employee.id}/avatar`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .attach('file', oversize, { filename: 'big.png', contentType: 'image/png' });

    expect(res.status).toBe(400);

    const count = await (testPrisma as any).file.count({ where: { tenantId: TENANT } });
    expect(count).toBe(0);
  });

  it('[MD-006][Media/upload-generic][P1-High] الـ endpoint العام لا يزال يقبل رفع ملف', async () => {
    const res = await req
      .post('/dashboard/media/upload')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .attach('file', LOGO_PNG);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
});
```

- [ ] **Step 2: Run the new E2E spec in isolation**

Run: `cd apps/backend && npx jest --config test/jest-e2e.json test/e2e/media/file-upload`
Expected: 6 tests pass.

- [ ] **Step 3: Run the full E2E suite for regression**

Run: `cd apps/backend && npm run test:e2e`
Expected: all existing + 6 new tests pass.

- [ ] **Step 4: Confirm the new tests appear in the HTML report under Media**

Run: `npm run test:report`
Then open `test-reports/output/test-report.html` and verify a `Media` module section with 6 entries (MD-001 … MD-006).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/test/e2e/media/file-upload.e2e-spec.ts
git commit -m "test(media): add E2E coverage for upload-logo and upload-avatar"
```

---

## Final verification

- [ ] **Step 1: Full backend check**

Run in order:
```bash
cd apps/backend && npm run lint
cd apps/backend && npm run test
cd apps/backend && npm run test:e2e
```

All three must pass.

- [ ] **Step 2: Sanity-check the generic endpoint was not broken**

Spot-check the services flow still works:
Run: `cd apps/backend && npx jest api/dashboard/media.controller.spec.ts`
Expected: PASS.

- [ ] **Step 3: Summarize the diff**

Run: `git log --oneline main..HEAD`
Expected: 8 commits — 2 infrastructure (mock + tag_tests), 4 feature (avatar slice, avatar wiring, logo slice, logo wiring), 1 fixtures, 1 E2E spec.
