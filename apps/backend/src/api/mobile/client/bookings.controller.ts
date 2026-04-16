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
import { BookingStatus, CancellationReason } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ListBookingsHandler } from '../../../modules/bookings/list-bookings/list-bookings.handler';
import { GetBookingHandler } from '../../../modules/bookings/get-booking/get-booking.handler';
import { CreateBookingHandler } from '../../../modules/bookings/create-booking/create-booking.handler';
import { CancelBookingHandler } from '../../../modules/bookings/cancel-booking/cancel-booking.handler';
import { RescheduleBookingHandler } from '../../../modules/bookings/reschedule-booking/reschedule-booking.handler';
import { RescheduleBookingDto } from '../../../modules/bookings/reschedule-booking/reschedule-booking.dto';

export class MobileCreateBookingDto {
  @IsUUID() branchId!: string;
  @IsUUID() employeeId!: string;
  @IsUUID() serviceId!: string;
  @IsDateString() scheduledAt!: string;
  @IsOptional() @IsUUID() durationOptionId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class MobileCancelBookingDto {
  @IsEnum(CancellationReason) reason!: CancellationReason;
  @IsOptional() @IsString() cancelNotes?: string;
}

export class MobileListBookingsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
}

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
  getBooking(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.get.execute({ bookingId: id });
  }

  @Patch(':id/cancel')
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
