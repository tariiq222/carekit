# P16 — Presentation Layer (HTTP Controllers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all existing handlers into REST controllers across three surfaces: dashboard (authenticated staff), mobile client app, and public (unauthenticated) endpoints.

**Architecture:** Controllers live in `src/api/{dashboard,mobile/client,mobile/employee,public}/` and import handlers from existing modules. Each controller is added to the corresponding feature module via `controllers:[]`. No new business logic — controllers are thin adapters that extract HTTP params, call handlers, and return results.

**Tech Stack:** NestJS controllers, class-validator DTOs, `@ApiTags`/`@ApiOperation` from `@nestjs/swagger`, `JwtGuard` + `CaslGuard` from `src/common/guards`, `@TenantId()` from `src/common/tenant/tenant.decorator.ts`, `@Public()` from `src/common/guards/jwt.guard.ts`, `@Throttle()` from `@nestjs/throttler`.

---

## Prerequisite: ThrottlerModule

The public endpoints use `@Throttle()`. Check if ThrottlerModule is registered globally before Task 6.

---

## File Map

### `src/api/dashboard/`
| File | Responsibility |
|------|---------------|
| `bookings.controller.ts` | Bookings CRUD + lifecycle actions |
| `finance.controller.ts` | Invoices + payments + coupons + Moyasar webhook + ZATCA |
| `people.controller.ts` | Clients + employees |
| `organization.controller.ts` | Branches + services + departments + categories + hours + branding + intake-forms + ratings |
| `comms.controller.ts` | Notifications + chat + email-templates |
| `ops.controller.ts` | Reports + activity log |
| `platform.controller.ts` | Problem reports + integrations |
| `ai.controller.ts` | Knowledge base + chat completion |
| `media.controller.ts` | File upload + get + delete + presigned URL |

### `src/api/mobile/client/`
| File | Responsibility |
|------|---------------|
| `bookings.controller.ts` | Client-scoped booking operations |
| `profile.controller.ts` | Client profile get/update |
| `payments.controller.ts` | Client-scoped payments + invoices |
| `chat.controller.ts` | AI chat completion + conversations |
| `notifications.controller.ts` | Notifications list + mark-read |

### `src/api/mobile/client/portal/`
| File | Responsibility |
|------|---------------|
| `home.controller.ts` | BFF: upcoming + notifications + invoices + profile in one request |
| `upcoming.controller.ts` | Upcoming bookings with service+employee details |
| `summary.controller.ts` | Booking count + last visit + balance summary |

### `src/api/mobile/employee/`
| File | Responsibility |
|------|---------------|
| `schedule.controller.ts` | Today's bookings + weekly schedule + availability |
| `clients.controller.ts` | Employee's client list + client history |
| `earnings.controller.ts` | Monthly earnings + payment breakdown |

### `src/api/public/`
| File | Responsibility |
|------|---------------|
| `branding.controller.ts` | GET /public/branding/:tenantSlug |
| `catalog.controller.ts` | GET /public/services/:tenantSlug |
| `slots.controller.ts` | GET /public/availability |

### Module wiring
Each controller group is added to the relevant existing module's `controllers:[]` array.

---

## Task 1: Dashboard — BookingsController

**Files:**
- Create: `src/api/dashboard/bookings.controller.ts`
- Modify: `src/modules/bookings/bookings.module.ts`

- [ ] **Step 1: Create the controller**

```typescript
// src/api/dashboard/bookings.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingStatus, BookingType, CancellationReason, RecurringFrequency } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, IsBoolean, IsNumber, IsArray, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateBookingHandler } from '../../modules/bookings/create-booking/create-booking.handler';
import { CreateRecurringBookingHandler } from '../../modules/bookings/create-recurring-booking/create-recurring-booking.handler';
import { ListBookingsHandler } from '../../modules/bookings/list-bookings/list-bookings.handler';
import { GetBookingHandler } from '../../modules/bookings/get-booking/get-booking.handler';
import { CancelBookingHandler } from '../../modules/bookings/cancel-booking/cancel-booking.handler';
import { RescheduleBookingHandler } from '../../modules/bookings/reschedule-booking/reschedule-booking.handler';
import { ConfirmBookingHandler } from '../../modules/bookings/confirm-booking/confirm-booking.handler';
import { CheckInBookingHandler } from '../../modules/bookings/check-in-booking/check-in-booking.handler';
import { CompleteBookingHandler } from '../../modules/bookings/complete-booking/complete-booking.handler';
import { NoShowBookingHandler } from '../../modules/bookings/no-show-booking/no-show-booking.handler';
import { AddToWaitlistHandler } from '../../modules/bookings/add-to-waitlist/add-to-waitlist.handler';
import { CheckAvailabilityHandler } from '../../modules/bookings/check-availability/check-availability.handler';

export class CreateBookingBody {
  @IsUUID() branchId!: string;
  @IsUUID() clientId!: string;
  @IsUUID() employeeId!: string;
  @IsUUID() serviceId!: string;
  @IsDateString() scheduledAt!: string;
  @IsOptional() @IsUUID() durationOptionId?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsEnum(BookingType) bookingType?: BookingType;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsUUID() groupSessionId?: string;
}

export class CreateRecurringBookingBody {
  @IsUUID() branchId!: string;
  @IsUUID() clientId!: string;
  @IsUUID() employeeId!: string;
  @IsUUID() serviceId!: string;
  @IsDateString() scheduledAt!: string;
  @IsInt() @Min(1) durationMins!: number;
  @IsNumber() price!: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsEnum(BookingType) bookingType?: BookingType;
  @IsOptional() @IsString() notes?: string;
  @IsEnum(RecurringFrequency) frequency!: RecurringFrequency;
  @IsOptional() @IsInt() @Min(1) intervalDays?: number;
  @IsOptional() @IsInt() @Min(1) occurrences?: number;
  @IsOptional() @IsDateString() until?: string;
  @IsOptional() @IsArray() @IsDateString({}, { each: true }) customDates?: string[];
  @IsOptional() @IsBoolean() skipConflicts?: boolean;
}

export class CancelBookingBody {
  @IsEnum(CancellationReason) reason!: CancellationReason;
  @IsOptional() @IsString() cancelNotes?: string;
}

export class RescheduleBookingBody {
  @IsDateString() newScheduledAt!: string;
  @IsOptional() @IsInt() @Min(1) newDurationMins?: number;
}

export class CompleteBookingBody {
  @IsOptional() @IsString() completionNotes?: string;
}

export class AddToWaitlistBody {
  @IsUUID() clientId!: string;
  @IsUUID() employeeId!: string;
  @IsUUID() serviceId!: string;
  @IsUUID() branchId!: string;
  @IsOptional() @IsDateString() preferredDate?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CheckAvailabilityQuery {
  @IsUUID() employeeId!: string;
  @IsUUID() branchId!: string;
  @IsDateString() date!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) durationMins?: number;
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsUUID() durationOptionId?: string;
  @IsOptional() @IsEnum(BookingType) bookingType?: BookingType;
}

export class ListBookingsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
  @IsOptional() @IsEnum(BookingType) bookingType?: BookingType;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
}

@ApiTags('Dashboard / Bookings')
@ApiBearerAuth()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/bookings')
export class DashboardBookingsController {
  constructor(
    private readonly create: CreateBookingHandler,
    private readonly createRecurring: CreateRecurringBookingHandler,
    private readonly list: ListBookingsHandler,
    private readonly get: GetBookingHandler,
    private readonly cancel: CancelBookingHandler,
    private readonly reschedule: RescheduleBookingHandler,
    private readonly confirm: ConfirmBookingHandler,
    private readonly checkIn: CheckInBookingHandler,
    private readonly complete: CompleteBookingHandler,
    private readonly noShow: NoShowBookingHandler,
    private readonly waitlist: AddToWaitlistHandler,
    private readonly availability: CheckAvailabilityHandler,
  ) {}

  @Post() @ApiOperation({ summary: 'Create booking' })
  createBooking(@TenantId() tenantId: string, @Body() body: CreateBookingBody) {
    return this.create.execute({
      tenantId,
      branchId: body.branchId,
      clientId: body.clientId,
      employeeId: body.employeeId,
      serviceId: body.serviceId,
      scheduledAt: new Date(body.scheduledAt),
      durationOptionId: body.durationOptionId,
      currency: body.currency,
      bookingType: body.bookingType,
      notes: body.notes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      groupSessionId: body.groupSessionId,
    });
  }

  @Post('recurring') @ApiOperation({ summary: 'Create recurring booking series' })
  createRecurringBooking(@TenantId() tenantId: string, @Body() body: CreateRecurringBookingBody) {
    return this.createRecurring.execute({
      tenantId,
      branchId: body.branchId,
      clientId: body.clientId,
      employeeId: body.employeeId,
      serviceId: body.serviceId,
      scheduledAt: new Date(body.scheduledAt),
      durationMins: body.durationMins,
      price: body.price,
      currency: body.currency,
      bookingType: body.bookingType,
      notes: body.notes,
      frequency: body.frequency,
      intervalDays: body.intervalDays,
      occurrences: body.occurrences,
      until: body.until ? new Date(body.until) : undefined,
      customDates: body.customDates?.map((d) => new Date(d)),
      skipConflicts: body.skipConflicts,
    });
  }

  @Get() @ApiOperation({ summary: 'List bookings' })
  listBookings(@TenantId() tenantId: string, @Query() q: ListBookingsQuery) {
    return this.list.execute({
      tenantId,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
      clientId: q.clientId,
      employeeId: q.employeeId,
      branchId: q.branchId,
      serviceId: q.serviceId,
      status: q.status,
      bookingType: q.bookingType,
      fromDate: q.fromDate ? new Date(q.fromDate) : undefined,
      toDate: q.toDate ? new Date(q.toDate) : undefined,
    });
  }

  @Get('availability') @ApiOperation({ summary: 'Check available slots' })
  checkAvailability(@TenantId() tenantId: string, @Query() q: CheckAvailabilityQuery) {
    return this.availability.execute({
      tenantId,
      employeeId: q.employeeId,
      branchId: q.branchId,
      date: new Date(q.date),
      durationMins: q.durationMins,
      serviceId: q.serviceId,
      durationOptionId: q.durationOptionId,
      bookingType: q.bookingType,
    });
  }

  @Get(':id') @ApiOperation({ summary: 'Get booking' })
  getBooking(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute({ tenantId, bookingId: id });
  }

  @Patch(':id/cancel') @ApiOperation({ summary: 'Cancel booking' })
  cancelBooking(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelBookingBody,
  ) {
    return this.cancel.execute({ tenantId, bookingId: id, reason: body.reason, cancelNotes: body.cancelNotes });
  }

  @Patch(':id/reschedule') @ApiOperation({ summary: 'Reschedule booking' })
  rescheduleBooking(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RescheduleBookingBody,
  ) {
    return this.reschedule.execute({
      tenantId,
      bookingId: id,
      newScheduledAt: new Date(body.newScheduledAt),
      newDurationMins: body.newDurationMins,
    });
  }

  @Patch(':id/confirm') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Confirm booking' })
  confirmBooking(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.confirm.execute({ tenantId, bookingId: id });
  }

  @Patch(':id/check-in') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Check in booking' })
  checkInBooking(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.checkIn.execute({ tenantId, bookingId: id });
  }

  @Patch(':id/complete') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Complete booking' })
  completeBooking(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CompleteBookingBody,
  ) {
    return this.complete.execute({ tenantId, bookingId: id, completionNotes: body.completionNotes });
  }

  @Patch(':id/no-show') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Mark no-show' })
  noShowBooking(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.noShow.execute({ tenantId, bookingId: id });
  }

  @Post('waitlist') @ApiOperation({ summary: 'Add to waitlist' })
  addToWaitlist(@TenantId() tenantId: string, @Body() body: AddToWaitlistBody) {
    return this.waitlist.execute({
      tenantId,
      clientId: body.clientId,
      employeeId: body.employeeId,
      serviceId: body.serviceId,
      branchId: body.branchId,
      preferredDate: body.preferredDate ? new Date(body.preferredDate) : undefined,
      notes: body.notes,
    });
  }
}
```

