import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';
import { RefundType } from '@prisma/client';

export class CancelApproveDto {
  @IsEnum(RefundType)
  @IsNotEmpty()
  refundType!: RefundType;

  @ValidateIf((o) => o.refundType === RefundType.partial)
  @IsInt()
  @Min(1)
  refundAmount?: number; // halalat — required when refundType is 'partial'

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}
