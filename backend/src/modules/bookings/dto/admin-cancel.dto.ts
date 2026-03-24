import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AdminCancelDto {
  @IsEnum(['full', 'partial', 'none'])
  refundType!: 'full' | 'partial' | 'none';

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