- [ ] **Step 2: Wire controller into BookingsModule**

In `src/modules/bookings/bookings.module.ts`, add:

```typescript
import { DashboardBookingsController } from '../../api/dashboard/bookings.controller';

@Module({
  imports: [DatabaseModule, MessagingModule, OrganizationModule],
  controllers: [DashboardBookingsController],          // ← add
  providers: [...handlers, PaymentCompletedEventHandler],
  exports: [...handlers],
})
```

- [ ] **Step 3: Run unit tests**

```bash
cd apps/backend && npx jest --testPathPattern="bookings" --passWithNoTests
```

Expected: PASS (no existing tests fail)

- [ ] **Step 4: Commit**

```bash
git add src/api/dashboard/bookings.controller.ts src/modules/bookings/bookings.module.ts
git commit -m "feat(api): p16-t1 DashboardBookingsController — full booking lifecycle"
```

---

## Task 2: Dashboard — FinanceController

**Files:**
- Create: `src/api/dashboard/finance.controller.ts`
- Modify: `src/modules/finance/finance.module.ts`

- [ ] **Step 1: Create the controller**

```typescript
// src/api/dashboard/finance.controller.ts
import {
  Controller, Get, Post, Body, Param, Query, UseGuards,
  ParseUUIDPipe, HttpCode, HttpStatus, Headers, RawBodyRequest, Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { Public } from '../../common/guards/jwt.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateInvoiceHandler } from '../../modules/finance/create-invoice/create-invoice.handler';
import { GetInvoiceHandler } from '../../modules/finance/get-invoice/get-invoice.handler';
import { ProcessPaymentHandler } from '../../modules/finance/process-payment/process-payment.handler';
import { ListPaymentsHandler } from '../../modules/finance/list-payments/list-payments.handler';
import { ApplyCouponHandler } from '../../modules/finance/apply-coupon/apply-coupon.handler';
import { MoyasarWebhookHandler } from '../../modules/finance/moyasar-webhook/moyasar-webhook.handler';
import { ZatcaSubmitHandler } from '../../modules/finance/zatca-submit/zatca-submit.handler';

export class CreateInvoiceBody {
  @IsUUID() bookingId!: string;
  @IsUUID() branchId!: string;
  @IsUUID() clientId!: string;
  @IsUUID() employeeId!: string;
  @IsNumber() subtotal!: number;
  @IsOptional() @IsNumber() discountAmt?: number;
  @IsOptional() @IsNumber() vatRate?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}

export class ProcessPaymentBody {
  @IsUUID() invoiceId!: string;
  @IsNumber() amount!: number;
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsOptional() @IsString() gatewayRef?: string;
  @IsOptional() @IsString() idempotencyKey?: string;
}

export class ApplyCouponBody {
  @IsString() code!: string;
  @IsNumber() orderTotal!: number;
}

export class ListPaymentsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsUUID() invoiceId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @IsOptional() @IsEnum(PaymentStatus) status?: PaymentStatus;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
}

export class ZatcaSubmitBody {
  @IsUUID() invoiceId!: string;
}

@ApiTags('Dashboard / Finance')
@ApiBearerAuth()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/finance')
export class DashboardFinanceController {
  constructor(
    private readonly createInvoice: CreateInvoiceHandler,
    private readonly getInvoice: GetInvoiceHandler,
    private readonly processPayment: ProcessPaymentHandler,
    private readonly listPayments: ListPaymentsHandler,
    private readonly applyCoupon: ApplyCouponHandler,
    private readonly moyasarWebhook: MoyasarWebhookHandler,
    private readonly zatcaSubmit: ZatcaSubmitHandler,
  ) {}

  @Post('invoices') @ApiOperation({ summary: 'Create invoice' })
  createInv(@TenantId() tenantId: string, @Body() body: CreateInvoiceBody) {
    return this.createInvoice.execute({
      tenantId,
      bookingId: body.bookingId,
      branchId: body.branchId,
      clientId: body.clientId,
      employeeId: body.employeeId,
      subtotal: body.subtotal,
      discountAmt: body.discountAmt,
      vatRate: body.vatRate,
      notes: body.notes,
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
    });
  }

  @Get('invoices/:id') @ApiOperation({ summary: 'Get invoice' })
  getInv(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.getInvoice.execute({ tenantId, invoiceId: id });
  }

  @Post('payments') @ApiOperation({ summary: 'Process payment' })
  processPaymentEndpoint(@TenantId() tenantId: string, @Body() body: ProcessPaymentBody) {
    return this.processPayment.execute({
      tenantId,
      invoiceId: body.invoiceId,
      amount: body.amount,
      method: body.method,
      gatewayRef: body.gatewayRef,
      idempotencyKey: body.idempotencyKey,
    });
  }

  @Get('payments') @ApiOperation({ summary: 'List payments' })
  listPaymentsEndpoint(@TenantId() tenantId: string, @Query() q: ListPaymentsQuery) {
    return this.listPayments.execute({
      tenantId,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
      invoiceId: q.invoiceId,
      clientId: q.clientId,
      method: q.method,
      status: q.status,
      fromDate: q.fromDate ? new Date(q.fromDate) : undefined,
      toDate: q.toDate ? new Date(q.toDate) : undefined,
    });
  }

  @Post('coupons/apply') @ApiOperation({ summary: 'Apply coupon code' })
  applyCouponEndpoint(@TenantId() tenantId: string, @Body() body: ApplyCouponBody) {
    return this.applyCoupon.execute({ tenantId, code: body.code, orderTotal: body.orderTotal });
  }

  @Post('zatca/submit') @ApiOperation({ summary: 'Submit invoice to ZATCA' })
  zatca(@TenantId() tenantId: string, @Body() body: ZatcaSubmitBody) {
    return this.zatcaSubmit.execute({ tenantId, invoiceId: body.invoiceId });
  }

  /** Moyasar webhook — public, no JWT, signature verified inside handler */
  @Public()
  @Post('payments/moyasar-webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Moyasar payment webhook (public)' })
  moyasarWebhookEndpoint(@Body() payload: Record<string, unknown>) {
    return this.moyasarWebhook.execute(payload);
  }
}
```

- [ ] **Step 2: Wire into FinanceModule**

```typescript
// src/modules/finance/finance.module.ts — add to @Module:
import { DashboardFinanceController } from '../../api/dashboard/finance.controller';

controllers: [DashboardFinanceController],
```

- [ ] **Step 3: Run tests**

```bash
cd apps/backend && npx jest --testPathPattern="finance" --passWithNoTests
```

- [ ] **Step 4: Commit**

```bash
git add src/api/dashboard/finance.controller.ts src/modules/finance/finance.module.ts
git commit -m "feat(api): p16-t1 DashboardFinanceController — invoices, payments, coupons, ZATCA"
```

---

## Task 3: Dashboard — PeopleController

**Files:**
- Create: `src/api/dashboard/people.controller.ts`
- Modify: `src/modules/people/people.module.ts`

- [ ] **Step 1: Create the controller**

