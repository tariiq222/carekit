# API Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document every HTTP endpoint (178) and DTO in `apps/backend` at Standard OpenAPI level, commit a reproducible `openapi.json` snapshot, and add guardrails (ESLint rule + CI check) that block future undocumented endpoints.

**Architecture:** Add shared Swagger helpers under `src/common/swagger/` (error DTO, paginated DTO, composite response decorators). Document each cluster's controllers + DTOs in parallel waves (one wave per cluster, isolated to that cluster's files). Add a local ESLint rule that errors on any HTTP-method decorator lacking `@ApiOperation`. Add a CI coverage script that regenerates `openapi.json` via the existing build-time `WRITE_OPENAPI_SPEC=1` path and asserts documentation completeness.

**Tech Stack:** NestJS 11, `@nestjs/swagger` 11.2, class-validator, ESLint flat config, Node/tsx scripts.

**Reference spec:** [docs/superpowers/specs/2026-04-17-api-documentation-design.md](../specs/2026-04-17-api-documentation-design.md)

---

## Global conventions (read before every task)

1. **English only** for all `summary`, `description`, `example` text.
2. **Tag format**: `<Audience> / <Cluster>` — closed list in the spec. Exactly one `@ApiTags` per controller.
3. **DTO changes are decorator-only**. Never rename fields, change validators, or reshape DTOs.
4. **Never rewrite handlers or controllers' business logic.** Only add imports + decorators.
5. **Route param example UUIDs** must use `'00000000-0000-0000-0000-000000000000'` as a stable placeholder.
6. **After every wave, run `cd apps/backend && npm run typecheck && npm run test -- --passWithNoTests`** — both must pass before committing.

---

## Task 0: Bootstrap — shared Swagger helpers + snapshot tooling

**Files:**
- Create: `apps/backend/src/common/swagger/api-error.dto.ts`
- Create: `apps/backend/src/common/swagger/api-paginated.dto.ts`
- Create: `apps/backend/src/common/swagger/api-standard-responses.decorator.ts`
- Create: `apps/backend/src/common/swagger/api-paginated-response.decorator.ts`
- Create: `apps/backend/src/common/swagger/index.ts`
- Modify: `apps/backend/src/main.ts` (deterministic JSON, contact/license)
- Modify: `apps/backend/package.json` (new scripts)
- Modify: `apps/backend/CLAUDE.md` (add "API Documentation" section)

- [ ] **Step 1: Write failing test for the error DTO shape**

Create `apps/backend/src/common/swagger/api-error.dto.spec.ts`:

```ts
import { ApiErrorDto } from './api-error.dto';
import { getSchemaPath } from '@nestjs/swagger';

describe('ApiErrorDto', () => {
  it('exposes exactly the fields produced by HttpExceptionFilter', () => {
    const instance = new ApiErrorDto();
    instance.statusCode = 400;
    instance.error = 'Bad Request';
    instance.message = 'validation failed';
    instance.timestamp = '2026-04-17T00:00:00.000Z';
    instance.path = '/api/v1/dashboard/bookings';
    instance.requestId = 'req-123';

    expect(Object.keys(instance).sort()).toEqual(
      ['error', 'message', 'path', 'requestId', 'statusCode', 'timestamp'].sort(),
    );
    expect(getSchemaPath(ApiErrorDto)).toContain('ApiErrorDto');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (module not found)**

```bash
cd apps/backend && npx jest src/common/swagger/api-error.dto.spec.ts
```

Expected: `Cannot find module './api-error.dto'`.

- [ ] **Step 3: Implement `api-error.dto.ts`**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Shape of every error response produced by HttpExceptionFilter.
 * Used exclusively for OpenAPI documentation — not instantiated at runtime.
 */
export class ApiErrorDto {
  @ApiProperty({ example: 400, description: 'HTTP status code' })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request', description: 'Short error category' })
  error!: string;

  @ApiProperty({
    example: 'validation failed',
    description: 'Human-readable message or array of validation messages',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message!: string | string[];

  @ApiPropertyOptional({
    example: 'req-7f9c2e1a',
    description: 'Correlation ID for log lookup',
  })
  requestId?: string;

  @ApiProperty({ example: '2026-04-17T12:34:56.000Z', description: 'ISO timestamp' })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/dashboard/bookings', description: 'Request path' })
  path!: string;
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/backend && npx jest src/common/swagger/api-error.dto.spec.ts
```

