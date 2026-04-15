import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId, UserId } from '../../common/tenant/tenant.decorator';
import { CreateBookingHandler } from '../../modules/bookings/create-booking/create-booking.handler';
import { CreateBookingDto } from '../../modules/bookings/create-booking/create-booking.dto';
import { CreateRecurringBookingHandler } from '../../modules/bookings/create-recurring-booking/create-recurring-booking.handler';
import { CreateRecurringBookingDto } from '../../modules/bookings/create-recurring-booking/create-recurring-booking.dto';
import { ListBookingsHandler } from '../../modules/bookings/list-bookings/list-bookings.handler';
import { ListBookingsDto } from '../../modules/bookings/list-bookings/list-bookings.dto';
import { GetBookingHandler } from '../../modules/bookings/get-booking/get-booking.handler';
import { CancelBookingHandler } from '../../modules/bookings/cancel-booking/cancel-booking.handler';
import { CancelBookingDto } from '../../modules/bookings/cancel-booking/cancel-booking.dto';
import { RescheduleBookingHandler } from '../../modules/bookings/reschedule-booking/reschedule-booking.handler';
import { RescheduleBookingDto } from '../../modules/bookings/reschedule-booking/reschedule-booking.dto';
import { ConfirmBookingHandler } from '../../modules/bookings/confirm-booking/confirm-booking.handler';
import { CheckInBookingHandler } from '../../modules/bookings/check-in-booking/check-in-booking.handler';
import { CompleteBookingHandler } from '../../modules/bookings/complete-booking/complete-booking.handler';
import { CompleteBookingDto } from '../../modules/bookings/complete-booking/complete-booking.dto';
import { NoShowBookingHandler } from '../../modules/bookings/no-show-booking/no-show-booking.handler';
import { AddToWaitlistHandler } from '../../modules/bookings/add-to-waitlist/add-to-waitlist.handler';
import { AddToWaitlistDto } from '../../modules/bookings/add-to-waitlist/add-to-waitlist.dto';
import { ListWaitlistHandler } from '../../modules/bookings/list-waitlist/list-waitlist.handler';
import { ListWaitlistDto } from '../../modules/bookings/list-waitlist/list-waitlist.dto';
import { RemoveWaitlistEntryHandler } from '../../modules/bookings/remove-waitlist-entry/remove-waitlist-entry.handler';
import { CheckAvailabilityHandler } from '../../modules/bookings/check-availability/check-availability.handler';
import { CheckAvailabilityDto } from '../../modules/bookings/check-availability/check-availability.dto';

@ApiTags('Bookings')
@ApiBearerAuth()
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
    private readonly listWaitlistHandler: ListWaitlistHandler,
    private readonly removeWaitlistHandler: RemoveWaitlistEntryHandler,
    private readonly availabilityHandler: CheckAvailabilityHandler,
  ) {}

  @Post()
  createBooking(@TenantId() tenantId: string, @Body() body: CreateBookingDto) {
    const { scheduledAt, expiresAt, ...rest } = body;
    return this.createHandler.execute({
      tenantId,
      ...rest,
      scheduledAt: new Date(scheduledAt),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });
  }

  @Post('recurring')
  createRecurringBooking(
    @TenantId() tenantId: string,
    @Body() body: CreateRecurringBookingDto,
  ) {
    const { scheduledAt, expiresAt, until, customDates, ...rest } = body;
    return this.createRecurringHandler.execute({
      tenantId,
      ...rest,
      scheduledAt: new Date(scheduledAt),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      until: until ? new Date(until) : undefined,
      customDates: customDates?.map((d) => new Date(d)),
    });
  }

  @Get()
  listBookings(@TenantId() tenantId: string, @Query() q: ListBookingsDto) {
    const { page, limit, fromDate, toDate, ...rest } = q;
    return this.listHandler.execute({
      tenantId,
      ...rest,
      page: page ?? 1,
      limit: limit ?? 20,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });
  }

  @Get('availability')
  checkAvailability(@TenantId() tenantId: string, @Query() q: CheckAvailabilityDto) {
    const { date, ...rest } = q;
    return this.availabilityHandler.execute({
      tenantId,
      ...rest,
      date: new Date(date),
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
    @Body() body: CancelBookingDto,
  ) {
    return this.cancelHandler.execute({
      tenantId,
      bookingId: id,
      changedBy: userId,
      ...body,
    });
  }

  @Patch(':id/reschedule')
  rescheduleBooking(
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RescheduleBookingDto,
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
    @Body() body: CompleteBookingDto,
  ) {
    return this.completeHandler.execute({
      tenantId,
      bookingId: id,
      changedBy: userId,
      ...body,
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
  addToWaitlist(@TenantId() tenantId: string, @Body() body: AddToWaitlistDto) {
    const { preferredDate, ...rest } = body;
    return this.waitlistHandler.execute({
      tenantId,
      ...rest,
      preferredDate: preferredDate ? new Date(preferredDate) : undefined,
    });
  }

  @Get('waitlist')
  listWaitlist(@TenantId() tenantId: string, @Query() query: ListWaitlistDto) {
    return this.listWaitlistHandler.execute({ tenantId, ...query });
  }

  @Delete('waitlist/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeWaitlistEntry(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.removeWaitlistHandler.execute({ tenantId, id });
  }
}
