import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { RefundType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminCancelDto {
  @ApiProperty({ enum: RefundType, description: 'How the refund should be processed' })
  @IsEnum(RefundType)
  refundType!: RefundType;

  @ApiPropertyOptional({ description: 'Refund amount in halalas (required when refundType is partial)', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  refundAmount?: number;

  @ApiPropertyOptional({ description: 'Reason for cancellation shown to patient', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @ApiPropertyOptional({ description: 'Internal admin notes (not visible to patient)', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}