```typescript
// src/api/dashboard/people.controller.ts
import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClientGender, ClientSource, EmployeeGender, EmploymentType, OnboardingStatus } from '@prisma/client';
import { IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateClientHandler } from '../../modules/people/clients/create-client.handler';
import { UpdateClientHandler } from '../../modules/people/clients/update-client.handler';
import { ListClientsHandler } from '../../modules/people/clients/list-clients.handler';
import { GetClientHandler } from '../../modules/people/clients/get-client.handler';
import { CreateEmployeeHandler } from '../../modules/people/employees/create-employee.handler';
import { ListEmployeesHandler } from '../../modules/people/employees/list-employees.handler';
import { GetEmployeeHandler } from '../../modules/people/employees/get-employee.handler';
import { UpdateAvailabilityHandler } from '../../modules/people/employees/update-availability.handler';
import { EmployeeOnboardingHandler } from '../../modules/people/employees/employee-onboarding.handler';

export class CreateClientBody {
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(ClientGender) gender?: ClientGender;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(ClientSource) source?: ClientSource;
  @IsOptional() @IsUUID() userId?: string;
}

export class UpdateClientBody {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(ClientGender) gender?: ClientGender;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListClientsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
  @IsOptional() @IsEnum(ClientGender) gender?: ClientGender;
  @IsOptional() @IsEnum(ClientSource) source?: ClientSource;
}

export class ListEmployeesQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
  @IsOptional() @IsEnum(EmployeeGender) gender?: EmployeeGender;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @IsOptional() @IsEnum(OnboardingStatus) onboardingStatus?: OnboardingStatus;
  @IsOptional() @IsUUID() specialtyId?: string;
  @IsOptional() @IsUUID() branchId?: string;
}

@ApiTags('Dashboard / People')
@ApiBearerAuth()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/people')
export class DashboardPeopleController {
  constructor(
    private readonly createClient: CreateClientHandler,
    private readonly updateClient: UpdateClientHandler,
    private readonly listClients: ListClientsHandler,
    private readonly getClient: GetClientHandler,
    private readonly createEmployee: CreateEmployeeHandler,
    private readonly listEmployees: ListEmployeesHandler,
    private readonly getEmployee: GetEmployeeHandler,
    private readonly updateAvailability: UpdateAvailabilityHandler,
    private readonly onboarding: EmployeeOnboardingHandler,
  ) {}

  // — Clients —
  @Post('clients') @ApiOperation({ summary: 'Create client' })
  createClientEndpoint(@TenantId() tenantId: string, @Body() body: CreateClientBody) {
    return this.createClient.execute({ tenantId, ...body, dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined });
  }

  @Get('clients') @ApiOperation({ summary: 'List clients' })
  listClientsEndpoint(@TenantId() tenantId: string, @Query() q: ListClientsQuery) {
    return this.listClients.execute({ tenantId, page: q.page ?? 1, limit: q.limit ?? 20, ...q });
  }

  @Get('clients/:id') @ApiOperation({ summary: 'Get client' })
  getClientEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.getClient.execute({ tenantId, clientId: id });
  }

  @Patch('clients/:id') @ApiOperation({ summary: 'Update client' })
  updateClientEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateClientBody,
  ) {
    return this.updateClient.execute({ tenantId, clientId: id, ...body, dateOfBirth: undefined });
  }

  // — Employees —
  @Post('employees') @ApiOperation({ summary: 'Create employee' })
  createEmployeeEndpoint(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.createEmployee.execute({ tenantId, ...body } as Parameters<typeof this.createEmployee.execute>[0]);
  }

  @Get('employees') @ApiOperation({ summary: 'List employees' })
  listEmployeesEndpoint(@TenantId() tenantId: string, @Query() q: ListEmployeesQuery) {
    return this.listEmployees.execute({ tenantId, page: q.page ?? 1, limit: q.limit ?? 20, ...q });
  }

  @Get('employees/:id') @ApiOperation({ summary: 'Get employee' })
  getEmployeeEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.getEmployee.execute({ tenantId, employeeId: id });
  }

  @Patch('employees/:id/availability') @ApiOperation({ summary: 'Update employee availability' })
  updateAvailabilityEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.updateAvailability.execute({ tenantId, employeeId: id, ...body } as Parameters<typeof this.updateAvailability.execute>[0]);
  }

  @Post('employees/:id/onboarding') @ApiOperation({ summary: 'Employee onboarding step' })
  onboardingEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.onboarding.execute({ tenantId, employeeId: id, ...body } as Parameters<typeof this.onboarding.execute>[0]);
  }
}
```

- [ ] **Step 2: Wire into PeopleModule**

```typescript
// src/modules/people/people.module.ts
import { DashboardPeopleController } from '../../api/dashboard/people.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardPeopleController],
  providers: [...handlers],
  exports: [...handlers],
})
```

- [ ] **Step 3: Run tests**

```bash
cd apps/backend && npx jest --testPathPattern="people|clients|employees" --passWithNoTests
```

- [ ] **Step 4: Commit**

```bash
git add src/api/dashboard/people.controller.ts src/modules/people/people.module.ts
git commit -m "feat(api): p16-t1 DashboardPeopleController — clients + employees CRUD"
```

---

## Task 4: Dashboard — OrganizationController

**Files:**
- Create: `src/api/dashboard/organization.controller.ts`
- Modify: `src/modules/organization/organization.module.ts`

- [ ] **Step 1: Create the controller**

