# File Upload Endpoints — Design Spec

**Date:** 2026-04-15
**Phase:** 6 (File Upload)
**Scope:** Backend — new dedicated upload endpoints for whitelabel logo and employee avatar, plus E2E coverage.

## Problem

The backend has a single generic upload endpoint: `POST /dashboard/media/upload`. It accepts any `ownerType` as a free string (`@IsString() @MaxLength(32)`), with a one-size-fits-all 25MB cap and a shared allowed-mimetype set. Callers must:

1. Upload the file.
2. Remember the returned `File.id` / `File.url`.
3. Make a second call to link it to the target resource (e.g. `PATCH /whitelabel` with `logoUrl`).

This creates three issues for the whitelabel-logo and employee-avatar flows:

- **Weak validation** — a 25MB PDF can be uploaded as `ownerType: 'whitelabel'` and accepted. The resource contract (logo = image) is enforced nowhere.
- **Non-atomic linking** — if the second PATCH fails or the UI crashes between calls, orphan `File` rows accumulate.
- **Permission blur** — CASL can't distinguish "allowed to upload any media" from "allowed to change clinic branding".

The generic endpoint stays for flows that don't have these concerns (currently: `services.ts:165` attaches images to `Service` records, which is expected to grow to categories/branches/etc.).

## Out of Scope

- **Intake form document uploads** — the `IntakeForm` schema has no `documentUrl` / `attachmentFileId` field. Adding one needs a migration + product decision about what the attachment represents. Deferred.
- **Dedicated endpoints for every upload path** — only logo and avatar, since those are the two resources with existing URL fields (`Whitelabel.logoUrl`, `Employee.avatarUrl`) that the dashboard actively sets.
- **Removing the generic endpoint** — it's used by services flow. Deprecation is a separate decision.
- **Mobile app uploads** — no mobile caller uses `/dashboard/media/upload`. No mobile surface changes here.

## Architecture

Two new vertical slices. Each slice owns one handler that:

1. Delegates raw upload to the existing `UploadFileHandler` (MinIO write + `File` row).
2. Updates the target resource's URL field in the **same `prisma.$transaction`** as the `File` row insert.

This keeps the generic upload logic in one place and layers resource-specific rules (mimetype whitelist, size cap, ownership check) on top.

```
modules/
├── org-experience/branding/
│   └── upload-logo/
│       ├── upload-logo.dto.ts          (empty body — file is the only input)
│       ├── upload-logo.handler.ts
│       └── upload-logo.handler.spec.ts
└── people/employees/
    └── upload-avatar/
        ├── upload-avatar.dto.ts        (empty body — file is the only input)
        ├── upload-avatar.handler.ts
        └── upload-avatar.handler.spec.ts
```

Controllers live in `src/api/dashboard/` (the codebase uses "branding" as the internal name; "whitelabel" is the external product term):

- `organization-settings.controller.ts` (existing, owns branding) gains `POST /dashboard/organization-settings/branding/logo`
- `people.controller.ts` (existing) gains `POST /dashboard/people/employees/:id/avatar`

### Handler contract (both slices)

```ts
execute(cmd: { tenantId: string; filename: string; mimetype: string; size: number; /* + avatar: employeeId */ }, buffer: Buffer)
  → Promise<{ fileId: string; url: string }>
```

Handler steps:

1. Validate mimetype against the slice-specific whitelist (reject with `BadRequestException` on mismatch).
2. Validate size against the slice-specific cap (reject with `BadRequestException` on overflow).
3. For avatar: verify the target employee exists under `tenantId` (`NotFoundException` otherwise).
4. Inside `prisma.$transaction`:
   - Call `uploadFileHandler.execute(...)` — writes to MinIO and inserts `File` row with `ownerType` + `ownerId` set.
   - `tx.brandingConfig.update({ where: { tenantId }, data: { logoUrl: url } })` or `tx.employee.update({ where: { id: employeeId, tenantId }, data: { avatarUrl: url } })`.
5. Return `{ fileId, url }`.

### Per-slice rules

| Slice | Endpoint | Allowed mimetypes | Max size | CASL subject | `ownerType` in File row |
|---|---|---|---|---|---|
| upload-logo | `POST /dashboard/organization-settings/branding/logo` | `image/png`, `image/jpeg`, `image/webp` | 2 MB | `manage Branding` | `branding` |
| upload-avatar | `POST /dashboard/people/employees/:id/avatar` | `image/png`, `image/jpeg`, `image/webp` | 1 MB | `update Employee` | `employee` |

The generic endpoint's 25MB cap and wider mimetype set remain unchanged for the services flow.

