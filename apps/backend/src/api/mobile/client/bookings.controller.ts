import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation,
  ApiCreatedResponse, ApiOkResponse, ApiParam, ApiResponse,
} from '@nestjs/swagger';
import { BookingStatus, CancellationReason } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ApiStandardResponses, ApiErrorDto } from '../../../common/swagger';
import { ListBookingsHandler } from '../../../modules/bookings/list-bookings/list-bookings.handler';
import { GetBookingHandler } from '../../../modules/bookings/get-booking/get-booking.handler';
import { CreateBookingHandler } from '../../../modules/bookings/create-booking/create-booking.handler';
import { CancelBookingHandler } from '../../../modules/bookings/cancel-booking/cancel-booking.handler';
import { RescheduleBookingHandler } from '../../../modules/bookings/reschedule-booking/reschedule-booking.handler';
import { RescheduleBookingDto } from '../../../modules/bookings/reschedule-booking/reschedule-booking.dto';
import { TrackUsage } from '../../../modules/platform/billing/track-usage.decorator';

export class MobileCreateBookingDto {
  @ApiProperty({ description: 'Branch where the booking takes place', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() branchId!: string;

  @ApiProperty({ description: 'Employee performing the service', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() employeeId!: string;

  @ApiProperty({ description: 'Service to be performed', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() serviceId!: string;

  @ApiProperty({ description: 'ISO 8601 start datetime', example: '2026-05-01T09:00:00.000Z' })
  @IsDateString() scheduledAt!: string;

  @ApiPropertyOptional({ description: 'Specific duration option to resolve price and duration', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() durationOptionId?: string;

  @ApiPropertyOptional({ description: 'Free-text notes for the booking', example: 'Please prepare the room in advance' })
  @IsOptional() @IsString() notes?: string;
}

export class MobileCancelBookingDto {
  @ApiProperty({ description: 'Reason for cancellation', enum: CancellationReason, enumName: 'CancellationReason', example: CancellationReason.CLIENT_REQUESTED })
  @IsEnum(CancellationReason) reason!: CancellationReason;

  @ApiPropertyOptional({ description: 'Free-text notes about the cancellation', example: 'Change of plans' })
  @IsOptional() @IsString() cancelNotes?: string;
}

export class MobileListBookingsDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ description: 'Records per page', example: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;

  @ApiPropertyOptional({ description: 'Filter by booking status', enum: BookingStatus, enumName: 'BookingStatus', example: BookingStatus.CONFIRMED })
  @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
}

@ApiTags('Mobile Client / Bookings')
@ApiBearerAuth()
@ApiStandardResponses()
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

  @Post()
  @TrackUsage('BOOKINGS_PER_MONTH')
  @ApiOperation({ summary: 'Create a booking' })
  @ApiCreatedResponse({ description: 'Booking created', schema: { type: 'object' } })
  createBooking(
    @CurrentUser() user: JwtUser,
    @Body() body: MobileCreateBookingDto,
  ) {
    return this.create.execute({
      clientId: user.sub,
      branchId: body.branchId,
      employeeId: body.employeeId,
      serviceId: body.serviceId,
      scheduledAt: new Date(body.scheduledAt),
      durationOptionId: body.durationOptionId,
      notes: body.notes,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List my bookings' })
  @ApiOkResponse({ description: 'Paginated list of the authenticated client bookings', schema: { type: 'object' } })
  listMyBookings(
    @CurrentUser() user: JwtUser,
    @Query() q: MobileListBookingsDto,
  ) {
    return this.list.execute({
      clientId: user.sub,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
      status: q.status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a booking by ID' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking detail', schema: { type: 'object' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  getBooking(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.get.execute({ bookingId: id });
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking cancelled', schema: { type: 'object' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  cancelBooking(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MobileCancelBookingDto,
  ) {
    return this.cancel.execute({
      bookingId: id,
      reason: body.reason,
      cancelNotes: body.cancelNotes,
      changedBy: user.sub,
      source: 'client',
    });
  }

  @Patch(':id/reschedule')
  @ApiOperation({ summary: 'Reschedule a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking rescheduled', schema: { type: 'object' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  rescheduleBooking(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RescheduleBookingDto,
  ) {
    return this.reschedule.execute({
      bookingId: id,
      newScheduledAt: new Date(body.newScheduledAt),
      newDurationMins: body.newDurationMins,
      changedBy: user.sub,
    });
  }
}