```typescript
// src/api/dashboard/organization.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateBranchHandler } from '../../modules/organization/branches/create-branch.handler';
import { UpdateBranchHandler } from '../../modules/organization/branches/update-branch.handler';
import { ListBranchesHandler } from '../../modules/organization/branches/list-branches.handler';
import { GetBranchHandler } from '../../modules/organization/branches/get-branch.handler';
import { CreateServiceHandler } from '../../modules/organization/services/create-service.handler';
import { UpdateServiceHandler } from '../../modules/organization/services/update-service.handler';
import { ListServicesHandler } from '../../modules/organization/services/list-services.handler';
import { ArchiveServiceHandler } from '../../modules/organization/services/archive-service.handler';
import { SetBusinessHoursHandler } from '../../modules/organization/hours/set-business-hours.handler';
import { GetBusinessHoursHandler } from '../../modules/organization/hours/get-business-hours.handler';
import { AddHolidayHandler } from '../../modules/organization/hours/add-holiday.handler';
import { RemoveHolidayHandler } from '../../modules/organization/hours/remove-holiday.handler';
import { ListHolidaysHandler } from '../../modules/organization/hours/list-holidays.handler';
import { UpsertBrandingHandler } from '../../modules/organization/branding/upsert-branding.handler';
import { GetBrandingHandler } from '../../modules/organization/branding/get-branding.handler';
import { CreateIntakeFormHandler } from '../../modules/organization/intake-forms/create-intake-form.handler';
import { GetIntakeFormHandler } from '../../modules/organization/intake-forms/get-intake-form.handler';
import { ListIntakeFormsHandler } from '../../modules/organization/intake-forms/list-intake-forms.handler';
import { SubmitRatingHandler } from '../../modules/organization/ratings/submit-rating.handler';
import { ListRatingsHandler } from '../../modules/organization/ratings/list-ratings.handler';
import { CreateDepartmentHandler } from '../../modules/organization/departments/create-department.handler';
import { UpdateDepartmentHandler } from '../../modules/organization/departments/update-department.handler';
import { ListDepartmentsHandler } from '../../modules/organization/departments/list-departments.handler';
import { CreateCategoryHandler } from '../../modules/organization/categories/create-category.handler';
import { UpdateCategoryHandler } from '../../modules/organization/categories/update-category.handler';
import { ListCategoriesHandler } from '../../modules/organization/categories/list-categories.handler';

export class ListServicesQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
}

export class ListRatingsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsUUID() employeeId?: string;
}

@ApiTags('Dashboard / Organization')
@ApiBearerAuth()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationController {
  constructor(
    private readonly createBranch: CreateBranchHandler,
    private readonly updateBranch: UpdateBranchHandler,
    private readonly listBranches: ListBranchesHandler,
    private readonly getBranch: GetBranchHandler,
    private readonly createService: CreateServiceHandler,
    private readonly updateService: UpdateServiceHandler,
    private readonly listServices: ListServicesHandler,
    private readonly archiveService: ArchiveServiceHandler,
    private readonly setBusinessHours: SetBusinessHoursHandler,
    private readonly getBusinessHours: GetBusinessHoursHandler,
    private readonly addHoliday: AddHolidayHandler,
    private readonly removeHoliday: RemoveHolidayHandler,
    private readonly listHolidays: ListHolidaysHandler,
    private readonly upsertBranding: UpsertBrandingHandler,
    private readonly getBranding: GetBrandingHandler,
    private readonly createIntakeForm: CreateIntakeFormHandler,
    private readonly getIntakeForm: GetIntakeFormHandler,
    private readonly listIntakeForms: ListIntakeFormsHandler,
    private readonly submitRating: SubmitRatingHandler,
    private readonly listRatings: ListRatingsHandler,
    private readonly createDepartment: CreateDepartmentHandler,
    private readonly updateDepartment: UpdateDepartmentHandler,
    private readonly listDepartments: ListDepartmentsHandler,
    private readonly createCategory: CreateCategoryHandler,
    private readonly updateCategory: UpdateCategoryHandler,
    private readonly listCategories: ListCategoriesHandler,
  ) {}

  // Branches
  @Post('branches') @ApiOperation({ summary: 'Create branch' })
  createBranchEndpoint(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.createBranch.execute({ tenantId, ...body } as Parameters<typeof this.createBranch.execute>[0]);
  }
  @Get('branches') @ApiOperation({ summary: 'List branches' })
  listBranchesEndpoint(@TenantId() tenantId: string) {
    return this.listBranches.execute({ tenantId });
  }
  @Get('branches/:id') @ApiOperation({ summary: 'Get branch' })
  getBranchEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.getBranch.execute({ tenantId, branchId: id });
  }
  @Patch('branches/:id') @ApiOperation({ summary: 'Update branch' })
  updateBranchEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.updateBranch.execute({ tenantId, branchId: id, ...body } as Parameters<typeof this.updateBranch.execute>[0]);
  }

  // Services
  @Post('services') @ApiOperation({ summary: 'Create service' })
  createServiceEndpoint(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.createService.execute({ tenantId, ...body } as Parameters<typeof this.createService.execute>[0]);
  }
  @Get('services') @ApiOperation({ summary: 'List services' })
  listServicesEndpoint(@TenantId() tenantId: string, @Query() q: ListServicesQuery) {
    return this.listServices.execute({ tenantId, page: q.page, limit: q.limit, isActive: q.isActive });
  }
  @Patch('services/:id') @ApiOperation({ summary: 'Update service' })
  updateServiceEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.updateService.execute({ tenantId, serviceId: id, ...body } as Parameters<typeof this.updateService.execute>[0]);
  }
  @Delete('services/:id') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Archive service' })
  archiveServiceEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.archiveService.execute({ tenantId, serviceId: id });
  }

  // Departments
  @Post('departments') @ApiOperation({ summary: 'Create department' })
  createDepartmentEndpoint(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.createDepartment.execute({ tenantId, ...body } as Parameters<typeof this.createDepartment.execute>[0]);
  }
  @Get('departments') @ApiOperation({ summary: 'List departments' })
  listDepartmentsEndpoint(@TenantId() tenantId: string) {
    return this.listDepartments.execute({ tenantId });
  }
  @Patch('departments/:id') @ApiOperation({ summary: 'Update department' })
  updateDepartmentEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.updateDepartment.execute({ tenantId, departmentId: id, ...body } as Parameters<typeof this.updateDepartment.execute>[0]);
  }

  // Categories
  @Post('categories') @ApiOperation({ summary: 'Create category' })
  createCategoryEndpoint(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.createCategory.execute({ tenantId, ...body } as Parameters<typeof this.createCategory.execute>[0]);
  }
  @Get('categories') @ApiOperation({ summary: 'List categories' })
  listCategoriesEndpoint(@TenantId() tenantId: string) {
    return this.listCategories.execute({ tenantId });
  }
  @Patch('categories/:id') @ApiOperation({ summary: 'Update category' })
  updateCategoryEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.updateCategory.execute({ tenantId, categoryId: id, ...body } as Parameters<typeof this.updateCategory.execute>[0]);
  }

  // Business hours
  @Post('hours') @ApiOperation({ summary: 'Set business hours' })
  setHours(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.setBusinessHours.execute({ tenantId, ...body } as Parameters<typeof this.setBusinessHours.execute>[0]);
  }
  @Get('hours/:branchId') @ApiOperation({ summary: 'Get business hours' })
  getHours(@TenantId() tenantId: string, @Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.getBusinessHours.execute({ tenantId, branchId });
  }
  @Post('holidays') @ApiOperation({ summary: 'Add holiday' })
  addHolidayEndpoint(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.addHoliday.execute({ tenantId, ...body } as Parameters<typeof this.addHoliday.execute>[0]);
  }
  @Delete('holidays/:id') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Remove holiday' })
  removeHolidayEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.removeHoliday.execute({ tenantId, holidayId: id });
  }
  @Get('holidays') @ApiOperation({ summary: 'List holidays' })
  listHolidaysEndpoint(@TenantId() tenantId: string, @Query('branchId') branchId?: string) {
    return this.listHolidays.execute({ tenantId, branchId });
  }

  // Branding
  @Post('branding') @ApiOperation({ summary: 'Upsert branding config' })
  upsertBrandingEndpoint(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.upsertBranding.execute({ tenantId, ...body } as Parameters<typeof this.upsertBranding.execute>[0]);
  }
  @Get('branding') @ApiOperation({ summary: 'Get branding config' })
  getBrandingEndpoint(@TenantId() tenantId: string) {
    return this.getBranding.execute({ tenantId });
  }

  // Intake forms
  @Post('intake-forms') @ApiOperation({ summary: 'Create intake form' })
  createIntakeFormEndpoint(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.createIntakeForm.execute({ tenantId, ...body } as Parameters<typeof this.createIntakeForm.execute>[0]);
  }
  @Get('intake-forms') @ApiOperation({ summary: 'List intake forms' })
  listIntakeFormsEndpoint(@TenantId() tenantId: string) {
    return this.listIntakeForms.execute({ tenantId });
  }
  @Get('intake-forms/:id') @ApiOperation({ summary: 'Get intake form' })
  getIntakeFormEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.getIntakeForm.execute({ tenantId, formId: id });
  }

  // Ratings
  @Post('ratings') @ApiOperation({ summary: 'Submit rating' })
  submitRatingEndpoint(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.submitRating.execute({ tenantId, ...body } as Parameters<typeof this.submitRating.execute>[0]);
  }
  @Get('ratings') @ApiOperation({ summary: 'List ratings' })
  listRatingsEndpoint(@TenantId() tenantId: string, @Query() q: ListRatingsQuery) {
    return this.listRatings.execute({ tenantId, page: q.page ?? 1, limit: q.limit ?? 20, employeeId: q.employeeId });
  }
}
```

- [ ] **Step 2: Wire into OrganizationModule**

```typescript
// src/modules/organization/organization.module.ts — add to @Module:
import { DashboardOrganizationController } from '../../api/dashboard/organization.controller';

controllers: [DashboardOrganizationController],
```

- [ ] **Step 3: Run tests**

```bash
cd apps/backend && npx jest --testPathPattern="organization|branch|service" --passWithNoTests
```

- [ ] **Step 4: Commit**

```bash
git add src/api/dashboard/organization.controller.ts src/modules/organization/organization.module.ts
git commit -m "feat(api): p16-t1 DashboardOrganizationController — branches, services, hours, branding, intake-forms, ratings"
```

---

## Task 5: Dashboard — Comms, Ops, Platform, AI, Media Controllers

**Files:**
- Create: `src/api/dashboard/comms.controller.ts`
- Create: `src/api/dashboard/ops.controller.ts`
- Create: `src/api/dashboard/platform.controller.ts`
- Create: `src/api/dashboard/ai.controller.ts`
- Create: `src/api/dashboard/media.controller.ts`
- Modify: `src/modules/comms/comms.module.ts`
- Modify: `src/modules/ops/ops.module.ts`
- Modify: `src/modules/platform/platform.module.ts`
- Modify: `src/modules/ai/ai.module.ts`
- Modify: `src/modules/media/media.module.ts`

- [ ] **Step 1: Create comms.controller.ts**

```typescript
// src/api/dashboard/comms.controller.ts
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { ListNotificationsHandler } from '../../modules/comms/notifications/list-notifications.handler';
import { MarkReadHandler } from '../../modules/comms/notifications/mark-read.handler';
import { CreateEmailTemplateHandler } from '../../modules/comms/email-templates/create-email-template.handler';
import { UpdateEmailTemplateHandler } from '../../modules/comms/email-templates/update-email-template.handler';
import { GetEmailTemplateHandler } from '../../modules/comms/email-templates/get-email-template.handler';
import { ListEmailTemplatesHandler } from '../../modules/comms/email-templates/list-email-templates.handler';
import { ListConversationsHandler } from '../../modules/comms/chat/list-conversations.handler';
import { ListMessagesHandler } from '../../modules/comms/chat/list-messages.handler';

export class ListNotificationsQuery {
  @IsUUID() recipientId!: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() unreadOnly?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

export class MarkReadBody {
  @IsOptional() notificationIds?: string[];
}

@ApiTags('Dashboard / Comms')
@ApiBearerAuth()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/comms')
export class DashboardCommsController {
  constructor(
    private readonly listNotifications: ListNotificationsHandler,
    private readonly markRead: MarkReadHandler,
    private readonly createTemplate: CreateEmailTemplateHandler,
    private readonly updateTemplate: UpdateEmailTemplateHandler,
    private readonly getTemplate: GetEmailTemplateHandler,
    private readonly listTemplates: ListEmailTemplatesHandler,
    private readonly listConversations: ListConversationsHandler,
    private readonly listMessages: ListMessagesHandler,
  ) {}

  @Get('notifications') @ApiOperation({ summary: 'List notifications' })
  listNotificationsEndpoint(@TenantId() tenantId: string, @Query() q: ListNotificationsQuery) {
    return this.listNotifications.execute({ tenantId, recipientId: q.recipientId, unreadOnly: q.unreadOnly, page: q.page ?? 1, limit: q.limit ?? 20 });
  }

  @Patch('notifications/mark-read') @ApiOperation({ summary: 'Mark notifications as read' })
  markReadEndpoint(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.markRead.execute({ tenantId, ...body } as Parameters<typeof this.markRead.execute>[0]);
  }

  @Post('email-templates') @ApiOperation({ summary: 'Create email template' })
  createTemplateEndpoint(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.createTemplate.execute({ tenantId, ...body } as Parameters<typeof this.createTemplate.execute>[0]);
  }
  @Get('email-templates') @ApiOperation({ summary: 'List email templates' })
  listTemplatesEndpoint(@TenantId() tenantId: string) {
    return this.listTemplates.execute({ tenantId });
  }
  @Get('email-templates/:id') @ApiOperation({ summary: 'Get email template' })
  getTemplateEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.getTemplate.execute({ tenantId, templateId: id });
  }
  @Patch('email-templates/:id') @ApiOperation({ summary: 'Update email template' })
  updateTemplateEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.updateTemplate.execute({ tenantId, templateId: id, ...body } as Parameters<typeof this.updateTemplate.execute>[0]);
  }

  @Get('chat/conversations') @ApiOperation({ summary: 'List chat conversations' })
  listConversationsEndpoint(@TenantId() tenantId: string) {
    return this.listConversations.execute({ tenantId });
  }
  @Get('chat/conversations/:id/messages') @ApiOperation({ summary: 'List chat messages' })
  listMessagesEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.listMessages.execute({ tenantId, sessionId: id });
  }
}
```