## Testing

### E2E (Jest + supertest)

File: `apps/backend/test/e2e/media/file-upload.e2e-spec.ts`

Six tests, all tagged for the dashboard report generator:

| ID | Slice | Priority | Title | What it asserts |
|---|---|---|---|---|
| MD-001 | Media/upload-logo | P1-High | رفع logo للـ branding ناجح | 201; `BrandingConfig.logoUrl` in DB updated; `File` row exists with `ownerType='branding'` |
| MD-002 | Media/upload-logo | P2-Medium | رفض logo > 2MB | 400; no `File` row created |
| MD-003 | Media/upload-logo | P2-Medium | رفض logo بنوع PDF | 400; no `File` row |
| MD-004 | Media/upload-avatar | P1-High | رفع avatar للموظف ناجح | 201; `Employee.avatarUrl` updated; `File` row with `ownerType='employee'`, `ownerId=employeeId` |
| MD-005 | Media/upload-avatar | P2-Medium | رفض avatar > 1MB | 400; no `File` row |
| MD-006 | Media/upload-generic | P1-High | الـ endpoint العام يقبل رفع ملف للـ services | 201; `File` row exists — regression guard for existing services flow |

### Fixtures

`apps/backend/test/e2e/fixtures/`:
- `sample-logo.png` (~5KB real PNG — used for MD-001, MD-004, MD-006 happy paths)
- `sample-document.pdf` (~50KB real PDF — used for MD-003 mimetype-rejection path)

Oversize cases (MD-002, MD-005) generate buffers in-test via `Buffer.alloc(sizeInBytes, 0x00)` with the PNG mimetype — no large fixtures committed.

### Unit tests (colocated `*.handler.spec.ts`)

Each new handler gets a spec covering:
- Mimetype rejection (PDF → `BadRequestException`)
- Size rejection (over cap → `BadRequestException`)
- Happy path (MinIO called, resource URL updated, transaction rollback on MinIO failure)
- For avatar: missing employee → `NotFoundException`, cross-tenant employee → `NotFoundException`

### Infrastructure

The E2E setup at [test/setup/app.setup.ts:115-120](apps/backend/test/setup/app.setup.ts#L115-L120) **mocks `MinioService`** (this contradicts an earlier brainstorming assumption). The existing mock uses wrong method names (`upload` / `delete` / `getPresignedUrl`) — these don't match the real interface (`uploadFile` / `deleteFile` / `getSignedUrl` / `fileExists`). The current generic-endpoint tests don't exercise this path, so the broken mock has been latent.

**Plan implication:** fix the mock to match the real `IStorageService` interface as part of Task 1 (infrastructure prep). Tests then verify:
- MinIO mock was called with the right bucket/key/mimetype
- `File` row persisted with correct fields
- Target resource (`BrandingConfig.logoUrl` / `Employee.avatarUrl`) updated in the same transaction

No real MinIO required for E2E.

### Report integration

`test-reports/scripts/tag_tests.py` gains `MD-` → `Media` in `ID_TO_MODULE`. Without this, the six tests land under "Unknown" in the HTML report.

## Rollout

1. Add `MD-` prefix to `tag_tests.py`.
2. Add `upload-avatar` slice + handler spec.
3. Add `upload-logo` slice + handler spec.
4. Wire controllers.
5. Add fixtures.
6. Write E2E spec.
7. `npm run test:e2e` → confirm report shows Media module with 6 tests.

Dashboard migration (switching `services.ts`-style double-call flows to the new dedicated endpoints) is **not** part of this spec. That's a dashboard-side follow-up once backend is merged.

## Risks

- **Breaking the existing services flow** — mitigated by MD-006 regression test and by leaving the generic endpoint untouched.
- **MinIO bucket not present in CI** — existing E2E tests already depend on MinIO; no new infra concern.
- **File rows created but resource update fails** — mitigated by wrapping both writes in `prisma.$transaction`. MinIO write is before the transaction (can't rollback S3), so a DB failure leaves an orphan MinIO object; this matches current generic-endpoint behavior and is acceptable (orphan-cleanup is a separate ops concern).

## Success Criteria

- `POST /dashboard/organization-settings/branding/logo` with a valid PNG → 201; `BrandingConfig.logoUrl` reflects new file immediately (no second call).
- `POST /dashboard/people/employees/:id/avatar` with a valid PNG → 201; `Employee.avatarUrl` updated immediately.
- Both endpoints reject mismatched mimetypes and oversized files with 400.
- Existing `POST /dashboard/media/upload` continues to work for services flow.
- Test report shows `Media` module with 6 tests, all green.
