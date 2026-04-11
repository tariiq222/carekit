import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { RefundType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CancelApproveDto {
  @ApiProperty({ enum: RefundType, description: 'How the refund should be processed' })
  @IsEnum(RefundType)
  @IsNotEmpty()
  refundType!: RefundType;

  @ApiPropertyOptional({ description: 'Refund amount in halalas — required when refundType is partial', minimum: 1 })
  @ValidateIf((o) => o.refundType === RefundType.partial)
  @IsInt()
  @Min(1)
  refundAmount?: number; // halalat — required when refundType is 'partial'

  @ApiPropertyOptional({ description: 'Internal admin notes (not visible to patient)', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}
