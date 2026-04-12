import { Controller, Get, Query } from '@nestjs/common';
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

@Controller('public/availability')
export class PublicSlotsController {
  constructor(private readonly checkAvailability: CheckAvailabilityHandler) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get()
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
