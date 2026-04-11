# OpenAPI Full Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete OpenAPI documentation to all 40 controllers (256 endpoints) and 117 DTOs — `@ApiOperation` on every endpoint, `@ApiResponse` on every endpoint, `@ApiProperty`/`@ApiPropertyOptional` on every DTO field.

**Architecture:** Pure documentation layer — zero runtime behavior changes. Controllers get `@ApiOperation` + `@ApiResponse` decorators. DTOs get `@ApiProperty`/`@ApiPropertyOptional`. A shared `swagger.config.ts` centralizes Swagger setup and provides reusable response decorators to reduce repetition. Tests are not affected (decorators are metadata only).

**Tech Stack:** `@nestjs/swagger` (already installed), NestJS 11, TypeScript strict mode.

---

## File Map

### New files (Phase 1)
- `backend/src/common/swagger/swagger.config.ts` — DocumentBuilder config + `SwaggerModule.setup` call, exported as `setupSwagger(app)`
- `backend/src/common/swagger/api-responses.decorator.ts` — Composable response decorators: `@ApiStandardResponses()`, `@ApiPaginatedResponse()`, `@ApiPublicResponse()`

### Modified files — Controllers (Phases 2–3, one commit per domain group)
All 40 `.controller.ts` files: add `@ApiOperation` + `@ApiResponse` per endpoint.

### Modified files — DTOs (Phase 4, one commit per domain group)
65 `.dto.ts` files missing `@ApiProperty`: add per field.

### Modified file — main.ts (Phase 1)
Replace inline DocumentBuilder block with `setupSwagger(app)` call.

---

## Task 1: Shared Swagger Infrastructure

**Files:**
- Create: `backend/src/common/swagger/swagger.config.ts`
- Create: `backend/src/common/swagger/api-responses.decorator.ts`
- Modify: `backend/src/main.ts`

- [ ] **Step 1: Create `swagger.config.ts`**

```typescript
// backend/src/common/swagger/swagger.config.ts
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('CareKit API')
    .setDescription('CareKit Clinic Management Platform — White-label API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication and session management')
    .addTag('Users', 'Staff user management')
    .addTag('Roles', 'Custom role definitions')
    .addTag('Permissions', 'Permission catalog (read-only)')
    .addTag('Clients', 'Client profiles and walk-in registration')
    .addTag('Employees', 'Employee profiles, availability, and services')
    .addTag('Favorite Employees', 'Client favourite employees')
    .addTag('Specialties', 'Medical specialties catalog')
    .addTag('Services', 'Clinic service catalog')
    .addTag('Branches', 'Multi-branch management (requires multi_branch feature)')
    .addTag('Departments', 'Department management (requires departments feature)')
    .addTag('Bookings', 'Appointment booking lifecycle')
    .addTag('Booking Settings', 'Booking flow configuration')
    .addTag('Waitlist', 'Booking waitlist management')
    .addTag('Payments', 'Payment processing — Moyasar and bank transfer')
    .addTag('Invoices', 'Invoice generation and delivery')
    .addTag('Coupons', 'Discount coupons (requires coupons feature)')
    .addTag('Gift Cards', 'Gift card management (requires gift_cards feature)')
    .addTag('Groups', 'Group session management (requires groups feature)')
    .addTag('Intake Forms', 'Pre-appointment intake forms (requires intake_forms feature)')
    .addTag('Ratings', 'Employee ratings (requires ratings feature)')
    .addTag('Notifications', 'In-app and push notifications')
    .addTag('Chatbot', 'AI chatbot sessions and knowledge base (requires chatbot feature)')
    .addTag('Activity Log', 'Audit trail of system events')
    .addTag('Problem Reports', 'User-submitted booking issue reports')
    .addTag('Reports', 'Revenue and activity reports (requires reports feature)')
    .addTag('Clinic', 'Working hours and holiday management')
    .addTag('Clinic Settings', 'Clinic identity and policy configuration')
    .addTag('Clinic Integrations', 'Third-party API credential management')
    .addTag('Whitelabel', 'Branding and white-label configuration')
    .addTag('Email Templates', 'Transactional email template management')
    .addTag('Feature Flags', 'Feature toggle management')
    .addTag('License', 'License and feature entitlement management')
    .addTag('ZATCA', 'Saudi e-invoicing compliance (Phase 2)')
    .addTag('Health', 'Service health check')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
```

- [ ] **Step 2: Create `api-responses.decorator.ts`**

```typescript
// backend/src/common/swagger/api-responses.decorator.ts
import { applyDecorators } from '@nestjs/common';
import {
  ApiResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

/** Standard error responses applied to all protected endpoints */
export function ApiStandardResponses() {
  return applyDecorators(
    ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' }),
    ApiForbiddenResponse({ description: 'Insufficient permissions' }),
    ApiBadRequestResponse({ description: 'Validation error in request body or params' }),
  );
}

/** For endpoints that can 404 */
export function ApiNotFoundResponse404(entity: string) {
  return ApiNotFoundResponse({ description: `${entity} not found` });
}

/** For public endpoints (no auth errors) */
export function ApiPublicResponse() {
  return applyDecorators(
    ApiBadRequestResponse({ description: 'Validation error' }),
  );
}
```

- [ ] **Step 3: Update `main.ts` to use `setupSwagger`**

Replace lines 99–109 in `backend/src/main.ts`:

```typescript
// Before (lines 99-109):
  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('CareKit API')
      .setDescription('CareKit Clinic Management Platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }
```

```typescript
// After:
  if (enableSwagger) {
    const { setupSwagger } = await import('./common/swagger/swagger.config.js');
    setupSwagger(app);
  }
```

Also remove the `DocumentBuilder, SwaggerModule` import from the top of `main.ts` (line 3) since they are no longer used directly.

- [ ] **Step 4: Run lint + typecheck**

```bash
cd backend && npm run lint && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/common/swagger/swagger.config.ts src/common/swagger/api-responses.decorator.ts src/main.ts
git commit -m "docs(backend): add centralized Swagger config and shared response decorators"
```

---

## Task 2: `@ApiOperation` + `@ApiResponse` — Settings & Config Controllers

Controllers: `whitelabel`, `organization-settings`, `clinic-integrations`, `business-hours`, `clinic-holidays`, `booking-settings`, `booking-status-log`, `feature-flags`, `license`

**Files:**
- Modify: `backend/src/modules/whitelabel/whitelabel.controller.ts`
- Modify: `backend/src/modules/organization-settings/organization-settings.controller.ts`
- Modify: `backend/src/modules/clinic-integrations/clinic-integrations.controller.ts`
- Modify: `backend/src/modules/clinic/business-hours.controller.ts`
- Modify: `backend/src/modules/clinic/clinic-holidays.controller.ts`
- Modify: `backend/src/modules/bookings/booking-settings.controller.ts`
- Modify: `backend/src/modules/bookings/booking-status-log.controller.ts`
- Modify: `backend/src/modules/feature-flags/feature-flags.controller.ts`
- Modify: `backend/src/modules/license/license.controller.ts`

- [ ] **Step 1: Update `whitelabel.controller.ts`**

Add imports at top (after existing swagger imports):
```typescript
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

Add decorators to each method:
```typescript
  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Get public branding configuration' })
  @ApiResponse({ status: 200, description: 'Branding config returned' })
  getPublicBranding() { ... }

  @Get()
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  @ApiOperation({ summary: 'Get full whitelabel configuration' })
  @ApiResponse({ status: 200, description: 'Full whitelabel config returned' })
  @ApiStandardResponses()
  get() { ... }

  @Put()
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  @ApiOperation({ summary: 'Update whitelabel configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated' })
  @ApiStandardResponses()
  update(@Body() dto: UpdateWhitelabelDto) { ... }
