import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { BookingStatus, BookingType, CancellationReason, RecurringFrequency } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, IsBoolean, IsNumber, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId, UserId } from '../../common/tenant/tenant.decorator';
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

@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/bookings')
export class DashboardBookingsController {
  constructor(
    private readonly createHandler: CreateBookingHandler,
    private readonly createRecurringHandler: CreateRecurringBookingHandler,
    private readonly listHandler: ListBookingsHandler,
    private readonly getHandler: GetBookingHandler,
    private readonly cancelHandler: CancelBookingHandler,
    private readonly rescheduleHandler: RescheduleBookingHandler,
    private readonly confirmHandler: ConfirmBookingHandler,
    private readonly checkInHandler: CheckInBookingHandler,
    private readonly completeHandler: CompleteBookingHandler,
    private readonly noShowHandler: NoShowBookingHandler,
    private readonly waitlistHandler: AddToWaitlistHandler,
    private readonly availabilityHandler: CheckAvailabilityHandler,
  ) {}

  @Post()
  createBooking(@TenantId() tenantId: string, @Body() body: CreateBookingBody) {
    return this.createHandler.execute({
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

  @Post('recurring')
  createRecurringBooking(@TenantId() tenantId: string, @Body() body: CreateRecurringBookingBody) {
    return this.createRecurringHandler.execute({
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

  @Get()
  listBookings(@TenantId() tenantId: string, @Query() q: ListBookingsQuery) {
    return this.listHandler.execute({
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

  @Get('availability')
  checkAvailability(@TenantId() tenantId: string, @Query() q: CheckAvailabilityQuery) {
    return this.availabilityHandler.execute({
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

  @Get(':id')
  getBooking(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.getHandler.execute({ tenantId, bookingId: id });
  }

  @Patch(':id/cancel')
  cancelBooking(
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelBookingBody,
  ) {
    return this.cancelHandler.execute({
      tenantId,
      bookingId: id,
      reason: body.reason,
      cancelNotes: body.cancelNotes,
      changedBy: userId,
    });
  }

  @Patch(':id/reschedule')
  rescheduleBooking(
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RescheduleBookingBody,
  ) {
    return this.rescheduleHandler.execute({
      tenantId,
      bookingId: id,
      newScheduledAt: new Date(body.newScheduledAt),
      newDurationMins: body.newDurationMins,
      changedBy: userId,
    });
  }

  @Patch(':id/confirm')
  @HttpCode(HttpStatus.OK)
  confirmBooking(
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.confirmHandler.execute({ tenantId, bookingId: id, changedBy: userId });
  }

  @Patch(':id/check-in')
  @HttpCode(HttpStatus.OK)
  checkInBooking(
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.checkInHandler.execute({ tenantId, bookingId: id, changedBy: userId });
  }

  @Patch(':id/complete')
  @HttpCode(HttpStatus.OK)
  completeBooking(
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CompleteBookingBody,
  ) {
    return this.completeHandler.execute({
      tenantId,
      bookingId: id,
      completionNotes: body.completionNotes,
      changedBy: userId,
    });
  }

  @Patch(':id/no-show')
  @HttpCode(HttpStatus.OK)
  noShowBooking(
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.noShowHandler.execute({ tenantId, bookingId: id, changedBy: userId });
  }

  @Post('waitlist')
  addToWaitlist(@TenantId() tenantId: string, @Body() body: AddToWaitlistBody) {
    return this.waitlistHandler.execute({
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
