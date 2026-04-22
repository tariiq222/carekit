import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation,
  ApiCreatedResponse, ApiOkResponse, ApiNoContentResponse, ApiParam, ApiResponse,
} from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { UserId } from '../../common/auth/user-id.decorator';
import { ApiStandardResponses } from '../../common/swagger';
import { ApiErrorDto } from '../../common/swagger';
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
import { ListBookingStatusLogHandler } from '../../modules/bookings/list-booking-status-log/list-booking-status-log.handler';
import { TrackUsage } from '../../modules/platform/billing/track-usage.decorator';

@ApiTags('Dashboard / Bookings')
@ApiBearerAuth()
@ApiStandardResponses()
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
    private readonly statusLogHandler: ListBookingStatusLogHandler,
  ) {}

  @Post()
  @TrackUsage('BOOKINGS_PER_MONTH')
  @ApiOperation({ summary: 'Create a booking' })
  @ApiCreatedResponse({ description: 'Booking created', schema: { type: 'object' } })
  createBooking(@UserId() userId: string, @Body() body: CreateBookingDto) {
    const { scheduledAt, expiresAt, ...rest } = body;
    return this.createHandler.execute({
      ...rest,
      scheduledAt: new Date(scheduledAt),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });
  }

  @Post('recurring')
  @TrackUsage('BOOKINGS_PER_MONTH')
  @ApiOperation({ summary: 'Create a recurring booking series' })
  @ApiCreatedResponse({ description: 'Recurring booking series created', schema: { type: 'object' } })
  createRecurringBooking(
    @Body() body: CreateRecurringBookingDto,
  ) {
    const { scheduledAt, expiresAt, until, customDates, ...rest } = body;
    return this.createRecurringHandler.execute({
      ...rest,
      scheduledAt: new Date(scheduledAt),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      until: until ? new Date(until) : undefined,
      customDates: customDates?.map((d) => new Date(d)),
    });
  }

  @Get()
  @ApiOperation({ summary: 'List bookings' })
  @ApiOkResponse({ description: 'Paginated list of bookings', schema: { type: 'object' } })
  listBookings(@Query() q: ListBookingsDto) {
    const { page, limit, fromDate, toDate, ...rest } = q;
    return this.listHandler.execute({
      ...rest,
      page: page ?? 1,
      limit: limit ?? 20,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });
  }

  @Get('availability')
  @ApiOperation({ summary: 'Check employee availability for a date' })
  @ApiOkResponse({ description: 'Available time slots', schema: { type: 'object' } })
  checkAvailability(@Query() q: CheckAvailabilityDto) {
    const { date, ...rest } = q;
    return this.availabilityHandler.execute({
      ...rest,
      date: new Date(date),
    });
  }

  @Get(':id/status-log')
  @ApiOperation({ summary: 'Get the status transition log for a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Status log entries (oldest first)', schema: { type: 'array' } })
  getBookingStatusLog(@Param('id', ParseUUIDPipe) id: string) {
    return this.statusLogHandler.execute({ bookingId: id });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a booking by ID' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking detail', schema: { type: 'object' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  getBooking(@Param('id', ParseUUIDPipe) id: string) {
    return this.getHandler.execute({ bookingId: id });
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking cancelled', schema: { type: 'object' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  cancelBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelBookingDto,
  ) {
    return this.cancelHandler.execute({
      bookingId: id,
      changedBy: userId,
      ...body,
    });
  }

  @Patch(':id/reschedule')
  @ApiOperation({ summary: 'Reschedule a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking rescheduled', schema: { type: 'object' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  rescheduleBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RescheduleBookingDto,
  ) {
    return this.rescheduleHandler.execute({
      bookingId: id,
      newScheduledAt: new Date(body.newScheduledAt),
      newDurationMins: body.newDurationMins,
      changedBy: userId,
    });
  }

  @Patch(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking confirmed', schema: { type: 'object' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  confirmBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.confirmHandler.execute({ bookingId: id, changedBy: userId });
  }

  @Patch(':id/check-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check in a client for a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Client checked in', schema: { type: 'object' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  checkInBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.checkInHandler.execute({ bookingId: id, changedBy: userId });
  }

  @Patch(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a booking as complete' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking marked complete', schema: { type: 'object' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  completeBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CompleteBookingDto,
  ) {
    return this.completeHandler.execute({
      bookingId: id,
      changedBy: userId,
      ...body,
    });
  }

  @Patch(':id/no-show')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a booking as no-show' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking marked as no-show', schema: { type: 'object' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  noShowBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.noShowHandler.execute({ bookingId: id, changedBy: userId });
  }

  @Post('waitlist')
  @ApiOperation({ summary: 'Add a client to the waitlist' })
  @ApiCreatedResponse({ description: 'Waitlist entry created', schema: { type: 'object' } })
  addToWaitlist(@Body() body: AddToWaitlistDto) {
    const { preferredDate, ...rest } = body;
    return this.waitlistHandler.execute({
      ...rest,
      preferredDate: preferredDate ? new Date(preferredDate) : undefined,
    });
  }

  @Get('waitlist')
  @ApiOperation({ summary: 'List waitlist entries' })
  @ApiOkResponse({ description: 'List of waitlist entries', schema: { type: 'object' } })
  listWaitlist(@Query() query: ListWaitlistDto) {
    return this.listWaitlistHandler.execute({ ...query });
  }

  @Delete('waitlist/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a waitlist entry' })
  @ApiParam({ name: 'id', description: 'Waitlist entry ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Waitlist entry removed' })
  @ApiResponse({ status: 404, description: 'Waitlist entry not found', type: ApiErrorDto })
  removeWaitlistEntry(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.removeWaitlistHandler.execute({ id });
  }
}
