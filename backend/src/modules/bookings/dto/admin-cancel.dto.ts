import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { RefundType } from '@prisma/client';

export class AdminCancelDto {
  @IsEnum(RefundType)
  refundType!: RefundType;

  @IsOptional()
  @IsInt()
  @Min(1)
  refundAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}
