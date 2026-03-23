import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

export class CancelApproveDto {
  @IsEnum(['full', 'partial', 'none'])
  @IsNotEmpty()
  refundType!: 'full' | 'partial' | 'none';

  @ValidateIf((o) => o.refundType === 'partial')
  @IsInt()
  @Min(1)
  refundAmount?: number; // halalat — required when refundType is 'partial'

  @IsOptional()
  @IsString()
  adminNotes?: string;
}
