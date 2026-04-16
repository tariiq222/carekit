# API Documentation — Design Spec

**Date**: 2026-04-17
**Owner**: @tariq
**Status**: Approved, ready for implementation plan

## Context

The CareKit backend exposes **178 endpoints** across **29 controllers** (Dashboard admin + Mobile Client + Mobile Employee + Public). `SwaggerModule` is wired in [apps/backend/src/main.ts](../../../apps/backend/src/main.ts) and serves `/api/docs`, but the documentation is effectively empty:

- Only 15/29 controllers have `@ApiTags`.
- **0/178** endpoints have `@ApiOperation`.
- No `@ApiResponse`, `@ApiParam`, or `@ApiQuery` anywhere.
- Only one DTO file uses `@ApiProperty` (out of dozens).

This blocks: (a) onboarding external/mobile developers, (b) generating a reliable typed SDK from OpenAPI, (c) contract-level PR review. This spec defines the work to bring every endpoint to a **standard documentation level** and to add guardrails that prevent regressions.

## Goals

1. Every HTTP endpoint in `apps/backend/src/api/**` is documented at the **Standard level** (definition below).
2. Every DTO used as `@Body()`, `@Query()`, or response is documented with `@ApiProperty` on each field.
3. Swagger UI at `/api/docs` is organized, navigable, and accurate.
4. Adding a new endpoint without documentation **fails lint and CI**.
5. An `openapi.json` snapshot lives in git so the API contract is reviewable in PR diffs.

## Non-Goals

- Translating docs into Arabic (English only — industry standard for developer-facing tooling).
- Rewriting DTOs or controllers beyond adding decorators.
- Building a public developer portal.
- Auto-generating the `@carekit/api-client` package contents (called out as a follow-up, not part of this work).

## Documentation Level — "Standard"

For **every** endpoint:

- `@ApiTags('<Audience> / <Cluster>')` on the controller (e.g., `Dashboard / Bookings`, `Mobile Client / Chat`, `Public / Auth`).
- `@ApiOperation({ summary, description? })` — English, imperative mood (e.g., `"Create a booking"`).
- `@ApiBearerAuth()` on protected controllers (global default where possible).
- `@ApiResponse` for the relevant subset of: `200`/`201` (success with DTO), `400` (validation), `401` (unauthenticated), `403` (forbidden, when CASL applies), `404` (when a resource lookup is involved). Unused codes are omitted.
- `@ApiParam({ name, description, example })` for every route param.
- `@ApiQuery({ name, required, description, example })` for every query param.
- `@ApiBody({ type })` is implicit from `@Body() dto: XxxDto` but explicit when polymorphic.

For **every** DTO:

- `@ApiProperty({ description, example })` on every public field, plus `@ApiPropertyOptional` for optional fields.
- Enums declared via `enum:` option so OpenAPI emits a proper `enum` schema.

## Architecture

### Shared helpers — `apps/backend/src/common/swagger/`

New folder containing reusable decorators and shapes so controllers stay readable:

| File | Purpose |
|---|---|
| `api-error.dto.ts` | Shared error response shape matching `HttpExceptionFilter` output (`statusCode`, `message`, `error`, `path`, `timestamp`). |
| `api-paginated.dto.ts` | Generic `{ data: T[], meta: { total, page, pageSize, totalPages } }` wrapper. |
| `api-standard-responses.decorator.ts` | Composite decorator that applies `401`/`403`/`500` responses (baseline for protected endpoints) — reduces noise in controllers. |
| `api-paginated-response.decorator.ts` | Produces a correct `@ApiOkResponse` for paginated endpoints with the right generic `T`. |
| `index.ts` | Barrel. |

### `main.ts` changes

- Keep `DocumentBuilder` as-is; add `.setContact()` + `.setLicense()` for professionalism.
- Keep `WRITE_OPENAPI_SPEC=1` behavior but add a new script `openapi:snapshot` that sets it and runs `nest build` so `apps/backend/openapi.json` is regenerated on demand.
- Tag order is controlled via the order of `@ApiTags` usage; document the convention in `CLAUDE.md`.

### Audience → Cluster tag map

Every controller gets exactly one tag, from this closed list:

```
Dashboard / AI
Dashboard / Bookings
Dashboard / Comms
Dashboard / Finance
Dashboard / Identity
Dashboard / Media
Dashboard / Ops
Dashboard / Org Config
Dashboard / Org Experience
Dashboard / Platform
Mobile Client / Bookings
Mobile Client / Chat
Mobile Client / Notifications
Mobile Client / Payments
Mobile Client / Portal
Mobile Client / Profile
Mobile Employee / Clients
Mobile Employee / Earnings
Mobile Employee / Schedule
Public / Auth
Public / Branding
Public / Catalog
Public / Slots
```

## Implementation Plan — Waves

### Wave 0 — Foundation (serial, blocks everything else)

1. Create `src/common/swagger/` with the files listed above.
2. Add `openapi:snapshot` npm script in `apps/backend/package.json` → sets `WRITE_OPENAPI_SPEC=1` and runs `nest build`.
3. Add placeholder `apps/backend/openapi.json` entry in git so later waves can overwrite, not create.
4. Extend `apps/backend/CLAUDE.md` with a new "API Documentation" section stating the Standard level rules and the closed tag list.

### Waves 1-13 — Cluster-scoped documentation (parallelizable)