- [ ] **Step 5: Implement `api-paginated.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from '@nestjs/common';

export class PaginationMetaDto {
  @ApiProperty({ example: 42, description: 'Total matching records' })
  total!: number;

  @ApiProperty({ example: 1, description: '1-based page number' })
  page!: number;

  @ApiProperty({ example: 20, description: 'Records per page' })
  pageSize!: number;

  @ApiProperty({ example: 3, description: 'Total number of pages' })
  totalPages!: number;
}

/**
 * Generic paginated response envelope. Use via
 * `ApiPaginatedResponse(ItemDto)` from the decorator module — do not
 * extend this class directly.
 */
export class PaginatedDto<T> {
  data!: T[];
  meta!: PaginationMetaDto;
}

export type PaginatedCtor<T> = Type<PaginatedDto<T>>;
```

- [ ] **Step 6: Implement `api-standard-responses.decorator.ts`**

```ts
import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ApiErrorDto } from './api-error.dto';

/**
 * Applies the baseline error responses every protected endpoint can return:
 *   400 Bad Request   – validation failure
 *   401 Unauthorized  – missing/invalid JWT
 *   403 Forbidden     – CASL denied the action
 *   500 Internal      – unhandled error
 *
 * Endpoints that lookup a resource should additionally add their own 404.
 */
export const ApiStandardResponses = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ApiResponse({ status: 400, description: 'Validation failed', type: ApiErrorDto }),
    ApiResponse({ status: 401, description: 'Missing or invalid authentication', type: ApiErrorDto }),
    ApiResponse({ status: 403, description: 'Action denied by permission policy', type: ApiErrorDto }),
    ApiResponse({ status: 500, description: 'Unhandled server error', type: ApiErrorDto }),
  );
```

- [ ] **Step 7: Implement `api-paginated-response.decorator.ts`**

```ts
import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginationMetaDto } from './api-paginated.dto';

/**
 * Produces a typed `@ApiOkResponse` whose schema is
 *   { data: ItemDto[], meta: PaginationMetaDto }
 */
export const ApiPaginatedResponse = <TItem extends Type<unknown>>(
  item: TItem,
  description = 'Paginated result',
): ClassDecorator & MethodDecorator =>
  applyDecorators(
    ApiExtraModels(PaginationMetaDto, item),
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(item) } },
          meta: { $ref: getSchemaPath(PaginationMetaDto) },
        },
      },
    }),
  );
```

- [ ] **Step 8: Implement `index.ts` barrel**

```ts
export * from './api-error.dto';
export * from './api-paginated.dto';
export * from './api-standard-responses.decorator';
export * from './api-paginated-response.decorator';
```

- [ ] **Step 9: Update `main.ts` for deterministic snapshot + contact info**

Edit [apps/backend/src/main.ts](../../../apps/backend/src/main.ts) — replace the `DocumentBuilder` block and snapshot block:

```ts
const swaggerConfig = new DocumentBuilder()
  .setTitle('Deqah API')
  .setDescription('Deqah clinic management platform — dashboard & mobile API')
  .setVersion('2.0')
  .setContact('Deqah Engineering', 'https://deqah.dev', 'dev@deqah.dev')
  .setLicense('Proprietary', 'https://deqah.dev/license')
  .addBearerAuth()
  .addServer('http://localhost:5100', 'Local dev')
  .build();

const document = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('api/docs', app, document, {
  swaggerOptions: { persistAuthorization: true },
});

if (process.env.WRITE_OPENAPI_SPEC === '1') {
  const outPath = resolve(__dirname, '../openapi.json');
  // Recursively sort every object's keys so git diffs stay stable.
  // Note: JSON.stringify's array-replacer is a global allowlist and
  // drops nested keys — we must walk the tree ourselves.
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = sortKeys((value as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }
    return value;
  };
  const ordered = JSON.stringify(sortKeys(document), null, 2);
  writeFileSync(outPath, ordered, 'utf-8');
  Logger.log(`OpenAPI spec written to ${outPath}`, 'Bootstrap');
  await app.close();
  return;
}
```