- [ ] **Step 2: Create ops.controller.ts**

```typescript
// src/api/dashboard/ops.controller.ts
import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportFormat, ReportType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { GenerateReportHandler } from '../../modules/ops/generate-report/generate-report.handler';
import { ListActivityHandler } from '../../modules/ops/log-activity/list-activity.handler';

export class GenerateReportBody {
  @IsEnum(ReportType) type!: ReportType;
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsEnum(ReportFormat) format?: ReportFormat;
  @IsUUID() requestedBy!: string;
}

export class ListActivityQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsUUID() actorId?: string;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
}

@ApiTags('Dashboard / Ops')
@ApiBearerAuth()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/ops')
export class DashboardOpsController {
  constructor(
    private readonly generateReport: GenerateReportHandler,
    private readonly listActivity: ListActivityHandler,
  ) {}

  @Post('reports') @ApiOperation({ summary: 'Generate report' })
  generateReportEndpoint(@TenantId() tenantId: string, @Body() body: GenerateReportBody) {
    return this.generateReport.execute({ tenantId, ...body, from: body.from, to: body.to });
  }

  @Get('activity') @ApiOperation({ summary: 'List activity log' })
  listActivityEndpoint(@TenantId() tenantId: string, @Query() q: ListActivityQuery) {
    return this.listActivity.execute({
      tenantId, page: q.page ?? 1, limit: q.limit ?? 20,
      actorId: q.actorId,
      fromDate: q.fromDate ? new Date(q.fromDate) : undefined,
      toDate: q.toDate ? new Date(q.toDate) : undefined,
    });
  }
}
```

- [ ] **Step 3: Create platform.controller.ts**

```typescript
// src/api/dashboard/platform.controller.ts
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateProblemReportHandler } from '../../modules/platform/problem-reports/create-problem-report.handler';
import { ListProblemReportsHandler } from '../../modules/platform/problem-reports/list-problem-reports.handler';
import { UpdateProblemReportStatusHandler } from '../../modules/platform/problem-reports/update-problem-report-status.handler';
import { UpsertIntegrationHandler } from '../../modules/platform/integrations/upsert-integration.handler';
import { ListIntegrationsHandler } from '../../modules/platform/integrations/list-integrations.handler';

export class ListProblemReportsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

@ApiTags('Dashboard / Platform')
@ApiBearerAuth()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/platform')
export class DashboardPlatformController {
  constructor(
    private readonly createReport: CreateProblemReportHandler,
    private readonly listReports: ListProblemReportsHandler,
    private readonly updateStatus: UpdateProblemReportStatusHandler,
    private readonly upsertIntegration: UpsertIntegrationHandler,
    private readonly listIntegrations: ListIntegrationsHandler,
  ) {}

  @Post('problem-reports') @ApiOperation({ summary: 'Create problem report' })
  createReportEndpoint(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.createReport.execute({ tenantId, ...body } as Parameters<typeof this.createReport.execute>[0]);
  }
  @Get('problem-reports') @ApiOperation({ summary: 'List problem reports' })
  listReportsEndpoint(@TenantId() tenantId: string, @Query() q: ListProblemReportsQuery) {
    return this.listReports.execute({ tenantId, page: q.page ?? 1, limit: q.limit ?? 20 });
  }
  @Patch('problem-reports/:id/status') @ApiOperation({ summary: 'Update problem report status' })
  updateStatusEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.updateStatus.execute({ tenantId, reportId: id, ...body } as Parameters<typeof this.updateStatus.execute>[0]);
  }

  @Post('integrations') @ApiOperation({ summary: 'Upsert integration' })
  upsertIntegrationEndpoint(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.upsertIntegration.execute({ tenantId, ...body } as Parameters<typeof this.upsertIntegration.execute>[0]);
  }
  @Get('integrations') @ApiOperation({ summary: 'List integrations' })
  listIntegrationsEndpoint(@TenantId() tenantId: string) {
    return this.listIntegrations.execute({ tenantId });
  }
}
```

- [ ] **Step 4: Create ai.controller.ts**

```typescript
// src/api/dashboard/ai.controller.ts
import { Controller, Post, Delete, Body, Param, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { ManageKnowledgeBaseHandler } from '../../modules/ai/manage-knowledge-base/manage-knowledge-base.handler';
import { ChatCompletionHandler } from '../../modules/ai/chat-completion/chat-completion.handler';

export class ChatCompletionBody {
  @IsString() userMessage!: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsUUID() sessionId?: string;
}

@ApiTags('Dashboard / AI')
@ApiBearerAuth()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/ai')
export class DashboardAiController {
  constructor(
    private readonly knowledgeBase: ManageKnowledgeBaseHandler,
    private readonly chatCompletion: ChatCompletionHandler,
  ) {}

  @Post('knowledge-base') @ApiOperation({ summary: 'Add document to knowledge base' })
  addDocument(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    return this.knowledgeBase.execute({ tenantId, ...body } as Parameters<typeof this.knowledgeBase.execute>[0]);
  }

  @Delete('knowledge-base/:id') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Delete document from knowledge base' })
  deleteDocument(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.knowledgeBase.execute({ tenantId, action: 'delete', documentId: id } as Parameters<typeof this.knowledgeBase.execute>[0]);
  }

  @Post('chat') @ApiOperation({ summary: 'AI chat completion' })
  chat(@TenantId() tenantId: string, @Body() body: ChatCompletionBody) {
    return this.chatCompletion.execute({ tenantId, ...body });
  }
}
```

- [ ] **Step 5: Create media.controller.ts**

```typescript
// src/api/dashboard/media.controller.ts
import {
  Controller, Post, Get, Delete, Body, Param, Query, UseGuards,
  ParseUUIDPipe, HttpCode, HttpStatus, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { GetFileHandler } from '../../modules/media/files/get-file.handler';
import { DeleteFileHandler } from '../../modules/media/files/delete-file.handler';
import { GeneratePresignedUrlHandler } from '../../modules/media/files/generate-presigned-url.handler';
import { UploadFileHandler } from '../../modules/media/files/upload-file.handler';

export class PresignedUrlQuery {
  @IsUUID() fileId!: string;
  @IsOptional() @IsString() expiresIn?: string;
}

@ApiTags('Dashboard / Media')
@ApiBearerAuth()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/media')
export class DashboardMediaController {
  constructor(
    private readonly upload: UploadFileHandler,
    private readonly getFile: GetFileHandler,
    private readonly deleteFile: DeleteFileHandler,
    private readonly presignedUrl: GeneratePresignedUrlHandler,
  ) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload file' })
  uploadEndpoint(
    @TenantId() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Record<string, unknown>,
  ) {
    return this.upload.execute(
      { tenantId, filename: file.originalname, mimetype: file.mimetype, size: file.size, ...body } as Parameters<typeof this.upload.execute>[0],
      file.buffer,
    );
  }

  @Get(':id') @ApiOperation({ summary: 'Get file metadata' })
  getFileEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.getFile.execute({ tenantId, fileId: id });
  }

  @Delete(':id') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Delete file' })
  deleteFileEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.deleteFile.execute({ tenantId, fileId: id });
  }

  @Get(':id/presigned-url') @ApiOperation({ summary: 'Generate presigned URL' })
  presignedUrlEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.presignedUrl.execute({ tenantId, fileId: id });
  }
}
```

- [ ] **Step 6: Wire all controllers into their modules**

In `src/modules/comms/comms.module.ts`:
```typescript
import { DashboardCommsController } from '../../api/dashboard/comms.controller';
// Add to @Module: controllers: [DashboardCommsController],
```

In `src/modules/ops/ops.module.ts`:
```typescript
import { DashboardOpsController } from '../../api/dashboard/ops.controller';
// Add to @Module: controllers: [DashboardOpsController],
```

In `src/modules/platform/platform.module.ts`:
```typescript
import { DashboardPlatformController } from '../../api/dashboard/platform.controller';
// Add to @Module: controllers: [DashboardPlatformController],
```

In `src/modules/ai/ai.module.ts`:
```typescript
import { DashboardAiController } from '../../api/dashboard/ai.controller';
// Add to @Module: controllers: [DashboardAiController],
```

In `src/modules/media/media.module.ts`:
```typescript
import { DashboardMediaController } from '../../api/dashboard/media.controller';
// Add to @Module: controllers: [DashboardMediaController],
```

- [ ] **Step 7: Run build to check for type errors**

```bash
cd apps/backend && npx tsc --noEmit
```

Expected: 0 errors. Fix any import path or type mismatch before committing.

- [ ] **Step 8: Commit**

```bash
git add src/api/dashboard/ src/modules/comms/comms.module.ts src/modules/ops/ops.module.ts src/modules/platform/platform.module.ts src/modules/ai/ai.module.ts src/modules/media/media.module.ts
git commit -m "feat(api): p16-t1 dashboard comms, ops, platform, AI, media controllers"
```

---

## Task 6: Mobile Client Controllers (p16-t2)

**Files:**
- Create: `src/api/mobile/client/bookings.controller.ts`
- Create: `src/api/mobile/client/profile.controller.ts`
- Create: `src/api/mobile/client/payments.controller.ts`
- Create: `src/api/mobile/client/chat.controller.ts`
- Create: `src/api/mobile/client/notifications.controller.ts`

