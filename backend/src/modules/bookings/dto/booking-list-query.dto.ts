import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus, BookingType } from '@prisma/client';

export class BookingListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perPage?: number;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsEnum(BookingType)
  type?: BookingType;

  @IsOptional()
  @IsUUID()
  practitionerId?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateFrom must be in YYYY-MM-DD format' })
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateTo must be in YYYY-MM-DD format' })
  dateTo?: string;
}