Note: the `await app.close(); return;` lets `WRITE_OPENAPI_SPEC=1 npm run start` exit after writing the snapshot — no listening server needed.

- [ ] **Step 10: Add package.json scripts**

Edit `apps/backend/package.json` scripts block — add:

```json
"openapi:snapshot": "WRITE_OPENAPI_SPEC=1 node dist/main.js",
"openapi:build-and-snapshot": "npm run build && npm run openapi:snapshot",
"check:openapi-coverage": "tsx scripts/check-openapi-coverage.ts"
```

Keep the existing `openapi:export` (fetches from running server) as an alternative workflow.

- [ ] **Step 11: Build + generate snapshot**

```bash
cd apps/backend && npm run build && npm run openapi:snapshot
```

Expected: `openapi.json` written to `apps/backend/openapi.json`, file opens in any JSON viewer.

- [ ] **Step 12: Update `apps/backend/CLAUDE.md` with API Documentation section**

Append to the conventions section:

```markdown
## API Documentation (Standard level)

Every HTTP endpoint in `src/api/**` MUST have:

- `@ApiTags('<Audience> / <Cluster>')` on the controller — tag list is closed, see [spec](../../docs/superpowers/specs/2026-04-17-api-documentation-design.md#audience--cluster-tag-map).
- `@ApiOperation({ summary })` — English, imperative ("Create a booking").
- `@ApiStandardResponses()` from `src/common/swagger` plus endpoint-specific success/404 responses.
- `@ApiParam`/`@ApiQuery` on every route/query parameter.

Every DTO used as `@Body` or `@Query`:
- `@ApiProperty({ description, example })` on required fields.
- `@ApiPropertyOptional({ description, example })` on optional fields.

Regenerate the OpenAPI snapshot after any change:

    npm run openapi:build-and-snapshot

Commit `apps/backend/openapi.json` alongside the endpoint change — CI fails if the snapshot drifts from source.
```

- [ ] **Step 13: Commit**

```bash
cd /c/pro/deqah && git add apps/backend/src/common/swagger apps/backend/src/main.ts apps/backend/package.json apps/backend/openapi.json apps/backend/CLAUDE.md && git commit -m "feat(backend): swagger helpers + deterministic openapi snapshot"
```

---

## Tasks 1-13: Cluster documentation waves

Each wave follows the **identical template below**. Substitute `<CLUSTER>`, `<AUDIENCE>`, and the controller list per the table.

### Wave template — recipe for every cluster

**Files (per wave):**
- Modify: every controller under that cluster's scope
- Modify: every DTO imported by those controllers (from `src/modules/<cluster>/**/*.dto.ts`)
- Regenerate: `apps/backend/openapi.json`

- [ ] **Step A: Document the controller**

For **every** controller in the wave:

1. Add `@ApiTags('<Audience> / <Cluster>')` at the top (replace any existing `@ApiTags`).
2. Keep `@ApiBearerAuth()` on protected controllers.
3. On **every** method:
   - Add `@ApiOperation({ summary: '<verb + object>' })`.
   - Add `@ApiStandardResponses()` from `src/common/swagger`.
   - Add `@ApiResponse({ status: 200|201, description, type: ReturnDto })` — use `@ApiOkResponse` or `@ApiCreatedResponse` for POST.
   - For endpoints that look up a resource by id: add `@ApiResponse({ status: 404, description: '<Resource> not found', type: ApiErrorDto })`.
   - For paginated list endpoints: use `@ApiPaginatedResponse(ItemDto)` instead of `@ApiOkResponse`.
   - `@ApiParam({ name, description, example: '00000000-0000-0000-0000-000000000000' })` for every `@Param`.
   - `@ApiQuery({ name, required, description, example })` for every `@Query` scalar (for DTO-typed `@Query`, declare the DTO with `@ApiPropertyOptional` and Swagger infers).

**Concrete example** — bookings create endpoint becomes:

```ts
import { ApiCreatedResponse, ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ApiStandardResponses, ApiErrorDto } from '../../common/swagger';
import { BookingResponseDto } from '../../modules/bookings/booking-response.dto';