Controllers are identical in structure to dashboard but scope all queries to `clientId` extracted from JWT. The JWT payload after `JwtGuard` runs exposes `req.user`. Add a `@CurrentUser()` decorator or extract `req.user.clientId` via a custom decorator.

- [ ] **Step 1: Create CurrentUser decorator**

```typescript
// src/common/auth/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUser {
  sub: string;
  tenantId: string;
  clientId?: string;
  employeeId?: string;
  roles: string[];
  permissions: Array<{ action: string; subject: string }>;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtUser }>();
    return request.user;
  },
);
```

- [ ] **Step 2: Create mobile client bookings controller**

```typescript
// src/api/mobile/client/bookings.controller.ts
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingStatus, CancellationReason } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { TenantId } from '../../../common/tenant/tenant.decorator';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ListBookingsHandler } from '../../../modules/bookings/list-bookings/list-bookings.handler';
import { GetBookingHandler } from '../../../modules/bookings/get-booking/get-booking.handler';
import { CreateBookingHandler } from '../../../modules/bookings/create-booking/create-booking.handler';
import { CancelBookingHandler } from '../../../modules/bookings/cancel-booking/cancel-booking.handler';
import { RescheduleBookingHandler } from '../../../modules/bookings/reschedule-booking/reschedule-booking.handler';

export class MobileCreateBookingBody {
  @IsUUID() branchId!: string;
  @IsUUID() employeeId!: string;
  @IsUUID() serviceId!: string;
  @IsDateString() scheduledAt!: string;
  @IsOptional() @IsUUID() durationOptionId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class MobileCancelBookingBody {
  @IsEnum(CancellationReason) reason!: CancellationReason;
}

export class MobileRescheduleBody {
  @IsDateString() newScheduledAt!: string;
}

export class MobileListBookingsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
}

@ApiTags('Mobile / Client / Bookings')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('mobile/client/bookings')
export class MobileClientBookingsController {
  constructor(
    private readonly list: ListBookingsHandler,
    private readonly get: GetBookingHandler,
    private readonly create: CreateBookingHandler,
    private readonly cancel: CancelBookingHandler,
    private readonly reschedule: RescheduleBookingHandler,
  ) {}

  @Post() @ApiOperation({ summary: 'Create booking (client)' })
  createBooking(@TenantId() tenantId: string, @CurrentUser() user: JwtUser, @Body() body: MobileCreateBookingBody) {
    return this.create.execute({
      tenantId,
      clientId: user.sub,
      branchId: body.branchId,
      employeeId: body.employeeId,
      serviceId: body.serviceId,
      scheduledAt: new Date(body.scheduledAt),
      durationOptionId: body.durationOptionId,
      notes: body.notes,
    });
  }

  @Get() @ApiOperation({ summary: 'List my bookings' })
  listMyBookings(@TenantId() tenantId: string, @CurrentUser() user: JwtUser, @Query() q: MobileListBookingsQuery) {
    return this.list.execute({ tenantId, clientId: user.sub, page: q.page ?? 1, limit: q.limit ?? 20, status: q.status });
  }

  @Get(':id') @ApiOperation({ summary: 'Get booking' })
  getBooking(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute({ tenantId, bookingId: id });
  }

  @Patch(':id/cancel') @ApiOperation({ summary: 'Cancel booking' })
  cancelBooking(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: MobileCancelBookingBody) {
    return this.cancel.execute({ tenantId, bookingId: id, reason: body.reason });
  }

  @Patch(':id/reschedule') @ApiOperation({ summary: 'Reschedule booking' })
  rescheduleBooking(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: MobileRescheduleBody) {
    return this.reschedule.execute({ tenantId, bookingId: id, newScheduledAt: new Date(body.newScheduledAt) });
  }
}
```

- [ ] **Step 3: Create remaining mobile client controllers**

```typescript
// src/api/mobile/client/profile.controller.ts
import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { TenantId } from '../../../common/tenant/tenant.decorator';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { GetClientHandler } from '../../../modules/people/clients/get-client.handler';
import { UpdateClientHandler } from '../../../modules/people/clients/update-client.handler';

@ApiTags('Mobile / Client / Profile')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('mobile/client/profile')
export class MobileClientProfileController {
  constructor(
    private readonly getClient: GetClientHandler,
    private readonly updateClient: UpdateClientHandler,
  ) {}

  @Get() @ApiOperation({ summary: 'Get my profile' })
  getProfile(@TenantId() tenantId: string, @CurrentUser() user: JwtUser) {
    return this.getClient.execute({ tenantId, clientId: user.sub });
  }

  @Patch() @ApiOperation({ summary: 'Update my profile' })
  updateProfile(@TenantId() tenantId: string, @CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    return this.updateClient.execute({ tenantId, clientId: user.sub, ...body } as Parameters<typeof this.updateClient.execute>[0]);
  }
}
```

```typescript
// src/api/mobile/client/payments.controller.ts
import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { TenantId } from '../../../common/tenant/tenant.decorator';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ListPaymentsHandler } from '../../../modules/finance/list-payments/list-payments.handler';
import { GetInvoiceHandler } from '../../../modules/finance/get-invoice/get-invoice.handler';

export class MobileListPaymentsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

@ApiTags('Mobile / Client / Payments')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('mobile/client/payments')
export class MobileClientPaymentsController {
  constructor(
    private readonly listPayments: ListPaymentsHandler,
    private readonly getInvoice: GetInvoiceHandler,
  ) {}

  @Get() @ApiOperation({ summary: 'List my payments' })
  listMyPayments(@TenantId() tenantId: string, @CurrentUser() user: JwtUser, @Query() q: MobileListPaymentsQuery) {
    return this.listPayments.execute({ tenantId, clientId: user.sub, page: q.page ?? 1, limit: q.limit ?? 20 });
  }

  @Get('invoices/:id') @ApiOperation({ summary: 'Get invoice' })
  getInvoiceEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.getInvoice.execute({ tenantId, invoiceId: id });
  }
}
```

```typescript
// src/api/mobile/client/chat.controller.ts
import { Controller, Post, Get, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { TenantId } from '../../../common/tenant/tenant.decorator';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ChatCompletionHandler } from '../../../modules/ai/chat-completion/chat-completion.handler';
import { ListConversationsHandler } from '../../../modules/comms/chat/list-conversations.handler';
import { ListMessagesHandler } from '../../../modules/comms/chat/list-messages.handler';

export class MobileChatBody {
  @IsString() userMessage!: string;
  @IsOptional() @IsUUID() sessionId?: string;
}

@ApiTags('Mobile / Client / Chat')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('mobile/client/chat')
export class MobileClientChatController {
  constructor(
    private readonly chatCompletion: ChatCompletionHandler,
    private readonly listConversations: ListConversationsHandler,
    private readonly listMessages: ListMessagesHandler,
  ) {}

  @Post() @ApiOperation({ summary: 'AI chat completion' })
  chat(@TenantId() tenantId: string, @CurrentUser() user: JwtUser, @Body() body: MobileChatBody) {
    return this.chatCompletion.execute({ tenantId, clientId: user.sub, ...body });
  }

  @Get('conversations') @ApiOperation({ summary: 'List my conversations' })
  listConversationsEndpoint(@TenantId() tenantId: string, @CurrentUser() user: JwtUser) {
    return this.listConversations.execute({ tenantId, clientId: user.sub });
  }

  @Get('conversations/:id/messages') @ApiOperation({ summary: 'List messages in conversation' })
  listMessagesEndpoint(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.listMessages.execute({ tenantId, sessionId: id });
  }
}
```

```typescript
// src/api/mobile/client/notifications.controller.ts
import { Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { TenantId } from '../../../common/tenant/tenant.decorator';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ListNotificationsHandler } from '../../../modules/comms/notifications/list-notifications.handler';
import { MarkReadHandler } from '../../../modules/comms/notifications/mark-read.handler';

export class MobileListNotificationsQuery {
  @IsOptional() @Type(() => Boolean) @IsBoolean() unreadOnly?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

@ApiTags('Mobile / Client / Notifications')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('mobile/client/notifications')
export class MobileClientNotificationsController {
  constructor(
    private readonly listNotifications: ListNotificationsHandler,
    private readonly markRead: MarkReadHandler,
  ) {}

  @Get() @ApiOperation({ summary: 'List my notifications' })
  listNotificationsEndpoint(@TenantId() tenantId: string, @CurrentUser() user: JwtUser, @Query() q: MobileListNotificationsQuery) {
    return this.listNotifications.execute({ tenantId, recipientId: user.sub, unreadOnly: q.unreadOnly, page: q.page ?? 1, limit: q.limit ?? 20 });
  }

  @Patch('mark-read') @ApiOperation({ summary: 'Mark notifications read' })
  markReadEndpoint(@TenantId() tenantId: string, @CurrentUser() user: JwtUser) {
    return this.markRead.execute({ tenantId, recipientId: user.sub } as Parameters<typeof this.markRead.execute>[0]);
  }
}
```

- [ ] **Step 4: Wire mobile client controllers**

Create a `MobileClientModule` to host these controllers, importing the handlers they need:

