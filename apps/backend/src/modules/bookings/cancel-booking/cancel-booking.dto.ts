import { CancellationReason } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

export class CancelBookingDto {
  @IsEnum(CancellationReason) reason!: CancellationReason;
  @IsOptional() @IsString() cancelNotes?: string;
  @IsOptional() @IsIn(['client', 'admin', 'employee', 'system']) source?:
    | 'client'
    | 'admin'
    | 'employee'
    | 'system';
}