```

- [ ] **Step 2: Update `organization-settings.controller.ts`**

```typescript
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Get public clinic information' })
  @ApiResponse({ status: 200, description: 'Public clinic info returned' })
  getPublic() { ... }

  @Get()
  @CheckPermissions({ module: 'organization-settings', action: 'view' })
  @ApiOperation({ summary: 'Get full clinic settings' })
  @ApiResponse({ status: 200, description: 'Clinic settings returned' })
  @ApiStandardResponses()
  get() { ... }

  @Put()
  @CheckPermissions({ module: 'organization-settings', action: 'edit' })
  @ApiOperation({ summary: 'Update clinic settings' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  @ApiStandardResponses()
  update(@Body() dto: UpdateOrganizationSettingsDto) { ... }
```

- [ ] **Step 3: Update `clinic-integrations.controller.ts`**

```typescript
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get()
  @CheckPermissions({ module: 'clinic-integrations', action: 'view' })
  @ApiOperation({ summary: 'Get integration credentials (sensitive fields masked)' })
  @ApiResponse({ status: 200, description: 'Masked integration credentials returned' })
  @ApiStandardResponses()
  get() { ... }

  @Put()
  @CheckPermissions({ module: 'clinic-integrations', action: 'edit' })
  @ApiOperation({ summary: 'Update integration credentials' })
  @ApiResponse({ status: 200, description: 'Credentials updated' })
  @ApiStandardResponses()
  update(@Body() dto: UpdateClinicIntegrationsDto) { ... }
```

- [ ] **Step 4: Update `business-hours.controller.ts`**

```typescript
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get()
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  @ApiOperation({ summary: 'Get clinic working hours for all days' })
  @ApiResponse({ status: 200, description: 'Working hours returned' })
  @ApiStandardResponses()
  async getAll() { ... }

  @Put()
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  @ApiOperation({ summary: 'Set clinic working hours (replaces all)' })
  @ApiResponse({ status: 200, description: 'Working hours updated' })
  @ApiStandardResponses()
  async setHours(@Body() dto: SetWorkingHoursDto) { ... }
```

- [ ] **Step 5: Update `clinic-holidays.controller.ts`**

```typescript
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get()
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  @ApiOperation({ summary: 'List clinic holidays, optionally filtered by year' })
  @ApiQuery({ name: 'year', required: false, description: 'Filter by year (e.g. 2026)' })
  @ApiResponse({ status: 200, description: 'Holiday list returned' })
  @ApiStandardResponses()
  async findAll(@Query('year') year?: string) { ... }

  @Post()
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  @ApiOperation({ summary: 'Add a clinic holiday' })
  @ApiResponse({ status: 201, description: 'Holiday created' })
  @ApiStandardResponses()
  async create(@Body() dto: CreateHolidayDto) { ... }

  @Delete(':id')
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  @ApiOperation({ summary: 'Delete a clinic holiday' })
  @ApiParam({ name: 'id', description: 'Holiday ID' })
  @ApiResponse({ status: 200, description: 'Holiday deleted' })
  @ApiStandardResponses()
  async remove(@Param('id') id: string) { ... }
```

- [ ] **Step 6: Update `booking-settings.controller.ts`**

```typescript
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get()
  @CheckPermissions({ module: 'bookings', action: 'view' })
  @ApiOperation({ summary: 'Get booking flow configuration' })
  @ApiResponse({ status: 200, description: 'Booking settings returned' })
  @ApiStandardResponses()
  async get() { ... }

  @Patch()
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  @ApiOperation({ summary: 'Update booking flow configuration' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  @ApiStandardResponses()
  async update(@Body() dto: UpdateBookingSettingsDto) { ... }
```

- [ ] **Step 7: Update `booking-status-log.controller.ts`**

```typescript
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get(':id/status-log')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  @ApiOperation({ summary: 'Get booking status change audit trail' })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiResponse({ status: 200, description: 'Status log entries returned' })
  @ApiStandardResponses()
  async getStatusLog(@Param('id', uuidPipe) id: string) { ... }
```

- [ ] **Step 8: Update `feature-flags.controller.ts`**

```typescript
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get()
  @CheckPermissions({ module: 'feature-flags', action: 'view' })
  @ApiOperation({ summary: 'List all feature flags with their current status' })
  @ApiResponse({ status: 200, description: 'Feature flags returned' })
  @ApiStandardResponses()
  findAll() { ... }

  @Get('map')
  @Public()
  @ApiOperation({ summary: 'Get feature flag map as key-value pairs (cached, public)' })
  @ApiResponse({ status: 200, description: 'Feature flag map returned' })
  getMap() { ... }

  @Patch(':key')
  @CheckPermissions({ module: 'feature-flags', action: 'edit' })
  @ApiOperation({ summary: 'Enable or disable a feature flag' })
  @ApiParam({ name: 'key', description: 'Feature flag key (e.g. multi_branch)' })
  @ApiResponse({ status: 200, description: 'Flag updated' })
  @ApiStandardResponses()
  toggle(@Param('key') key: string, @Body() dto: ToggleFeatureFlagDto) { ... }
```

- [ ] **Step 9: Update `license.controller.ts`**

```typescript
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get()
  @CheckPermissions({ module: 'license', action: 'view' })
  @ApiOperation({ summary: 'Get current license configuration' })
  @ApiResponse({ status: 200, description: 'License config returned' })
  @ApiStandardResponses()
  get() { ... }

  @Put()
  @CheckPermissions({ module: 'license', action: 'edit' })
  @ApiOperation({ summary: 'Update license feature entitlements' })
  @ApiResponse({ status: 200, description: 'License updated' })
  @ApiStandardResponses()
  update(@Body() dto: UpdateLicenseDto) { ... }

  @Get('features')
  @CheckPermissions({ module: 'license', action: 'view' })
  @ApiOperation({ summary: 'Get enabled features derived from current license' })
  @ApiResponse({ status: 200, description: 'Feature status list returned' })
  @ApiStandardResponses()
  getFeatures() { ... }
```

- [ ] **Step 10: Run lint + typecheck**

```bash
cd backend && npm run lint && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
cd backend
git add \
  src/modules/whitelabel/whitelabel.controller.ts \
  src/modules/organization-settings/organization-settings.controller.ts \
  src/modules/clinic-integrations/clinic-integrations.controller.ts \
  src/modules/clinic/business-hours.controller.ts \
  src/modules/clinic/clinic-holidays.controller.ts \
  src/modules/bookings/booking-settings.controller.ts \
  src/modules/bookings/booking-status-log.controller.ts \
  src/modules/feature-flags/feature-flags.controller.ts \
  src/modules/license/license.controller.ts
git commit -m "docs(backend/settings): add @ApiOperation + @ApiResponse to settings/config controllers"
```

---

## Task 3: `@ApiOperation` + `@ApiResponse` — Notifications, Email Templates, Waitlist, Permissions, Health

**Files:**
- Modify: `backend/src/modules/notifications/notifications.controller.ts`
- Modify: `backend/src/modules/email-templates/email-templates.controller.ts`
- Modify: `backend/src/modules/bookings/waitlist.controller.ts`
- Modify: `backend/src/modules/permissions/permissions.controller.ts`
- Modify: `backend/src/modules/health/health.controller.ts`

- [ ] **Step 1: Update `notifications.controller.ts`**

Add imports:
```typescript
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get()
  @ApiOperation({ summary: "List current user's notifications (paginated)" })
  @ApiResponse({ status: 200, description: 'Notification list returned' })
  @ApiStandardResponses()
  async findAll(...) { ... }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get count of unread notifications' })
  @ApiResponse({ status: 200, description: 'Unread count returned', schema: { properties: { count: { type: 'number' } } } })
  @ApiStandardResponses()
  async getUnreadCount(...) { ... }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  @ApiStandardResponses()
  async markAllAsRead(...) { ... }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiStandardResponses()
  async markAsRead(...) { ... }

  @Post('fcm-token')
  @ApiOperation({ summary: 'Register a Firebase FCM push notification token' })
  @ApiResponse({ status: 201, description: 'Token registered' })
  @ApiStandardResponses()
  async registerFcmToken(...) { ... }

  @Delete('fcm-token')
  @ApiOperation({ summary: 'Unregister a Firebase FCM push notification token' })
  @ApiResponse({ status: 200, description: 'Token unregistered' })
  @ApiStandardResponses()
  async unregisterFcmToken(...) { ... }
```

- [ ] **Step 2: Update `email-templates.controller.ts`**

Add imports:
```typescript
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get()
  @ApiOperation({ summary: 'List all email templates' })
  @ApiResponse({ status: 200, description: 'Template list returned' })
  @ApiStandardResponses()
  async findAll() { ... }

  @Get(':slug')
  @ApiOperation({ summary: 'Get email template by slug' })
  @ApiParam({ name: 'slug', description: 'Template slug (e.g. booking-confirmed)' })
  @ApiResponse({ status: 200, description: 'Template returned' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @ApiStandardResponses()
  async findBySlug(@Param('slug') slug: string) { ... }

  @Patch(':id')
  @ApiOperation({ summary: 'Update email template content' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template updated' })
  @ApiStandardResponses()
  async update(...) { ... }

  @Post(':slug/preview')
  @ApiOperation({ summary: 'Preview rendered email template with sample context' })
  @ApiParam({ name: 'slug', description: 'Template slug' })
  @ApiResponse({ status: 201, description: 'Rendered HTML returned' })
  @ApiStandardResponses()
  async preview(...) { ... }
```

- [ ] **Step 3: Update `waitlist.controller.ts`**

Add imports:
```typescript
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get('my')
  @ApiOperation({ summary: "List current client's waitlist entries" })
  @ApiResponse({ status: 200, description: 'Waitlist entries returned' })
  @ApiStandardResponses()
  async findMyEntries(...) { ... }

  @Get()
  @ApiOperation({ summary: 'List all waitlist entries (admin view, with filters)' })
  @ApiQuery({ name: 'employeeId', required: false, description: 'Filter by employee UUID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiResponse({ status: 200, description: 'Waitlist returned' })
  @ApiStandardResponses()
  async findAll(...) { ... }

  @Post()
  @ApiOperation({ summary: 'Join the waitlist for a employee' })
  @ApiResponse({ status: 201, description: 'Added to waitlist' })
  @ApiStandardResponses()
  async join(...) { ... }

  @Delete(':id')
  @ApiOperation({ summary: 'Leave the waitlist (remove entry)' })
  @ApiParam({ name: 'id', description: 'Waitlist entry UUID' })
  @ApiResponse({ status: 200, description: 'Removed from waitlist' })
  @ApiStandardResponses()
  async leave(...) { ... }
```

- [ ] **Step 4: Update `permissions.controller.ts`**

Add imports:
```typescript
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get()
  @ApiOperation({ summary: 'List all available system permissions (read-only catalog)' })
  @ApiResponse({ status: 200, description: 'Permission list returned' })
  @ApiStandardResponses()
  async findAll() { ... }
```

- [ ] **Step 5: Update `health.controller.ts`**

Add imports:
```typescript
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
```

Add `@ApiTags('Health')` to the class and:
```typescript
  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Check service health (database, Redis, MinIO)' })
  @ApiResponse({ status: 200, description: 'All services healthy' })
  @ApiResponse({ status: 503, description: 'One or more services degraded' })
  async check(): Promise<HealthCheckResult> { ... }
```

- [ ] **Step 6: Run lint + typecheck**

```bash
cd backend && npm run lint && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd backend
git add \
  src/modules/notifications/notifications.controller.ts \
  src/modules/email-templates/email-templates.controller.ts \
  src/modules/bookings/waitlist.controller.ts \
  src/modules/permissions/permissions.controller.ts \
  src/modules/health/health.controller.ts
git commit -m "docs(backend/notifications): add @ApiOperation + @ApiResponse to notifications, email-templates, waitlist, permissions, health"
```

---

## Task 4: `@ApiOperation` + `@ApiResponse` — Employees & Specialties

**Files:**
- Modify: `backend/src/modules/employees/employees.controller.ts`
- Modify: `backend/src/modules/employees/favorite-employees.controller.ts`
- Modify: `backend/src/modules/specialties/specialties.controller.ts`

- [ ] **Step 1: Update `employees.controller.ts`**

Add imports:
```typescript
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

Add to each method (full list):
```typescript
  @Get()
  @Public()
  @ApiOperation({ summary: 'List employees with filters (public)' })
  @ApiResponse({ status: 200, description: 'Employee list returned' })

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get employee profile (public)' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Employee returned' })
  @ApiResponse({ status: 404, description: 'Employee not found' })

  @Post()
  @ApiOperation({ summary: 'Create a employee profile' })
  @ApiResponse({ status: 201, description: 'Employee created' })
  @ApiStandardResponses()

  @Post('onboard')
  @ApiOperation({ summary: 'Onboard employee with user account creation' })
  @ApiResponse({ status: 201, description: 'Employee onboarded' })
  @ApiStandardResponses()

  @Patch(':id')
  @ApiOperation({ summary: 'Update employee profile' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Employee updated' })
  @ApiStandardResponses()

  @Delete(':id')
  @ApiOperation({ summary: 'Delete employee (soft delete)' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Employee deleted' })
  @ApiStandardResponses()

  @Get(':id/availability')
  @Public()
  @ApiOperation({ summary: 'Get employee availability schedule (public)' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Availability schedule returned' })

  @Put(':id/availability')
  @ApiOperation({ summary: 'Set employee availability schedule' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Availability updated' })
  @ApiStandardResponses()

  @Get(':id/slots')
  @Public()
  @ApiOperation({ summary: 'Get available booking time slots for a date (public)' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Available slots returned' })

  @Get(':id/available-dates')
  @Public()
  @ApiOperation({ summary: 'Get available dates in a month (public)' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Available dates returned' })

  @Get(':id/breaks')
  @ApiOperation({ summary: 'Get employee break schedule' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Breaks returned' })
  @ApiStandardResponses()

  @Put(':id/breaks')
  @ApiOperation({ summary: 'Set employee break schedule' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Breaks updated' })
  @ApiStandardResponses()

  @Get(':id/vacations')
  @ApiOperation({ summary: 'Get employee vacation periods' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Vacations returned' })
  @ApiStandardResponses()

  @Post(':id/vacations')
  @ApiOperation({ summary: 'Create a vacation period for employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 201, description: 'Vacation created' })
  @ApiStandardResponses()

  @Delete(':id/vacations/:vacationId')
  @ApiOperation({ summary: 'Delete a employee vacation period' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiParam({ name: 'vacationId', description: 'Vacation UUID' })
  @ApiResponse({ status: 200, description: 'Vacation deleted' })
  @ApiStandardResponses()

  @Get(':id/services')
  @Public()
  @ApiOperation({ summary: 'List services offered by employee with pricing (public)' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Services returned' })

  @Post(':id/services')
  @ApiOperation({ summary: 'Assign a service to employee with pricing override' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 201, description: 'Service assigned' })
  @ApiStandardResponses()

  @Patch(':id/services/:serviceId')
  @ApiOperation({ summary: 'Update employee service pricing' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service pricing updated' })
  @ApiStandardResponses()

  @Delete(':id/services/:serviceId')
  @ApiOperation({ summary: 'Remove a service from employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service removed' })
  @ApiStandardResponses()

  @Get(':id/services/:serviceId/types')
  @Public()
  @ApiOperation({ summary: 'Get service types and duration options for booking (public)' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service types returned' })

  @Get(':id/ratings')
  @Public()
  @ApiOperation({ summary: 'Get aggregated ratings for a employee (public, paginated)' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Ratings returned' })
```

- [ ] **Step 2: Update `favorite-employees.controller.ts`**

Add imports:
```typescript
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get('favorites')
  @ApiOperation({ summary: "List current client's favourite employees" })
  @ApiResponse({ status: 200, description: 'Favourites returned' })
  @ApiStandardResponses()

  @Post(':id/favorite')
  @ApiOperation({ summary: 'Add a employee to favourites' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 201, description: 'Added to favourites' })
  @ApiStandardResponses()

  @Delete(':id/favorite')
  @ApiOperation({ summary: 'Remove a employee from favourites' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Removed from favourites' })
  @ApiStandardResponses()
```

- [ ] **Step 3: Update `specialties.controller.ts`**

Add imports:
```typescript
import { ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

Add `@ApiBearerAuth()` to the class (currently missing).

```typescript
  @Get()
  @Public()
  @ApiOperation({ summary: 'List all specialties (public)' })
  @ApiResponse({ status: 200, description: 'Specialty list returned' })

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get specialty detail (public)' })
  @ApiParam({ name: 'id', description: 'Specialty UUID' })
  @ApiResponse({ status: 200, description: 'Specialty returned' })
  @ApiResponse({ status: 404, description: 'Specialty not found' })

  @Post()
  @ApiOperation({ summary: 'Create a specialty' })
  @ApiResponse({ status: 201, description: 'Specialty created' })
  @ApiStandardResponses()

  @Patch(':id')
  @ApiOperation({ summary: 'Update a specialty' })
  @ApiParam({ name: 'id', description: 'Specialty UUID' })
  @ApiResponse({ status: 200, description: 'Specialty updated' })
  @ApiStandardResponses()

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a specialty' })
  @ApiParam({ name: 'id', description: 'Specialty UUID' })
  @ApiResponse({ status: 200, description: 'Specialty deleted' })
  @ApiStandardResponses()
```

- [ ] **Step 4: Run lint + typecheck**

```bash
cd backend && npm run lint && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd backend
git add \
  src/modules/employees/employees.controller.ts \
  src/modules/employees/favorite-employees.controller.ts \
  src/modules/specialties/specialties.controller.ts
git commit -m "docs(backend/employees): add @ApiOperation + @ApiResponse to employees and specialties controllers"
```

---

## Task 5: `@ApiOperation` + `@ApiResponse` — Branches, Users

**Files:**
- Modify: `backend/src/modules/branches/branches.controller.ts`
- Modify: `backend/src/modules/users/users.controller.ts`

- [ ] **Step 1: Update `branches.controller.ts`**

Add imports:
```typescript
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get('public')
  @Public()
  @ApiOperation({ summary: 'List public branches (public, requires multi_branch feature)' })
  @ApiResponse({ status: 200, description: 'Branch list returned' })

  @Get()
  @ApiOperation({ summary: 'List branches with filters' })
  @ApiResponse({ status: 200, description: 'Branch list returned' })
  @ApiStandardResponses()

  @Get(':id')
  @ApiOperation({ summary: 'Get branch detail' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Branch returned' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  @ApiStandardResponses()

  @Post()
  @ApiOperation({ summary: 'Create a branch' })
  @ApiResponse({ status: 201, description: 'Branch created' })
  @ApiStandardResponses()

  @Patch(':id')
  @ApiOperation({ summary: 'Update a branch' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Branch updated' })
  @ApiStandardResponses()

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a branch' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Branch deleted' })
  @ApiStandardResponses()

  @Get(':id/employees')
  @ApiOperation({ summary: 'Get employees assigned to a branch' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Employee list returned' })
  @ApiStandardResponses()

  @Patch(':id/employees')
  @ApiOperation({ summary: 'Assign employees to a branch (replaces existing)' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Assignments updated' })
  @ApiStandardResponses()

  @Delete(':id/employees/:employeeId')
  @ApiOperation({ summary: 'Remove a employee from a branch' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Employee removed from branch' })
  @ApiStandardResponses()
```

- [ ] **Step 2: Update `users.controller.ts`**

Add imports:
```typescript
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get()
  @ApiOperation({ summary: 'List staff users with filters and pagination' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'perPage', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false, description: 'Filter by role slug' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status (true/false)' })
  @ApiResponse({ status: 200, description: 'User list returned' })
  @ApiStandardResponses()

  @Get(':id')
  @ApiOperation({ summary: 'Get staff user detail' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User returned' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiStandardResponses()

  @Post()
  @ApiOperation({ summary: 'Create a staff user account' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiStandardResponses()

  @Patch(':id')
  @ApiOperation({ summary: 'Update a staff user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiStandardResponses()

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a staff user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiStandardResponses()

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a deactivated staff user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User activated' })
  @ApiStandardResponses()

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a staff user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deactivated' })
  @ApiStandardResponses()

  @Post(':id/roles')
  @ApiOperation({ summary: 'Assign a role to a staff user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Role assigned' })
  @ApiStandardResponses()

  @Delete(':id/roles/:roleId')
  @ApiOperation({ summary: 'Remove a role from a staff user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiParam({ name: 'roleId', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role removed' })
  @ApiStandardResponses()
```

- [ ] **Step 3: Run lint + typecheck**

```bash
cd backend && npm run lint && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd backend
git add \
  src/modules/branches/branches.controller.ts \
  src/modules/users/users.controller.ts
git commit -m "docs(backend/users): add @ApiOperation + @ApiResponse to branches and users controllers"
```

---

## Task 6: `@ApiOperation` + `@ApiResponse` — Intake Forms, Coupons, Gift Cards

**Files:**
- Modify: `backend/src/modules/intake-forms/intake-forms.controller.ts`
- Modify: `backend/src/modules/coupons/coupons.controller.ts`
- Modify: `backend/src/modules/gift-cards/gift-cards.controller.ts`

- [ ] **Step 1: Update `intake-forms.controller.ts`**

Add imports:
```typescript
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get()
  @ApiOperation({ summary: 'List intake forms (requires intake_forms feature)' })
  @ApiResponse({ status: 200, description: 'Form list returned' })
  @ApiStandardResponses()

  @Get(':formId')
  @ApiOperation({ summary: 'Get intake form detail' })
  @ApiParam({ name: 'formId', description: 'Form UUID' })
  @ApiResponse({ status: 200, description: 'Form returned' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  @ApiStandardResponses()

  @Post()
  @ApiOperation({ summary: 'Create an intake form' })
  @ApiResponse({ status: 201, description: 'Form created' })
  @ApiStandardResponses()

  @Patch(':formId')
  @ApiOperation({ summary: 'Update an intake form' })
  @ApiParam({ name: 'formId', description: 'Form UUID' })
  @ApiResponse({ status: 200, description: 'Form updated' })
  @ApiStandardResponses()

  @Delete(':formId')
  @ApiOperation({ summary: 'Delete an intake form' })
  @ApiParam({ name: 'formId', description: 'Form UUID' })
  @ApiResponse({ status: 200, description: 'Form deleted' })
  @ApiStandardResponses()

  @Put(':formId/fields')
  @ApiOperation({ summary: 'Set intake form fields (replaces existing)' })
  @ApiParam({ name: 'formId', description: 'Form UUID' })
  @ApiResponse({ status: 200, description: 'Fields updated' })
  @ApiStandardResponses()

  @Post(':formId/responses')
  @ApiOperation({ summary: 'Submit a response to an intake form' })
  @ApiParam({ name: 'formId', description: 'Form UUID' })
  @ApiResponse({ status: 201, description: 'Response submitted' })
  @ApiStandardResponses()

  @Get('responses/:bookingId')
  @ApiOperation({ summary: 'Get intake form responses for a booking' })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID' })
  @ApiResponse({ status: 200, description: 'Responses returned' })
  @ApiStandardResponses()
```

- [ ] **Step 2: Update `coupons.controller.ts`**

Add imports:
```typescript
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get()
  @ApiOperation({ summary: 'List coupons with filters (requires coupons feature)' })
  @ApiResponse({ status: 200, description: 'Coupon list returned' })
  @ApiStandardResponses()

  @Get(':id')
  @ApiOperation({ summary: 'Get coupon detail' })
  @ApiParam({ name: 'id', description: 'Coupon UUID' })
  @ApiResponse({ status: 200, description: 'Coupon returned' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  @ApiStandardResponses()

  @Post()
  @ApiOperation({ summary: 'Create a coupon' })
  @ApiResponse({ status: 201, description: 'Coupon created' })
  @ApiStandardResponses()

  @Patch(':id')
  @ApiOperation({ summary: 'Update a coupon' })
  @ApiParam({ name: 'id', description: 'Coupon UUID' })
  @ApiResponse({ status: 200, description: 'Coupon updated' })
  @ApiStandardResponses()

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a coupon' })
  @ApiParam({ name: 'id', description: 'Coupon UUID' })
  @ApiResponse({ status: 200, description: 'Coupon deleted' })
  @ApiStandardResponses()

  @Post('apply')
  @ApiOperation({ summary: 'Apply a coupon code to a booking' })
  @ApiResponse({ status: 201, description: 'Coupon applied, discount amount returned' })
  @ApiStandardResponses()

  @Post('validate')
  @ApiOperation({ summary: 'Validate a coupon code (does not apply)' })
  @ApiResponse({ status: 200, description: 'Validation result returned' })
  @ApiStandardResponses()
```

- [ ] **Step 3: Update `gift-cards.controller.ts`**

Add imports:
```typescript
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get()
  @ApiOperation({ summary: 'List gift cards with filters (requires gift_cards feature)' })
  @ApiResponse({ status: 200, description: 'Gift card list returned' })
  @ApiStandardResponses()

  @Get(':id')
  @ApiOperation({ summary: 'Get gift card detail' })
  @ApiParam({ name: 'id', description: 'Gift card UUID' })
  @ApiResponse({ status: 200, description: 'Gift card returned' })
  @ApiResponse({ status: 404, description: 'Gift card not found' })
  @ApiStandardResponses()

  @Post()
  @ApiOperation({ summary: 'Create a gift card' })
  @ApiResponse({ status: 201, description: 'Gift card created' })
  @ApiStandardResponses()

  @Patch(':id')
  @ApiOperation({ summary: 'Update a gift card' })
  @ApiParam({ name: 'id', description: 'Gift card UUID' })
  @ApiResponse({ status: 200, description: 'Gift card updated' })
  @ApiStandardResponses()

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a gift card' })
  @ApiParam({ name: 'id', description: 'Gift card UUID' })
  @ApiResponse({ status: 200, description: 'Gift card deactivated' })
  @ApiStandardResponses()

  @Post('check-balance')
  @ApiOperation({ summary: 'Check gift card balance by code (public)' })
  @ApiResponse({ status: 201, description: 'Balance returned' })

  @Post(':id/credit')
  @ApiOperation({ summary: 'Add credit to a gift card' })
  @ApiParam({ name: 'id', description: 'Gift card UUID' })
  @ApiResponse({ status: 201, description: 'Credit added, new balance returned' })
  @ApiStandardResponses()
```

- [ ] **Step 4: Run lint + typecheck**

```bash
cd backend && npm run lint && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd backend
git add \
  src/modules/intake-forms/intake-forms.controller.ts \
  src/modules/coupons/coupons.controller.ts \
  src/modules/gift-cards/gift-cards.controller.ts
git commit -m "docs(backend/features): add @ApiOperation + @ApiResponse to intake-forms, coupons, gift-cards"
```

---

## Task 7: `@ApiOperation` + `@ApiResponse` — Chatbot (3 controllers)

**Files:**
- Modify: `backend/src/modules/chatbot/chatbot.controller.ts`
- Modify: `backend/src/modules/chatbot/chatbot-admin.controller.ts`
- Modify: `backend/src/modules/chatbot/chatbot-kb.controller.ts`

- [ ] **Step 1: Update `chatbot.controller.ts`**

Add imports:
```typescript
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Post('sessions')
  @ApiOperation({ summary: 'Create a new chatbot session (requires chatbot feature)' })
  @ApiResponse({ status: 201, description: 'Session created' })
  @ApiStandardResponses()

  @Get('sessions')
  @ApiOperation({ summary: 'List chatbot sessions (admin sees all, client sees own)' })
  @ApiResponse({ status: 200, description: 'Session list returned' })
  @ApiStandardResponses()

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get chatbot session detail' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiResponse({ status: 200, description: 'Session returned' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiStandardResponses()

  @Post('sessions/:id/messages')
  @ApiOperation({ summary: 'Send a message to chatbot (standard response)' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiResponse({ status: 201, description: 'Message processed, response returned' })
  @ApiStandardResponses()

  @Post('sessions/:id/messages/stream')
  @ApiOperation({ summary: 'Send a message to chatbot (SSE streaming response)' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiResponse({ status: 200, description: 'SSE stream opened — events: text, tool, action, done, error', content: { 'text/event-stream': {} } })
  @ApiStandardResponses()

  @Post('sessions/:id/end')
  @ApiOperation({ summary: 'End a chatbot session' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiResponse({ status: 200, description: 'Session ended' })
  @ApiStandardResponses()
```

- [ ] **Step 2: Update `chatbot-admin.controller.ts`**

Add imports:
```typescript
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get('config')
  @ApiOperation({ summary: 'Get all chatbot configuration entries' })
  @ApiResponse({ status: 200, description: 'Config returned' })
  @ApiStandardResponses()

  @Get('config/:category')
  @ApiOperation({ summary: 'Get chatbot config entries by category' })
  @ApiParam({ name: 'category', description: 'Config category name' })
  @ApiResponse({ status: 200, description: 'Category config returned' })
  @ApiStandardResponses()

  @Put('config')
  @ApiOperation({ summary: 'Bulk upsert chatbot config entries' })
  @ApiResponse({ status: 200, description: 'Config updated' })
  @ApiStandardResponses()

  @Post('config/seed')
  @ApiOperation({ summary: 'Seed default chatbot configuration values' })
  @ApiResponse({ status: 200, description: 'Defaults seeded, count returned' })
  @ApiStandardResponses()

  @Get('analytics')
  @ApiOperation({ summary: 'Get chatbot session analytics' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date ISO string' })
  @ApiQuery({ name: 'to', required: false, description: 'End date ISO string' })
  @ApiResponse({ status: 200, description: 'Analytics stats returned' })
  @ApiStandardResponses()

  @Get('analytics/questions')
  @ApiOperation({ summary: 'Get most frequently asked questions' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default: 10)' })
  @ApiResponse({ status: 200, description: 'Popular questions returned' })
  @ApiStandardResponses()

  @Post('sessions/:id/staff-messages')
  @ApiOperation({ summary: 'Send a staff message to a handed-off chatbot session' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiResponse({ status: 201, description: 'Staff message sent' })
  @ApiStandardResponses()
```

- [ ] **Step 3: Update `chatbot-kb.controller.ts`**

Add imports:
```typescript
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
```

```typescript
  @Get('knowledge-base')
  @ApiOperation({ summary: 'List knowledge base entries (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'perPage', required: false })
  @ApiQuery({ name: 'source', required: false, description: 'Filter by source (manual/sync/file)' })
  @ApiQuery({ name: 'category', required: false })
  @ApiResponse({ status: 200, description: 'KB entries returned' })
  @ApiStandardResponses()

  @Post('knowledge-base')
  @ApiOperation({ summary: 'Create a manual knowledge base entry' })
  @ApiResponse({ status: 201, description: 'KB entry created' })
  @ApiStandardResponses()

  @Patch('knowledge-base/:id')
  @ApiOperation({ summary: 'Update a knowledge base entry' })
  @ApiParam({ name: 'id', description: 'KB entry UUID' })
  @ApiResponse({ status: 200, description: 'KB entry updated' })
  @ApiStandardResponses()

  @Delete('knowledge-base/:id')
  @ApiOperation({ summary: 'Delete a knowledge base entry' })
  @ApiParam({ name: 'id', description: 'KB entry UUID' })
  @ApiResponse({ status: 200, description: 'KB entry deleted' })
  @ApiStandardResponses()

  @Post('knowledge-base/sync')
  @ApiOperation({ summary: 'Sync knowledge base from clinic database records' })
  @ApiResponse({ status: 200, description: 'Sync complete, count returned' })
  @ApiStandardResponses()

  @Post('knowledge-base/files')
  @ApiOperation({ summary: 'Upload a file to knowledge base (PDF, DOCX, TXT — max 10MB)' })
  @ApiResponse({ status: 201, description: 'File uploaded, processing queued' })
  @ApiStandardResponses()

  @Get('knowledge-base/files')
  @ApiOperation({ summary: 'List uploaded knowledge base files (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'perPage', required: false })
  @ApiResponse({ status: 200, description: 'File list returned' })
  @ApiStandardResponses()

  @Post('knowledge-base/files/:id/process')
  @ApiOperation({ summary: 'Trigger processing of an uploaded KB file' })
  @ApiParam({ name: 'id', description: 'File UUID' })
  @ApiResponse({ status: 200, description: 'Processing triggered' })
  @ApiStandardResponses()

  @Delete('knowledge-base/files/:id')
  @ApiOperation({ summary: 'Delete a knowledge base file' })
  @ApiParam({ name: 'id', description: 'File UUID' })
  @ApiResponse({ status: 200, description: 'File deleted' })
  @ApiStandardResponses()
```

- [ ] **Step 4: Run lint + typecheck**

```bash
cd backend && npm run lint && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd backend
git add \
  src/modules/chatbot/chatbot.controller.ts \
  src/modules/chatbot/chatbot-admin.controller.ts \
  src/modules/chatbot/chatbot-kb.controller.ts
git commit -m "docs(backend/chatbot): add @ApiOperation + @ApiResponse to all 3 chatbot controllers"
```

---

## Task 8: `@ApiResponse` on Already-Documented Controllers

The 15 controllers that already have `@ApiOperation` are missing `@ApiResponse` entirely. Add responses to: `auth`, `bookings`, `booking-actions`, `services`, `employees` (already done in Task 4), `groups`, `payments`, `invoices`, `reports`, `departments`, `clients`, `problem-reports`, `roles`, `activity-log`, `zatca`, `ratings`.

**Files:**
- Modify: `backend/src/modules/auth/auth.controller.ts`
- Modify: `backend/src/modules/bookings/bookings.controller.ts`
- Modify: `backend/src/modules/bookings/booking-actions.controller.ts`
- Modify: `backend/src/modules/services/services.controller.ts`
- Modify: `backend/src/modules/groups/groups.controller.ts`
- Modify: `backend/src/modules/payments/payments.controller.ts`
- Modify: `backend/src/modules/invoices/invoices.controller.ts`
- Modify: `backend/src/modules/reports/reports.controller.ts`
- Modify: `backend/src/modules/departments/departments.controller.ts`
- Modify: `backend/src/modules/clients/clients.controller.ts`
- Modify: `backend/src/modules/problem-reports/problem-reports.controller.ts`
- Modify: `backend/src/modules/roles/roles.controller.ts`
- Modify: `backend/src/modules/activity-log/activity-log.controller.ts`
- Modify: `backend/src/modules/zatca/zatca.controller.ts`
- Modify: `backend/src/modules/ratings/ratings.controller.ts`

Pattern for each: import `ApiResponse` from `@nestjs/swagger` and `ApiStandardResponses` from the shared decorator, then add appropriate `@ApiResponse` and `@ApiStandardResponses()` to each endpoint following this mapping:
- `@Get` → `@ApiResponse({ status: 200 })` + `@ApiStandardResponses()`
- `@Post` → `@ApiResponse({ status: 201 })` + `@ApiStandardResponses()`
- `@Patch` / `@Put` → `@ApiResponse({ status: 200 })` + `@ApiStandardResponses()`
- `@Delete` → `@ApiResponse({ status: 200 })` + `@ApiStandardResponses()`
- `@Public()` endpoints → only `@ApiResponse`, no `@ApiStandardResponses()`
- Any endpoint that can 404 → add `@ApiResponse({ status: 404, description: '...' })`

This task is split into 3 commits to respect the ≤10 files rule.

- [ ] **Step 1: Add `@ApiResponse` to auth, bookings, booking-actions, services, groups (5 files)**

For `auth.controller.ts`: all 12 endpoints get responses. Public endpoints (register, login, otp, refresh-token, password endpoints) get status 200/201 only. Protected endpoints also get `@ApiStandardResponses()`.

For `bookings.controller.ts`: 10 endpoints — standard GET→200, POST→201 pattern.

For `booking-actions.controller.ts`: 10 endpoints — all are POST actions returning 200/201, all `@ApiStandardResponses()`.

For `services.controller.ts`: 20 endpoints — standard pattern, file upload endpoint gets `@ApiConsumes('multipart/form-data')`.

For `groups.controller.ts`: 16 endpoints — standard pattern.

- [ ] **Step 2: Run lint + typecheck, then commit first 5 files**

```bash
cd backend && npm run lint && npx tsc --noEmit
git add \
  src/modules/auth/auth.controller.ts \
  src/modules/bookings/bookings.controller.ts \
  src/modules/bookings/booking-actions.controller.ts \
  src/modules/services/services.controller.ts \
  src/modules/groups/groups.controller.ts
git commit -m "docs(backend/core): add @ApiResponse to auth, bookings, services, groups controllers"
```

- [ ] **Step 3: Add `@ApiResponse` to payments, invoices, reports, departments, clients (5 files)**

For `payments.controller.ts`: 11 endpoints. Note webhook endpoint is `@Public()` so no `@ApiStandardResponses()`. Bank transfer upload gets `@ApiConsumes('multipart/form-data')`.

For `invoices.controller.ts`: 7 endpoints — standard pattern.

For `reports.controller.ts`: 7 endpoints — all are GET, all `@ApiStandardResponses()`.

For `departments.controller.ts`: 6 endpoints — standard pattern.

For `clients.controller.ts`: 8 endpoints — standard pattern.

- [ ] **Step 4: Run lint + typecheck, then commit second 5 files**

```bash
cd backend && npm run lint && npx tsc --noEmit
git add \
  src/modules/payments/payments.controller.ts \
  src/modules/invoices/invoices.controller.ts \
  src/modules/reports/reports.controller.ts \
  src/modules/departments/departments.controller.ts \
  src/modules/clients/clients.controller.ts
git commit -m "docs(backend/payments): add @ApiResponse to payments, invoices, reports, departments, clients"
```

- [ ] **Step 5: Add `@ApiResponse` to problem-reports, roles, activity-log, zatca, ratings (5 files)**

For `problem-reports.controller.ts`: 4 endpoints — standard pattern.

For `roles.controller.ts`: 6 endpoints — standard pattern.

For `activity-log.controller.ts`: 2 endpoints — standard pattern.

For `zatca.controller.ts`: 5 endpoints — standard pattern, owner-only module.

For `ratings.controller.ts`: 3 endpoints — standard pattern.

- [ ] **Step 6: Run lint + typecheck, then commit last 5 files**

```bash
cd backend && npm run lint && npx tsc --noEmit
git add \
  src/modules/problem-reports/problem-reports.controller.ts \
  src/modules/roles/roles.controller.ts \
  src/modules/activity-log/activity-log.controller.ts \
  src/modules/zatca/zatca.controller.ts \
  src/modules/ratings/ratings.controller.ts
git commit -m "docs(backend/misc): add @ApiResponse to problem-reports, roles, activity-log, zatca, ratings"
```

---

## Task 9: `@ApiProperty` on DTOs — Auth, Users, Roles, Clients, Specialties

**Files (11 DTO files):**
- Modify: `backend/src/modules/auth/dto/change-password.dto.ts`
- Modify: `backend/src/modules/auth/dto/otp.dto.ts`
- Modify: `backend/src/modules/auth/dto/refresh-token.dto.ts`
- Modify: `backend/src/modules/auth/dto/register.dto.ts`
- Modify: `backend/src/modules/auth/dto/reset-password.dto.ts`
- Modify: `backend/src/modules/auth/dto/verify-email.dto.ts`
- Modify: `backend/src/modules/users/dto/create-user.dto.ts` (UpdateUserDto + AssignRoleDto inside same file)
- Modify: `backend/src/modules/roles/dto/create-role.dto.ts`
- Modify: `backend/src/modules/clients/dto/client-list-query.dto.ts`
- Modify: `backend/src/modules/specialties/dto/create-specialty.dto.ts`
- Modify: `backend/src/modules/specialties/dto/update-specialty.dto.ts`

Pattern for **every field** in each DTO:
- Required field: `@ApiProperty({ description: '...', example: '...' })`
- Optional field: `@ApiPropertyOptional({ description: '...', example: '...' })`
- Enum field: `@ApiProperty({ enum: EnumName, description: '...' })`
- Array field: `@ApiProperty({ type: [ItemType], description: '...' })`

- [ ] **Step 1: Add `@ApiProperty` to auth DTOs (6 files)**

`auth/dto/register.dto.ts`:
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'User email address', example: 'user@clinic.com' })
  @IsEmail() ...
  email!: string;

  @ApiProperty({ description: 'Password (min 8 chars, must contain upper, lower, digit)', example: 'Clinic123' })
  @IsString() ...
  password!: string;

  @ApiProperty({ description: 'First name', example: 'Ahmed' })
  firstName!: string;

  @ApiProperty({ description: 'Last name', example: 'Al-Rashidi' })
  lastName!: string;

  @ApiPropertyOptional({ description: 'Phone in E.164 format', example: '+966501234567' })
  phone?: string;
}
```

Apply same pattern to `change-password.dto.ts`, `otp.dto.ts`, `refresh-token.dto.ts`, `reset-password.dto.ts`, `verify-email.dto.ts`.

- [ ] **Step 2: Add `@ApiProperty` to users + roles + clients + specialties DTOs (5 files)**

`users/dto/create-user.dto.ts` — `CreateUserDto`, `UpdateUserDto`, `AssignRoleDto` all in same file. Add `@ApiProperty`/`@ApiPropertyOptional` to all fields.

`roles/dto/create-role.dto.ts` — read the file and add properties.

`clients/dto/client-list-query.dto.ts` — all query params get `@ApiPropertyOptional`.

`specialties/dto/create-specialty.dto.ts` and `update-specialty.dto.ts` — all fields.

- [ ] **Step 3: Run lint + typecheck**

```bash
cd backend && npm run lint && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd backend
git add \
  src/modules/auth/dto/change-password.dto.ts \
  src/modules/auth/dto/otp.dto.ts \
  src/modules/auth/dto/refresh-token.dto.ts \
  src/modules/auth/dto/register.dto.ts \
  src/modules/auth/dto/reset-password.dto.ts \
  src/modules/auth/dto/verify-email.dto.ts \
  src/modules/users/dto/create-user.dto.ts \
  src/modules/roles/dto/create-role.dto.ts \
  src/modules/clients/dto/client-list-query.dto.ts \
  src/modules/specialties/dto/create-specialty.dto.ts \
  src/modules/specialties/dto/update-specialty.dto.ts
git commit -m "docs(backend/auth): add @ApiProperty to auth, users, roles, clients, specialties DTOs"
```

---

## Task 10: `@ApiProperty` on DTOs — Employees

**Files (9 DTO files):**
- Modify: `backend/src/modules/employees/dto/assign-employee-service.dto.ts`
- Modify: `backend/src/modules/employees/dto/create-employee.dto.ts`
- Modify: `backend/src/modules/employees/dto/create-vacation.dto.ts`
- Modify: `backend/src/modules/employees/dto/get-available-dates-query.dto.ts`
- Modify: `backend/src/modules/employees/dto/get-employees-query.dto.ts`
- Modify: `backend/src/modules/employees/dto/get-slots-query.dto.ts`
- Modify: `backend/src/modules/employees/dto/onboard-employee.dto.ts`
- Modify: `backend/src/modules/employees/dto/set-availability.dto.ts`
- Modify: `backend/src/modules/employees/dto/set-breaks.dto.ts`
- Modify: `backend/src/modules/employees/dto/update-employee-service.dto.ts`
- Modify: `backend/src/modules/employees/dto/update-employee.dto.ts`

- [ ] **Step 1: Read all 11 employee DTO files**

```bash
cat backend/src/modules/employees/dto/*.dto.ts
```

- [ ] **Step 2: Add `@ApiProperty`/`@ApiPropertyOptional` to every field in each file**

Apply the standard pattern: required → `@ApiProperty`, optional → `@ApiPropertyOptional`, enum → add `enum:` key, nested objects/arrays → add `type:` key.

- [ ] **Step 3: Run lint + typecheck**

```bash
cd backend && npm run lint && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/modules/employees/dto/
git commit -m "docs(backend/employees): add @ApiProperty to all employee DTOs"
```

---

## Task 11: `@ApiProperty` on DTOs — Bookings

**Files (10 DTO files):**
- Modify: `backend/src/modules/bookings/dto/admin-cancel.dto.ts`
- Modify: `backend/src/modules/bookings/dto/booking-list-query.dto.ts`
- Modify: `backend/src/modules/bookings/dto/cancel-approve.dto.ts`
- Modify: `backend/src/modules/bookings/dto/cancel-reject.dto.ts`
- Modify: `backend/src/modules/bookings/dto/cancel-request.dto.ts`
- Modify: `backend/src/modules/bookings/dto/complete-booking.dto.ts`
- Modify: `backend/src/modules/bookings/dto/create-booking.dto.ts`
- Modify: `backend/src/modules/bookings/dto/create-recurring-booking.dto.ts`
- Modify: `backend/src/modules/bookings/dto/reschedule-booking.dto.ts`
- Modify: `backend/src/modules/bookings/dto/join-waitlist.dto.ts`

- [ ] **Step 1: Read all booking DTO files**

```bash
cat backend/src/modules/bookings/dto/*.dto.ts
```

- [ ] **Step 2: Add `@ApiProperty`/`@ApiPropertyOptional` to every field**

- [ ] **Step 3: Run lint + typecheck**

```bash
cd backend && npm run lint && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/modules/bookings/dto/
git commit -m "docs(backend/bookings): add @ApiProperty to all booking DTOs"
```

---

## Task 12: `@ApiProperty` on DTOs — Payments, Invoices, ZATCA

**Files (10 DTO files):**
- Modify: `backend/src/modules/payments/dto/bank-transfer-upload.dto.ts`
- Modify: `backend/src/modules/payments/dto/create-moyasar-payment.dto.ts`
- Modify: `backend/src/modules/payments/dto/create-payment.dto.ts`
- Modify: `backend/src/modules/payments/dto/moyasar-webhook.dto.ts`
- Modify: `backend/src/modules/payments/dto/payment-filter.dto.ts`
- Modify: `backend/src/modules/payments/dto/refund.dto.ts`
- Modify: `backend/src/modules/payments/dto/review-receipt.dto.ts`
- Modify: `backend/src/modules/payments/dto/update-payment-status.dto.ts`
- Modify: `backend/src/modules/invoices/dto/create-invoice.dto.ts`
- Modify: `backend/src/modules/invoices/dto/invoice-filter.dto.ts`

- [ ] **Step 1: Read all payment + invoice DTO files**

```bash
cat backend/src/modules/payments/dto/*.dto.ts && cat backend/src/modules/invoices/dto/*.dto.ts
```

- [ ] **Step 2: Add `@ApiProperty`/`@ApiPropertyOptional` to every field**

- [ ] **Step 3: Run lint + typecheck**

```bash
cd backend && npm run lint && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/modules/payments/dto/ src/modules/invoices/dto/
git commit -m "docs(backend/payments): add @ApiProperty to all payment and invoice DTOs"
```

---

## Task 13: `@ApiProperty` on DTOs — Services, Branches, Departments, Groups

**Files (15 DTO files):**
- Modify: `backend/src/modules/services/dto/create-category.dto.ts`
- Modify: `backend/src/modules/services/dto/create-service.dto.ts`
- Modify: `backend/src/modules/services/dto/service-list-query.dto.ts`
- Modify: `backend/src/modules/services/dto/set-booking-types.dto.ts`
- Modify: `backend/src/modules/services/dto/update-category.dto.ts` (already has some `@ApiPropertyOptional`)
- Modify: `backend/src/modules/services/dto/update-service.dto.ts`
- Modify: `backend/src/modules/branches/dto/assign-employees.dto.ts`
- Modify: `backend/src/modules/branches/dto/branch-filter.dto.ts`
- Modify: `backend/src/modules/branches/dto/update-branch.dto.ts`
- Modify: `backend/src/modules/departments/dto/department-list-query.dto.ts` (already has some)
- Modify: `backend/src/modules/groups/dto/update-group.dto.ts`

- [ ] **Step 1: Read all DTO files**

```bash
cat backend/src/modules/services/dto/*.dto.ts && \
cat backend/src/modules/branches/dto/*.dto.ts && \
cat backend/src/modules/departments/dto/*.dto.ts && \
cat backend/src/modules/groups/dto/update-group.dto.ts
```

- [ ] **Step 2: Add `@ApiProperty`/`@ApiPropertyOptional` to every field that lacks it**

For files that already have partial `@ApiPropertyOptional`, add missing ones only.

- [ ] **Step 3: Run lint + typecheck**

```bash
cd backend && npm run lint && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd backend
git add \
  src/modules/services/dto/ \
  src/modules/branches/dto/ \
  src/modules/departments/dto/department-list-query.dto.ts \
  src/modules/groups/dto/update-group.dto.ts
git commit -m "docs(backend/services): add @ApiProperty to services, branches, departments, groups DTOs"
```

---

## Task 14: `@ApiProperty` on DTOs — Clients, Notifications, Intake Forms, Ratings, Activity Log, Problem Reports, Chatbot

**Files (12 DTO files):**
- Modify: `backend/src/modules/clients/dto/claim-account.dto.ts`
- Modify: `backend/src/modules/clients/dto/create-walk-in-client.dto.ts`
- Modify: `backend/src/modules/clients/dto/update-client.dto.ts`
- Modify: `backend/src/modules/notifications/dto/create-notification.dto.ts`
- Modify: `backend/src/modules/notifications/dto/notification-list-query.dto.ts`
- Modify: `backend/src/modules/notifications/dto/register-fcm-token.dto.ts`
- Modify: `backend/src/modules/notifications/dto/unregister-fcm-token.dto.ts`
- Modify: `backend/src/modules/intake-forms/dto/create-intake-form.dto.ts`
- Modify: `backend/src/modules/intake-forms/dto/submit-response.dto.ts`
- Modify: `backend/src/modules/ratings/dto/create-rating.dto.ts`
- Modify: `backend/src/modules/activity-log/dto/activity-log-query.dto.ts`
- Modify: `backend/src/modules/chatbot/dto/create-session.dto.ts`
- Modify: `backend/src/modules/chatbot/dto/send-message.dto.ts`
- Modify: `backend/src/modules/chatbot/dto/session-list-query.dto.ts`

- [ ] **Step 1: Read all DTO files**

```bash
cat backend/src/modules/clients/dto/claim-account.dto.ts \
    backend/src/modules/clients/dto/create-walk-in-client.dto.ts \
    backend/src/modules/clients/dto/update-client.dto.ts \
    backend/src/modules/notifications/dto/*.dto.ts \
    backend/src/modules/intake-forms/dto/create-intake-form.dto.ts \
    backend/src/modules/intake-forms/dto/submit-response.dto.ts \
    backend/src/modules/ratings/dto/create-rating.dto.ts \
    backend/src/modules/activity-log/dto/activity-log-query.dto.ts \
    backend/src/modules/chatbot/dto/create-session.dto.ts \
    backend/src/modules/chatbot/dto/send-message.dto.ts \
    backend/src/modules/chatbot/dto/session-list-query.dto.ts
```

- [ ] **Step 2: Add `@ApiProperty`/`@ApiPropertyOptional` to every field**

- [ ] **Step 3: Run lint + typecheck**

```bash
cd backend && npm run lint && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd backend
git add \
  src/modules/clients/dto/claim-account.dto.ts \
  src/modules/clients/dto/create-walk-in-client.dto.ts \
  src/modules/clients/dto/update-client.dto.ts \
  src/modules/notifications/dto/ \
  src/modules/intake-forms/dto/create-intake-form.dto.ts \
  src/modules/intake-forms/dto/submit-response.dto.ts \
  src/modules/ratings/dto/create-rating.dto.ts \
  src/modules/activity-log/dto/activity-log-query.dto.ts \
  src/modules/chatbot/dto/create-session.dto.ts \
  src/modules/chatbot/dto/send-message.dto.ts \
  src/modules/chatbot/dto/session-list-query.dto.ts
git commit -m "docs(backend/clients): add @ApiProperty to clients, notifications, intake-forms, ratings, chatbot DTOs"
```

---

## Task 15: `@ApiProperty` on DTOs — Coupons, Gift Cards, Problem Reports, Zatca

**Files (10 DTO files):**
- Modify: `backend/src/modules/coupons/dto/apply-coupon.dto.ts`
- Modify: `backend/src/modules/coupons/dto/coupon-filter.dto.ts`
- Modify: `backend/src/modules/coupons/dto/create-coupon.dto.ts`
- Modify: `backend/src/modules/coupons/dto/update-coupon.dto.ts`
- Modify: `backend/src/modules/gift-cards/dto/add-credit.dto.ts`
- Modify: `backend/src/modules/gift-cards/dto/check-balance.dto.ts`
- Modify: `backend/src/modules/gift-cards/dto/create-gift-card.dto.ts`
- Modify: `backend/src/modules/gift-cards/dto/gift-card-filter.dto.ts`
- Modify: `backend/src/modules/gift-cards/dto/update-gift-card.dto.ts`
- Modify: `backend/src/modules/problem-reports/dto/create-problem-report.dto.ts`
- Modify: `backend/src/modules/problem-reports/dto/problem-report-query.dto.ts`
- Modify: `backend/src/modules/problem-reports/dto/resolve-problem-report.dto.ts`

- [ ] **Step 1: Read all DTO files**

```bash
cat backend/src/modules/coupons/dto/*.dto.ts && \
cat backend/src/modules/gift-cards/dto/*.dto.ts && \
cat backend/src/modules/problem-reports/dto/*.dto.ts
```

- [ ] **Step 2: Add `@ApiProperty`/`@ApiPropertyOptional` to every field**

- [ ] **Step 3: Run lint + typecheck**

```bash
cd backend && npm run lint && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd backend
git add \
  src/modules/coupons/dto/ \
  src/modules/gift-cards/dto/ \
  src/modules/problem-reports/dto/
git commit -m "docs(backend/coupons): add @ApiProperty to coupons, gift-cards, problem-reports DTOs"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Run all tests to ensure no regressions**

```bash
cd backend && npm run test
```

Expected: all tests pass (decorators are metadata only, no runtime impact).

- [ ] **Step 2: Run typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start backend and verify Swagger UI**

```bash
cd backend && npm run dev &
sleep 5
curl -s http://localhost:5100/api/v1/health | jq .
```

Then open `http://localhost:5100/api/docs` in browser and verify:
- All 40 tags appear in sidebar
- Each tag has all its endpoints
- Endpoints show operation summaries
- Request body schemas are populated from DTOs
- Response sections show status codes

- [ ] **Step 4: Spot-check 5 endpoints in Swagger UI**

Verify these specifically (cover public + auth + complex DTOs):
1. `GET /api/v1/health` — should show 200 + 503 responses
2. `POST /api/v1/auth/login` — should show request body schema with all fields
3. `GET /api/v1/employees/{id}/slots` — should show query params
4. `POST /api/v1/chatbot/sessions/{id}/messages/stream` — should show SSE content type
5. `POST /api/v1/payments/moyasar/webhook` — should be marked Public (no Bearer requirement)

- [ ] **Step 5: Final commit if any fixes were needed**

If Swagger spot-check reveals missing decorators, fix them and commit:
```bash
git add [affected files]
git commit -m "docs(backend): fix Swagger documentation gaps found in final review"
```