```typescript
// src/api/mobile/client/mobile-client.module.ts
import { Module } from '@nestjs/common';
import { BookingsModule } from '../../../modules/bookings/bookings.module';
import { PeopleModule } from '../../../modules/people/people.module';
import { FinanceModule } from '../../../modules/finance/finance.module';
import { AiModule } from '../../../modules/ai/ai.module';
import { CommsModule } from '../../../modules/comms/comms.module';
import { MobileClientBookingsController } from './bookings.controller';
import { MobileClientProfileController } from './profile.controller';
import { MobileClientPaymentsController } from './payments.controller';
import { MobileClientChatController } from './chat.controller';
import { MobileClientNotificationsController } from './notifications.controller';

@Module({
  imports: [BookingsModule, PeopleModule, FinanceModule, AiModule, CommsModule],
  controllers: [
    MobileClientBookingsController,
    MobileClientProfileController,
    MobileClientPaymentsController,
    MobileClientChatController,
    MobileClientNotificationsController,
  ],
})
export class MobileClientModule {}
```

Then register in `app.module.ts`:
```typescript
import { MobileClientModule } from './api/mobile/client/mobile-client.module';
// Add MobileClientModule to @Module imports array
```

- [ ] **Step 5: Run type check**

```bash
cd apps/backend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/api/mobile/client/ src/common/auth/current-user.decorator.ts src/app.module.ts
git commit -m "feat(api): p16-t2 mobile client controllers — bookings, profile, payments, chat, notifications"
```

---

## Task 7: Mobile Client Portal BFF (p16-t3 & t4)

**Files:**
- Create: `src/api/mobile/client/portal/home.controller.ts`
- Create: `src/api/mobile/client/portal/upcoming.controller.ts`
- Create: `src/api/mobile/client/portal/summary.controller.ts`
- Modify: `src/api/mobile/client/mobile-client.module.ts`

- [ ] **Step 1: Create home BFF endpoint**

```typescript
// src/api/mobile/client/portal/home.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../../../common/guards/jwt.guard';
import { TenantId } from '../../../../common/tenant/tenant.decorator';
import { CurrentUser, JwtUser } from '../../../../common/auth/current-user.decorator';
import { ListBookingsHandler } from '../../../../modules/bookings/list-bookings/list-bookings.handler';
import { ListNotificationsHandler } from '../../../../modules/comms/notifications/list-notifications.handler';
import { ListPaymentsHandler } from '../../../../modules/finance/list-payments/list-payments.handler';
import { GetClientHandler } from '../../../../modules/people/clients/get-client.handler';

@ApiTags('Mobile / Client / Portal')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('mobile/client/portal')
export class MobileClientHomeController {
  constructor(
    private readonly listBookings: ListBookingsHandler,
    private readonly listNotifications: ListNotificationsHandler,
    private readonly listPayments: ListPaymentsHandler,
    private readonly getClient: GetClientHandler,
  ) {}

  @Get('home') @ApiOperation({ summary: 'Home screen BFF — upcoming, notifications, invoices, profile' })
  async home(@TenantId() tenantId: string, @CurrentUser() user: JwtUser) {
    const now = new Date();
    const [upcomingResult, notificationsResult, paymentsResult, profile] = await Promise.all([
      this.listBookings.execute({
        tenantId,
        clientId: user.sub,
        fromDate: now,
        page: 1,
        limit: 5,
      }),
      this.listNotifications.execute({
        tenantId,
        recipientId: user.sub,
        unreadOnly: true,
        page: 1,
        limit: 5,
      }),
      this.listPayments.execute({
        tenantId,
        clientId: user.sub,
        page: 1,
        limit: 3,
      }),
      this.getClient.execute({ tenantId, clientId: user.sub }),
    ]);

    return {
      profile,
      upcomingBookings: upcomingResult.data,
      unreadNotifications: notificationsResult.data,
      unreadCount: notificationsResult.meta.total,
      recentPayments: paymentsResult.data,
    };
  }
}
```

- [ ] **Step 2: Create upcoming controller**

```typescript
// src/api/mobile/client/portal/upcoming.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../../../common/guards/jwt.guard';
import { TenantId } from '../../../../common/tenant/tenant.decorator';
import { CurrentUser, JwtUser } from '../../../../common/auth/current-user.decorator';
import { PrismaService } from '../../../../infrastructure/database';

export class UpcomingQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

@ApiTags('Mobile / Client / Portal')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('mobile/client/portal/upcoming')
export class MobileClientUpcomingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get() @ApiOperation({ summary: 'Upcoming bookings with service and employee details' })
  async upcoming(@TenantId() tenantId: string, @CurrentUser() user: JwtUser, @Query() q: UpcomingQuery) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const now = new Date();

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          tenantId,
          clientId: user.sub,
          scheduledAt: { gte: now },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        orderBy: { scheduledAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          service: { select: { id: true, name: true } },
          employee: { select: { id: true, name: true, avatarUrl: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
      this.prisma.booking.count({
        where: { tenantId, clientId: user.sub, scheduledAt: { gte: now }, status: { in: ['PENDING', 'CONFIRMED'] } },
      }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
```

- [ ] **Step 3: Create summary controller**

```typescript
// src/api/mobile/client/portal/summary.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../../../common/guards/jwt.guard';
import { TenantId } from '../../../../common/tenant/tenant.decorator';
import { CurrentUser, JwtUser } from '../../../../common/auth/current-user.decorator';
import { PrismaService } from '../../../../infrastructure/database';

@ApiTags('Mobile / Client / Portal')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('mobile/client/portal/summary')
export class MobileClientSummaryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get() @ApiOperation({ summary: 'Client summary — booking count, last visit, balance' })
  async summary(@TenantId() tenantId: string, @CurrentUser() user: JwtUser) {
    const [totalBookings, lastBooking, unpaidInvoices] = await Promise.all([
      this.prisma.booking.count({ where: { tenantId, clientId: user.sub } }),
      this.prisma.booking.findFirst({
        where: { tenantId, clientId: user.sub, status: 'COMPLETED' },
        orderBy: { scheduledAt: 'desc' },
        select: { scheduledAt: true },
      }),
      this.prisma.invoice.aggregate({
        where: { tenantId, clientId: user.sub, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
        _sum: { total: true },
      }),
    ]);

    return {
      totalBookings,
      lastVisit: lastBooking?.scheduledAt ?? null,
      outstandingBalance: Number(unpaidInvoices._sum.total ?? 0),
    };
  }
}
```

- [ ] **Step 4: Register portal controllers in MobileClientModule**

```typescript
// src/api/mobile/client/mobile-client.module.ts — add imports and controllers:
import { DatabaseModule } from '../../../infrastructure/database';
import { MobileClientHomeController } from './portal/home.controller';
import { MobileClientUpcomingController } from './portal/upcoming.controller';
import { MobileClientSummaryController } from './portal/summary.controller';

// Add DatabaseModule to imports
// Add the three portal controllers to controllers array
```

- [ ] **Step 5: Commit**

```bash
git add src/api/mobile/client/portal/
git commit -m "feat(api): p16-t3/t4 mobile client portal BFF — home, upcoming, summary"
```

---

## Task 8: Mobile Employee Controllers (p16-t5)

**Files:**
- Create: `src/api/mobile/employee/schedule.controller.ts`
- Create: `src/api/mobile/employee/clients.controller.ts`
- Create: `src/api/mobile/employee/earnings.controller.ts`
- Create: `src/api/mobile/employee/mobile-employee.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create schedule controller**

```typescript
// src/api/mobile/employee/schedule.controller.ts
import { Controller, Get, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { TenantId } from '../../../common/tenant/tenant.decorator';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ListBookingsHandler } from '../../../modules/bookings/list-bookings/list-bookings.handler';
import { UpdateAvailabilityHandler } from '../../../modules/people/employees/update-availability.handler';

export class EmployeeScheduleQuery {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

@ApiTags('Mobile / Employee / Schedule')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('mobile/employee/schedule')
export class MobileEmployeeScheduleController {
  constructor(
    private readonly listBookings: ListBookingsHandler,
    private readonly updateAvailability: UpdateAvailabilityHandler,
  ) {}

  @Get('today') @ApiOperation({ summary: "Today's bookings" })
  today(@TenantId() tenantId: string, @CurrentUser() user: JwtUser) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400_000);
    return this.listBookings.execute({ tenantId, employeeId: user.sub, fromDate: today, toDate: tomorrow, page: 1, limit: 50 });
  }

  @Get('weekly') @ApiOperation({ summary: 'Weekly schedule' })
  weekly(@TenantId() tenantId: string, @CurrentUser() user: JwtUser, @Query() q: EmployeeScheduleQuery) {
    return this.listBookings.execute({
      tenantId,
      employeeId: user.sub,
      fromDate: q.fromDate ? new Date(q.fromDate) : undefined,
      toDate: q.toDate ? new Date(q.toDate) : undefined,
      page: q.page ?? 1,
      limit: q.limit ?? 100,
    });
  }

  @Patch('availability') @ApiOperation({ summary: 'Update my availability' })
  updateAvailability(@TenantId() tenantId: string, @CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    return this.updateAvailability.execute({ tenantId, employeeId: user.sub, ...body } as Parameters<typeof this.updateAvailability.execute>[0]);
  }
}
```

- [ ] **Step 2: Create clients controller (employee-scoped)**

```typescript
// src/api/mobile/employee/clients.controller.ts
import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { TenantId } from '../../../common/tenant/tenant.decorator';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { PrismaService } from '../../../infrastructure/database';

export class EmployeeClientListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsString() search?: string;
}