@ApiTags('Dashboard / Bookings')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/bookings')
export class DashboardBookingsController {
  @Post()
  @ApiOperation({ summary: 'Create a booking' })
  @ApiCreatedResponse({ description: 'Booking created', type: BookingResponseDto })
  createBooking(@UserId() userId: string, @Body() body: CreateBookingDto) { /* unchanged */ }

  @Get(':id')
  @ApiOperation({ summary: 'Get a booking by id' })
  @ApiParam({ name: 'id', description: 'Booking UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiResponse({ status: 200, description: 'Booking found', type: BookingResponseDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  getBooking(@Param('id', ParseUUIDPipe) id: string) { /* unchanged */ }
}
```

**If no response DTO exists** (handler returns a plain object), create one next to the handler (`<action>-response.dto.ts`) with `@ApiProperty` on every field. Do not change the handler's actual return value.

- [ ] **Step B: Document every DTO used by the wave's controllers**

For each DTO file (`src/modules/<cluster>/**/*.dto.ts`):

1. Import `ApiProperty`, `ApiPropertyOptional` from `@nestjs/swagger`.
2. Put `@ApiProperty({ description, example })` above every required field.
3. Put `@ApiPropertyOptional({ description, example })` above every `@IsOptional` field.
4. For enums, pass `enum: EnumType, enumName: 'EnumType'`.
5. **Do not** change validators, types, or field names.

**Concrete example** — `CreateBookingDto`:

```ts
import { BookingType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ description: 'Branch where the booking takes place', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() branchId!: string;

  @ApiProperty({ description: 'Client receiving the service', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() clientId!: string;

  @ApiProperty({ description: 'Employee delivering the service', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() employeeId!: string;

  @ApiProperty({ description: 'Service being booked', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() serviceId!: string;

  @ApiProperty({ description: 'ISO datetime when the booking starts', example: '2026-05-01T09:00:00.000Z' })
  @IsDateString() scheduledAt!: string;

  @ApiPropertyOptional({ description: 'Specific ServiceDurationOption to price against', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() durationOptionId?: string;

  @ApiPropertyOptional({ description: 'Currency code override', example: 'SAR' })
  @IsOptional() @IsString() currency?: string;

  @ApiPropertyOptional({ description: 'Booking type', enum: BookingType, enumName: 'BookingType' })
  @IsOptional() @IsEnum(BookingType) bookingType?: BookingType;

  @ApiPropertyOptional({ description: 'Free-form notes', example: 'Client prefers afternoon slots' })
  @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ description: 'Auto-expiry time for unpaid bookings', example: '2026-05-01T10:00:00.000Z' })
  @IsOptional() @IsDateString() expiresAt?: string;

  @ApiPropertyOptional({ description: 'Parent group session id', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() groupSessionId?: string;

  @ApiPropertyOptional({ description: 'True if client will pay on arrival', example: false })
  @IsOptional() @IsBoolean() payAtClinic?: boolean;

  @ApiPropertyOptional({ description: 'Promo code to apply at checkout', example: 'WELCOME10' })
  @IsOptional() @IsString() couponCode?: string;
}
```

- [ ] **Step C: Typecheck + tests**

```bash
cd apps/backend && npm run typecheck && npx jest --testPathPattern="<cluster-folder>"
```

Expected: both pass.

- [ ] **Step D: Regenerate snapshot**

```bash
cd apps/backend && npm run openapi:build-and-snapshot
```

- [ ] **Step E: Commit**

```bash
cd /c/pro/deqah && git add apps/backend/src/api/<audience>/<cluster>.controller.ts apps/backend/src/modules/<cluster> apps/backend/openapi.json && git commit -m "docs(backend): document <cluster> endpoints and dtos"
```

### Wave assignment

| # | Cluster | Tag(s) | Controller files | DTO root |
|---|---|---|---|---|
| 1 | bookings | `Dashboard / Bookings`, `Mobile Client / Bookings` | `api/dashboard/bookings.controller.ts`, `api/mobile/client/bookings.controller.ts` | `modules/bookings/**/*.dto.ts` |
| 2 | finance | `Dashboard / Finance`, `Mobile Client / Payments` | `api/dashboard/finance.controller.ts`, `api/mobile/client/payments.controller.ts` | `modules/finance/**/*.dto.ts` |
| 3 | identity | `Dashboard / Identity`, `Public / Auth` | `api/dashboard/identity.controller.ts`, `api/public/auth.controller.ts` | `modules/identity/**/*.dto.ts` |
| 4 | people | `Dashboard / People`, `Mobile Employee / Clients`, `Mobile Client / Profile` | `api/dashboard/people.controller.ts`, `api/mobile/employee/clients.controller.ts`, `api/mobile/client/profile.controller.ts` | `modules/people/**/*.dto.ts` |
| 5 | comms | `Dashboard / Comms`, `Mobile Client / Chat`, `Mobile Client / Notifications` | `api/dashboard/comms.controller.ts`, `api/mobile/client/chat.controller.ts`, `api/mobile/client/notifications.controller.ts` | `modules/comms/**/*.dto.ts` |
| 6 | org-config | `Dashboard / Org Config` | `api/dashboard/organization-branches.controller.ts`, `organization-hours.controller.ts`, `organization-categories.controller.ts`, `organization-departments.controller.ts`, `organization-settings.controller.ts` | `modules/org-config/**/*.dto.ts` |
| 7 | org-experience | `Dashboard / Org Experience`, `Public / Branding`, `Public / Catalog` | `api/dashboard/organization.controller.ts`, `api/public/branding.controller.ts`, `api/public/catalog.controller.ts` | `modules/org-experience/**/*.dto.ts` |
| 8 | ops | `Dashboard / Ops` | `api/dashboard/ops.controller.ts` | `modules/ops/**/*.dto.ts` |
| 9 | ai | `Dashboard / AI` | `api/dashboard/ai.controller.ts` | `modules/ai/**/*.dto.ts` |
| 10 | media | `Dashboard / Media` | `api/dashboard/media.controller.ts` | `modules/media/**/*.dto.ts` |
| 11 | platform | `Dashboard / Platform`, `Public / Slots` | `api/dashboard/platform.controller.ts`, `api/public/slots.controller.ts` | `modules/platform/**/*.dto.ts` |
| 12 | mobile client portal | `Mobile Client / Portal` | `api/mobile/client/portal/{home,summary,upcoming}.controller.ts` | `modules/bookings`, `modules/people` (reuse) |
| 13 | mobile employee schedule | `Mobile Employee / Schedule`, `Mobile Employee / Earnings` | `api/mobile/employee/schedule.controller.ts`, `api/mobile/employee/earnings.controller.ts` | `modules/people`, `modules/finance` (reuse) |

For waves 12 and 13 (reuse DTOs from other clusters), skip DTO edits when those DTOs were already decorated by an earlier wave.

---

## Task 14: Local ESLint rule — require `@ApiOperation`

**Files:**
- Create: `apps/backend/eslint-rules/deqah-plugin.mjs`
- Create: `apps/backend/eslint-rules/require-api-operation.mjs`
- Create: `apps/backend/eslint-rules/require-api-operation.test.mjs`
- Modify: `apps/backend/eslint.config.mjs`

- [ ] **Step 1: Write rule test**

Create `apps/backend/eslint-rules/require-api-operation.test.mjs`:

```js
import { RuleTester } from 'eslint';
import rule from './require-api-operation.mjs';

const tester = new RuleTester({
  languageOptions: { parser: await import('@typescript-eslint/parser'), ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('require-api-operation', rule, {
  valid: [
    {
      code: `
        class C {
          @Get()
          @ApiOperation({ summary: 'x' })
          foo() {}
        }
      `,
    },
    {
      code: `
        class C {
          bar() {}  // no HTTP decorator — allowed
        }
      `,
    },
  ],
  invalid: [
    {
      code: `
        class C {
          @Get()
          foo() {}
        }
      `,
      errors: [{ messageId: 'missing' }],
    },
    {
      code: `
        class C {
          @Post('/x')
          @UseGuards(X)
          foo() {}
        }
      `,
      errors: [{ messageId: 'missing' }],
    },
  ],
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/backend && node --test eslint-rules/require-api-operation.test.mjs
```

- [ ] **Step 3: Implement the rule**

Create `apps/backend/eslint-rules/require-api-operation.mjs`:

```js
const HTTP_DECORATORS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'All', 'Options', 'Head']);

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Require @ApiOperation on every NestJS HTTP handler method' },
    messages: {
      missing: 'HTTP handler is missing @ApiOperation({ summary }). Add one from @nestjs/swagger.',
    },
    schema: [],
  },
  create(context) {
    return {
      MethodDefinition(node) {
        const decorators = node.decorators ?? [];
        if (decorators.length === 0) return;

        const names = decorators
          .map((d) => {
            const expr = d.expression;
            if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier') return expr.callee.name;
            if (expr.type === 'Identifier') return expr.name;
            return null;
          })
          .filter(Boolean);

        const isHttpHandler = names.some((n) => HTTP_DECORATORS.has(n));
        if (!isHttpHandler) return;

        const hasApiOperation = names.includes('ApiOperation');
        if (!hasApiOperation) {
          context.report({ node, messageId: 'missing' });
        }
      },
    };
  },
};

export default rule;
```

- [ ] **Step 4: Create the flat-config plugin wrapper**

Create `apps/backend/eslint-rules/deqah-plugin.mjs`:

```js
import requireApiOperation from './require-api-operation.mjs';

export default {
  rules: {
    'require-api-operation': requireApiOperation,
  },
};
```

- [ ] **Step 5: Wire into `eslint.config.mjs`**

Edit `apps/backend/eslint.config.mjs` — add to the `plugins` object and the `rules` block:

```js
import deqahPlugin from './eslint-rules/deqah-plugin.mjs';
// ...
plugins: {
  '@typescript-eslint': tsPlugin,
  deqah: deqahPlugin,
},
rules: {
  // ...existing rules
  'deqah/require-api-operation': 'error',
},
```

And add this block (after the tests block) so specs/tests are exempt:

```js
{
  files: ['**/*.spec.ts', 'test/**/*.ts'],
  rules: { 'deqah/require-api-operation': 'off' },
},
```

- [ ] **Step 6: Run rule test — expect PASS**

```bash
cd apps/backend && node --test eslint-rules/require-api-operation.test.mjs
```

- [ ] **Step 7: Run full lint — expect PASS (waves 1-13 already added @ApiOperation everywhere)**

```bash
cd apps/backend && npm run lint
```

- [ ] **Step 8: Commit**

```bash
cd /c/pro/deqah && git add apps/backend/eslint-rules apps/backend/eslint.config.mjs && git commit -m "feat(backend): eslint rule require-api-operation"
```

---

## Task 15: CI coverage script

**Files:**
- Create: `apps/backend/scripts/check-openapi-coverage.ts`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Implement the coverage script**

Create `apps/backend/scripts/check-openapi-coverage.ts`:

```ts
/**
 * Fails if any endpoint in openapi.json lacks summary / error responses,
 * or if any referenced schema has an undocumented property.
 *
 * Usage:
 *   cd apps/backend && npm run check:openapi-coverage
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface OpenApi {
  paths: Record<string, Record<string, { summary?: string; responses?: Record<string, unknown>; tags?: string[] }>>;
  components?: { schemas?: Record<string, { properties?: Record<string, { description?: string; example?: unknown }> }> };
}

const specPath = resolve(__dirname, '../openapi.json');
const spec = JSON.parse(readFileSync(specPath, 'utf-8')) as OpenApi;

const problems: string[] = [];

for (const [route, methods] of Object.entries(spec.paths ?? {})) {
  for (const [method, op] of Object.entries(methods)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
    const id = `${method.toUpperCase()} ${route}`;
    if (!op.summary) problems.push(`${id} — missing summary`);
    if (!op.tags || op.tags.length === 0) problems.push(`${id} — missing tag`);
    const responses = op.responses ?? {};
    const hasErrorResponse = Object.keys(responses).some((code) => code.startsWith('4') || code.startsWith('5'));
    if (!hasErrorResponse) problems.push(`${id} — no 4xx/5xx response documented`);
  }
}

for (const [schemaName, schema] of Object.entries(spec.components?.schemas ?? {})) {
  for (const [prop, propSchema] of Object.entries(schema.properties ?? {})) {
    if (!propSchema.description && propSchema.example === undefined) {
      problems.push(`schema ${schemaName}.${prop} — missing description and example`);
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ OpenAPI coverage check failed — ${problems.length} gap(s):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

console.log(`✓ OpenAPI coverage passes (${Object.keys(spec.paths ?? {}).length} routes checked)`);
```

- [ ] **Step 2: Run it against the current snapshot — expect PASS**

```bash
cd apps/backend && npm run check:openapi-coverage
```

If it fails, the failing list points directly to the undocumented endpoints/fields. Go back to the relevant wave, fix, regenerate snapshot, retry.

- [ ] **Step 3: Add CI job**

Edit `.github/workflows/ci.yml` — add a new job (read the existing file first, slot alongside the existing backend job):

```yaml
  api-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Build backend
        run: npm run build --workspace=apps/backend
      - name: Regenerate openapi.json
        run: npm run openapi:snapshot --workspace=apps/backend
      - name: Fail if snapshot drifted
        run: git diff --exit-code apps/backend/openapi.json
      - name: Coverage check
        run: npm run check:openapi-coverage --workspace=apps/backend
```

- [ ] **Step 4: Commit**

```bash
cd /c/pro/deqah && git add apps/backend/scripts/check-openapi-coverage.ts .github/workflows/ci.yml && git commit -m "ci(backend): openapi coverage + snapshot drift checks"
```

---

## Task 16: Manual verification via Chrome DevTools MCP

**Files:** none — this is a verification-only task per the project's QA gate.

- [ ] **Step 1: Start the backend**

```bash
cd apps/backend && npm run dev
```

- [ ] **Step 2: Open `/api/docs` in the browser via DevTools MCP**

Navigate to `http://localhost:5100/api/docs`.

- [ ] **Step 3: Verify the checklist**

- Tags listed in the order defined in the spec's closed tag list.
- Expand three random endpoints from three different tags — each shows `summary`, parameter docs, and at least one success + one error response.
- `Try it out` on a public endpoint (e.g., `Public / Branding`) still returns a valid response.
- DTOs in the `Schemas` section show field descriptions and examples.

- [ ] **Step 4: If any gap found**

Go back to the responsible wave, fix the decorator, regenerate snapshot, re-run lint + coverage script, re-verify.

---

## Task 17: Final verification + handoff

- [ ] **Step 1: Green build end-to-end**

```bash
cd apps/backend && npm run lint && npm run typecheck && npm run test && npm run check:openapi-coverage
```

All four must pass.

- [ ] **Step 2: Confirm acceptance criteria from the spec**

Open [the spec's Acceptance Criteria section](../specs/2026-04-17-api-documentation-design.md#acceptance-criteria) and tick each item.

- [ ] **Step 3: Final commit if anything remains**

```bash
cd /c/pro/deqah && git status
```

Should be clean.

---

## Self-review (addressed inline before publication)

- **Spec coverage**: every acceptance-criteria item maps to a task (Task 0 → helpers + CLAUDE.md; Tasks 1-13 → decorators; Task 14 → ESLint; Task 15 → CI + snapshot guard; Task 16 → manual QA; Task 17 → final green build).
- **Placeholders**: none — wave template is fully spelled out with a concrete bookings example and reused by every cluster.
- **Type consistency**: `ApiErrorDto`, `ApiStandardResponses`, `ApiPaginatedResponse`, `PaginationMetaDto` names are used consistently across Tasks 0, 1-13, and 15.
- **Snapshot path**: consistently `apps/backend/openapi.json` everywhere.
- **Tag names**: controller tag strings match the closed list in the spec across wave table and examples.
