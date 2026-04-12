import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class RescheduleBookingDto {
  @IsDateString() newScheduledAt!: string;
  @IsOptional() @IsInt() @Min(1) newDurationMins?: number;
}