Each wave documents one cluster's controllers + DTOs. Waves are independent → may run in parallel via `backend-dev` subagents, 3-4 at a time:

| Wave | Cluster | Controllers (files under `src/api/`) |
|---|---|---|
| 1 | bookings | `dashboard/bookings`, `mobile/client/bookings`, relevant employee controllers |
| 2 | finance | `dashboard/finance` |
| 3 | identity | `dashboard/identity`, `public/auth` |
| 4 | people | `dashboard/people`, `mobile/employee/clients`, `mobile/client/profile` |
| 5 | comms | `dashboard/comms`, `mobile/client/chat`, `mobile/client/notifications` |
| 6 | org-config | `dashboard/organization-branches`, `organization-hours`, `organization-categories`, `organization-departments`, `organization-settings` |
| 7 | org-experience | `dashboard/organization` (branding, intake, ratings, services), `public/branding`, `public/catalog` |
| 8 | ops | `dashboard/ops` |
| 9 | ai | `dashboard/ai` |
| 10 | media | `dashboard/media` |
| 11 | platform | `dashboard/platform`, `public/slots` |
| 12 | mobile client portal | `mobile/client/portal/{home,summary,upcoming}`, `mobile/client/payments` |
| 13 | mobile employee | `mobile/employee/{schedule,earnings}` |

Each wave's subagent is constrained to: its cluster's controllers, its cluster's DTO files, and the new `src/common/swagger/` helpers. No cross-cluster edits.

### Wave 14 — Guardrails

1. **Local ESLint rule** at `apps/backend/eslint-rules/require-api-operation.js`:
   - Detects any method with `@Get|@Post|@Put|@Patch|@Delete` decorators
   - Errors if no sibling `@ApiOperation` decorator exists
   - Registered in `apps/backend/.eslintrc.cjs` as `carekit/require-api-operation: "error"`
2. **CI coverage script** at `apps/backend/scripts/check-openapi-coverage.ts`:
   - Runs `openapi:snapshot` to regenerate `openapi.json`
   - Asserts: every `paths[*]` entry has a `summary`; every operation has at least one 4xx response; every referenced schema's properties have `description` or `example`
   - Exits non-zero with a readable list of gaps
   - Wired into CI workflow (new `api-docs` job).
3. **OpenAPI snapshot guard**: CI runs `openapi:snapshot` and fails if `git diff --exit-code apps/backend/openapi.json` is non-empty — forces PRs to commit the snapshot alongside their endpoint changes.

### Wave 15 — Verification & Handoff

- `npm run lint`, `npm run typecheck`, `npm run test` all green in `apps/backend`.
- Manual visual check of `/api/docs` (via Chrome DevTools MCP per the QA gate):
  - Tags listed in the expected order.
  - Clicking any endpoint shows `summary`, parameters, and response schemas.
  - `Try it out` still works against a local dev backend.
- Update `apps/backend/CLAUDE.md` "API Documentation" section with a link to `/api/docs` and the `openapi:snapshot` workflow.
- Update root `CLAUDE.md` commands section with `npm run openapi:snapshot`.

## Regression Prevention (recap)

Three layers, per the user's choice (option D):

1. **ESLint rule** — catches missing `@ApiOperation` at lint time, locally and in PR.
2. **CI coverage script** — catches missing `@ApiProperty`, missing responses, missing parameter docs after build.
3. **Snapshot diff guard** — catches silent contract drift (e.g., renaming a DTO field without updating the snapshot).

## Acceptance Criteria

- [ ] `@ApiOperation` on 178/178 endpoints.
- [ ] `@ApiResponse` covering the applicable subset of 200/201/400/401/403/404 on every endpoint.
- [ ] `@ApiParam`/`@ApiQuery` on every route param and query param.
- [ ] `@ApiProperty`/`@ApiPropertyOptional` on every field of every DTO used in the API layer.
- [ ] `apps/backend/src/common/swagger/` exists and is used by controllers.
- [ ] `apps/backend/openapi.json` is committed and reproducible via `npm run openapi:snapshot`.
- [ ] ESLint rule `carekit/require-api-operation` exists and errors on violations.
- [ ] CI coverage script exists, is wired into the workflow, and fails on gaps.
- [ ] `apps/backend/CLAUDE.md` documents the standard and links to `/api/docs`.
- [ ] All existing controller/handler unit tests continue to pass unchanged.
- [ ] `/api/docs` manually verified: tags grouped, endpoints browsable, auth works.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Parallel waves create merge conflicts on `app.module.ts` / shared files. | Waves touch only their cluster's controllers + DTOs + the new `common/swagger/` helpers (added once in Wave 0). No shared-file edits during Waves 1-13. |
| ESLint rule has false positives on non-HTTP decorators. | Rule only fires when a sibling method decorator name matches `/^(Get|Post|Put|Patch|Delete)$/` from `@nestjs/common`. |
| `openapi.json` snapshot produces noisy diffs on unrelated changes (ordering). | Serialize with deterministic key order; document in CLAUDE.md that snapshot regen is part of any endpoint-touching PR. |
| Subagent adds speculative fields to DTOs. | Each wave prompt explicitly forbids DTO shape changes — decorators only. |

## Future Work (out of scope)

- Regenerate `packages/api-client` from `openapi.json` via `openapi-typescript`.
- Add request/response examples harvested from e2e tests.
- Publish a redoc-based static docs site to GitHub Pages.
- Arabic translations of endpoint descriptions for internal-facing docs portal.