@ApiTags('Mobile / Employee / Clients')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('mobile/employee/clients')
export class MobileEmployeeClientsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get() @ApiOperation({ summary: "List employee's clients (distinct clients from bookings)" })
  async listMyClients(@TenantId() tenantId: string, @CurrentUser() user: JwtUser, @Query() q: EmployeeClientListQuery) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const clientIds = await this.prisma.booking.findMany({
      where: { tenantId, employeeId: user.sub },
      select: { clientId: true },
      distinct: ['clientId'],
      skip: (page - 1) * limit,
      take: limit,
    });

    const ids = clientIds.map((b) => b.clientId);
    const where = {
      id: { in: ids },
      ...(q.search ? { OR: [
        { name: { contains: q.search, mode: 'insensitive' as const } },
        { phone: { contains: q.search, mode: 'insensitive' as const } },
      ] } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({ where }),
      this.prisma.client.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  @Get(':clientId/history') @ApiOperation({ summary: 'Booking history for a specific client with this employee' })
  async clientHistory(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.prisma.booking.findMany({
      where: { tenantId, employeeId: user.sub, clientId },
      orderBy: { scheduledAt: 'desc' },
      take: 20,
      include: { service: { select: { id: true, name: true } } },
    });
  }
}
```

- [ ] **Step 3: Create earnings controller**

```typescript
// src/api/mobile/employee/earnings.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { TenantId } from '../../../common/tenant/tenant.decorator';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { PrismaService } from '../../../infrastructure/database';

export class EarningsQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

@ApiTags('Mobile / Employee / Earnings')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('mobile/employee/earnings')
export class MobileEmployeeEarningsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get() @ApiOperation({ summary: 'Monthly earnings summary' })
  async earnings(@TenantId() tenantId: string, @CurrentUser() user: JwtUser, @Query() q: EarningsQuery) {
    const now = new Date();
    const from = q.from ? new Date(q.from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = q.to ? new Date(q.to) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        employeeId: user.sub,
        status: { in: ['PAID'] },
        paidAt: { gte: from, lte: to },
      },
      include: {
        payments: { select: { amount: true, method: true } },
      },
    });

    const totalEarnings = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const byMethod: Record<string, number> = {};
    for (const inv of invoices) {
      for (const p of inv.payments) {
        byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
      }
    }

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      totalEarnings,
      invoiceCount: invoices.length,
      byMethod,
    };
  }
}
```

- [ ] **Step 4: Create MobileEmployeeModule**

```typescript
// src/api/mobile/employee/mobile-employee.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { BookingsModule } from '../../../modules/bookings/bookings.module';
import { PeopleModule } from '../../../modules/people/people.module';
import { MobileEmployeeScheduleController } from './schedule.controller';
import { MobileEmployeeClientsController } from './clients.controller';
import { MobileEmployeeEarningsController } from './earnings.controller';

@Module({
  imports: [DatabaseModule, BookingsModule, PeopleModule],
  controllers: [
    MobileEmployeeScheduleController,
    MobileEmployeeClientsController,
    MobileEmployeeEarningsController,
  ],
})
export class MobileEmployeeModule {}
```

Register in `app.module.ts`:
```typescript
import { MobileEmployeeModule } from './api/mobile/employee/mobile-employee.module';
// Add MobileEmployeeModule to imports
```

- [ ] **Step 5: Commit**

```bash
git add src/api/mobile/employee/ src/app.module.ts
git commit -m "feat(api): p16-t5 mobile employee controllers — schedule, clients, earnings"
```

---

## Task 9: Public Controllers (p16-t6)

**Files:**
- Create: `src/api/public/branding.controller.ts`
- Create: `src/api/public/catalog.controller.ts`
- Create: `src/api/public/slots.controller.ts`
- Create: `src/api/public/public.module.ts`
- Modify: `src/app.module.ts`

> **Prerequisite:** Check if `@nestjs/throttler` is installed. If not: `npm install @nestjs/throttler` (in `apps/backend`). Then register `ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }])` in `app.module.ts` imports and add `APP_GUARD` provider for `ThrottlerGuard`.

- [ ] **Step 1: Create branding.controller.ts**

```typescript
// src/api/public/branding.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/guards/jwt.guard';
import { PrismaService } from '../../infrastructure/database';

@ApiTags('Public')
@Controller('public/branding')
export class PublicBrandingController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get(':tenantSlug')
  @ApiOperation({ summary: 'Get branding config by tenant slug' })
  async getBranding(@Param('tenantSlug') tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) return null;

    return this.prisma.brandingConfig.findUnique({
      where: { tenantId: tenant.id },
    });
  }
}
```

- [ ] **Step 2: Create catalog.controller.ts**

```typescript
// src/api/public/catalog.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/guards/jwt.guard';
import { PrismaService } from '../../infrastructure/database';

@ApiTags('Public')
@Controller('public/services')
export class PublicCatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get(':tenantSlug')
  @ApiOperation({ summary: 'Get service catalog by tenant slug' })
  async getCatalog(@Param('tenantSlug') tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) return null;

    const [departments, categories, services] = await Promise.all([
      this.prisma.department.findMany({
        where: { tenantId: tenant.id },
        orderBy: { name: 'asc' },
      }),
      this.prisma.category.findMany({
        where: { tenantId: tenant.id },
        orderBy: { name: 'asc' },
      }),
      this.prisma.service.findMany({
        where: { tenantId: tenant.id, isActive: true, archivedAt: null },
        include: {
          durationOptions: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return { departments, categories, services };
  }
}
```

- [ ] **Step 3: Create slots.controller.ts**

```typescript
// src/api/public/slots.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BookingType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Public } from '../../common/guards/jwt.guard';
import { CheckAvailabilityHandler } from '../../modules/bookings/check-availability/check-availability.handler';

export class PublicSlotsQuery {
  @IsUUID() tenantId!: string;
  @IsUUID() employeeId!: string;
  @IsUUID() branchId!: string;
  @IsDateString() date!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) durationMins?: number;
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsUUID() durationOptionId?: string;
  @IsOptional() @IsEnum(BookingType) bookingType?: BookingType;
}

@ApiTags('Public')
@Controller('public/availability')
export class PublicSlotsController {
  constructor(private readonly checkAvailability: CheckAvailabilityHandler) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get()
  @ApiOperation({ summary: 'Get available slots for employee/service/date' })
  getSlots(@Query() q: PublicSlotsQuery) {
    return this.checkAvailability.execute({
      tenantId: q.tenantId,
      employeeId: q.employeeId,
      branchId: q.branchId,
      date: new Date(q.date),
      durationMins: q.durationMins,
      serviceId: q.serviceId,
      durationOptionId: q.durationOptionId,
      bookingType: q.bookingType,
    });
  }
}
```

- [ ] **Step 4: Create PublicModule**

```typescript
// src/api/public/public.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { BookingsModule } from '../../modules/bookings/bookings.module';
import { PublicBrandingController } from './branding.controller';
import { PublicCatalogController } from './catalog.controller';
import { PublicSlotsController } from './slots.controller';

@Module({
  imports: [DatabaseModule, BookingsModule],
  controllers: [PublicBrandingController, PublicCatalogController, PublicSlotsController],
})
export class PublicModule {}
```

Register in `app.module.ts`:
```typescript
import { PublicModule } from './api/public/public.module';
// Add PublicModule to imports
```

- [ ] **Step 5: Install throttler if needed and register globally**

```bash
cd apps/backend && npm list @nestjs/throttler 2>/dev/null || npm install @nestjs/throttler
```

In `app.module.ts` imports:
```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Add to imports array:
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),

// Add to providers array:
{ provide: APP_GUARD, useClass: ThrottlerGuard },
```

- [ ] **Step 6: Build check**

```bash
cd apps/backend && npx tsc --noEmit
```

Fix all errors before committing.

- [ ] **Step 7: Commit**

```bash
git add src/api/public/ src/app.module.ts
git commit -m "feat(api): p16-t6 public controllers — branding, catalog, availability slots"
```

---

## Task 10: Integration Smoke Test

- [ ] **Step 1: Start the server**

```bash
cd apps/backend && npm run dev &
sleep 5
```

- [ ] **Step 2: Verify route registration**

```bash
curl -s http://localhost:5100/api/public/branding/test-clinic | head -c 200
```

Expected: JSON response (null or branding object), not 404.

```bash
curl -s http://localhost:5100/api/dashboard/bookings \
  -H "Authorization: Bearer INVALID" | head -c 100
```

Expected: `{"statusCode":401,...}` — JWT guard is working.

```bash
curl -s "http://localhost:5100/api/public/availability?tenantId=00000000-0000-0000-0000-000000000000&employeeId=00000000-0000-0000-0000-000000000000&branchId=00000000-0000-0000-0000-000000000000&date=2026-05-01" | head -c 100
```

Expected: empty slots array `[]` or 404 — route is reachable.

- [ ] **Step 3: Run full test suite**

```bash
cd apps/backend && npm run test
```

Expected: all existing tests pass.

- [ ] **Step 4: Kill dev server and commit if all tests pass**

```bash
kill %1 2>/dev/null || true
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] p16-t1 — dashboard controllers (bookings, finance, people, org, comms, ops, platform, AI, media)
- [x] p16-t2 — mobile client controllers (bookings, profile, payments, chat, notifications)
- [x] p16-t3 — mobile portal BFF home endpoint
- [x] p16-t4 — upcoming + summary portal controllers
- [x] p16-t5 — mobile employee controllers (schedule, clients, earnings)
- [x] p16-t6 — public controllers (branding, catalog, slots) with @Throttle

**Items to verify before implementing:**
1. `tenant.findUnique({ where: { slug: ... } })` — confirm `slug` field exists on Tenant model in Prisma schema
2. `invoice.payments` relation — confirm Payment→Invoice relation is `payments` on Invoice
3. `ManageKnowledgeBaseHandler.execute()` signature — verify it accepts `{ tenantId, action, documentId }` or adjust AI controller accordingly
4. `ListConversationsHandler.execute()` — verify signature accepts `{ tenantId, clientId? }`
5. `MarkReadHandler.execute()` — verify signature to confirm correct field names

If any of the above differ from what the handler actually expects, update the controller call site to match exactly.
